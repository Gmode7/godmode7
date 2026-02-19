import { describe, it, expect, vi, afterEach } from 'vitest';
import { hasEnvVar } from './envCheck.js';

describe('hasEnvVar', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns true for openai when OPENAI_API_KEY starts with sk-', () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-test123');
    expect(hasEnvVar('openai')).toBe(true);
  });

  it('returns false for openai when OPENAI_API_KEY is missing', () => {
    vi.stubEnv('OPENAI_API_KEY', '');
    expect(hasEnvVar('openai')).toBe(false);
  });

  it('returns false for openai when key does not start with sk-', () => {
    vi.stubEnv('OPENAI_API_KEY', 'bad-key');
    expect(hasEnvVar('openai')).toBe(false);
  });

  it('returns true for kimi when KIMI_API_KEY is long enough', () => {
    vi.stubEnv('KIMI_API_KEY', 'long-enough-key');
    expect(hasEnvVar('kimi')).toBe(true);
  });

  it('returns false for kimi when key is too short', () => {
    vi.stubEnv('KIMI_API_KEY', 'short');
    expect(hasEnvVar('kimi')).toBe(false);
  });

  it('returns true for claude when ANTHROPIC_API_KEY starts with sk-ant-', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'sk-ant-test123');
    expect(hasEnvVar('claude')).toBe(true);
  });

  it('returns false for claude when key does not start with sk-ant-', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'wrong-prefix');
    expect(hasEnvVar('claude')).toBe(false);
  });

  it('returns true for unknown provider', () => {
    expect(hasEnvVar('unknown')).toBe(true);
  });
});
