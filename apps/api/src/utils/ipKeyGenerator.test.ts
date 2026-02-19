import { describe, it, expect } from 'vitest';
import { ipKeyGenerator, rateLimitKeyGenerator } from './ipKeyGenerator.js';

function mockReq(overrides: Record<string, any> = {}): any {
  return {
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ip: '127.0.0.1',
    ...overrides,
  };
}

describe('ipKeyGenerator', () => {
  it('extracts IP from x-forwarded-for string', () => {
    const req = mockReq({ headers: { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' } });
    expect(ipKeyGenerator(req)).toBe('10.0.0.1');
  });

  it('extracts IP from x-forwarded-for array', () => {
    const req = mockReq({ headers: { 'x-forwarded-for': ['10.0.0.5'] } });
    expect(ipKeyGenerator(req)).toBe('10.0.0.5');
  });

  it('strips ::ffff: prefix', () => {
    const req = mockReq({
      headers: {},
      socket: { remoteAddress: '::ffff:192.168.1.1' },
    });
    expect(ipKeyGenerator(req)).toBe('192.168.1.1');
  });

  it('falls back to socket remoteAddress', () => {
    const req = mockReq({ headers: {}, socket: { remoteAddress: '10.1.1.1' } });
    expect(ipKeyGenerator(req)).toBe('10.1.1.1');
  });

  it('returns "unknown" when no IP source available', () => {
    const req = mockReq({ headers: {}, socket: {}, ip: undefined });
    expect(ipKeyGenerator(req)).toBe('unknown');
  });
});

describe('rateLimitKeyGenerator', () => {
  it('uses API key when present', () => {
    const req = mockReq({ headers: { 'x-api-key': 'gm7_abc123' } });
    expect(rateLimitKeyGenerator(req)).toBe('key:gm7_abc123');
  });

  it('falls back to IP when no API key', () => {
    const req = mockReq({ headers: {}, socket: { remoteAddress: '10.0.0.1' } });
    expect(rateLimitKeyGenerator(req)).toBe('ip:10.0.0.1');
  });

  it('falls back to IP when API key is empty string', () => {
    const req = mockReq({ headers: { 'x-api-key': '' }, socket: { remoteAddress: '10.0.0.1' } });
    expect(rateLimitKeyGenerator(req)).toBe('ip:10.0.0.1');
  });
});
