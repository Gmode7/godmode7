import { describe, it, expect } from 'vitest';
import { isValidPlan, PLAN_LIMITS, UNAUTHENTICATED_LIMITS } from './plans.js';

describe('isValidPlan', () => {
  it('accepts "basic"', () => {
    expect(isValidPlan('basic')).toBe(true);
  });

  it('accepts "pro"', () => {
    expect(isValidPlan('pro')).toBe(true);
  });

  it('accepts "business"', () => {
    expect(isValidPlan('business')).toBe(true);
  });

  it('rejects invalid plan names', () => {
    expect(isValidPlan('enterprise')).toBe(false);
    expect(isValidPlan('')).toBe(false);
    expect(isValidPlan('BASIC')).toBe(false);
  });
});

describe('PLAN_LIMITS', () => {
  it('basic < pro < business for globalRequestsPerMin', () => {
    expect(PLAN_LIMITS.basic.globalRequestsPerMin).toBeLessThan(
      PLAN_LIMITS.pro.globalRequestsPerMin,
    );
    expect(PLAN_LIMITS.pro.globalRequestsPerMin).toBeLessThan(
      PLAN_LIMITS.business.globalRequestsPerMin,
    );
  });

  it('basic < pro < business for chatRequestsPerMin', () => {
    expect(PLAN_LIMITS.basic.chatRequestsPerMin).toBeLessThan(
      PLAN_LIMITS.pro.chatRequestsPerMin,
    );
    expect(PLAN_LIMITS.pro.chatRequestsPerMin).toBeLessThan(
      PLAN_LIMITS.business.chatRequestsPerMin,
    );
  });

  it('unauthenticated limits are lower than basic', () => {
    expect(UNAUTHENTICATED_LIMITS.globalRequestsPerMin).toBeLessThan(
      PLAN_LIMITS.basic.globalRequestsPerMin,
    );
    expect(UNAUTHENTICATED_LIMITS.chatRequestsPerMin).toBeLessThan(
      PLAN_LIMITS.basic.chatRequestsPerMin,
    );
  });
});
