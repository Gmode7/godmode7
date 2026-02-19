import type { Request, Response, NextFunction } from "express";
import type { Scope } from "../utils/scopes.js";
import { hasScope } from "../utils/scopes.js";

export function requireScope(scope: Scope) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userScopes = req.scopes;
    if (!userScopes || !hasScope(userScopes, scope)) {
      res.status(403).json({
        error: "Forbidden",
        message: "Missing required scope: " + scope,
      });
      return;
    }
    next();
  };
}

export function requireAnyScope(...scopes: Scope[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userScopes = req.scopes;
    if (!userScopes || !scopes.some((s) => hasScope(userScopes, s))) {
      res.status(403).json({
        error: "Forbidden",
        message: "Missing required scope. Need one of: " + scopes.join(", "),
      });
      return;
    }
    next();
  };
}
