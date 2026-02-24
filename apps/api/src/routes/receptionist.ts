/**
 * AI Receptionist Route
 * 
 * Handles conversational project intake before pipeline starts.
 * The receptionist interviews the user, gathers requirements,
 * and then creates the project + starts the pipeline.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { hashApiKey } from '@ai-native/core';
import { orchestrator } from '../orchestrator/index.js';
import { generateWithOpenRouter } from '../llm/openrouter.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

// In-memory session storage (use Redis in production)
interface ReceptionistSession {
  id: string;
  stage: 'greeting' | 'interviewing' | 'clarifying' | 'ready' | 'completed';
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  extractedInfo: {
    projectName?: string;
    appType?: string;
    description?: string;
    targetUsers?: string;
    coreFeatures?: string[];
    techPreferences?: string;
    timeline?: string;
    budget?: string;
    existingSystems?: string;
  };
  createdAt: Date;
}

const sessions = new Map<string, ReceptionistSession>();

// Cleanup old sessions every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [id, session] of sessions) {
    if (session.createdAt < oneHourAgo) {
      sessions.delete(id);
    }
  }
}, 60 * 60 * 1000);

/* ── Prompts ────────────────────────────────────────── */

const RECEPTIONIST_SYSTEM_PROMPT = `You are the AI Receptionist at GM7, a world-class AI software development agency.

Your job is to conduct a friendly, professional interview with clients who want to build software. You gather requirements through natural conversation before handing off to the engineering team.

## Conversation Flow:
1. **Greeting** - Welcome the user, understand what they want to build
2. **Discovery** - Ask clarifying questions about:
   - What type of app/system they need
   - Who will use it (target users)
   - Core features (must-haves vs nice-to-haves)
   - Any technical preferences or constraints
   - Timeline and budget (rough estimates are fine)
   - Integrations with existing systems

3. **Summarize** - Once you have enough info, provide a clear summary

## Rules:
- Keep responses conversational and friendly (not robotic)
- Ask ONE or TWO questions at a time (don't overwhelm)
- Adapt your questions based on what they've already told you
- If they mention a specific app type (todo, chat, blog, shop), dive deeper into that domain
- Don't ask about things they've already answered
- When you have enough info (5-6 key points), say you're ready to create the project
- Use emojis occasionally to keep it friendly ✨
- Keep responses concise (2-4 sentences max)

## Output Format:
Just respond naturally as a helpful receptionist would.`;

const PROJECT_GENERATOR_PROMPT = `Based on the conversation with the client, create a structured project specification.

Extract and format the following information:

1. PROJECT_NAME: A concise, professional name (2-4 words)
2. APP_TYPE: The category (e.g., Web App, Mobile App, API, Dashboard, E-commerce, etc.)
3. DESCRIPTION: A compelling 2-3 sentence summary of what this app does and who it's for
4. TARGET_USERS: Who will use this app
5. CORE_FEATURES: List of 5-8 must-have features
6. TECH_PREFERENCES: Any tech stack preferences mentioned (or "Flexible" if none)
7. TIMELINE: Rough timeline (if mentioned, otherwise "Not specified")
8. BUDGET_RANGE: Budget indication (if mentioned, otherwise "Not specified")
9. INTEGRATIONS: Any external systems to integrate with

Output in this exact JSON format:
{
  "projectName": "...",
  "appType": "...",
  "description": "...",
  "targetUsers": "...",
  "coreFeatures": ["...", "..."],
  "techPreferences": "...",
  "timeline": "...",
  "budgetRange": "...",
  "integrations": "..."
}`;

/* ── Helper Functions ───────────────────────────────── */

function createSession(): ReceptionistSession {
  const id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const session: ReceptionistSession = {
    id,
    stage: 'greeting',
    messages: [],
    extractedInfo: {},
    createdAt: new Date(),
  };
  sessions.set(id, session);
  return session;
}

async function generateReceptionistResponse(
  session: ReceptionistSession,
  userMessage: string
): Promise<string> {
  const messages = [
    { role: 'system', content: RECEPTIONIST_SYSTEM_PROMPT },
    ...session.messages.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  try {
    const response = await generateWithOpenRouter({
      system: RECEPTIONIST_SYSTEM_PROMPT,
      user: messages.map(m => `${m.role}: ${m.content}`).join('\n\n'),
      temperature: 0.7,
      maxTokens: 800,
      model: 'meta-llama/llama-3.3-70b-instruct',
    });
    return response;
  } catch (err) {
    console.error('[receptionist] LLM error:', err);
    return "I'd love to help you get started! Could you tell me a bit more about what kind of app you're looking to build? 🚀";
  }
}

async function extractProjectSpec(
  session: ReceptionistSession
): Promise<ReceptionistSession['extractedInfo'] | null> {
  const conversation = session.messages
    .map(m => `${m.role}: ${m.content}`)
    .join('\n\n');

  try {
    const response = await generateWithOpenRouter({
      system: PROJECT_GENERATOR_PROMPT,
      user: conversation,
      temperature: 0.3,
      maxTokens: 1500,
      model: 'google/gemma-3-27b-it',
    });

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        projectName: parsed.projectName,
        appType: parsed.appType,
        description: parsed.description,
        targetUsers: parsed.targetUsers,
        coreFeatures: parsed.coreFeatures,
        techPreferences: parsed.techPreferences,
        timeline: parsed.timeline,
        budget: parsed.budgetRange,
        existingSystems: parsed.integrations,
      };
    }
  } catch (err) {
    console.error('[receptionist] Extraction error:', err);
  }
  return null;
}

async function createProjectAndStartPipeline(
  session: ReceptionistSession,
  clientId: string
): Promise<{ projectId: string; jobId: string }> {
  const info = session.extractedInfo;
  
  // 1. Create project
  const project = await prisma.project.create({
    data: {
      name: info.projectName || 'New Project',
      description: info.description || 'AI-generated project',
      clientId,
    },
  });

  // 2. Create job
  const job = await prisma.job.create({
    data: {
      projectId: project.id,
      strategy: 'A',
      riskClassification: 'standard',
      currentState: 'INTAKE_PENDING',
    },
  });

  // 3. Create comprehensive intake brief artifact
  const briefContent = {
    markdown: `# ${info.projectName || 'Project Brief'}

## Overview
${info.description || 'No description provided'}

## Target Users
${info.targetUsers || 'Not specified'}

## Core Features
${info.coreFeatures?.map(f => `- ${f}`).join('\n') || '- Not specified'}

## Technical Preferences
${info.techPreferences || 'Flexible'}

## Timeline
${info.timeline || 'Not specified'}

## Budget Range
${info.budget || 'Not specified'}

## Integrations
${info.existingSystems || 'None specified'}

## Additional Context
This project was created through AI receptionist interview.
`,
    idea: info.description || '',
    extractedInfo: info,
  };

  const payload = JSON.stringify(briefContent);
  await prisma.artifact.create({
    data: {
      jobId: job.id,
      type: 'intake_questions',
      content: payload,
      hash: hashApiKey(payload),
    },
  });

  // 4. Start pipeline
  orchestrator.startPipeline(job.id).catch(err => {
    console.error(`[receptionist] Pipeline start failed:`, err);
  });

  return { projectId: project.id, jobId: job.id };
}

/* ── Routes ─────────────────────────────────────────── */

// POST /receptionist/start - Start a new receptionist session
router.post('/start', planBasedLimiter('chat'), requireScope('projects:write'), async (req: Request, res: Response) => {
  try {
    const session = createSession();
    
    const greeting = "👋 Welcome to GM7! I'm your AI receptionist.\n\nI'd love to help you bring your app idea to life. What kind of project are you looking to build?";
    
    session.messages.push({ role: 'assistant', content: greeting });
    
    res.json({
      sessionId: session.id,
      message: greeting,
      stage: session.stage,
    });
  } catch (err: any) {
    console.error('[receptionist/start]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

// POST /receptionist/chat - Continue conversation
const ChatBody = z.object({
  sessionId: z.string(),
  message: z.string().min(1),
});

router.post('/chat', planBasedLimiter('chat'), requireScope('projects:write'), async (req: Request, res: Response) => {
  try {
    const parsed = ChatBody.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }

    const { sessionId, message } = parsed.data;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found. Please start a new session.' });
    }

    // Add user message
    session.messages.push({ role: 'user', content: message });

    // Check if user wants to proceed/create project
    const lowerMsg = message.toLowerCase();
    const isReadyToCreate = 
      lowerMsg.includes('sounds good') ||
      lowerMsg.includes('looks great') ||
      lowerMsg.includes('lets do it') ||
      lowerMsg.includes("let's do it") ||
      lowerMsg.includes('go ahead') ||
      lowerMsg.includes('create it') ||
      lowerMsg.includes('start the project') ||
      lowerMsg.includes('perfect') && lowerMsg.includes('create');

    if (isReadyToCreate && session.messages.length > 4) {
      // Extract final spec and create project
      const extracted = await extractProjectSpec(session);
      
      if (extracted) {
        session.extractedInfo = extracted;
        session.stage = 'completed';

        const clientId = (req as any).agent?.id || 'default';
        const { projectId, jobId } = await createProjectAndStartPipeline(session, clientId);

        const successMessage = `✨ **Project Created!**\n\n**${extracted.projectName}** is now being built by our AI team.\n\n📋 **Summary:**\n• **Type:** ${extracted.appType}\n• **Features:** ${extracted.coreFeatures?.slice(0, 3).join(', ')}...\n\n🚀 **Pipeline Started!**\n• Project ID: \`${projectId}\`\n• Job ID: \`${jobId}\`\n\nHead to the **Pipeline** tab to watch the AI agents work!`;

        session.messages.push({ role: 'assistant', content: successMessage });

        return res.json({
          sessionId: session.id,
          message: successMessage,
          stage: session.stage,
          projectCreated: true,
          projectId,
          jobId,
        });
      }
    }

    // Continue interview
    const response = await generateReceptionistResponse(session, message);
    session.messages.push({ role: 'assistant', content: response });

    // Update stage based on conversation length
    if (session.messages.length > 8) {
      session.stage = 'ready';
    } else if (session.messages.length > 4) {
      session.stage = 'clarifying';
    } else {
      session.stage = 'interviewing';
    }

    res.json({
      sessionId: session.id,
      message: response,
      stage: session.stage,
      projectCreated: false,
    });

  } catch (err: any) {
    console.error('[receptionist/chat]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

// POST /receptionist/create-now - Skip to project creation with current info
router.post('/create-now', planBasedLimiter('chat'), requireScope('projects:write'), async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    const session = sessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const extracted = await extractProjectSpec(session);
    
    if (!extracted) {
      return res.status(400).json({ error: 'Could not extract project details from conversation' });
    }

    session.extractedInfo = extracted;
    session.stage = 'completed';

    const clientId = (req as any).agent?.id || 'default';
    const { projectId, jobId } = await createProjectAndStartPipeline(session, clientId);

    res.json({
      success: true,
      projectId,
      jobId,
      summary: extracted,
    });

  } catch (err: any) {
    console.error('[receptionist/create-now]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

// GET /receptionist/session/:id - Get session history
router.get('/session/:id', requireScope('projects:read'), async (req: Request, res: Response) => {
  try {
    const session = sessions.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({
      sessionId: session.id,
      stage: session.stage,
      messages: session.messages,
      extractedInfo: session.extractedInfo,
    });
  } catch (err: any) {
    console.error('[receptionist/session]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

export default router;
