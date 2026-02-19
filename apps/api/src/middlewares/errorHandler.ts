import type { Request, Response, NextFunction } from "express";

const isProduction = () => process.env.NODE_ENV === "production";

export function errorHandler(
  err: Error & { status?: number; statusCode?: number },
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const status = err.status || err.statusCode || 500;
  console.error("[error] " + status + " " + err.message, isProduction() ? "" : err.stack);
  res.status(status).json({
    error: status >= 500 ? "Internal Server Error" : err.message,
    ...(isProduction() ? {} : { stack: err.stack }),
  });
}
