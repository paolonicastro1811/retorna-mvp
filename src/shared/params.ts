import type { Request } from "express";

/**
 * Safe param extraction — Express 5 types params as string | string[].
 * In practice route params are always string.
 */
export function param(req: Request, name: string): string {
  const val = req.params[name];
  return Array.isArray(val) ? val[0] : val;
}

export function queryString(req: Request, name: string): string | undefined {
  const val = req.query[name];
  if (!val) return undefined;
  return Array.isArray(val) ? String(val[0]) : String(val);
}
