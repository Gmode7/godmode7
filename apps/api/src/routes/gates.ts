import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { requireScope } from '../middlewares/requireScope.js';
import { gatesEngine } from '@ai-native/core';
import { GateCheckSchema } from '../schemas/inline.js';

const router = Router();
const isProduction = process.env.NODE_ENV === 'production';

router.get('/job/:jobId', requireScope('projects:read'), async (req: Request, res: Response) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.jobId }, include: { gates: true } });
    if (!job) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json({ gates: job.gates, requiredGates: gatesEngine.getRequiredGates(job.strategy, job.riskClassification) });
  } catch (err: any) {
    console.error('[gates/job]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.post('/check', requireScope('projects:write'), async (req: Request, res: Response) => {
  try {
    const parsed = GateCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation Error', details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { jobId, gateType } = parsed.data;
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { artifacts: true, gates: true } });
    if (!job) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    const result = gatesEngine.checkGate(gateType, job.artifacts.map(a => ({ type: a.type })),
      job.gates.map(g => ({ gateType: g.gateType, status: g.status as any })));
    await prisma.gate.upsert({
      where: { jobId_gateType: { jobId, gateType } },
      update: { status: result.status, reason: result.reason, checkedAt: new Date() },
      create: { jobId, gateType, status: result.status, reason: result.reason, checkedAt: new Date() }
    });
    res.json(result);
  } catch (err: any) {
    console.error('[gates/check]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

router.get('/definitions', requireScope('projects:read'), (_: Request, res: Response) => {
  res.json({ gates: gatesEngine.getGateDefinitions() });
});

export default router;
