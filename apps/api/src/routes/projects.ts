import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireScope } from '../middlewares/requireScope.js';
import { CreateProjectSchema } from '../schemas/inline.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

router.get('/', requireScope('projects:read'), async (_: Request, res: Response) => {
  try {
    const projects = await prisma.project.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ projects, total: projects.length });
  } catch (err: any) {
    console.error('[projects/list]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.post('/', requireScope('projects:write'), async (req: Request, res: Response) => {
  try {
    const parsed = CreateProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { name, clientId, description } = parsed.data;
    const project = await prisma.project.create({ data: { name, clientId: clientId || 'default', description } });
    res.status(201).json(project);
  } catch (err: any) {
    console.error('[projects/create]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.delete('/:id', requireScope('projects:write'), async (req: Request, res: Response) => {
  try {
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[projects/delete]', err);
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Project not found' });
      return;
    }
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

export default router;
