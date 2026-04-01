/**
 * Tenant Guard Middleware — ensures the authenticated user can only
 * access resources belonging to their own restaurant.
 *
 * Compares req.params.restaurantId with req.user.restaurantId (from JWT).
 * Returns 403 if they don't match.
 */

import { Request, Response, NextFunction } from "express";

export function tenantGuard(req: Request, res: Response, next: NextFunction) {
  // Check both :restaurantId and :id (some routes use :id for the restaurant)
  const paramRestaurantId = req.params.restaurantId || req.params.id;

  // If the route doesn't have a restaurant param, skip (nothing to guard)
  if (!paramRestaurantId) return next();

  const user = (req as any).user;

  // If no user on request (auth was skipped or failed), reject
  if (!user || !user.restaurantId) {
    return res.status(403).json({ error: "Forbidden — no tenant context" });
  }

  if (paramRestaurantId !== user.restaurantId) {
    console.warn(
      `[TenantGuard] BLOCKED: user=${user.userId} tried to access restaurant=${paramRestaurantId} but belongs to ${user.restaurantId}`
    );
    return res.status(403).json({ error: "Forbidden — you cannot access this restaurant" });
  }

  next();
}
