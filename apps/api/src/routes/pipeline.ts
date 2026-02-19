import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashApiKey, PIPELINE_STAGES } from '@ai-native/core';
import { requireScope } from '../middlewares/requireScope.js';
import { orchestrator } from '../orchestrator/index.js';
import { subscribePipelineEvents } from '../orchestrator/events.js';

const router = Router();

/* ── Validation ────────────────────────────────────── */

const StartPipelineBody = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  brief: z.string().min(10, 'brief must be >= 10 chars').max(12000),
});

/* ── POST /pipeline/start ──────────────────────────── */

router.post(
  '/pipeline/start',
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      const parsed = StartPipelineBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        });
      }

      const { projectId, brief } = parsed.data;

      // Verify project exists
      const project = await prisma.project.findUnique({ where: { id: projectId } });
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Create job in INTAKE_PENDING state
      const job = await prisma.job.create({
        data: {
          projectId,
          strategy: 'A',
          riskClassification: 'standard',
          currentState: 'INTAKE_PENDING',
        },
      });

      // Save brief as intake_questions artifact so the intake agent has context
      const payload = JSON.stringify({ markdown: brief, idea: brief });
      await prisma.artifact.create({
        data: {
          jobId: job.id,
          type: 'intake_questions',
          content: payload,
          hash: hashApiKey(payload),
        },
      });

      // Start pipeline without awaiting (fire and forget)
      orchestrator.startPipeline(job.id).catch(err => {
        console.error(`[pipeline] Failed to start pipeline for job ${job.id}:`, err);
      });

      return res.status(201).json({
        jobId: job.id,
        status: 'started',
        currentState: 'INTAKE_PENDING',
      });
    } catch (err: any) {
      console.error('[pipeline/start]', err);
      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

/* ── GET /pipeline/:jobId/events (SSE) ─────────────── */

router.get(
  '/pipeline/:jobId/events',
  requireScope('jobs:read'),
  async (req: Request, res: Response) => {
    const { jobId } = req.params;

    // Verify job exists
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Set SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // Send initial state event
    const initialEvent = {
      jobId,
      type: 'initial_state' as const,
      data: { currentState: job.currentState },
      timestamp: new Date().toISOString(),
    };
    res.write(`data: ${JSON.stringify(initialEvent)}\n\n`);

    // Subscribe to pipeline events
    const unsubscribe = subscribePipelineEvents(jobId, (event) => {
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // Heartbeat every 30s
    const heartbeat = setInterval(() => {
      res.write(`: heartbeat\n\n`);
    }, 30_000);

    // Cleanup on client disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },
);

/* ── GET /pipeline/:jobId/status ───────────────────── */

router.get(
  '/pipeline/:jobId/status',
  requireScope('jobs:read'),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { artifacts: true, gates: true },
      });
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Compute current stage and progress
      let currentStage = 'UNKNOWN';
      let progress = 0;

      if (job.currentState === 'COMPLETED') {
        currentStage = 'COMPLETED';
        progress = PIPELINE_STAGES.length;
      } else {
        for (let i = 0; i < PIPELINE_STAGES.length; i++) {
          const stage = PIPELINE_STAGES[i];
          if (job.currentState.startsWith(stage)) {
            currentStage = stage;
            progress = i;
            if (job.currentState.endsWith('_DONE')) {
              progress = i + 1;
            }
            break;
          }
        }
      }

      return res.json({
        ...job,
        currentStage,
        progress,
        totalStages: PIPELINE_STAGES.length,
      });
    } catch (err: any) {
      console.error('[pipeline/status]', err);
      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

/* ── POST /pipeline/:jobId/retry ───────────────────── */

router.post(
  '/pipeline/:jobId/retry',
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      const { jobId } = req.params;

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Must be in a *_FAILED state
      if (!job.currentState.endsWith('_FAILED')) {
        return res.status(400).json({
          error: 'Job is not in a failed state',
          currentState: job.currentState,
        });
      }

      const stage = job.currentState.replace('_FAILED', '');

      // Fire and forget
      orchestrator.retryStage(jobId, stage).catch(err => {
        console.error(`[pipeline] Retry failed for job ${jobId}:`, err);
      });

      return res.json({
        jobId,
        status: 'retrying',
        stage,
      });
    } catch (err: any) {
      console.error('[pipeline/retry]', err);
      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

export default router;
