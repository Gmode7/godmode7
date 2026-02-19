import { describe, it, expect } from 'vitest';
import { hashSHA256, hashApiKey } from './index.js';

describe('hashSHA256', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashSHA256('test');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic', () => {
    expect(hashSHA256('hello')).toBe(hashSHA256('hello'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashSHA256('a')).not.toBe(hashSHA256('b'));
  });

  it('handles empty string', () => {
    const hash = hashSHA256('');
    expect(hash).toHaveLength(64);
  });
});

describe('hashApiKey', () => {
  it('returns a 64-character hex string', () => {
    const hash = hashApiKey('gm7_abc123');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is consistent with hashSHA256', () => {
    const key = 'gm7_testkey';
    expect(hashApiKey(key)).toBe(hashSHA256(key));
  });

  it('produces different hashes for different keys', () => {
    expect(hashApiKey('key1')).not.toBe(hashApiKey('key2'));
  });
});
