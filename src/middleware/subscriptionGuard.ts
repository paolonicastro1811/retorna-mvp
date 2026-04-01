import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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
    },
  });

  if (!restaurant) return next();

  // Active subscription — always allow
  if (restaurant.subscriptionStatus === "active") return next();

  // Check trial period
  if (restaurant.subscriptionStatus === "trialing" && restaurant.trialStartDate) {
    const trialEnd = new Date(restaurant.trialStartDate);
    trialEnd.setDate(trialEnd.getDate() + restaurant.trialDays);

    if (new Date() < trialEnd) {
      return next(); // Still within trial
    }

    // Trial expired — update status
    await prisma.restaurant.update({
      where: { id: user.restaurantId },
      data: { subscriptionStatus: "expired" },
    });
  }

  // Subscription expired, past_due, or canceled
  return res.status(402).json({
    error: "Assinatura necessária",
    code: "SUBSCRIPTION_REQUIRED",
    message: "Seu período de teste expirou. Assine um plano para continuar usando o sistema.",
  });
}
