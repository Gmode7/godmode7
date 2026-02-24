import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { gatesEngine } from '@ai-native/core';
import { ChatMessageSchema } from '../schemas/inline.js';
import { hashApiKey } from '@ai-native/core';
import { orchestrator } from '../orchestrator/index.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

/**
 * Intent Recognition System
 * Detects user intent from natural language
 */
type IntentType = 
  | 'build_app' 
  | 'create_project' 
  | 'create_job' 
  | 'list_projects' 
  | 'list_jobs' 
  | 'show_status' 
  | 'show_help' 
  | 'show_gates'
  | 'general_chat';

interface IntentResult {
  type: IntentType;
  confidence: number;
  data?: {
    projectName?: string;
    description?: string;
    projectId?: string;
  };
}

/**
 * Extract project name from build request
 * Uses pattern matching and simple heuristics
 */
function extractProjectName(message: string): string {
  const lower = message.toLowerCase();
  
  // Common patterns
  const patterns = [
    /(?:build|create|make)\s+(?:a|an|me)?\s*["']?([^"']+?)["']?(?:\s+app|\s+application|$)/i,
    /(?:app|application)\s+(?:for|to)\s+["']?([^"']+?)["']?(?:\s*$)/i,
    /(?:called|named)\s+["']?([^"']+?)["']?(?:\s*$)/i,
    /(?:i want|i need)\s+(?:a|an)?\s*(?:todo|task|note|chat|blog|shop|store|game|tool|manager|tracker)\s*(?:app|application)?/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      // Clean up the extracted name
      let name = match[1].trim();
      // Capitalize first letter of each word
      name = name.replace(/\b\w/g, c => c.toUpperCase());
      return name;
    }
  }
  
  // Fallback: extract key noun phrases
  const words = lower.split(/\s+/);
  const stopWords = new Set(['a', 'an', 'the', 'for', 'to', 'build', 'create', 'make', 'me', 'app', 'application', 'i', 'want', 'need', 'can', 'you']);
  const keywords = words.filter(w => w.length > 2 && !stopWords.has(w));
  
  if (keywords.length > 0) {
    return keywords[0].charAt(0).toUpperCase() + keywords[0].slice(1) + ' App';
  }
  
  return 'New Project';
}

/**
 * Recognize user intent from message
 */
function recognizeIntent(message: string): IntentResult {
  const lower = message.toLowerCase().trim();
  
  // Build app intent patterns
  const buildPatterns = [
    /(?:build|create|make)\s+(?:a|an|me)?\s+(?:app|application|website|site|tool)/i,
    /(?:i want|i need)\s+(?:a|an)?\s+(?:app|application|website)/i,
    /(?:can you|could you)?\s*(?:build|create|make)/i,
    /(?:start|begin)\s+(?:a|an|new)?\s+project/i,
    /(?:todo|task|note|chat|blog|shop|store|game|tool|manager|tracker)\s*(?:app|application)?/i,
  ];
  
  for (const pattern of buildPatterns) {
    if (pattern.test(lower)) {
      return {
        type: 'build_app',
        confidence: 0.9,
        data: {
          projectName: extractProjectName(message),
          description: message,
        },
      };
    }
  }
  
  // Create project patterns
  if (/^create project|^new project|^add project/.test(lower)) {
    const name = message.replace(/^(create|new|add)\s+project\s*/i, '').trim() || 'New Project';
    return {
      type: 'create_project',
      confidence: 0.95,
      data: { projectName: name },
    };
  }
  
  // Create job patterns
  if (/^create job|^new job/.test(lower)) {
    const projectId = message.replace(/^(create|new)\s+job\s*/i, '').trim();
    return {
      type: 'create_job',
      confidence: 0.95,
      data: { projectId },
    };
  }
  
  // List patterns
  if (lower.includes('project') && (lower.includes('list') || lower.includes('show') || lower.includes('all'))) {
    return { type: 'list_projects', confidence: 0.9 };
  }
  
  if (lower.includes('job') && (lower.includes('list') || lower.includes('show') || lower.includes('all'))) {
    return { type: 'list_jobs', confidence: 0.9 };
  }
  
  // Status patterns
  if (lower.includes('status') || lower.includes('health') || lower.includes('system')) {
    return { type: 'show_status', confidence: 0.9 };
  }
  
  // Gates patterns
  if (lower.includes('gate') || lower.includes('stage') || lower.includes('checkpoint')) {
    return { type: 'show_gates', confidence: 0.85 };
  }
  
  // Help patterns
  if (lower === 'help' || lower === 'hi' || lower === 'hello' || lower === 'start' || lower.includes('what can you do')) {
    return { type: 'show_help', confidence: 1.0 };
  }
  
  return { type: 'general_chat', confidence: 0.5 };
}

/**
 * Execute the AI Pipeline automatically
 * Creates project, job, and starts the pipeline
 */
async function executeBuildPipeline(
  req: Request,
  projectName: string,
  description: string
): Promise<{ success: boolean; message: string; projectId?: string; jobId?: string }> {
  try {
    const clientId = (req as any).agent?.id || 'default';
    
    // 1. Create Project
    const project = await prisma.project.create({
      data: { 
        name: projectName, 
        description: description.slice(0, 500),
        clientId 
      },
    });
    
    // 2. Create Job
    const job = await prisma.job.create({
      data: {
        projectId: project.id,
        strategy: 'A',
        riskClassification: 'standard',
        currentState: 'INTAKE_PENDING',
      },
    });
    
    // 3. Create intake artifact with the user's request
    const payload = JSON.stringify({
      markdown: `# Project Request\n\n${description}\n\n## User Request\n${description}\n\n## Auto-Generated\nThis project was created via AI chat interface.`,
      idea: description,
    });
    
    await prisma.artifact.create({
      data: {
        jobId: job.id,
        type: 'intake_questions',
        content: payload,
        hash: hashApiKey(payload),
      },
    });
    
    // 4. Start the pipeline (fire and forget)
    orchestrator.startPipeline(job.id).catch(err => {
      console.error(`[chat/pipeline] Failed to start pipeline for job ${job.id}:`, err);
    });
    
    return {
      success: true,
      message: `🚀 AI Pipeline Started!\n\n**Project:** ${project.name}\n**Job ID:** ${job.id.slice(0, 8)}...\n**Status:** INTAKE_PENDING → Pipeline running automatically\n\nThe AI agents are now working on your project. Check the Pipeline tab to see progress!`,
      projectId: project.id,
      jobId: job.id,
    };
  } catch (err: any) {
    console.error('[chat/build] Pipeline execution failed:', err);
    return {
      success: false,
      message: '❌ Failed to start pipeline: ' + (err.message || 'Unknown error'),
    };
  }
}

router.get('/messages', planBasedLimiter('chat'), requireScope('chat:read'), async (_: Request, res: Response) => {
  try {
    const messages = await prisma.chatMessage.findMany({ orderBy: { createdAt: 'asc' }, take: 100 });
    res.json({ messages });
  } catch (err: any) {
    console.error('[chat/list]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.post('/messages', planBasedLimiter('chat'), requireScope('chat:write'), async (req: Request, res: Response) => {
  try {
    const parsed = ChatMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { content } = parsed.data;
    const userMsg = await prisma.chatMessage.create({ data: { role: 'user', content } });

    // Recognize intent
    const intent = recognizeIntent(content);
    let response = '';

    switch (intent.type) {
      case 'build_app': {
        const projectName = intent.data?.projectName || 'New Project';
        const description = intent.data?.description || content;
        
        // Send immediate acknowledgment
        const ackMsg = await prisma.chatMessage.create({
          data: { 
            role: 'assistant', 
            content: `🎯 I understand! You want to build: **${projectName}**\n\nStarting AI pipeline now...` 
          },
        });
        
        // Execute pipeline
        const result = await executeBuildPipeline(req, projectName, description);
        response = result.message;
        
        res.json({ 
          userMessage: userMsg, 
          assistantMessage: ackMsg,
          followUp: { role: 'assistant', content: response }
        });
        
        // Save the follow-up message
        await prisma.chatMessage.create({
          data: { role: 'assistant', content: response },
        });
        return;
      }
      
      case 'create_project': {
        const name = intent.data?.projectName || 'New Project';
        const project = await prisma.project.create({ 
          data: { name, clientId: (req as any).agent?.id || 'default' } 
        });
        response = `✅ Project created!\n\n**Name:** ${project.name}\n**ID:** ${project.id}\n\nWant me to create a job for this project? Just say "create job ${project.id}"`;
        break;
      }
      
      case 'create_job': {
        const projectId = intent.data?.projectId || '';
        if (!projectId) {
          response = 'Please provide a project ID. Example: "create job <project-id>" or just say "build a todo app" to start automatically!';
        } else {
          try {
            const job = await prisma.job.create({ 
              data: { projectId, strategy: 'A', riskClassification: 'standard' } 
            });
            response = `✅ Job created!\n\n**Job ID:** ${job.id}\n**State:** ${job.currentState}\n\n💡 **Pro tip:** Next time just say "build me a [type] app" and I'll create the project AND start the pipeline automatically!`;
          } catch (e) {
            response = '❌ Invalid project ID. Use "projects" to see available projects.';
          }
        }
        break;
      }
      
      case 'list_projects': {
        const projects = await prisma.project.findMany({ 
          take: 10, 
          orderBy: { createdAt: 'desc' } 
        });
        response = projects.length === 0
          ? '📭 No projects yet.\n\n💡 **Get started:** Just type "build a todo app" or "create project MyApp"'
          : `📁 Projects (${projects.length}):\n\n${projects.map(p => `• **${p.name}**\n  ID: \`${p.id}\``).join('\n\n')}`;
        break;
      }
      
      case 'list_jobs': {
        const jobs = await prisma.job.findMany({ 
          take: 10, 
          orderBy: { createdAt: 'desc' }, 
          include: { project: true } 
        });
        response = jobs.length === 0
          ? '📭 No jobs yet.\n\n💡 Create one: "create job <project-id>" or start automatically with "build a chat app"'
          : `🔧 Jobs (${jobs.length}):\n\n${jobs.map(j => `• **${j.project.name}**\n  Job: \`${j.id.slice(0, 8)}...\`\n  State: \`${j.currentState}\``).join('\n\n')}`;
        break;
      }
      
      case 'show_status': {
        const [p, j, a] = await Promise.all([
          prisma.project.count(), 
          prisma.job.count(), 
          prisma.agentIdentity.count()
        ]);
        response = `📊 **System Status**\n\n• Projects: ${p}\n• Jobs: ${j}\n• Agents: ${a}\n• API: ✅ Healthy\n• Version: 1.3.0\n\n💡 **Ready to build!** Try: "build a todo app"`;
        break;
      }
      
      case 'show_gates': {
        const gates = gatesEngine.getGateDefinitions();
        response = `🚦 **Pipeline Gates**\n\n${gates.map(g => `• **${g.type}**\n  ${g.description}`).join('\n\n')}`;
        break;
      }
      
      case 'show_help':
        response = `# 🤖 GM7 AI Assistant\n\n## Quick Start - Just Type:\n• **"build a todo app"** - Creates project + starts AI pipeline automatically!\n• **"build me a chat application"** - Same magic ✨\n• **"create project MyApp"** - Create project only\n\n## Other Commands:\n• **status** - System health\n• **projects** - List all projects\n• **jobs** - List all jobs\n• **gates** - Pipeline stages info\n• **create job <id>** - Add job to project\n\n💡 **Pro tip:** Natural language works! Try "make a note-taking app" or "I need a blog website"`;
        break;
      
      case 'general_chat':
      default:
        response = `I received: "${content}"\n\n🤔 I'm not sure what you want. Try:\n• "build a todo app" - Start AI pipeline\n• "help" - See all commands\n• "status" - Check system`;
    }

    const assistantMsg = await prisma.chatMessage.create({ data: { role: 'assistant', content: response } });
    res.json({ userMessage: userMsg, assistantMessage: assistantMsg });
  } catch (err: any) {
    console.error('[chat/send]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.delete('/messages', planBasedLimiter('chat'), requireScope('admin:write'), async (_: Request, res: Response) => {
  try {
    await prisma.chatMessage.deleteMany();
    res.json({ success: true });
  } catch (err: any) {
    console.error('[chat/delete]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

export default router;
