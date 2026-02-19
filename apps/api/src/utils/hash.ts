import crypto from "node:crypto";

export function hashApiKey(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext).digest("hex");
}

export function generateApiKey(): string {
  const random = crypto.randomBytes(24).toString("hex");
  return `gm7_${random}`;
}
