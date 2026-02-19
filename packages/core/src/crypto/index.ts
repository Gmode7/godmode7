import crypto from 'crypto';
export function hashSHA256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}
export function hashApiKey(key: string): string {
  return hashSHA256(key);
}
