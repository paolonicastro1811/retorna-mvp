import { Router, Request, Response } from "express";
import { param, queryString } from "../shared/params";
import { prisma } from "../database/client";
import { customerEventService } from "../services/customerEvent.service";
import { segmentationService } from "../services/segmentation.service";
import { campaignService } from "../services/campaign.service";
import { messagingService } from "../services/messaging.service";
import { attributionService } from "../services/attribution.service";

const router = Router();

// ══════════════════════════════════════════════════════════
// POST /demo/import  [LEGACY — historical import only]
// Imported customers default to opt-in "unknown" and are
// NOT campaign-eligible until they initiate WhatsApp contact.
// Primary acquisition is now via inbound WhatsApp messages.
// ══════════════════════════════════════════════════════════

interface ImportCustomer {
  phone: string;
  name?: string;
}

interface ImportVisit {
  phone: string;
  amount?: number;
  occurredAt?: string;
}

router.post("/import", async (req: Request, res: Response) => {
  const { restaurantId, customers, visits } = req.body as {
    restaurantId: string;
    customers?: ImportCustomer[];
    visits?: ImportVisit[];
  };

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurantId is required" });
  }

  // Tenant isolation: JWT users can only import to their own restaurant
  const user = (req as any).user;
  if (user && user.restaurantId !== restaurantId) {
    return res.status(403).json({ error: "Forbidden — you cannot access this restaurant" });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }

  let customersCreated = 0;
  let customersUpdated = 0;
  let visitsCreated = 0;
  let errorsCount = 0;
  const errors: string[] = [];

  // --- Import customers [LEGACY] ---
  // Imported customers get acquisitionSource="import" and whatsappOptInStatus="unknown".
  // They remain INELIGIBLE for campaigns until they:
  //   1. Initiate a WhatsApp conversation (webhook auto-grants opt-in)
  //   2. Have at least 1 recorded visit (totalVisits >= 1)
  if (Array.isArray(customers)) {
    for (let i = 0; i < customers.length; i++) {
      const c = customers[i];
      try {
        if (!c.phone) {
          errors.push(`customer[${i}]: missing phone`);
          errorsCount++;
          continue;
        }
        const existing = await prisma.customer.findUnique({
          where: {
            restaurantId_phone: { restaurantId, phone: c.phone },
          },
        });
        if (existing) {
          if (c.name) {
            await prisma.customer.update({
              where: { id: existing.id },
              data: { name: c.name },
            });
          }
          customersUpdated++;
        } else {
          await prisma.customer.create({
            data: {
              restaurantId,
              phone: c.phone,
              name: c.name,
              acquisitionSource: "import",
            },
          });
          customersCreated++;
        }
      } catch (err) {
        errors.push(`customer[${i}]: ${(err as Error).message}`);
        errorsCount++;
      }
    }
  }

  // --- Import visits ---
  if (Array.isArray(visits)) {
    for (let i = 0; i < visits.length; i++) {
      const v = visits[i];
      try {
        if (!v.phone) {
          errors.push(`visit[${i}]: missing phone`);
          errorsCount++;
          continue;
        }
        await customerEventService.recordVisit({
          restaurantId,
          phone: v.phone,
          amount: v.amount != null ? Number(v.amount) : undefined,
          occurredAt: v.occurredAt ? new Date(v.occurredAt) : undefined,
        });
        visitsCreated++;
      } catch (err) {
        errors.push(`visit[${i}]: ${(err as Error).message}`);
        errorsCount++;
      }
    }
  }

  res.json({
    customers_created: customersCreated,
    customers_updated: customersUpdated,
    visits_created: visitsCreated,
    errors_count: errorsCount,
    ...(errors.length > 0 && { errors }),
  });
});

// ══════════════════════════════════════════════════════════
// POST /demo/run-campaign
// ══════════════════════════════════════════════════════════

const COOLDOWN_DAYS = 7;

router.post("/run-campaign", async (req: Request, res: Response) => {
  const { restaurantId } = req.body as { restaurantId: string };

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurantId is required" });
  }

  // Tenant isolation
  const user = (req as any).user;
  if (user && user.restaurantId !== restaurantId) {
    return res.status(403).json({ error: "Forbidden — you cannot access this restaurant" });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }

  // 1. Refresh lifecycle per tutti i clienti
  await segmentationService.refreshAllForRestaurant(restaurantId);

  // 2. Assicura che esista almeno un template
  let template = await prisma.messageTemplate.findFirst({
    where: { restaurantId, isActive: true },
  });
  if (!template) {
    template = await prisma.messageTemplate.create({
      data: {
        restaurantId,
        name: "Retorna Default",
        body: "Oi {{name}}! Sentimos sua falta. Volte a nos visitar e ganhe um desconto especial!",
        channel: "whatsapp",
      },
    });
  }

  // 3. Seleziona clienti inactive, applicando cooldown
  const cooldownDate = new Date();
  cooldownDate.setDate(cooldownDate.getDate() - COOLDOWN_DAYS);

  // LGPD + visit gate: only target inactive + opted-in + contactable + at least 1 visit + explicit marketing consent
  const inactiveCustomers = await prisma.customer.findMany({
    where: {
      restaurantId,
      lifecycleStatus: "inactive",
      whatsappOptInStatus: "granted",
      contactableStatus: "contactable",
      totalVisits: { gte: 1 },
      marketingOptInAt: { not: null }, // LGPD: explicit marketing consent required
    },
  });

  // Filtra: non contattati negli ultimi COOLDOWN_DAYS
  const recentlyContacted = await prisma.outboundMessage.findMany({
    where: {
      restaurantId,
      customerId: { in: inactiveCustomers.map((c) => c.id) },
      sentAt: { gte: cooldownDate },
    },
    select: { customerId: true },
  });
  const cooldownSet = new Set(recentlyContacted.map((m) => m.customerId));
  const eligible = inactiveCustomers.filter((c) => !cooldownSet.has(c.id));

  if (eligible.length === 0) {
    return res.json({
      campaignId: null,
      audience_size: 0,
      messages_sent: 0,
      messages_failed: 0,
      note: "No eligible inactive customers (all in cooldown or none inactive)",
    });
  }

  // 4. Crea campagna
  const campaign = await campaignService.create({
    restaurantId,
    name: `Retorna ${new Date().toISOString().slice(0, 10)}`,
    segmentRules: { lifecycle: ["inactive"] },
    templateId: template.id,
  });

  // 5. Build audience (solo eligible, bypass segmentRules per applicare cooldown)
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "building" },
  });
  await prisma.campaignAudienceItem.createMany({
    data: eligible.map((c) => ({
      campaignId: campaign.id,
      customerId: c.id,
    })),
    skipDuplicates: true,
  });
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "ready" },
  });

  // 6. Queue + dispatch
  const queueResult = await messagingService.queueMessages(campaign.id);
  const dispatchResult = await messagingService.dispatchCampaign(campaign.id);

  res.json({
    campaignId: campaign.id,
    audience_size: eligible.length,
    messages_sent: dispatchResult.sent,
    messages_failed: dispatchResult.failed,
  });
});

// ══════════════════════════════════════════════════════════
// GET /demo/report?restaurantId=xxx&days=30
// ══════════════════════════════════════════════════════════

router.get("/report", async (req: Request, res: Response) => {
  const restaurantId = queryString(req, "restaurantId");
  const daysParam = queryString(req, "days");

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurantId query param is required" });
  }

  // Tenant isolation
  const reportUser = (req as any).user;
  if (reportUser && reportUser.restaurantId !== restaurantId) {
    return res.status(403).json({ error: "Forbidden — you cannot access this restaurant" });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });
  if (!restaurant) {
    return res.status(404).json({ error: "Restaurant not found" });
  }

  const days = daysParam ? parseInt(daysParam, 10) : undefined;
  const since = days
    ? new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    : undefined;

  // Clienti contattati (distinct customers with outbound messages)
  const contactedResult = await prisma.outboundMessage.findMany({
    where: {
      restaurantId,
      status: { in: ["sent", "delivered", "read"] },
      ...(since && { sentAt: { gte: since } }),
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  const contactedCustomers = contactedResult.length;

  // Messaggi totali inviati
  const totalMessages = await prisma.outboundMessage.count({
    where: {
      restaurantId,
      status: { in: ["sent", "delivered", "read"] },
      ...(since && { sentAt: { gte: since } }),
    },
  });

  // Delivery breakdown
  const deliveryStats = await prisma.outboundMessage.groupBy({
    by: ["status"],
    where: {
      restaurantId,
      ...(since && { createdAt: { gte: since } }),
    },
    _count: true,
  });

  // Attributions + revenue
  const roi = await attributionService.getRestaurantROI(restaurantId, since);

  // Dettaglio reactivations
  const attributions = await prisma.reactivationAttribution.findMany({
    where: {
      message: { restaurantId },
      ...(since && { createdAt: { gte: since } }),
    },
    include: {
      customer: { select: { name: true, phone: true } },
      visit: { select: { amount: true, occurredAt: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Customer totals for context
  const totalCustomers = await prisma.customer.count({
    where: { restaurantId },
  });
  const lifecycleBreakdown = await prisma.customer.groupBy({
    by: ["lifecycleStatus"],
    where: { restaurantId },
    _count: true,
  });

  // LGPD consent breakdown
  const consentBreakdown = await prisma.customer.groupBy({
    by: ["whatsappOptInStatus"],
    where: { restaurantId },
    _count: true,
  });

  res.json({
    restaurant: restaurant.name,
    period: days ? `last ${days} days` : "all time",
    customers: {
      total: totalCustomers,
      lifecycle: Object.fromEntries(
        lifecycleBreakdown.map((g) => [g.lifecycleStatus, g._count])
      ),
      consent: Object.fromEntries(
        consentBreakdown.map((g) => [g.whatsappOptInStatus, g._count])
      ),
    },
    campaigns: {
      contacted_customers: contactedCustomers,
      total_messages: totalMessages,
      delivery: Object.fromEntries(
        deliveryStats.map((g) => [g.status, g._count])
      ),
    },
    reactivation: {
      reactivated_customers: roi.count,
      total_revenue: roi.totalRevenue,
      roi_estimate:
        totalMessages > 0
          ? `R$${(roi.totalRevenue / totalMessages).toFixed(2)}/msg`
          : "N/A",
      details: attributions.map((a) => ({
        customer: a.customer.name,
        phone: a.customer.phone,
        revenue: a.visit.amount,
        visit_date: a.visit.occurredAt,
        attributed_at: a.createdAt,
      })),
    },
  });
});

// ══════════════════════════════════════════════════════════
// POST /demo/grant-optin  [DEBUG ONLY — NOT part of compliant flow]
//
// Manually forces WhatsApp opt-in for customers. This bypasses
// the compliant inbound-message acquisition path and must NEVER
// be available in production. Opt-in should only be granted when
// a customer initiates a WhatsApp conversation (handled by the
// webhook inbound handler).
// ══════════════════════════════════════════════════════════

router.post("/grant-optin", async (req: Request, res: Response) => {
  // --- PRODUCTION GUARD ---
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({
      error: "grant-optin is disabled in production",
      reason:
        "Opt-in must be acquired via inbound WhatsApp message (compliant flow). " +
        "This debug endpoint is only available in development/staging.",
    });
  }

  const { restaurantId, phones } = req.body as {
    restaurantId: string;
    phones?: string[];
  };

  if (!restaurantId) {
    return res.status(400).json({ error: "restaurantId is required" });
  }

  // Tenant isolation
  const demoUser = (req as any).user;
  if (demoUser && demoUser.restaurantId !== restaurantId) {
    return res.status(403).json({ error: "Forbidden — you cannot access this restaurant" });
  }

  // If no phones specified, grant opt-in to ALL customers (demo convenience)
  const where: Record<string, unknown> = { restaurantId };
  if (Array.isArray(phones) && phones.length > 0) {
    where.phone = { in: phones };
  }

  const result = await prisma.customer.updateMany({
    where: where as any,
    data: {
      whatsappOptInStatus: "granted",
      whatsappOptInAt: new Date(),
    },
  });

  res.json({
    updated: result.count,
    note: phones
      ? `Opt-in granted for ${phones.length} phones`
      : "Opt-in granted for all customers in restaurant",
    warning: "DEBUG ONLY — this bypasses the compliant WhatsApp inbound flow",
  });
});

export const demoRouter = router;
