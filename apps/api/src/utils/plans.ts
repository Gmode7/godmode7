export const VALID_PLANS = ["basic", "pro", "business"] as const;
export type Plan = (typeof VALID_PLANS)[number];

export function isValidPlan(plan: string): plan is Plan {
  return VALID_PLANS.includes(plan as Plan);
}

export interface PlanLimits {
  globalRequestsPerMin: number;
  chatRequestsPerMin: number;
}

export const PLAN_LIMITS: Record<Plan, PlanLimits> = {
  basic: { globalRequestsPerMin: 60, chatRequestsPerMin: 10 },
  pro: { globalRequestsPerMin: 120, chatRequestsPerMin: 30 },
  business: { globalRequestsPerMin: 300, chatRequestsPerMin: 120 },
};

export const UNAUTHENTICATED_LIMITS: PlanLimits = {
  globalRequestsPerMin: 30,
  chatRequestsPerMin: 5,
};
