import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { hashApiKey } from '@ai-native/core';
import { kimiGenerateMarkdown, isKimiConfigured, KimiConfigError } from '../llm/kimi.js';
import { getArtifactByType, getIntakeContent, getAdrArtifacts } from '../utils/artifact-helpers.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = Router();

/* ── Validation ────────────────────────────────────── */

const ReadmeInputBody = z.object({
  audience: z.enum(['developers', 'customers']).default('developers'),
  notes: z.string().max(4000).optional(),
});

const ApiDocsInputBody = z.object({
  notes: z.string().max(4000).optional(),
});

const GuideInputBody = z.object({
  persona: z.enum(['founder', 'engineer', 'pm']).default('founder'),
});

const ChangelogInputBody = z.object({
  notes: z.string().max(2000).optional(),
});

/* ── System Prompts ────────────────────────────────── */

const README_PROMPT = `You are a Technical Writer at GM7, a world-class AI software agency.
Your job: create a polished, professional README.md for a project.

Output MUST be valid Markdown starting with "# Project Name".

Include these sections:

## What It Is
2-3 sentence overview of the project and its purpose.

## Features
Bullet list of key capabilities.

## Setup
Prerequisites and environment setup:
- Required environment variables (names only, no values)
- Dependencies to install
- Database setup commands

## Running Locally
Step-by-step commands to run the project locally:
- Installation: pnpm install
- Database: pnpm db:generate && pnpm db:push
- Development: pnpm dev
- Other useful scripts from package.json

## API Authentication
How to authenticate with the API:
- Required header: x-api-key
- How to obtain an API key
- Example request

## Typical Workflow
Step-by-step guide for the main use case:
1. Create a project
2. Create a job
3. Generate artifacts with agents
4. Check gates
5. Download or view artifacts

## Project Structure
Brief overview of key directories and files.

## Contributing
Brief note on how to contribute (if applicable).

## License
License information.

Rules:
- Clear, professional tone
- Code examples should be copy-paste ready
- Don't include actual secret values
- Target 800-1500 words
- Make it welcoming for the target audience`;

const API_DOCS_PROMPT = `You are a Technical Writer at GM7, a world-class AI software agency.
Your job: create comprehensive API documentation.

Output MUST be valid Markdown starting with "# API Documentation".

Include these sections:

## Base URL
The base URL for all API requests.

## Authentication
All endpoints require authentication via x-api-key header.

## Rate Limiting
Description of rate limiting behavior and headers.

## Common Headers
Standard request/response headers.

## Endpoints

For each endpoint group, document:

### Group Name

#### Endpoint Name
\`\`\`http
METHOD /path
\`\`\`

**Auth Required:** Yes (scope: required-scope)

**Request Body:**
\`\`\`json
{
  "field": "type - description"
}
\`\`\`

**Response:**
\`\`\`json
{
  "field": "type - description"
}
\`\`\`

**Errors:**
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 429: Rate Limited
- 503: Service Unavailable (LLM not configured)

## Error Handling
Common error response format.

## SDK / Client Examples
Example using curl and fetch.

Rules:
- Use actual endpoint paths from the provided routes
- Include all major endpoint groups
- Document request/response shapes accurately
- Note rate limiting behavior
- Target 1500-2500 words`;

const USER_GUIDE_PROMPT = `You are a Technical Writer at GM7, a world-class AI software agency.
Your job: create a user guide for the GM7 AI software agency platform.

Output MUST be valid Markdown starting with "# GM7 User Guide".

Include these sections:

## Introduction
What GM7 is and who it's for.

## Quick Start
Get up and running in 5 minutes:
1. Get API key
2. Create your first project
3. Create a job
4. Run an agent
5. View artifacts

## Core Concepts
- Projects: Organize your work
- Jobs: Individual deliverables
- Agents: AI specialists (Intake, PM, Architect, Engineer, QA, Security, DevOps, Tech Writer)
- Artifacts: Documents produced by agents
- Gates: Quality checkpoints

## The GM7 Workflow
Step-by-step through the full software development lifecycle:
1. Intake: Capture requirements
2. Planning: PRD and backlog
3. Architecture: Design decisions
4. Engineering: Implementation plan and code
5. QA: Testing strategy
6. Security: Threat model and findings
7. Release: Deploy and monitor
8. Documentation: Polish and publish

## Using Each Agent
Brief guide for each agent:
- What they do
- Required inputs
- Artifacts produced
- Gates updated

## Best Practices
Tips for getting the best results from GM7.

## Troubleshooting
Common issues and solutions.

Rules:
- Tone should match the persona (founder=executive, engineer=technical, pm=process-focused)
- Practical, actionable guidance
- Include concrete examples
- Target 1500-2500 words`;

const CHANGELOG_PROMPT = `You are a Technical Writer at GM7, a world-class AI software agency.
Your job: create a changelog/release notes document summarizing job artifacts.

Output MUST be valid Markdown starting with "# Changelog".

Include these sections:

## Release Overview
Brief summary of what was delivered.

## New Features
Major capabilities added.

## Artifacts Generated
List of all documents produced, organized by agent:
- Intake: INTAKE.md
- Product Manager: PRD.md, BACKLOG.md
- Architect: ARCH.md, ADRs
- Engineer: ENGINEERING_PLAN.md, PATCH.diff, TEST_PLAN.md
- QA: QA_TEST_MATRIX.md, QA_REPORT.md
- Security: THREAT_MODEL.md, SECURITY_FINDINGS.md, SECURITY_FIX_PLAN.md
- DevOps: CI_PLAN.md, RUNBOOK.md, DEPLOY.md
- Tech Writer: README.md, API_DOCS.md, USER_GUIDE.md

## Gates Passed
Quality checkpoints that were cleared.

## Changes from Previous Version
What changed compared to earlier iterations.

## Known Issues
Any limitations or issues to be aware of.

## Migration Notes
If applicable, how to migrate from previous versions.

## Credits
Acknowledgment of the AI agents involved.

Rules:
- Professional release notes tone
- Highlight the most important changes
- Be honest about limitations
- Target 800-1500 words`;

/* ── Helper Functions ─────────────────────────────── */

function parseApiRoutes(): string {
  try {
    // Read the main index.ts file
    const indexPath = path.join(__dirname, '..', 'index.ts');
    if (!fs.existsSync(indexPath)) {
      return 'API routes not available for parsing';
    }
    
    const content = fs.readFileSync(indexPath, 'utf-8');
    
    // Extract route definitions
    const routes: string[] = [];
    
    // Match app.get/post/put/delete/patch patterns
    const routeRegex = /app\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g;
    let match;
    
    while ((match = routeRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      routes.push(`${method} ${path}`);
    }
    
    // Also match router patterns from route files
    const routerRegex = /router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g;
    while ((match = routerRegex.exec(content)) !== null) {
      const method = match[1].toUpperCase();
      const path = match[2];
      routes.push(`${method} ${path}`);
    }
    
    return routes.join('\n') || 'No routes parsed';
  } catch (err) {
    return `Error parsing routes: ${err}`;
  }
}

function buildReadmePrompt(
  audience: string,
  notes: string | undefined,
  job: any,
  intake: any,
  prd: any,
  arch: any,
  engPlan: any,
): string {
  const parts: string[] = [];

  parts.push(`# README Generation Request`);
  parts.push(`\n## Target Audience\n${audience}`);

  if (notes) {
    parts.push(`\n## Additional Notes\n${notes}`);
  }

  if (job) {
    parts.push(`\n## Job Metadata\n- Job ID: ${job.id}\n- Strategy: ${job.strategy}\n- Risk Classification: ${job.riskClassification}`);
  }

  if (prd?.markdown) {
    parts.push(`\n## Product Requirements\n${prd.markdown.slice(0, 3000)}...`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Overview\n${arch.markdown.slice(0, 2000)}...`);
  }

  if (engPlan?.markdown) {
    parts.push(`\n## Engineering Plan\n${engPlan.markdown.slice(0, 2000)}...`);
  }

  if (intake?.markdown) {
    parts.push(`\n## Intake Brief\n${intake.markdown.slice(0, 2000)}...`);
  }

  return parts.join('\n');
}

function buildApiDocsPrompt(
  notes: string | undefined,
  apiRoutes: string,
): string {
  const parts: string[] = [];

  parts.push(`# API Documentation Generation Request`);

  if (notes) {
    parts.push(`\n## Additional Notes\n${notes}`);
  }

  parts.push(`\n## API Routes\n\`\`\`\n${apiRoutes}\n\`\`\``);

  return parts.join('\n');
}

function buildGuidePrompt(
  persona: string,
  prd: any,
  arch: any,
): string {
  const parts: string[] = [];

  parts.push(`# User Guide Generation Request`);
  parts.push(`\n## Target Persona\n${persona}`);

  if (prd?.markdown) {
    parts.push(`\n## Product Overview\n${prd.markdown.slice(0, 3000)}...`);
  }

  if (arch?.markdown) {
    parts.push(`\n## Architecture Overview\n${arch.markdown.slice(0, 2000)}...`);
  }

  return parts.join('\n');
}

function buildChangelogPrompt(
  notes: string | undefined,
  job: any,
  artifacts: any[],
  gates: any[],
): string {
  const parts: string[] = [];

  parts.push(`# Changelog Generation Request`);

  if (notes) {
    parts.push(`\n## Additional Notes\n${notes}`);
  }

  if (job) {
    parts.push(`\n## Job Info\n- Job ID: ${job.id}\n- Created: ${job.createdAt}\n- State: ${job.currentState}`);
  }

  if (artifacts.length > 0) {
    parts.push(`\n## Artifacts Generated`);
    artifacts.forEach(a => {
      parts.push(`- ${a.type} (${a.createdAt})`);
    });
  }

  if (gates.length > 0) {
    parts.push(`\n## Gates Status`);
    gates.forEach(g => {
      parts.push(`- ${g.gateType}: ${g.status}`);
    });
  }

  return parts.join('\n');
}

/* ── POST /jobs/:id/docs/readme ────────────────────── */

router.post(
  '/jobs/:id/docs/readme',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      // Check Kimi configuration first
      if (!isKimiConfigured()) {
        return res.status(503).json({
          error: 'Kimi not configured',
          missing: ['KIMI_API_KEY'],
        });
      }

      const { id: jobId } = req.params;
      const parsed = ReadmeInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { audience, notes } = parsed.data;

      // Load existing artifacts
      const intake = await getIntakeContent(jobId);
      const prd = await getArtifactByType(jobId, 'prd');
      const arch = await getArtifactByType(jobId, 'architecture');
      const engPlan = await getArtifactByType(jobId, 'engineering_plan');

      // Build prompt context
      const userPrompt = buildReadmePrompt(audience, notes, job, intake, prd, arch, engPlan);

      // LLM call
      const readmeMarkdown = await kimiGenerateMarkdown({
        system: README_PROMPT,
        user: userPrompt,
        temperature: 0.4,
        maxTokens: 8000,
      });

      // Persist artifact README.md
      const payload = JSON.stringify({ markdown: readmeMarkdown, filename: 'README.md', source: 'techwriter_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'docs_readme', content: payload, hash: hashApiKey(payload) },
      });

      return res.json({ readmeMarkdown });
    } catch (err: any) {
      console.error('[docs/readme]', err);

      if (err instanceof KimiConfigError) {
        return res.status(503).json({
          error: 'Kimi not configured',
          missing: ['KIMI_API_KEY'],
        });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

/* ── POST /jobs/:id/docs/api ───────────────────────── */

router.post(
  '/jobs/:id/docs/api',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      // Check Kimi configuration first
      if (!isKimiConfigured()) {
        return res.status(503).json({
          error: 'Kimi not configured',
          missing: ['KIMI_API_KEY'],
        });
      }

      const { id: jobId } = req.params;
      const parsed = ApiDocsInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { notes } = parsed.data;

      // Parse API routes from index.ts
      const apiRoutes = parseApiRoutes();

      // Build prompt context
      const userPrompt = buildApiDocsPrompt(notes, apiRoutes);

      // LLM call
      const apiDocsMarkdown = await kimiGenerateMarkdown({
        system: API_DOCS_PROMPT,
        user: userPrompt,
        temperature: 0.3,
        maxTokens: 8000,
      });

      // Persist artifact API_DOCS.md
      const payload = JSON.stringify({ markdown: apiDocsMarkdown, filename: 'API_DOCS.md', source: 'techwriter_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'docs_api', content: payload, hash: hashApiKey(payload) },
      });

      // Mark gate DOCS_DONE passed
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'DOCS_DONE' } },
        update: { status: 'PASS', reason: 'API_DOCS.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'DOCS_DONE', status: 'PASS', reason: 'API_DOCS.md artifact created', checkedAt: new Date() },
      });

      return res.json({ apiDocsMarkdown });
    } catch (err: any) {
      console.error('[docs/api]', err);

      if (err instanceof KimiConfigError) {
        return res.status(503).json({
          error: 'Kimi not configured',
          missing: ['KIMI_API_KEY'],
        });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

/* ── POST /jobs/:id/docs/guide ─────────────────────── */

router.post(
  '/jobs/:id/docs/guide',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      // Check Kimi configuration first
      if (!isKimiConfigured()) {
        return res.status(503).json({
          error: 'Kimi not configured',
          missing: ['KIMI_API_KEY'],
        });
      }

      const { id: jobId } = req.params;
      const parsed = GuideInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { persona } = parsed.data;

      // Load existing artifacts
      const prd = await getArtifactByType(jobId, 'prd');
      const arch = await getArtifactByType(jobId, 'architecture');

      // Build prompt context
      const userPrompt = buildGuidePrompt(persona, prd, arch);

      // LLM call
      const guideMarkdown = await kimiGenerateMarkdown({
        system: USER_GUIDE_PROMPT,
        user: userPrompt,
        temperature: 0.4,
        maxTokens: 8000,
      });

      // Persist artifact USER_GUIDE.md
      const payload = JSON.stringify({ markdown: guideMarkdown, filename: 'USER_GUIDE.md', source: 'techwriter_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'docs_guide', content: payload, hash: hashApiKey(payload) },
      });

      return res.json({ guideMarkdown });
    } catch (err: any) {
      console.error('[docs/guide]', err);

      if (err instanceof KimiConfigError) {
        return res.status(503).json({
          error: 'Kimi not configured',
          missing: ['KIMI_API_KEY'],
        });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

/* ── POST /jobs/:id/docs/changelog ─────────────────── */

router.post(
  '/jobs/:id/docs/changelog',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      // Check Kimi configuration first
      if (!isKimiConfigured()) {
        return res.status(503).json({
          error: 'Kimi not configured',
          missing: ['KIMI_API_KEY'],
        });
      }

      const { id: jobId } = req.params;
      const parsed = ChangelogInputBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ 
        where: { id: jobId },
        include: { artifacts: true, gates: true }
      });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { notes } = parsed.data;

      // Build prompt context
      const userPrompt = buildChangelogPrompt(notes, job, job.artifacts, job.gates);

      // LLM call
      const changelogMarkdown = await kimiGenerateMarkdown({
        system: CHANGELOG_PROMPT,
        user: userPrompt,
        temperature: 0.4,
        maxTokens: 6000,
      });

      // Persist artifact CHANGELOG.md
      const payload = JSON.stringify({ markdown: changelogMarkdown, filename: 'CHANGELOG.md', source: 'techwriter_agent' });
      await prisma.artifact.create({
        data: { jobId, type: 'docs_changelog', content: payload, hash: hashApiKey(payload) },
      });

      return res.json({ changelogMarkdown });
    } catch (err: any) {
      console.error('[docs/changelog]', err);

      if (err instanceof KimiConfigError) {
        return res.status(503).json({
          error: 'Kimi not configured',
          missing: ['KIMI_API_KEY'],
        });
      }

      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

export default router;
