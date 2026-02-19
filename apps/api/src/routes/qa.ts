import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { hashApiKey } from '@ai-native/core';
import { generateMarkdown, isOpenAIConfigured, OpenAIConfigError } from '../llm/openai.js';
import { getArtifactByType, getIntakeContent, getAdrArtifacts } from '../utils/artifact-helpers.js';
const router = Router();

/* ── Validation ────────────────────────────────────── */

const MatrixInputBody = z.object({
  focus: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
});

const ReportInputBody = z.object({
  context: z.string().max(4000).optional(),
});

const ChecklistInputBody = z.object({
  releaseType: z.enum(['mvp', 'v1', 'hotfix']).default('mvp'),
});

/* ── System Prompts ────────────────────────────────── */

const QA_MATRIX_PROMPT = `You are a Senior QA Engineer at GM7, a world-class AI software agency.
Your job: create a comprehensive QA Test Matrix that ensures thorough test coverage.

Output MUST be valid Markdown starting with "# QA Test Matrix".

Include these sections:

## Overview
Brief summary of what's being tested and the scope.

## Test Matrix
Create a detailed table with these columns:
| Area/Feature | Test Scenario | Inputs/Preconditions | Expected Result | Priority | Type | Automation? |

Guidelines for columns:
- Area/Feature: The functional area being tested (e.g., "User Authentication", "Payment Processing")
- Test Scenario: Clear description of what is being tested (happy path + edge cases)
- Inputs/Preconditions: Specific data, state, or conditions required
- Expected Result: Precise expected outcome (not just "it works")
- Priority: P0 (critical), P1 (important), P2 (nice to have)
- Type: unit, integration, e2e, security, performance, accessibility
- Automation?: yes/no (whether this test should/could be automated)

## Coverage Summary
- Total test scenarios
- By priority: P0 count, P1 count, P2 count
- By type breakdown
- Automation coverage percentage

## Risk Areas
Features or flows that need extra attention during testing.

Rules:
- Be specific and testable. Each scenario should be executable by a tester.
- Cover happy paths, edge cases, error conditions, and security scenarios.
- Consider input validation, authorization, data integrity, and concurrency.
- Base on provided PRD/ARCH/PLAN. Do not invent requirements.
- Target 1500-2500 words.
- Professional, clear tone.`;

const QA_REPORT_PROMPT = `You are a Senior QA Engineer at GM7, a world-class AI software agency.
Your job: produce a QA Report that assesses readiness for release.

Output MUST be valid Markdown starting with "# QA Report".

Include these sections:

## Executive Summary
- Overall verdict: SHIP / NOT READY / CONDITIONAL
- Confidence level (High/Medium/Low) and rationale
- Key blockers if any

## Risk Assessment
### Highest Risk Areas
Top 3-5 areas that could cause production issues.

### Regression Risks
Changes from PATCH.diff that could break existing functionality.

## Coverage Analysis
- Requirements coverage (what's tested vs not)
- Missing test scenarios
- Gaps in test matrix

## Code Quality Observations
Based on PATCH.diff and architecture:
- Potential bugs or issues
- Error handling gaps
- Security concerns
- Performance considerations

## Observability Assessment
- Logging adequacy
- Metrics coverage
- Alerting readiness
- Debugging capabilities

## Data Risks
- Migration risks (if applicable)
- Data integrity concerns
- Rollback considerations

## Recommendations
- Must-fix issues before release
- Should-fix issues (can be fast-followed)
- Monitoring suggestions for post-release
- Testing debt to address later

Rules:
- Be honest and objective. Flag real risks even if they delay release.
- Reference specific parts of the code (PATCH.diff) and architecture.
- Consider production realities: load, failures, user behavior.
- Target 1000-2000 words.
- Professional, clear tone.`;

const QA_CHECKLIST_PROMPT = `You are a Senior QA Engineer at GM7, a world-class AI software agency.
Your job: create a release checklist that ensures nothing is forgotten.

Output MUST be valid Markdown starting with "# QA Release Checklist".

Include these sections:

## Pre-Release Verification
Checklist items that must pass before deploying:
- [ ] Critical path tests passed
- [ ] Security scan completed
- [ ] Performance baseline met
- [ ] Error handling verified
- [ ] Documentation updated
- [ ] Rollback plan documented

## Environment Checks
- [ ] Staging environment matches production
- [ ] Database migrations tested
- [ ] Feature flags configured
- [ ] Secrets/certificates valid

## Smoke Tests (Post-Deploy)
Quick verification tests immediately after deployment:
- [ ] Application starts without errors
- [ ] Health checks pass
- [ ] Critical user flows work
- [ ] Integration points respond

## Monitoring & Rollback
- [ ] Logs are flowing
- [ ] Metrics dashboards accessible
- [ ] Alerts configured and tested
- [ ] Rollback procedure ready
- [ ] On-call engineer notified

## Post-Release Validation
- [ ] Error rates within normal range
- [ ] Performance metrics acceptable
- [ ] User feedback channels monitored
- [ ] Incident response ready

Rules:
- Make items actionable and verifiable.
- Include who should do each check if relevant.
- Tailor emphasis based on release type (MVP vs v1 vs hotfix).
- Keep it practical, not bureaucratic.
- Target 800-1500 words.
- Professional, clear tone.`;

/* ── Helper Functions ─────────────────────────────── */

function buildMatrixPrompt(
  focus: string | undefined,
  notes: string | undefined,
  intake: any,
  prd: any,
  backlog: any,
  arch: any,
  engPlan: any,
  patch: any,
  testPlan: any,
  adrs: any[],
  audit: any,
): string {
  const parts: string[] = [];

  parts.push(`# QA Test Matrix Generation Request`);

  if (focus) {
    parts.push(`\n## Focus Areas\n${focus}`);
  }

  if (notes) {
    parts.push(`\n## Additional Notes\n${notes}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown}`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document (ARCH)\n${arch.markdown}`);
  }

  if (engPlan?.markdown) {
    parts.push(`\n## Engineering Plan\n${engPlan.markdown}`);
  }

  if (backlog?.markdown) {
    parts.push(`\n## Product Backlog\n${backlog.markdown}`);
  }

  if (testPlan?.markdown) {
    parts.push(`\n## Test Plan\n${testPlan.markdown}`);
  }

  if (patch?.markdown) {
    parts.push(`\n## Implementation Patch (PATCH.diff)\n${patch.markdown}`);
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

function buildReportPrompt(
  context: string | undefined,
  matrix: any,
  intake: any,
  prd: any,
  arch: any,
  engPlan: any,
  patch: any,
  testPlan: any,
  adrs: any[],
  audit: any,
): string {
  const parts: string[] = [];

  parts.push(`# QA Report Generation Request`);

  if (context) {
    parts.push(`\n## Release Context\n${context}`);
  }

  if (matrix?.markdown) {
    parts.push(`\n## QA Test Matrix\n${matrix.markdown}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown}`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document (ARCH)\n${arch.markdown}`);
  }

  if (engPlan?.markdown) {
    parts.push(`\n## Engineering Plan\n${engPlan.markdown}`);
  }

  if (patch?.markdown) {
    parts.push(`\n## Implementation Patch (PATCH.diff)\n${patch.markdown}`);
  }

  if (testPlan?.markdown) {
    parts.push(`\n## Test Plan\n${testPlan.markdown}`);
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

function buildChecklistPrompt(
  releaseType: string,
  matrix: any,
  report: any,
  prd: any,
  arch: any,
  engPlan: any,
): string {
  const parts: string[] = [];

  parts.push(`# QA Release Checklist Generation Request`);
  parts.push(`\n## Release Type\n${releaseType.toUpperCase()}`);

  if (report?.markdown) {
    parts.push(`\n## QA Report Summary\n${report.markdown.slice(0, 2000)}...`);
  }

  if (matrix?.markdown) {
    parts.push(`\n## QA Test Matrix Summary\n${matrix.markdown.slice(0, 2000)}...`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown.slice(0, 2000)}...`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document (ARCH)\n${arch.markdown.slice(0, 2000)}...`);
  }

  if (engPlan?.markdown) {
    parts.push(`\n## Engineering Plan\n${engPlan.markdown.slice(0, 2000)}...`);
  }

  return parts.join('\n');
}

/* ── POST /jobs/:id/qa/matrix ──────────────────────── */

router.post(
  '/jobs/:id/qa/matrix',
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
      const parsed = MatrixInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { focus, notes } = parsed.data;

      // Load existing artifacts
      const intake = await getIntakeContent(jobId);
      const prd = await getArtifactByType(jobId, 'prd');
      const backlog = await getArtifactByType(jobId, 'backlog');
      const arch = await getArtifactByType(jobId, 'architecture');
      const engPlan = await getArtifactByType(jobId, 'engineering_plan');
      const patch = await getArtifactByType(jobId, 'patch');
      const testPlan = await getArtifactByType(jobId, 'test_plan');
      const adrs = await getAdrArtifacts(jobId);
      const audit = await getArtifactByType(jobId, 'audit_report');

      // Build prompt context
      const userPrompt = buildMatrixPrompt(focus, notes, intake, prd, backlog, arch, engPlan, patch, testPlan, adrs, audit);

      // LLM call
      const matrixMarkdown = await generateMarkdown({
        system: QA_MATRIX_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 6000,
      });

      // Persist artifact QA_TEST_MATRIX.md
      const payload = JSON.stringify({ markdown: matrixMarkdown, filename: 'QA_TEST_MATRIX.md', source: 'qa_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'qa_matrix', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate QA_MATRIX_DONE passed
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'QA_MATRIX_DONE' } },
        update: { status: 'PASS', reason: 'QA_TEST_MATRIX.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'QA_MATRIX_DONE', status: 'PASS', reason: 'QA_TEST_MATRIX.md artifact created', checkedAt: new Date() },
      });

      return res.json({ matrixMarkdown });
    } catch (err: any) {
      console.error('[qa/matrix]', err);

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

/* ── POST /jobs/:id/qa/report ──────────────────────── */

router.post(
  '/jobs/:id/qa/report',
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
      const parsed = ReportInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { context } = parsed.data;

      // Load existing artifacts
      const matrix = await getArtifactByType(jobId, 'qa_matrix');
      const intake = await getIntakeContent(jobId);
      const prd = await getArtifactByType(jobId, 'prd');
      const arch = await getArtifactByType(jobId, 'architecture');
      const engPlan = await getArtifactByType(jobId, 'engineering_plan');
      const patch = await getArtifactByType(jobId, 'patch');
      const testPlan = await getArtifactByType(jobId, 'test_plan');
      const adrs = await getAdrArtifacts(jobId);
      const audit = await getArtifactByType(jobId, 'audit_report');

      // Build prompt context
      const userPrompt = buildReportPrompt(context, matrix, intake, prd, arch, engPlan, patch, testPlan, adrs, audit);

      // LLM call
      const reportMarkdown = await generateMarkdown({
        system: QA_REPORT_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 6000,
      });

      // Persist artifact QA_REPORT.md
      const payload = JSON.stringify({ markdown: reportMarkdown, filename: 'QA_REPORT.md', source: 'qa_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'qa_report', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate QA_REPORT_DONE passed
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'QA_REPORT_DONE' } },
        update: { status: 'PASS', reason: 'QA_REPORT.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'QA_REPORT_DONE', status: 'PASS', reason: 'QA_REPORT.md artifact created', checkedAt: new Date() },
      });

      return res.json({ reportMarkdown });
    } catch (err: any) {
      console.error('[qa/report]', err);

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

/* ── POST /jobs/:id/qa/checklist ───────────────────── */

router.post(
  '/jobs/:id/qa/checklist',
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
      const parsed = ChecklistInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { releaseType } = parsed.data;

      // Load existing artifacts
      const matrix = await getArtifactByType(jobId, 'qa_matrix');
      const report = await getArtifactByType(jobId, 'qa_report');
      const prd = await getArtifactByType(jobId, 'prd');
      const arch = await getArtifactByType(jobId, 'architecture');
      const engPlan = await getArtifactByType(jobId, 'engineering_plan');

      // Build prompt context
      const userPrompt = buildChecklistPrompt(releaseType, matrix, report, prd, arch, engPlan);

      // LLM call
      const checklistMarkdown = await generateMarkdown({
        system: QA_CHECKLIST_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 4000,
      });

      // Persist artifact QA_CHECKLIST.md
      const payload = JSON.stringify({ markdown: checklistMarkdown, filename: 'QA_CHECKLIST.md', source: 'qa_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'qa_checklist', content: payload, hash: hashApiKey(payload) },
      });

      return res.json({ checklistMarkdown });
    } catch (err: any) {
      console.error('[qa/checklist]', err);

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
