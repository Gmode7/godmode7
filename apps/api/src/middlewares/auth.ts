import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { hashApiKey } from "../utils/hash.js";
import { parseScopes } from "../utils/scopes.js";
import { isValidPlan, type Plan } from "../utils/plans.js";
const isProduction = () => process.env.NODE_ENV === "production";

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKeyHeader = req.headers["x-api-key"];

  // Dev bypass (NEVER in production)
  if (!isProduction() && !apiKeyHeader) {
    const devKey = process.env.DEV_API_KEY;
    if (devKey) {
      const keyHash = hashApiKey(devKey);
      const found = await prisma.apiKey.findUnique({
        where: { keyHash },
        include: { agent: true },
      });

      if (found && found.isActive && found.agent.isActive) {
        const plan = isValidPlan(found.agent.plan) ? found.agent.plan : "basic" as Plan;
        const scopes = parseScopes(found.scopes);
        req.agent = {
          id: found.agent.id,
          name: found.agent.name,
          role: found.agent.role,
          plan,
          isActive: found.agent.isActive,
        };
        req.apiKey = { id: found.id, name: found.name, scopes };
        req.plan = plan;
        req.scopes = scopes;
        return next();
      }
    }
    res.status(401).json({
      error: "Unauthorized",
      message: "Missing x-api-key header. Set DEV_API_KEY in .env for dev bypass.",
    });
    return;
  }

  if (!apiKeyHeader || typeof apiKeyHeader !== "string") {
    res.status(401).json({ error: "Unauthorized", message: "Missing x-api-key header" });
    return;
  }

  try {
    const keyHash = hashApiKey(apiKeyHeader);
    const apiKeyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { agent: true },
    });

    if (!apiKeyRecord) {
      res.status(401).json({ error: "Unauthorized", message: "Invalid API key" });
      return;
    }
    if (!apiKeyRecord.isActive) {
      res.status(401).json({ error: "Unauthorized", message: "API key has been revoked" });
      return;
    }
    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      res.status(401).json({ error: "Unauthorized", message: "API key has expired" });
      return;
    }
    if (!apiKeyRecord.agent.isActive) {
      res.status(403).json({ error: "Forbidden", message: "Agent account is deactivated" });
      return;
    }

    const plan = isValidPlan(apiKeyRecord.agent.plan) ? apiKeyRecord.agent.plan : "basic" as Plan;
    const scopes = parseScopes(apiKeyRecord.scopes);

    req.agent = {
      id: apiKeyRecord.agent.id,
      name: apiKeyRecord.agent.name,
      role: apiKeyRecord.agent.role,
      plan,
      isActive: apiKeyRecord.agent.isActive,
    };
    req.apiKey = { id: apiKeyRecord.id, name: apiKeyRecord.name, scopes };
    req.plan = plan;
    req.scopes = scopes;
    next();
  } catch (err) {
    console.error("[auth] DB lookup failed:", err);
    res.status(500).json({
      error: "Internal Server Error",
      message: isProduction() ? "Authentication service unavailable" : String(err),
    });
  }
}
