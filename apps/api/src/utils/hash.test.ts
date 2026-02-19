import { describe, it, expect } from 'vitest';
import { hashApiKey, generateApiKey } from './hash.js';

describe('hashApiKey', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashApiKey('gm7_test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashApiKey('same-key')).toBe(hashApiKey('same-key'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashApiKey('key-a')).not.toBe(hashApiKey('key-b'));
  });
});

describe('generateApiKey', () => {
  it('starts with gm7_ prefix', () => {
    const key = generateApiKey();
    expect(key.startsWith('gm7_')).toBe(true);
  });

  it('has correct length (4 prefix + 48 hex chars)', () => {
    const key = generateApiKey();
    expect(key).toHaveLength(4 + 48);
  });

  it('generates unique keys', () => {
    const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
    expect(keys.size).toBe(10);
  });
});
