import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireScope } from '../middlewares/requireScope.js';
import { planBasedLimiter } from '../middlewares/rateLimiter.js';
import { gatesEngine } from '@ai-native/core';
import { ChatMessageSchema } from '../schemas/inline.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

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

    let response = '';
    const lc = content.toLowerCase();

    if (lc.includes('help') || lc === 'hi' || lc === 'hello') {
      response = 'Welcome to AI-Native Backend! Commands: status, projects, jobs, gates, create project [name], create job [projectId]';
    } else if (lc.includes('status')) {
      const [p, j, a] = await Promise.all([prisma.project.count(), prisma.job.count(), prisma.agentIdentity.count()]);
      response = 'System Status: Projects: ' + p + ', Jobs: ' + j + ', Agents: ' + a + ', API: Healthy, Version: 1.3.0';
    } else if (lc.startsWith('create project')) {
      const name = content.replace(/create project\s*/i, '').trim() || 'New Project';
      const project = await prisma.project.create({ data: { name, clientId: (req as any).agent?.id || 'default' } });
      response = 'Project Created! Name: ' + project.name + ', ID: ' + project.id;
    } else if (lc.startsWith('create job')) {
      const projectId = content.replace(/create job\s*/i, '').trim();
      if (!projectId) {
        response = 'Please provide a project ID: create job <projectId>';
      } else {
        try {
          const job = await prisma.job.create({ data: { projectId, strategy: 'A', riskClassification: 'standard' } });
          response = 'Job Created! ID: ' + job.id + ', State: ' + job.currentState;
        } catch (e) {
          response = 'Invalid project ID. Use "projects" to see available projects.';
        }
      }
    } else if (lc.includes('project')) {
      const projects = await prisma.project.findMany({ take: 10, orderBy: { createdAt: 'desc' } });
      response = projects.length === 0
        ? 'No Projects Yet. Create one: create project MyProject'
        : 'Projects (' + projects.length + '): ' + projects.map(p => p.name + ' [' + p.id + ']').join(', ');
    } else if (lc.includes('job')) {
      const jobs = await prisma.job.findMany({ take: 10, orderBy: { createdAt: 'desc' }, include: { project: true } });
      response = jobs.length === 0
        ? 'No Jobs Yet.'
        : 'Jobs (' + jobs.length + '): ' + jobs.map(j => j.project.name + ' [' + j.id.slice(0,8) + '...] ' + j.currentState).join(', ');
    } else if (lc.includes('gate')) {
      const gates = gatesEngine.getGateDefinitions();
      response = 'Gates: ' + gates.map(g => g.type + ': ' + g.description).join('; ');
    } else {
      response = 'I received: "' + content + '". Try: help, status, projects, jobs, gates';
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
