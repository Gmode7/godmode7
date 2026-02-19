import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { z } from 'zod';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { hashApiKey } from '@ai-native/core';
import { callOpenAI } from '../llm/openai.js';
const router = Router();

/* ── Validation ────────────────────────────────────── */

const QuestionsBody = z.object({
  idea: z.string().min(10, 'idea must be >= 10 chars').max(4000),
});

const BriefBody = z.object({
  answers: z.string().min(10, 'answers must be >= 10 chars').max(12000),
});

/* ── System Prompts ────────────────────────────────── */

const QUESTIONS_PROMPT = `You are the Intake / Account Manager at GM7, a world-class AI software agency.
Your job: ask the client concise, high-signal clarifying questions about their project idea.

Rules:
- Ask 7–12 numbered questions.
- Cover: target users, core problem, must-have features, nice-to-haves, existing systems/integrations, timeline, budget range, technical constraints, success metrics, non-goals.
- Friendly but professional. No filler. No rambling.
- Output clean Markdown starting with "## Intake Questionnaire".
- End with: "Please answer each question. Once we receive your answers we will produce your Intake Brief."`;

const BRIEF_PROMPT = `You are the Intake / Account Manager at GM7, an AI software agency.
You received answers to the intake questionnaire. Produce a structured Intake Brief.

Output EXACTLY this Markdown structure:

# Intake Brief

## Project Overview
(2-3 sentence summary)

## Problem Statement
(What problem? For whom?)

## Requirements
### Must-Have (P0)
- …
### Should-Have (P1)
- …
### Nice-to-Have (P2)
- …

## Non-Goals / Out of Scope
- …

## Constraints
- Timeline: …
- Budget: …
- Technical: …

## Assumptions
- …

## Acceptance Criteria
- …

## Risks
- …

## Next Steps
- Brief handed to Product Manager for PRD creation.

Rules:
- Be specific, not vague.
- Derive everything from answers. Do not invent requirements.
- Under 800 words.
- Professional tone.`;

/* ── POST /jobs/:id/intake/questions ───────────────── */

router.post(
  '/jobs/:id/intake/questions',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      const { id: jobId } = req.params;
      const parsed = QuestionsBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { idea } = parsed.data;

      // Chat history breadcrumb
      await prisma.chatMessage.create({
        data: { role: 'user', content: `[intake][${jobId}] Idea: ${idea}` },
      });

      // LLM call
      const questionsMarkdown = await callOpenAI(QUESTIONS_PROMPT, idea);

      // Persist artifact
      const payload = JSON.stringify({ markdown: questionsMarkdown, idea });
      await prisma.artifact.create({
        data: { jobId, type: 'intake_questions', content: payload, hash: hashApiKey(payload) },
      });

      await prisma.chatMessage.create({
        data: { role: 'assistant', content: `[intake][${jobId}] Questionnaire generated (${questionsMarkdown.length} chars)` },
      });

      return res.json({ questionsMarkdown, jobId });
    } catch (err: any) {
      console.error('[intake/questions]', err);
      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

/* ── POST /jobs/:id/intake/brief ───────────────────── */

router.post(
  '/jobs/:id/intake/brief',
  planBasedLimiter('chat'),
  requireScope('jobs:write'),
  async (req: Request, res: Response) => {
    try {
      const { id: jobId } = req.params;
      const parsed = BriefBody.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
      }

      const job = await prisma.job.findUnique({
        where: { id: jobId },
        include: { artifacts: true },
      });
      if (!job) return res.status(404).json({ error: 'Job not found' });

      const { answers } = parsed.data;

      // Build full context from prior questionnaire artifact
      const qArtifact = job.artifacts.find((a) => a.type === 'intake_questions');
      let llmInput = answers;
      if (qArtifact) {
        try {
          const q = JSON.parse(qArtifact.content);
          llmInput = `Original idea:\n${q.idea}\n\nQuestionnaire:\n${q.markdown}\n\nClient answers:\n${answers}`;
        } catch {
          /* use raw answers */
        }
      }

      await prisma.chatMessage.create({
        data: { role: 'user', content: `[intake][${jobId}] Answers received (${answers.length} chars)` },
      });

      // LLM call
      const intakeMarkdown = await callOpenAI(BRIEF_PROMPT, llmInput);

      // Persist artifact
      const payload = JSON.stringify({ markdown: intakeMarkdown, answers });
      await prisma.artifact.create({
        data: { jobId, type: 'intake_brief', content: payload, hash: hashApiKey(payload) },
      });

      // Pass gate INTAKE_DONE
      await prisma.gate.upsert({
        where: { jobId_gateType: { jobId, gateType: 'INTAKE_DONE' } },
        update: { status: 'PASS', reason: 'INTAKE.md artifact created', checkedAt: new Date() },
        create: { jobId, gateType: 'INTAKE_DONE', status: 'PASS', reason: 'INTAKE.md artifact created', checkedAt: new Date() },
      });

      // Advance FSM if still in initial state
      if (job.currentState === 'PENDING_REQUIREMENTS') {
        await prisma.job.update({
          where: { id: jobId },
          data: { currentState: 'REQUIREMENTS_COMPLETE' },
        });
      }

      await prisma.chatMessage.create({
        data: { role: 'assistant', content: `[intake][${jobId}] Brief generated. Gate INTAKE_DONE → PASS. State → REQUIREMENTS_COMPLETE` },
      });

      return res.json({ intakeMarkdown, jobId, gate: 'INTAKE_DONE', gateStatus: 'PASS' });
    } catch (err: any) {
      console.error('[intake/brief]', err);
      return res.status(500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal error' : err.message,
      });
    }
  },
);

export default router;
