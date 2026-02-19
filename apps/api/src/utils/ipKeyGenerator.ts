import type { Request } from "express";

export function ipKeyGenerator(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  let ip: string | undefined;

  if (typeof forwarded === "string") {
    ip = forwarded.split(",")[0]?.trim();
  } else if (Array.isArray(forwarded)) {
    ip = forwarded[0]?.trim();
  }

  if (!ip) {
    ip = req.socket?.remoteAddress || req.ip || "unknown";
  }

  if (ip && ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  return ip || "unknown";
}

export function rateLimitKeyGenerator(req: Request): string {
  const apiKey = req.headers["x-api-key"];
  if (typeof apiKey === "string" && apiKey.length > 0) {
    return `key:${apiKey}`;
  }
  return `ip:${ipKeyGenerator(req)}`;
}
