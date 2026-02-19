import type { Scope } from "../utils/scopes";
import type { Plan } from "../utils/plans";

declare global {
  namespace Express {
    interface Request {
      agent?: {
        id: string;
        name: string;
        role: string;
        plan: Plan;
        isActive: boolean;
      };
      apiKey?: {
        id: string;
        name: string;
        scopes: Scope[];
      };
      plan?: Plan;
      scopes?: Scope[];
    }
  }
}
