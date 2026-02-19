import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireScope } from '../middlewares/requireScope.js';
import { hashApiKey } from '@ai-native/core';
import { CreateArtifactSchema } from '../schemas/inline.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

router.get('/job/:jobId', requireScope('artifacts:read'), async (req: Request, res: Response) => {
  try {
    const artifacts = await prisma.artifact.findMany({ where: { jobId: req.params.jobId } });
    res.json({ artifacts: artifacts.map(a => ({ ...a, content: JSON.parse(a.content) })) });
  } catch (err: any) {
    console.error('[artifacts/list]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.post('/', requireScope('artifacts:write'), async (req: Request, res: Response) => {
  try {
    const parsed = CreateArtifactSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { type, jobId, content } = parsed.data;
    const contentStr = JSON.stringify(content);
    const hash = hashApiKey(contentStr);
    const artifact = await prisma.artifact.create({ data: { type, jobId, content: contentStr, hash } });
    res.status(201).json({ ...artifact, content });
  } catch (err: any) {
    console.error('[artifacts/create]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

export default router;
