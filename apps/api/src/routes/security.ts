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

const ThreatModelInputBody = z.object({
  context: z.string().max(4000).optional(),
  assets: z.string().max(2000).optional(),
  attackSurface: z.string().max(2000).optional(),
});

const FindingsInputBody = z.object({
  codeContext: z.string().max(16000).optional(),
  notes: z.string().max(4000).optional(),
});

const FixPlanInputBody = z.object({
  target: z.enum(['mvp', 'prod', 'hardening']).default('prod'),
});

/* ── System Prompts ────────────────────────────────── */

const THREAT_MODEL_PROMPT = `You are a Security Architect at GM7, a world-class AI software agency.
Your job: create a comprehensive Threat Model for the system.

Output MUST be valid Markdown starting with "# Threat Model".

Include these sections:

## System Summary
Brief description of what the system does, its architecture, and key components.

## Assets to Protect
List of valuable assets that need protection:
- Data assets (user data, credentials, PII, financial data)
- Infrastructure assets (servers, databases, APIs)
- Cryptographic assets (keys, tokens, certificates)
- Business logic assets (algorithms, configurations)

## Threat Actors
Identify potential attackers:
- External attackers (anonymous, script kiddies, organized crime)
- Insider threats (employees, contractors)
- Nation-state actors
- Competitors
- Malicious users

## Entry Points / Trust Boundaries
- External interfaces (APIs, web UI, mobile apps)
- Internal boundaries (microservices, databases)
- Third-party integrations
- Administrative interfaces

## Abuse Cases
Specific ways the system could be misused:
- Credential stuffing attacks
- Data exfiltration
- Privilege escalation
- Business logic abuse
- Resource exhaustion

## STRIDE Analysis
For each major component, analyze:
- **Spoofing**: Can an attacker pretend to be someone else?
- **Tampering**: Can data be modified without authorization?
- **Repudiation**: Can actions be performed without leaving traces?
- **Information Disclosure**: Can sensitive data be exposed?
- **Denial of Service**: Can the system be made unavailable?
- **Elevation of Privilege**: Can users gain unauthorized access?

## Mitigations
Concrete security controls:
- Authentication mechanisms (MFA, session management)
- Authorization (RBAC, ABAC, least privilege)
- Input validation and sanitization
- Rate limiting and throttling
- Secrets management
- Encryption (at rest, in transit)
- Logging and monitoring
- Network isolation

## Residual Risk
Risks that remain after mitigations, with justification for acceptance.

Rules:
- Be specific to the system described in PRD/ARCH.
- Prioritize realistic threats over theoretical ones.
- Mitigations must be actionable.
- Target 1500-2500 words.
- Professional, security-focused tone.`;

const SECURITY_FINDINGS_PROMPT = `You are a Security Auditor at GM7, a world-class AI software agency.
Your job: identify security vulnerabilities and produce actionable findings.

Output MUST be valid Markdown starting with "# Security Findings".

Include these sections:

## Executive Summary
- Total findings by severity
- Overall security posture
- Immediate actions required

## Top 5 Risks
Brief list of the most critical issues that need immediate attention.

## Detailed Findings
For each finding, include:

### Finding ID-XXX: [Title]
- **Severity**: Critical / High / Medium / Low
- **Category**: AuthN/AuthZ, Secrets, Injection, DoS, Supply-chain, Data leak, Configuration, Business Logic
- **Location**: File, endpoint, or component affected
- **Evidence**: Specific code snippet, behavior, or configuration (cite source)
- **Impact**: What could happen if exploited
- **Recommendation**: Concrete fix with code example if applicable
- **Effort**: Rough estimate (Hours/Days/Weeks)

Categories to consider:
- Authentication/Authorization flaws
- Injection vulnerabilities (SQL, NoSQL, XSS, Command)
- Sensitive data exposure
- Insecure deserialization
- Security misconfiguration
- Insufficient logging/monitoring
- Secrets hardcoded in code
- Insecure cryptographic practices
- Race conditions
- SSRF / URL validation issues
- CORS misconfigurations
- File upload vulnerabilities

## Risk Matrix
Visual or tabular summary of findings with severity vs likelihood.

## Appendix: Methodology
Brief note on how findings were identified (code review, architecture analysis, etc.).

Rules:
- Only report issues with evidence from provided artifacts/code.
- Cite specific files/lines when codeContext is provided.
- Prioritize exploitable vulnerabilities over theoretical concerns.
- Include concrete remediation steps.
- Target 1500-3000 words depending on complexity.
- Professional, direct tone.`;

const SECURITY_FIX_PLAN_PROMPT = `You are a Security Engineering Lead at GM7, a world-class AI software agency.
Your job: create an actionable security fix plan prioritized by risk and effort.

Output MUST be valid Markdown starting with "# Security Fix Plan".

Include these sections:

## Overview
- Target environment (MVP/Prod/Hardening)
- Timeline recommendation
- Resource requirements

## Fix Priorities

### Critical (Fix Immediately)
Tasks that must be completed before release:
- Task ID, description, owner, effort
- Acceptance criteria
- Verification steps

### High (Fix Before Production)
Tasks that should be completed within sprint:
- Task ID, description, owner, effort
- Acceptance criteria
- Verification steps

### Medium (Fix in Next Sprint)
Tasks for the next development cycle:
- Task ID, description, owner, effort
- Acceptance criteria

### Low (Address in Hardening)
Tasks for security hardening phase:
- Task ID, description, owner, effort

## Implementation Order
Suggested sequence of fixes considering dependencies:
1. Step one (with rationale)
2. Step two (with rationale)
...

## Verification Commands
Specific commands or tests to verify each fix:
- Unit test examples
- Integration test commands
- Security scan commands
- Manual verification steps

## Acceptance Criteria
Overall definition of done for the security fix phase:
- All Critical/High findings resolved
- Security tests passing
- Code review completed
- Security sign-off obtained

## Post-Implementation Monitoring
- Alerts to configure
- Metrics to watch
- Incident response readiness

Rules:
- Be practical and realistic about effort estimates.
- Consider engineering capacity and business priorities.
- Include specific, testable acceptance criteria.
- Target 1000-2000 words.
- Professional, actionable tone.`;

/* ── Helper Functions ─────────────────────────────── */

function buildThreatModelPrompt(
  context: string | undefined,
  assets: string | undefined,
  attackSurface: string | undefined,
  intake: any,
  prd: any,
  arch: any,
  engPlan: any,
  adrs: any[],
): string {
  const parts: string[] = [];

  parts.push(`# Threat Model Generation Request`);

  if (context) {
    parts.push(`\n## Deployment Context\n${context}`);
  }

  if (assets) {
    parts.push(`\n## Known Assets\n${assets}`);
  }

  if (attackSurface) {
    parts.push(`\n## Known Attack Surface\n${attackSurface}`);
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

  if (adrs.length > 0) {
    parts.push(`\n## Architecture Decision Records (ADRs)`);
    adrs.forEach((adr, i) => {
      parts.push(`\n### ADR ${i + 1}\n${adr.markdown || adr.content || JSON.stringify(adr)}`);
    });
  }

  if (intake?.markdown) {
    parts.push(`\n## Intake Brief\n${intake.markdown}`);
  }

  return parts.join('\n');
}

function buildFindingsPrompt(
  codeContext: string | undefined,
  notes: string | undefined,
  threatModel: any,
  intake: any,
  prd: any,
  arch: any,
  engPlan: any,
  patch: any,
  qaReport: any,
  adrs: any[],
  audit: any,
): string {
  const parts: string[] = [];

  parts.push(`# Security Findings Generation Request`);

  if (notes) {
    parts.push(`\n## Additional Notes\n${notes}`);
  }

  if (threatModel?.markdown) {
    parts.push(`\n## Threat Model\n${threatModel.markdown}`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document (ARCH)\n${arch.markdown}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown}`);
  }

  if (engPlan?.markdown) {
    parts.push(`\n## Engineering Plan\n${engPlan.markdown}`);
  }

  if (patch?.markdown) {
    parts.push(`\n## Implementation Patch (PATCH.diff)\n${patch.markdown}`);
  }

  if (codeContext) {
    parts.push(`\n## Code Context\n\`\`\`\n${codeContext}\n\`\`\``);
  }

  if (qaReport?.markdown) {
    parts.push(`\n## QA Report\n${qaReport.markdown}`);
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

function buildFixPlanPrompt(
  target: string,
  findings: any,
  threatModel: any,
  arch: any,
  prd: any,
): string {
  const parts: string[] = [];

  parts.push(`# Security Fix Plan Generation Request`);
  parts.push(`\n## Target Environment\n${target.toUpperCase()}`);

  if (findings?.markdown) {
    parts.push(`\n## Security Findings\n${findings.markdown}`);
  } else if (threatModel?.markdown) {
    parts.push(`\n## Threat Model (for generating fix plan)\n${threatModel.markdown}`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Document (ARCH)\n${arch.markdown}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements Document (PRD)\n${prd.markdown}`);
  }

  return parts.join('\n');
}

/* ── POST /jobs/:id/security/threat-model ──────────── */

router.post(
  '/jobs/:id/security/threat-model',
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
      const parsed = ThreatModelInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { context, assets, attackSurface } = parsed.data;

      // Load existing artifacts
      const intake = await getIntakeContent(jobId);
      const prd = await getArtifactByType(jobId, 'prd');
      const arch = await getArtifactByType(jobId, 'architecture');
      const engPlan = await getArtifactByType(jobId, 'engineering_plan');
      const adrs = await getAdrArtifacts(jobId);

      // Build prompt context
      const userPrompt = buildThreatModelPrompt(context, assets, attackSurface, intake, prd, arch, engPlan, adrs);

      // LLM call
      const threatModelMarkdown = await generateMarkdown({
        system: THREAT_MODEL_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 6000,
      });

      // Persist artifact THREAT_MODEL.md
      const payload = JSON.stringify({ markdown: threatModelMarkdown, filename: 'THREAT_MODEL.md', source: 'security_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'threat_model', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate THREAT_MODEL_DONE passed
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'THREAT_MODEL_DONE' } },
        update: { status: 'PASS', reason: 'THREAT_MODEL.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'THREAT_MODEL_DONE', status: 'PASS', reason: 'THREAT_MODEL.md artifact created', checkedAt: new Date() },
      });

      return res.json({ threatModelMarkdown });
    } catch (err: any) {
      console.error('[security/threat-model]', err);

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

/* ── POST /jobs/:id/security/findings ──────────────── */

router.post(
  '/jobs/:id/security/findings',
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
      const parsed = FindingsInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { codeContext, notes } = parsed.data;

      // Load existing artifacts
      const threatModel = await getArtifactByType(jobId, 'threat_model');
      const intake = await getIntakeContent(jobId);
      const prd = await getArtifactByType(jobId, 'prd');
      const arch = await getArtifactByType(jobId, 'architecture');
      const engPlan = await getArtifactByType(jobId, 'engineering_plan');
      const patch = await getArtifactByType(jobId, 'patch');
      const qaReport = await getArtifactByType(jobId, 'qa_report');
      const adrs = await getAdrArtifacts(jobId);
      const audit = await getArtifactByType(jobId, 'audit_report');

      // Build prompt context
      const userPrompt = buildFindingsPrompt(
        codeContext,
        notes,
        threatModel,
        intake,
        prd,
        arch,
        engPlan,
        patch,
        qaReport,
        adrs,
        audit,
      );

      // LLM call
      const findingsMarkdown = await generateMarkdown({
        system: SECURITY_FINDINGS_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 6000,
      });

      // Persist artifact SECURITY_FINDINGS.md
      const payload = JSON.stringify({ markdown: findingsMarkdown, filename: 'SECURITY_FINDINGS.md', source: 'security_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'security_findings', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate SECURITY_REVIEW_DONE passed
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'SECURITY_REVIEW_DONE' } },
        update: { status: 'PASS', reason: 'SECURITY_FINDINGS.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'SECURITY_REVIEW_DONE', status: 'PASS', reason: 'SECURITY_FINDINGS.md artifact created', checkedAt: new Date() },
      });

      return res.json({ findingsMarkdown });
    } catch (err: any) {
      console.error('[security/findings]', err);

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

/* ── POST /jobs/:id/security/fix-plan ──────────────── */

router.post(
  '/jobs/:id/security/fix-plan',
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
      const parsed = FixPlanInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { target } = parsed.data;

      // Load existing artifacts
      const findings = await getArtifactByType(jobId, 'security_findings');
      const threatModel = await getArtifactByType(jobId, 'threat_model');
      const arch = await getArtifactByType(jobId, 'architecture');
      const prd = await getArtifactByType(jobId, 'prd');

      // Build prompt context
      const userPrompt = buildFixPlanPrompt(target, findings, threatModel, arch, prd);

      // LLM call
      const fixPlanMarkdown = await generateMarkdown({
        system: SECURITY_FIX_PLAN_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 6000,
      });

      // Persist artifact SECURITY_FIX_PLAN.md
      const payload = JSON.stringify({ markdown: fixPlanMarkdown, filename: 'SECURITY_FIX_PLAN.md', source: 'security_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'security_fix_plan', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate SECURITY_FIX_PLAN_DONE passed
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'SECURITY_FIX_PLAN_DONE' } },
        update: { status: 'PASS', reason: 'SECURITY_FIX_PLAN.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'SECURITY_FIX_PLAN_DONE', status: 'PASS', reason: 'SECURITY_FIX_PLAN.md artifact created', checkedAt: new Date() },
      });

      return res.json({ fixPlanMarkdown });
    } catch (err: any) {
      console.error('[security/fix-plan]', err);

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
