import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { z } from "zod";
import { requireScope } from "../middlewares/requireScope.js";
import { generateApiKey, hashApiKey } from "../utils/hash.js";
import { VALID_SCOPES, DEFAULT_SCOPES, scopesToString, type Scope } from "../utils/scopes.js";
import { VALID_PLANS } from "../utils/plans.js";
import { hasEnvVar } from "../utils/envCheck.js";
const router = Router();

// All admin routes require admin:read at minimum
router.use(requireScope("admin:read"));

// ── Zod Schemas ──

const CreateApiKeySchema = z.object({
  agentId: z.string().min(1, "agentId is required"),
  name: z.string().min(1).max(100).default("default"),
  scopes: z
    .array(z.enum(VALID_SCOPES as unknown as [string, ...string[]]))
    .min(1)
    .default([...DEFAULT_SCOPES]),
  expiresAt: z
    .string()
    .datetime()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
});

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.string().min(1).max(100).default("agent"),
  plan: z.enum(VALID_PLANS as unknown as [string, ...string[]]).default("basic"),
});

// ── API Key Endpoints ──

router.post(
  "/api-keys",
  requireScope("admin:write"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateApiKeySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation Error", details: parsed.error.flatten().fieldErrors });
      return;
    }

    const { agentId, name, scopes, expiresAt } = parsed.data;

    const agent = await prisma.agentIdentity.findUnique({ where: { id: agentId } });
    if (!agent) {
      res.status(404).json({ error: "Not Found", message: "Agent not found" });
      return;
    }

    const plaintext = generateApiKey();
    const keyHash = hashApiKey(plaintext);

    const apiKey = await prisma.apiKey.create({
      data: {
        keyHash,
        name,
        scopes: scopesToString(scopes as Scope[]),
        agentId,
        expiresAt,
      },
    });

    res.status(201).json({
      id: apiKey.id,
      name: apiKey.name,
      scopes: scopes,
      agentId,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      key: plaintext,
      warning: "This is the only time the full API key will be shown. Store it securely.",
    });
  }
);

router.post(
  "/api-keys/:id/revoke",
  requireScope("admin:write"),
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    try {
      const apiKey = await prisma.apiKey.update({
        where: { id },
        data: { isActive: false },
      });
      res.json({ id: apiKey.id, name: apiKey.name, isActive: false, revokedAt: new Date().toISOString() });
    } catch (err: any) {
      if (err?.code === "P2025") {
        res.status(404).json({ error: "Not Found", message: "API key not found" });
        return;
      }
      throw err;
    }
  }
);

router.get("/api-keys", async (_req: Request, res: Response): Promise<void> => {
  const keys = await prisma.apiKey.findMany({
    select: {
      id: true,
      name: true,
      scopes: true,
      isActive: true,
      expiresAt: true,
      createdAt: true,
      agentId: true,
      agent: { select: { name: true, role: true, plan: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    count: keys.length,
    keys: keys.map((k) => ({
      ...k,
      scopes: k.scopes ? k.scopes.split(",").filter(Boolean) : [],
    })),
  });
});

// ── Agent Endpoints ──

router.get("/agents", async (_req: Request, res: Response): Promise<void> => {
  const agents = await prisma.agentIdentity.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      plan: true,
      isActive: true,
      createdAt: true,
      _count: { select: { apiKeys: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  res.json({ count: agents.length, agents });
});

router.post(
  "/agents",
  requireScope("admin:write"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = CreateAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation Error", details: parsed.error.flatten().fieldErrors });
      return;
    }
    const { name, role, plan } = parsed.data;
    const agent = await prisma.agentIdentity.create({ data: { name, role, plan } });
    res.status(201).json(agent);
  }
);

// ── Status ──

const isProduction = process.env.NODE_ENV === "production";

router.get("/status", async (_req: Request, res: Response): Promise<void> => {
  try {
    const [agentCount, jobCount, projectCount] = await Promise.all([
      prisma.agentIdentity.count(), prisma.job.count(), prisma.project.count()
    ]);
    res.json({ agentCount, jobCount, projectCount, version: '1.3.0' });
  } catch (err: any) {
    console.error('[admin/status]', err);
    res.status(500).json({ error: isProduction ? 'Internal error' : err.message });
  }
});

// ── Agent Readiness ──
// NOTE: /agents/readiness MUST be before /agents/:id/ready so Express
// doesn't match "readiness" as an :id param.

router.get(
  "/agents/readiness",
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const agents = await prisma.agentIdentity.findMany({
        select: {
          id: true,
          name: true,
          role: true,
          provider: true,
          isActive: true,
          isReady: true,
          readinessNote: true,
        },
        orderBy: { createdAt: 'asc' }
      });

      const agentStatuses = agents.map(agent => {
        const missingEnv: string[] = [];

        if (!hasEnvVar(agent.provider)) {
          switch (agent.provider) {
            case 'openai':
              missingEnv.push('OPENAI_API_KEY');
              break;
            case 'kimi':
              missingEnv.push('KIMI_API_KEY');
              break;
            case 'claude':
              missingEnv.push('ANTHROPIC_API_KEY');
              break;
          }
        }

        return {
          ...agent,
          missingEnv,
          overallReady: agent.isActive && agent.isReady && missingEnv.length === 0,
        };
      });

      const allReady = agentStatuses.every(a => a.overallReady);

      res.json({
        ok: allReady,
        agents: agentStatuses,
      });
    } catch (err: any) {
      console.error('[admin/agents/readiness]', err);
      res.status(500).json({
        error: isProduction ? 'Internal error' : err.message,
      });
    }
  }
);

router.post(
  "/agents/:id/ready",
  requireScope("admin:write"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { isReady, note } = req.body;

      if (typeof isReady !== 'boolean') {
        res.status(400).json({ error: 'isReady must be a boolean' });
        return;
      }
      if (note && typeof note === 'string' && note.length > 500) {
        res.status(400).json({ error: 'note must be <= 500 chars' });
        return;
      }

      const agent = await prisma.agentIdentity.update({
        where: { id },
        data: {
          isReady,
          readinessNote: note || null,
        },
        select: {
          id: true,
          name: true,
          role: true,
          provider: true,
          isActive: true,
          isReady: true,
          readinessNote: true,
        }
      });

      res.json({ agent });
    } catch (err: any) {
      console.error('[admin/agents/ready]', err);
      if (err.code === 'P2025') {
        res.status(404).json({ error: 'Agent not found' });
        return;
      }
      res.status(500).json({
        error: isProduction ? 'Internal error' : err.message,
      });
    }
  }
);

export default router;
