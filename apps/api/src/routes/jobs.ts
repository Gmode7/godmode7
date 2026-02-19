import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireScope } from '../middlewares/requireScope.js';
import { gatesEngine, STATE_TRANSITIONS } from '@ai-native/core';
import { CreateJobSchema, TransitionSchema } from '../schemas/inline.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

router.get('/', requireScope('jobs:read'), async (req: Request, res: Response) => {
  try {
    const where = req.query.projectId ? { projectId: req.query.projectId as string } : {};
    const jobs = await prisma.job.findMany({ where, orderBy: { createdAt: 'desc' }, include: { gates: true } });
    res.json({ jobs, total: jobs.length });
  } catch (err: any) {
    console.error('[jobs/list]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.post('/', requireScope('jobs:write'), async (req: Request, res: Response) => {
  try {
    const parsed = CreateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { projectId, strategy, riskClassification } = parsed.data;
    const job = await prisma.job.create({ data: { projectId, strategy, riskClassification } });
    res.status(201).json(job);
  } catch (err: any) {
    console.error('[jobs/create]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.get('/:id', requireScope('jobs:read'), async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { artifacts: true, gates: true } });
    job ? res.json(job) : res.status(404).json({ error: 'Not found' });
  } catch (err: any) {
    console.error('[jobs/get]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.post('/:id/transition', requireScope('jobs:write'), async (req: Request, res: Response) => {
  try {
    const parsed = TransitionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { targetState } = parsed.data;

    // Load current job
    const job = await prisma.job.findUnique({ where: { id: req.params.id }, include: { gates: true } });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // FSM validation: check if transition is valid
    const validTransitions = STATE_TRANSITIONS[job.currentState];
    if (!validTransitions || !validTransitions.includes(targetState)) {
      res.status(400).json({
        error: 'Invalid state transition',
        currentState: job.currentState,
        targetState,
        validTransitions: validTransitions || [],
      });
      return;
    }

    // Check gate requirements via engine
    const passedGates = job.gates.filter(g => g.status === 'PASS').map(g => g.gateType);
    const transitions = gatesEngine.getValidTransitions(job.currentState, job.strategy, job.riskClassification, passedGates);
    const target = transitions.find(t => t.state === targetState);
    if (target && !target.allowed) {
      res.status(400).json({
        error: 'Gate requirements not met',
        currentState: job.currentState,
        targetState,
        missingGates: target.missingGates,
      });
      return;
    }

    const updated = await prisma.job.update({ where: { id: req.params.id }, data: { currentState: targetState } });
    res.json(updated);
  } catch (err: any) {
    console.error('[jobs/transition]', err);
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

export default router;
