import { describe, it, expect } from 'vitest';
import { parseScopes, hasScope, scopesToString, VALID_SCOPES, type Scope } from './scopes.js';

describe('parseScopes', () => {
  it('parses comma-separated scopes', () => {
    const scopes = parseScopes('projects:read,jobs:read');
    expect(scopes).toEqual(['projects:read', 'jobs:read']);
  });

  it('trims whitespace', () => {
    const scopes = parseScopes(' projects:read , jobs:read ');
    expect(scopes).toEqual(['projects:read', 'jobs:read']);
  });

  it('filters out invalid scopes', () => {
    const scopes = parseScopes('projects:read,bogus:scope,jobs:read');
    expect(scopes).toEqual(['projects:read', 'jobs:read']);
  });

  it('returns empty array for empty string', () => {
    expect(parseScopes('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseScopes('   ')).toEqual([]);
  });
});

describe('hasScope', () => {
  it('returns true when scope is present', () => {
    const scopes: Scope[] = ['projects:read', 'jobs:write'];
    expect(hasScope(scopes, 'projects:read')).toBe(true);
  });

  it('returns false when scope is missing', () => {
    const scopes: Scope[] = ['projects:read'];
    expect(hasScope(scopes, 'admin:write')).toBe(false);
  });

  it('returns false for empty scopes array', () => {
    expect(hasScope([], 'projects:read')).toBe(false);
  });
});

describe('scopesToString', () => {
  it('joins scopes with commas', () => {
    const scopes: Scope[] = ['projects:read', 'jobs:write'];
    expect(scopesToString(scopes)).toBe('projects:read,jobs:write');
  });

  it('returns empty string for empty array', () => {
    expect(scopesToString([])).toBe('');
  });
});
