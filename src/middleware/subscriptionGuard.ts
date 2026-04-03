import { Request, Response, NextFunction } from "express";
import { prisma } from "../database/client";

/**
 * Middleware that checks if the restaurant has an active subscription or is within trial period.
 * Returns 402 Payment Required if trial expired and no active subscription.
 */
export async function subscriptionGuard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const user = (req as any).user;
  if (!user?.restaurantId) return next(); // Let auth middleware handle this

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: user.restaurantId },
    select: {
      subscriptionStatus: true,
      trialStartDate: true,
      trialDays: true,
      timezone: true,
    },
  });

  if (!restaurant) return next();

  // Active subscription — always allow
  if (restaurant.subscriptionStatus === "active") return next();

  // Check trial period using restaurant timezone
  if (restaurant.subscriptionStatus === "trialing" && restaurant.trialStartDate) {
    const trialEnd = new Date(restaurant.trialStartDate);
    trialEnd.setDate(trialEnd.getDate() + restaurant.trialDays);

    // Get current date in restaurant timezone for fair comparison
    const tz = restaurant.timezone || "America/Sao_Paulo";
    const nowInTz = new Date(
      new Date().toLocaleString("en-US", { timeZone: tz })
    );

    if (nowInTz < trialEnd) {
      return next(); // Still within trial
    }

    // Trial expired — update status
    try {
      await prisma.restaurant.update({
        where: { id: user.restaurantId },
        data: { subscriptionStatus: "expired" },
      });
    } catch (err) {
      console.error("[SubscriptionGuard] Failed to update expired status:", err);
    }
  }

  // Subscription expired, past_due, or canceled
  return res.status(402).json({
    error: "Assinatura necessária",
    code: "SUBSCRIPTION_REQUIRED",
    message: "Seu período de teste expirou. Assine um plano para continuar usando o sistema.",
  });
}
