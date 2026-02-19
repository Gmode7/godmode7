import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { hashApiKey } from '@ai-native/core';
import { claudeGenerate, isClaudeConfigured, ClaudeConfigError } from '../llm/claude.js';
import { getArtifactByType, getIntakeContent } from '../utils/artifact-helpers.js';
const router = Router();

/* ── Validation ────────────────────────────────────── */

const ArchInputBody = z.object({
  idea: z.string().min(10, 'idea must be >= 10 chars').max(4000).optional(),
  constraints: z.string().max(8000).optional(),
  stackPreferences: z.string().max(2000).optional(),
});

const AdrInputBody = z.object({
  decisions: z.array(z.string().min(5, 'decision must be >= 5 chars').max(200)).min(1).max(10),
  context: z.string().max(4000).optional(),
});

/* ── System Prompts ────────────────────────────────── */

const ARCH_SYSTEM_PROMPT = `You are the Tech Lead / Architect at GM7, a world-class AI software agency.
Your job: produce a comprehensive Architecture Document (ARCH.md) that guides the engineering team.

Output MUST be valid Markdown starting with "# Architecture Document".

Include these sections:

## System Overview
High-level description of the system, its purpose, and key capabilities.

## Goals & Non-Goals
- Goals: What this architecture achieves
- Non-goals: What is explicitly out of scope

## Architecture Diagram
Provide a text-based diagram using Mermaid or ASCII box drawing showing:
- Major components and their relationships
- External integrations
- Data flow

## Components & Responsibilities
For each major component:
- Name and purpose
- Key responsibilities
- Interfaces (inbound/outbound)
- Technology choices with brief rationale

## Data Model Overview
Key entities, their relationships, and storage approach. Include an ER diagram if helpful.

## API Surface Overview
High-level API design:
- REST endpoints or GraphQL schema outline
- Key request/response patterns
- WebSocket/events if applicable

## Security Model
- Authentication approach (OAuth, JWT, API keys, etc.)
- Authorization strategy (RBAC, ABAC)
- Key storage and secrets management
- Data protection (encryption at rest/transit)
- Rate limiting strategy
- Input validation and sanitization

## Reliability
- Timeout policies
- Retry strategies
- Circuit breakers
- Idempotency mechanisms
- Error handling patterns
- graceful degradation

## Observability
- Logging strategy (levels, correlation IDs)
- Metrics collection (business + technical)
- Alerting thresholds
- Distributed tracing

## Deployment Model
- Environment strategy (dev/staging/prod)
- Infrastructure approach (containers, serverless, etc.)
- CI/CD pipeline outline
- Rollback strategy

## Open Questions
2-3 architectural decisions or constraints that need further discussion.

Rules:
- Be specific and actionable. Include concrete numbers where applicable (timeouts, limits).
- Base on the provided PRD/intake. Do not invent requirements.
- Production-grade thinking. Consider failure modes and edge cases.
- Keep it detailed but readable. Target 1500-2500 words.
- Professional, clear tone.`;

const ADR_SYSTEM_PROMPT = `You are the Tech Lead / Architect at GM7, a world-class AI software agency.
Your job: write Architecture Decision Records (ADRs) following the standard format.

For each decision provided, generate an ADR with this exact structure:

# ADR-XXXX: <Decision Title>

## Date
<current date>

## Status
Proposed

## Context
What is the issue that we're seeing that is motivating this decision or change?
What are the forces at play (technical, political, social, project-local)?

## Decision
What is the change that we're proposing or have agreed to implement?
Be specific about the chosen approach.

## Consequences
What becomes easier or more difficult to do because of this change?

### Pros
- List positive consequences

### Cons
- List negative consequences and trade-offs

## Alternatives Considered
What other options were evaluated? Why were they rejected?

Rules:
- Each ADR should be self-contained and readable standalone.
- Be specific. Reference the provided context.
- Professional, concise tone.`;

/* ── Helper Functions ─────────────────────────────── */

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

function buildArchPrompt(
  intake: any,
  prd: any,
  backlog: any,
  body: z.infer<typeof ArchInputBody>,
  jobMeta: any,
): string {
  const parts: string[] = [];

  parts.push(`# Architecture Generation Request`);
  parts.push(`\n## Job Metadata\n- Job ID: ${jobMeta.id}\n- Strategy: ${jobMeta.strategy}\n- Risk Classification: ${jobMeta.riskClassification}`);

  if (body.stackPreferences) {
    parts.push(`\n## Stack Preferences\n${body.stackPreferences}`);
  }

  if (body.constraints) {
    parts.push(`\n## Constraints\n${body.constraints}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown}`);
  }

  if (backlog?.markdown) {
    parts.push(`\n## Product Backlog\n${backlog.markdown}`);
  }

  if (intake?.markdown) {
    parts.push(`\n## Intake Brief\n${intake.markdown}`);
  } else if (body.idea) {
    parts.push(`\n## Idea\n${body.idea}`);
  }

  return parts.join('\n');
}

function buildAdrPrompt(
  decisions: string[],
  context: string | undefined,
  arch: any,
  prd: any,
  intake: any,
): string {
  const parts: string[] = [];

  parts.push(`# ADR Generation Request`);
  parts.push(`\n## Decisions to Document\n${decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}`);

  if (context) {
    parts.push(`\n## Additional Context\n${context}`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document\n${arch.markdown}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document\n${prd.markdown}`);
  }

  if (intake?.markdown) {
    parts.push(`\n## Intake Brief\n${intake.markdown}`);
  }

  return parts.join('\n');
}

/* ── POST /jobs/:id/tech/arch ──────────────────────── */

router.post(
  '/jobs/:id/tech/arch',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      // Check Claude configuration first
      if (!isClaudeConfigured()) {
        return res.status(503).json({
          error: 'Claude not configured',
          missing: ['ANTHROPIC_API_KEY'],
        });
      }

      const { id: jobId } = req.params;
      const parsed = ArchInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const body = parsed.data;

      // Load existing artifacts
      const intake = await getIntakeContent(jobId);
      const prd = await getArtifactByType(jobId, 'prd');
      const backlog = await getArtifactByType(jobId, 'backlog');

      // Require at least some input
      if (!intake && !prd && !body.idea) {
        return res.status(400).json({
          error: 'Missing input',
          message: 'Provide idea in body, or ensure INTAKE.md or PRD.md exists for this job',
        });
      }

      // Build prompt context
      const userPrompt = buildArchPrompt(intake, prd, backlog, body, job);

      // LLM call
      const archMarkdown = await claudeGenerate({
        system: ARCH_SYSTEM_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 8000,
      });

      // Persist artifact ARCH.md
      const payload = JSON.stringify({ markdown: archMarkdown, filename: 'ARCH.md', source: 'tech_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'architecture', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate ARCH_DONE passed
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'ARCH_DONE' } },
        update: { status: 'PASS', reason: 'ARCH.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'ARCH_DONE', status: 'PASS', reason: 'ARCH.md artifact created', checkedAt: new Date() },
      });

      return res.json({ archMarkdown });
    } catch (err: any) {
      console.error('[tech/arch]', err);

      if (err instanceof ClaudeConfigError) {
        return res.status(503).json({
          error: 'Claude not configured',
          missing: ['ANTHROPIC_API_KEY'],
        });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

/* ── POST /jobs/:id/tech/adrs ──────────────────────── */

router.post(
  '/jobs/:id/tech/adrs',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      // Check Claude configuration first
      if (!isClaudeConfigured()) {
        return res.status(503).json({
          error: 'Claude not configured',
          missing: ['ANTHROPIC_API_KEY'],
        });
      }

      const { id: jobId } = req.params;
      const parsed = AdrInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { decisions, context } = parsed.data;

      // Load existing artifacts
      const arch = await getArtifactByType(jobId, 'architecture');
      const prd = await getArtifactByType(jobId, 'prd');
      const intake = await getIntakeContent(jobId);

      // Build prompt context
      const userPrompt = buildAdrPrompt(decisions, context, arch, prd, intake);

      // Generate ADRs for all decisions in one call (more efficient)
      const adrsPrompt = `${ADR_SYSTEM_PROMPT}\n\nGenerate ${decisions.length} ADR(s) for the following decisions:\n${decisions.map((d, i) => `${i + 1}. ${d}`).join('\n')}\n\nSeparate each ADR with a line containing exactly: ---ADR_SEPARATOR---`;

      const combinedMarkdown = await claudeGenerate({
        system: adrsPrompt,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 8000,
      });

      // Split the response into individual ADRs
      const adrParts = combinedMarkdown.split('---ADR_SEPARATOR---').map(s => s.trim()).filter(Boolean);

      // If we got fewer ADRs than decisions, use the whole response as one ADR
      const adrTexts = adrParts.length >= decisions.length ? adrParts.slice(0, decisions.length) : [combinedMarkdown];

      // Save each ADR as an artifact
      const savedAdrs: Array<{ filename: string; markdown: string }> = [];
      const timestamp = Date.now();

      for (let i = 0; i < decisions.length; i++) {
        const decision = decisions[i];
        const adrMarkdown = adrTexts[i] || adrTexts[0]; // Fallback to first if not enough generated
        const slug = slugify(decision);
        const filename = `ADR-${String(i + 1).padStart(4, '0')}-${slug}.md`;

        const payload = JSON.stringify({ markdown: adrMarkdown, filename, decision, source: 'tech_agent' });
        await prisma.artifact.create({
          data: {
            jobId,
            type: 'adr',
            content: payload,
            hash: hashApiKey(payload + timestamp + i), // Ensure unique hash
          },
        });

        savedAdrs.push({ filename, markdown: adrMarkdown });
      }

      return res.json({ adrs: savedAdrs });
    } catch (err: any) {
      console.error('[tech/adrs]', err);

      if (err instanceof ClaudeConfigError) {
        return res.status(503).json({
          error: 'Claude not configured',
          missing: ['ANTHROPIC_API_KEY'],
        });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

export default router;
