import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { hashApiKey } from '@ai-native/core';
import { claudeGenerate, isClaudeConfigured, ClaudeConfigError } from '../llm/claude.js';
import { getArtifactByType, getIntakeContent, getAdrArtifacts } from '../utils/artifact-helpers.js';
const router = Router();

/* ── Validation ────────────────────────────────────── */

const PlanInputBody = z.object({
  request: z.string().min(10, 'request must be >= 10 chars').max(6000),
  repoContext: z.string().max(12000).optional(),
  constraints: z.string().max(8000).optional(),
});

const PatchInputBody = z.object({
  request: z.string().min(10, 'request must be >= 10 chars').max(6000),
  targetFiles: z.array(z.string().max(200)).max(50).optional(),
  notes: z.string().max(8000).optional(),
});

const TestsInputBody = z.object({
  request: z.string().max(6000).optional(),
});

/* ── System Prompts ────────────────────────────────── */

const ENGINEERING_PLAN_PROMPT = `You are a Senior Software Engineer at GM7, a world-class AI software agency.
Your job: create a detailed engineering plan for implementing a feature or system.

Output MUST be valid Markdown starting with "# Engineering Plan".

Include these sections:

## Implementation Approach
High-level strategy for implementing the requested changes. Include key algorithms or patterns.

## File/Module Breakdown
List of files/modules to create or modify with:
- File path
- Purpose
- Key functions/classes
- Dependencies

## Key Interfaces
Define the main interfaces, types, or contracts:
- Function signatures
- Data structures
- API contracts
- Event schemas

## Security Considerations
- Input validation
- Authentication/authorization checks
- Data sanitization
- Secrets handling
- Vulnerability mitigations

## Risks & Mitigations
- Technical risks
- Integration risks
- Performance risks
- Mitigation strategies

## Step-by-Step Execution Checklist
Numbered, actionable steps that a developer can follow:
1. Step one
2. Step two
...

Rules:
- Be specific and actionable. Include concrete file paths and function names.
- Base on the provided PRD/ARCH. Do not invent requirements.
- Production-grade code quality. Consider error handling and edge cases.
- Target 1000-2000 words.
- Professional, clear tone.`;

const PATCH_GENERATION_PROMPT = `You are a Senior Software Engineer at GM7, a world-class AI software agency.
Your job: generate a unified diff patch that implements the requested changes.

Output ONLY a valid unified diff patch. No markdown code blocks, no commentary, no explanations.

The patch must:
- Start with "diff --git" lines
- Include proper file headers (--- and +++)
- Use proper @@ hunk headers
- Show context lines (use -U3 for 3 lines of context)
- Include new files with /dev/null as the old file
- Include deleted files with /dev/null as the new file

Example format:
diff --git a/src/file.ts b/src/file.ts
--- a/src/file.ts
+++ b/src/file.ts
@@ -1,5 +1,7 @@
 import foo from 'foo';
 
 export function bar() {
+  // New code here
+  const x = 1;
   return foo();
 }

Rules:
- Generate clean, production-ready code
- Include proper error handling
- Follow existing code style if repo context provided
- Ensure the patch is syntactically valid
- Only output the diff, nothing else`;

const TEST_PLAN_PROMPT = `You are a QA Engineer at GM7, a world-class AI software agency.
Your job: create a comprehensive test plan for the implementation.

Output MUST be valid Markdown starting with "# Test Plan".

Include these sections:

## Unit Tests
- Test cases for individual functions/classes
- Input/output expectations
- Mock/stub strategy

## Integration Tests
- End-to-end workflows
- External service interactions
- Database interactions

## Edge Cases
- Boundary conditions
- Error scenarios
- Race conditions
- Resource exhaustion

## Security Tests
- Input validation tests
- Authentication bypass attempts
- Injection attacks
- Privilege escalation

## Performance Tests
- Load testing scenarios
- Benchmark criteria
- Memory leak detection

## How to Run
- Test commands
- Environment setup
- CI/CD integration

Rules:
- Be specific with test case descriptions
- Include expected results for each test
- Cover both happy path and failure modes
- Target 800-1500 words.
- Professional, clear tone.`;

/* ── Helper Functions ─────────────────────────────── */

function buildPlanPrompt(
  request: string,
  repoContext: string | undefined,
  constraints: string | undefined,
  intake: any,
  prd: any,
  backlog: any,
  arch: any,
  adrs: any[],
  audit: any,
): string {
  const parts: string[] = [];

  parts.push(`# Engineering Task`);
  parts.push(`\n## Request\n${request}`);

  if (constraints) {
    parts.push(`\n## Constraints\n${constraints}`);
  }

  if (repoContext) {
    parts.push(`\n## Repository Context\n${repoContext}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown}`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document (ARCH)\n${arch.markdown}`);
  }

  if (backlog?.markdown) {
    parts.push(`\n## Product Backlog\n${backlog.markdown}`);
  }

  if (adrs.length > 0) {
    parts.push(`\n## Architecture Decision Records (ADRs)`);
    adrs.forEach((adr, i) => {
      parts.push(`\n### ADR ${i + 1}\n${adr.markdown || adr.content || JSON.stringify(adr)}`);
    });
  }

  if (audit?.markdown) {
    parts.push(`\n## Audit Report\n${audit.markdown}`);
  }

  if (intake?.markdown) {
    parts.push(`\n## Intake Brief\n${intake.markdown}`);
  }

  return parts.join('\n');
}

function buildPatchPrompt(
  request: string,
  targetFiles: string[] | undefined,
  notes: string | undefined,
  prd: any,
  arch: any,
  plan: any,
): string {
  const parts: string[] = [];

  parts.push(`# Patch Generation Request`);
  parts.push(`\n## Request\n${request}`);

  if (targetFiles && targetFiles.length > 0) {
    parts.push(`\n## Target Files\n${targetFiles.join('\n')}`);
  }

  if (notes) {
    parts.push(`\n## Additional Notes\n${notes}`);
  }

  if (plan?.markdown) {
    parts.push(`\n## Engineering Plan\n${plan.markdown}`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document (ARCH)\n${arch.markdown}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown}`);
  }

  parts.push(`\n\nGenerate a unified diff patch that implements the requested changes. Output ONLY the diff, no markdown blocks, no explanations.`);

  return parts.join('\n');
}

function buildTestPlanPrompt(
  request: string | undefined,
  prd: any,
  arch: any,
  plan: any,
  patch: any,
): string {
  const parts: string[] = [];

  parts.push(`# Test Plan Generation Request`);

  if (request) {
    parts.push(`\n## Specific Request\n${request}`);
  }

  if (patch?.markdown) {
    parts.push(`\n## Implementation Patch\n${patch.markdown}`);
  }

  if (plan?.markdown) {
    parts.push(`\n## Engineering Plan\n${plan.markdown}`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document (ARCH)\n${arch.markdown}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown}`);
  }

  return parts.join('\n');
}

function looksLikeDiff(content: string): boolean {
  const trimmed = content.trim();
  // Must start with diff --git or contain --- and +++ lines
  if (trimmed.startsWith('diff --git')) return true;
  const lines = trimmed.split('\n');
  const hasMinusMinusMinus = lines.some(l => l.startsWith('--- '));
  const hasPlusPlusPlus = lines.some(l => l.startsWith('+++ '));
  return hasMinusMinusMinus && hasPlusPlusPlus;
}

/* ── POST /jobs/:id/eng/plan ───────────────────────── */

router.post(
  '/jobs/:id/eng/plan',
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
      const parsed = PlanInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { request, repoContext, constraints } = parsed.data;

      // Load existing artifacts
      const intake = await getIntakeContent(jobId);
      const prd = await getArtifactByType(jobId, 'prd');
      const backlog = await getArtifactByType(jobId, 'backlog');
      const arch = await getArtifactByType(jobId, 'architecture');
      const adrs = await getAdrArtifacts(jobId);
      const audit = await getArtifactByType(jobId, 'audit_report');

      // Build prompt context
      const userPrompt = buildPlanPrompt(
        request,
        repoContext,
        constraints,
        intake,
        prd,
        backlog,
        arch,
        adrs,
        audit,
      );

      // LLM call
      const planMarkdown = await claudeGenerate({
        system: ENGINEERING_PLAN_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 8192,
      });

      // Persist artifact ENGINEERING_PLAN.md
      const payload = JSON.stringify({ markdown: planMarkdown, filename: 'ENGINEERING_PLAN.md', source: 'eng_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'engineering_plan', content: payload, hash: hashApiKey(payload) },
      });

      return res.json({ planMarkdown });
    } catch (err: any) {
      console.error('[eng/plan]', err);

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

/* ── POST /jobs/:id/eng/patch ──────────────────────── */

router.post(
  '/jobs/:id/eng/patch',
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
      const parsed = PatchInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { request, targetFiles, notes } = parsed.data;

      // Load existing artifacts
      const prd = await getArtifactByType(jobId, 'prd');
      const arch = await getArtifactByType(jobId, 'architecture');
      const plan = await getArtifactByType(jobId, 'engineering_plan');

      // Build prompt context
      const userPrompt = buildPatchPrompt(request, targetFiles, notes, prd, arch, plan);

      // LLM call
      const patchDiff = await claudeGenerate({
        system: PATCH_GENERATION_PROMPT,
        user: userPrompt,
        temperature: 0.2,
        maxTokens: 8192,
      });

      // Validate it looks like a diff
      const isValidDiff = looksLikeDiff(patchDiff);

      // Persist artifact PATCH.diff regardless of validation (for debugging)
      const payload = JSON.stringify({ 
        markdown: patchDiff, 
        filename: 'PATCH.diff', 
        source: 'eng_agent',
        validated: isValidDiff,
      });
      await prisma.artifact.create({
        data: { jobId, type: 'patch', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate PATCH_READY only if valid diff
      if (isValidDiff) {
        await prisma.gate.upsert({
          where: { jobId_gateType: { jobId, gateType: 'PATCH_READY' } },
          update: { status: 'PASS', reason: 'PATCH.diff artifact created and validated', checkedAt: new Date() },
          create: { jobId, gateType: 'PATCH_READY', status: 'PASS', reason: 'PATCH.diff artifact created and validated', checkedAt: new Date() },
        });
      }

      return res.json({ 
        patchDiff,
        validated: isValidDiff,
        gate: isValidDiff ? { type: 'PATCH_READY', status: 'PASS' } : null,
      });
    } catch (err: any) {
      console.error('[eng/patch]', err);

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

/* ── POST /jobs/:id/eng/tests ──────────────────────── */

router.post(
  '/jobs/:id/eng/tests',
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
      const parsed = TestsInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { request } = parsed.data;

      // Load existing artifacts
      const prd = await getArtifactByType(jobId, 'prd');
      const arch = await getArtifactByType(jobId, 'architecture');
      const plan = await getArtifactByType(jobId, 'engineering_plan');
      const patch = await getArtifactByType(jobId, 'patch');

      // Build prompt context
      const userPrompt = buildTestPlanPrompt(request, prd, arch, plan, patch);

      // LLM call
      const testPlanMarkdown = await claudeGenerate({
        system: TEST_PLAN_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 8192,
      });

      // Persist artifact TEST_PLAN.md
      const payload = JSON.stringify({ markdown: testPlanMarkdown, filename: 'TEST_PLAN.md', source: 'eng_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'test_plan', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate TESTS_PLANNED
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'TESTS_PLANNED' } },
        update: { status: 'PASS', reason: 'TEST_PLAN.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'TESTS_PLANNED', status: 'PASS', reason: 'TEST_PLAN.md artifact created', checkedAt: new Date() },
      });

      return res.json({ 
        testPlanMarkdown,
        gate: { type: 'TESTS_PLANNED', status: 'PASS' },
      });
    } catch (err: any) {
      console.error('[eng/tests]', err);

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
