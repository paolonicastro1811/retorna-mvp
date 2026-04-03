import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../database/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "");

// Stripe Price IDs — set these in .env after creating products in Stripe Dashboard
const PRICE_IDS: Record<string, string> = {
  manual_monthly: process.env.STRIPE_PRICE_MANUAL_MONTHLY || "",
  manual_annual: process.env.STRIPE_PRICE_MANUAL_ANNUAL || "",
  automatic_monthly: process.env.STRIPE_PRICE_AUTOMATIC_MONTHLY || "",
  automatic_annual: process.env.STRIPE_PRICE_AUTOMATIC_ANNUAL || "",
};

const router = Router();

// ─── Create Checkout Session ─────────────────────────────────────
// POST /billing/checkout
router.post("/checkout", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.restaurantId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: user.restaurantId },
  });
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurante não encontrado" });
  }

  const { billingCycle } = req.body;
  const cycle = billingCycle === "annual" ? "annual" : "monthly";
  const priceKey = `${restaurant.plan}_${cycle}`;
  const priceId = PRICE_IDS[priceKey];

  if (!priceId) {
    return res.status(400).json({ error: "Preço não configurado para este plano" });
  }

  // Create or reuse Stripe customer
  let customerId = restaurant.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: restaurant.name,
      metadata: {
        restaurantId: restaurant.id,
        plan: restaurant.plan,
      },
    });
    customerId = customer.id;
    await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { stripeCustomerId: customerId },
    });
  }

  const appUrl = process.env.APP_URL || "http://localhost:5173";

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card", "boleto"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/painel?billing=success`,
    cancel_url: `${appUrl}/painel?billing=canceled`,
    metadata: {
      restaurantId: restaurant.id,
    },
  });

  res.json({ url: session.url });
});

// ─── Customer Portal ─────────────────────────────────────────────
// POST /billing/portal
router.post("/portal", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.restaurantId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: user.restaurantId },
  });
  if (!restaurant?.stripeCustomerId) {
    return res.status(400).json({ error: "Nenhuma assinatura encontrada" });
  }

  const appUrl = process.env.APP_URL || "http://localhost:5173";

  const session = await stripe.billingPortal.sessions.create({
    customer: restaurant.stripeCustomerId,
    return_url: `${appUrl}/painel`,
  });

  res.json({ url: session.url });
});

// ─── Get subscription status ─────────────────────────────────────
// GET /billing/status
router.get("/status", async (req: Request, res: Response) => {
  const user = (req as any).user;
  if (!user?.restaurantId) {
    return res.status(401).json({ error: "Não autenticado" });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: user.restaurantId },
    select: {
      plan: true,
      billingCycle: true,
      subscriptionStatus: true,
      trialStartDate: true,
      trialDays: true,
      stripeSubscriptionId: true,
      timezone: true,
    },
  });
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurante não encontrado" });
  }

  let trialEndsAt: Date | null = null;
  let trialDaysRemaining = 0;

  if (restaurant.trialStartDate) {
    trialEndsAt = new Date(restaurant.trialStartDate);
    trialEndsAt.setDate(trialEndsAt.getDate() + restaurant.trialDays);

    // Use restaurant timezone for fair day calculation
    const tz = restaurant.timezone || "America/Sao_Paulo";
    const nowInTz = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
    trialDaysRemaining = Math.max(
      0,
      Math.ceil((trialEndsAt.getTime() - nowInTz.getTime()) / (1000 * 60 * 60 * 24))
    );
  }

  const isActive =
    restaurant.subscriptionStatus === "active" ||
    (restaurant.subscriptionStatus === "trialing" && trialDaysRemaining > 0);

  res.json({
    plan: restaurant.plan,
    billingCycle: restaurant.billingCycle,
    subscriptionStatus: restaurant.subscriptionStatus,
    trialEndsAt,
    trialDaysRemaining,
    isActive,
    hasSubscription: !!restaurant.stripeSubscriptionId,
  });
});

export const billingRouter = router;

// ─── Stripe Webhook (mounted separately, needs raw body) ─────────
export const stripeWebhookRouter = Router();

stripeWebhookRouter.post(
  "/",
  async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

    // Reject webhooks if signature verification is not configured in production
    if (!endpointSecret) {
      if (process.env.NODE_ENV === "production") {
        console.error("FATAL: STRIPE_WEBHOOK_SECRET not set — rejecting webhook");
        return res.status(500).json({ error: "Webhook signature secret not configured" });
      }
      console.warn("[Stripe] WARNING: STRIPE_WEBHOOK_SECRET not set — skipping signature verification in dev");
    }

    let event: Stripe.Event;
    try {
      if (endpointSecret) {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
      } else {
        // Dev only: parse raw body as event (no signature check)
        event = JSON.parse(req.body.toString()) as Stripe.Event;
      }
    } catch (err) {
      console.error("Stripe webhook signature verification failed:", err);
      return res.status(400).json({ error: "Webhook signature failed" });
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const restaurantId = session.metadata?.restaurantId;
        if (restaurantId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          await prisma.restaurant.update({
            where: { id: restaurantId },
            data: {
              stripeSubscriptionId: subscription.id,
              stripePriceId: subscription.items.data[0]?.price.id || null,
              subscriptionStatus: "active",
            },
          });
          console.log(`[Stripe] Subscription activated for restaurant ${restaurantId}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const restaurant = await prisma.restaurant.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (restaurant) {
          let status = "active";
          if (subscription.status === "past_due") status = "past_due";
          if (subscription.status === "canceled") status = "canceled";
          if (subscription.status === "unpaid") status = "expired";

          await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: {
              subscriptionStatus: status,
              stripePriceId: subscription.items.data[0]?.price.id || null,
            },
          });
          console.log(`[Stripe] Subscription ${status} for restaurant ${restaurant.id}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const restaurant = await prisma.restaurant.findUnique({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (restaurant) {
          await prisma.restaurant.update({
            where: { id: restaurant.id },
            data: { subscriptionStatus: "expired" },
          });
          console.log(`[Stripe] Subscription expired for restaurant ${restaurant.id}`);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const invoiceSub = (invoice as any).subscription as string | null;
        if (invoiceSub) {
          const restaurant = await prisma.restaurant.findUnique({
            where: { stripeSubscriptionId: invoiceSub },
          });
          if (restaurant) {
            await prisma.restaurant.update({
              where: { id: restaurant.id },
              data: { subscriptionStatus: "past_due" },
            });
            console.log(`[Stripe] Payment failed for restaurant ${restaurant.id}`);
          }
        }
        break;
      }
    }

    res.json({ received: true });
  }
);
