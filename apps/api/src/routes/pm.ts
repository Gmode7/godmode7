import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { hashApiKey } from '@ai-native/core';
import { generateMarkdown, isOpenAIConfigured, OpenAIConfigError } from '../llm/openai.js';
import { getArtifactByType, getIntakeArtifact } from '../utils/artifact-helpers.js';
const router = Router();

/* ── Validation ────────────────────────────────────── */

const PmInputBody = z.object({
  idea: z.string().min(10, 'idea must be >= 10 chars').max(4000).optional(),
  constraints: z.string().max(8000).optional(),
  productName: z.string().max(200).optional(),
  targetUsers: z.string().max(800).optional(),
});

/* ── System Prompts ────────────────────────────────── */

const PRD_SYSTEM_PROMPT = `You are the Product Manager at GM7, a world-class AI software agency.
Your job: produce a comprehensive but focused Product Requirements Document (PRD) based on the provided intake materials.

Output MUST be valid Markdown starting with "# Product Requirements Document".

Include these sections:

## Overview
2-3 sentence summary of what we're building and why.

## Problem Statement
What pain point or opportunity does this address? Who feels it most?

## Target Users / Personas
2-3 primary personas with brief descriptions, goals, and frustrations.

## Goals
- Primary goal (the one metric that matters)
- Secondary goals (2-3 supporting outcomes)

## Non-Goals
Explicitly what is NOT in scope for this phase.

## Functional Requirements
Numbered list (FR-1, FR-2, etc.) of specific, testable capabilities.
Group by user flow or feature area if applicable.

## Non-Functional Requirements
- Security: authentication, authorization, data protection
- Performance: response times, throughput, concurrency
- Reliability: uptime targets, error handling, recovery
- Scalability: growth expectations
- Compliance: any regulatory needs

## Data Model (High-Level)
Key entities and relationships. Use simple text diagrams if helpful.

## API Surface (High-Level)
Key endpoints or capabilities the system must expose. Not implementation details.

## Milestones
Phased delivery approach with 3-4 milestones, each with clear deliverables.

## Risks & Mitigations
Top 3-5 risks with concrete mitigation strategies.

## Open Questions
2-3 questions the team should resolve before/during implementation.

Rules:
- Be specific and actionable. Avoid vague language like "should be fast."
- Base everything on the provided context. Do not invent features.
- Keep it detailed but concise. Target 1000-1500 words.
- Professional, clear tone.`;

const BACKLOG_SYSTEM_PROMPT = `You are the Product Manager at GM7, a world-class AI software agency.
Your job: transform a PRD or intake brief into a structured product backlog.

Output MUST be valid Markdown starting with "# Product Backlog".

Include these sections:

## Epics
List 3-6 epics that group related functionality. Each epic should have:
- ID (e.g., E1, E2)
- Name
- Brief description
- Success criteria

## User Stories
For each epic, list user stories with:
- ID (e.g., E1-US1)
- "As a [role], I want [goal], so that [benefit]"
- Acceptance criteria (Given/When/Then format)
- Priority: P0 (must have), P1 (should have), P2 (nice to have)
- Rough estimation: S (small, 1-2 days), M (medium, 3-5 days), L (large, 1-2 weeks)

## Dependencies
Map dependencies between stories/epics. What must be done first?

## Sprint Suggestion
Suggest how stories might be grouped into 2-3 sprints/milestones for initial delivery.

Rules:
- All stories must be INVEST (Independent, Negotiable, Valuable, Estimable, Small, Testable).
- Acceptance criteria must be testable.
- Prioritize ruthlessly. Not everything is P0.
- Base on the provided PRD/intake. Do not invent scope.
- Professional, clear tone.`;

/* ── Helper Functions ─────────────────────────────── */

function buildPrdPrompt(intake: any, body: z.infer<typeof PmInputBody>, jobMeta: any): string {
  const parts: string[] = [];

  if (body.productName) {
    parts.push(`Product Name: ${body.productName}`);
  }

  if (body.targetUsers) {
    parts.push(`Target Users: ${body.targetUsers}`);
  }

  if (intake?.markdown) {
    parts.push(`\n## Intake Brief\n${intake.markdown}`);
  } else if (body.idea) {
    parts.push(`\n## Idea\n${body.idea}`);
  }

  if (body.constraints) {
    parts.push(`\n## Constraints\n${body.constraints}`);
  }

  parts.push(`\n## Job Metadata\n- Job ID: ${jobMeta.id}\n- Strategy: ${jobMeta.strategy}\n- Risk Classification: ${jobMeta.riskClassification}`);

  return parts.join('\n');
}

function buildBacklogPrompt(prd: any, intake: any, body: z.infer<typeof PmInputBody>): string {
  const parts: string[] = [];

  if (body.productName) {
    parts.push(`Product Name: ${body.productName}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document\n${prd.markdown}`);
  } else if (intake?.markdown) {
    parts.push(`\n## Intake Brief\n${intake.markdown}`);
  } else if (body.idea) {
    parts.push(`\n## Idea\n${body.idea}`);
  }

  if (body.constraints) {
    parts.push(`\n## Constraints\n${body.constraints}`);
  }

  if (body.targetUsers) {
    parts.push(`\n## Target Users\n${body.targetUsers}`);
  }

  return parts.join('\n');
}

/* ── POST /jobs/:id/pm/prd ─────────────────────────── */

router.post(
  '/jobs/:id/pm/prd',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      // Check OpenAI configuration first
      if (!isOpenAIConfigured()) {
        return res.status(503).json({
          error: 'OpenAI not configured',
          missing: ['OPENAI_API_KEY'],
        });
      }

      const { id: jobId } = req.params;
      const parsed = PmInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const body = parsed.data;

      // Require at least idea in body or existing intake artifact
      const intake = await getIntakeArtifact(jobId);
      if (!body.idea && !intake.content) {
        return res.status(400).json({
          error: 'Missing input',
          message: 'Provide idea in body, or ensure INTAKE.md (intake_brief artifact) exists for this job',
        });
      }

      // Build prompt context
      const userPrompt = buildPrdPrompt(intake.content, body, job);

      // LLM call
      const prdMarkdown = await generateMarkdown({
        system: PRD_SYSTEM_PROMPT,
        user: userPrompt,
        temperature: 0.4,
        maxTokens: 6000,
      });

      // Persist artifact PRD.md (create new version each time)
      const payload = JSON.stringify({ markdown: prdMarkdown, source: 'pm_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'prd', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate PRD_DONE passed
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'PRD_DONE' } },
        update: { status: 'PASS', reason: 'PRD.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'PRD_DONE', status: 'PASS', reason: 'PRD.md artifact created', checkedAt: new Date() },
      });

      return res.json({ prdMarkdown });
    } catch (err: any) {
      console.error('[pm/prd]', err);

      if (err instanceof OpenAIConfigError) {
        return res.status(503).json({
          error: 'OpenAI not configured',
          missing: ['OPENAI_API_KEY'],
        });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

/* ── POST /jobs/:id/pm/backlog ─────────────────────── */

router.post(
  '/jobs/:id/pm/backlog',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      // Check OpenAI configuration first
      if (!isOpenAIConfigured()) {
        return res.status(503).json({
          error: 'OpenAI not configured',
          missing: ['OPENAI_API_KEY'],
        });
      }

      const { id: jobId } = req.params;
      const parsed = PmInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const body = parsed.data;

      // Load PRD if exists, else intake
      const prd = await getArtifactByType(jobId, 'prd');
      const intake = await getIntakeArtifact(jobId);

      if (!prd && !intake.content && !body.idea) {
        return res.status(400).json({
          error: 'Missing input',
          message: 'Provide idea in body, or ensure PRD.md or INTAKE.md exists for this job',
        });
      }

      // Build prompt context
      const userPrompt = buildBacklogPrompt(prd, intake.content, body);

      // LLM call
      const backlogMarkdown = await generateMarkdown({
        system: BACKLOG_SYSTEM_PROMPT,
        user: userPrompt,
        temperature: 0.4,
        maxTokens: 6000,
      });

      // Persist artifact BACKLOG.md (create new version each time)
      const payload = JSON.stringify({ markdown: backlogMarkdown, source: 'pm_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'backlog', content: payload, hash: hashApiKey(payload) },
      });

      return res.json({ backlogMarkdown });
    } catch (err: any) {
      console.error('[pm/backlog]', err);

      if (err instanceof OpenAIConfigError) {
        return res.status(503).json({
          error: 'OpenAI not configured',
          missing: ['OPENAI_API_KEY'],
        });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

export default router;
