import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "../lib/redis.js";
import { rateLimitKeyGenerator } from "../utils/ipKeyGenerator.js";
import { PLAN_LIMITS, UNAUTHENTICATED_LIMITS, type Plan } from "../utils/plans.js";

function makeRedisStore(prefix: string): InstanceType<typeof RedisStore> | undefined {
  const redis = getRedis();
  if (!redis) return undefined;
  return new RedisStore({
    sendCommand: (...args: string[]) => redis.call(args[0], ...args.slice(1)) as any,
    prefix: `rl:global:${prefix}:`,
  });
}

export const globalRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: rateLimitKeyGenerator,
  store: makeRedisStore("global"),
  message: { error: "Too Many Requests", message: "Rate limit exceeded. Please slow down." },
});

// ── In-memory fallback store for plan-based limiter ──

const planStores: Map<string, { count: number; resetAt: number }> = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of planStores) {
    if (entry.resetAt <= now) planStores.delete(key);
  }
}, 5 * 60 * 1000).unref();

async function planLimitWithRedis(
  storeKey: string,
  windowMs: number,
): Promise<{ count: number; ttlMs: number }> {
  const redis = getRedis();
  if (!redis) throw new Error("no redis");

  const redisKey = `rl:plan:${storeKey}`;
  const results = await redis
    .multi()
    .incr(redisKey)
    .pttl(redisKey)
    .exec();

  const count = (results?.[0]?.[1] as number) ?? 1;
  let ttl = (results?.[1]?.[1] as number) ?? -1;

  // Set expiry on first increment (ttl == -1 means no expiry set)
  if (ttl < 0) {
    await redis.pexpire(redisKey, windowMs);
    ttl = windowMs;
  }

  return { count, ttlMs: ttl };
}

export function planBasedLimiter(type: "global" | "chat") {
  return async (req: Request, res: Response, next: Function): Promise<void> => {
    const plan: Plan = req.plan || "basic";
    const limits = PLAN_LIMITS[plan] || UNAUTHENTICATED_LIMITS;
    const maxRequests = type === "chat" ? limits.chatRequestsPerMin : limits.globalRequestsPerMin;
    const windowMs = 60_000;

    const rateLimitKey = rateLimitKeyGenerator(req);
    const storeKey = type + ":" + rateLimitKey;

    let count: number;
    let resetSeconds: number;

    try {
      const result = await planLimitWithRedis(storeKey, windowMs);
      count = result.count;
      resetSeconds = Math.ceil(result.ttlMs / 1000);
    } catch {
      // Fallback to in-memory when Redis is unavailable
      const now = Date.now();
      let entry = planStores.get(storeKey);

      if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + windowMs };
        planStores.set(storeKey, entry);
      }

      entry.count++;
      count = entry.count;
      resetSeconds = Math.ceil((entry.resetAt - now) / 1000);
    }

    const remaining = Math.max(0, maxRequests - count);
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetSeconds);
    res.setHeader("X-RateLimit-Policy", maxRequests + ";w=60;comment=\"" + plan + ":" + type + "\"");

    if (count > maxRequests) {
      res.setHeader("Retry-After", resetSeconds);
      res.status(429).json({
        error: "Too Many Requests",
        message: "Plan \"" + plan + "\" allows " + maxRequests + " " + type + " requests/min. Upgrade for higher limits.",
        retryAfter: resetSeconds,
      });
      return;
    }

    next();
  };
}
