// ============================================================
// LoyaltyService — Automatic tier management + message triggers
//
// Two entry points:
// 1. onVisitRegistered() — called synchronously after each visit
//    Handles: tier upgrade, streak, surprise, post-visit thanks,
//             milestone halfway (5 visits), loyalty VIP (every 20 visits)
// 2. runDailyAutomation() — called by cron every day
//    Handles: reactivation messages, streak expiry
// ============================================================

import { prisma } from "../database/client";
import { whatsappProvider, WhatsAppCredentials } from "./whatsapp.provider";

type Tier = "novo" | "frequente" | "prata" | "ouro";

const TIER_ORDER: Tier[] = ["novo", "frequente", "prata", "ouro"];
const TIER_EMOJI: Record<Tier, string> = {
  novo: "",
  frequente: "⭐",
  prata: "🥈",
  ouro: "🥇",
};
const TIER_NAMES_PT: Record<Tier, string> = {
  novo: "Novo",
  frequente: "Frequente",
  prata: "Prata",
  ouro: "Ouro",
};

// ============================================================
// On Visit Registered — called right after a visit is logged
// ============================================================
export async function onVisitRegistered(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { restaurant: true },
  });
  if (!customer || !customer.restaurant) return;

  const r = customer.restaurant;
  const c = customer;

  // Skip if no marketing consent
  if (!c.marketingOptInAt || c.contactableStatus !== "contactable") return;

  // --- 1. Calculate new tier ---
  // The visit has already been recorded before onVisitRegistered is called,
  // so c.totalVisits is stale (off-by-one). Use +1 to reflect the current visit.
  const currentVisits = c.totalVisits + 1;
  const oldTier = c.tier as Tier;
  let newTier: Tier = "novo";
  if (currentVisits >= r.tierOuroMinVisits) newTier = "ouro";
  else if (currentVisits >= r.tierPrataMinVisits) newTier = "prata";
  else if (currentVisits >= r.tierFrequenteMinVisits) newTier = "frequente";

  const tierChanged = TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(oldTier);

  // --- 2. Update streak ---
  const now = new Date();
  const streakWindowMs = r.streakWindowDays * 24 * 60 * 60 * 1000;
  let newStreak = c.currentStreak;

  if (c.streakUpdatedAt && now.getTime() - c.streakUpdatedAt.getTime() <= streakWindowMs) {
    newStreak = c.currentStreak + 1;
  } else {
    newStreak = 1; // Reset streak
  }

  // --- 3. Surprise counter ---
  let newSurpriseCounter = c.surpriseCounter + 1;
  let triggerSurprise = false;
  let newNextSurpriseAt = c.nextSurpriseAt;

  if (newSurpriseCounter >= c.nextSurpriseAt) {
    triggerSurprise = true;
    newSurpriseCounter = 0;
    // Random next threshold between min and max
    newNextSurpriseAt =
      r.surpriseEveryMinVisits +
      Math.floor(Math.random() * (r.surpriseEveryMaxVisits - r.surpriseEveryMinVisits + 1));
  }

  // --- 4. Update customer in DB ---
  await prisma.customer.update({
    where: { id: customerId },
    data: {
      tier: newTier,
      currentStreak: newStreak,
      streakUpdatedAt: now,
      surpriseCounter: newSurpriseCounter,
      nextSurpriseAt: newNextSurpriseAt,
      ...(tierChanged ? { tierUpgradedAt: now } : {}),
    },
  });

  // --- 5. Send messages ---
  const phone = c.phone;
  const name = c.name ?? "Cliente";

  // Build per-restaurant WhatsApp credentials
  const waCredentials: WhatsAppCredentials | undefined =
    r.waAccessToken && r.waPhoneNumberId
      ? { accessToken: r.waAccessToken, phoneNumberId: r.waPhoneNumberId }
      : undefined;

  // Find active templates for this restaurant
  const templates = await prisma.messageTemplate.findMany({
    where: { restaurantId: r.id, isActive: true },
  });
  const templateMap = new Map(templates.map((t) => [t.hsmTemplateName, t]));

  // ── All templates below must exist on Meta Business Manager ──

  // 5a. Post-visit + consent — handled by postVisitConsent.job.ts (24h after visit)
  // Only sent to customers WITHOUT opt-in consent.

  // 5b. Milestone halfway — at exactly 5 visits
  if (currentVisits === 5 && templateMap.has("milestone_halfway_v1")) {
    await sendAndLog(r.id, customerId, phone, "milestone_halfway", [name, String(currentVisits)], {
      visits: currentVisits,
    }, waCredentials);
  }

  // 5c. Reward earned — 10% discount at exactly 10 visits
  if (currentVisits === 10 && templateMap.has("reward_earned_v1")) {
    await sendAndLog(r.id, customerId, phone, "reward_earned", [name, String(currentVisits)], {
      visits: currentVisits,
      discount: 10,
    }, waCredentials);
  }

  // 5d. Surprise discount — random chance for loyal customers (3+ visits)
  if (triggerSurprise && templateMap.has("surprise_discount_v1")) {
    await sendAndLog(r.id, customerId, phone, "surprise_discount", [name], {
      visits: currentVisits,
    }, waCredentials);
  }

  // 5e. Loyalty VIP — 20% discount at every multiple of 20 visits (20, 40, 60, 80...)
  if (currentVisits >= 20 && currentVisits % 20 === 0 && templateMap.has("loyalty_vip_v1")) {
    await sendAndLog(r.id, customerId, phone, "loyalty_vip", [name, String(currentVisits)], {
      visits: currentVisits,
      discount: 20,
    }, waCredentials);
  }

  // 5f. Reactivation — handled by dailyAutomation() cron (customers inactive 30+ days)

  console.log(
    `[Loyalty] Visit processed: customer=${customerId} visits=${currentVisits} tier=${oldTier}→${newTier} streak=${newStreak} surprise=${triggerSurprise}`
  );
}

// ============================================================
// Daily Automation — runs via cron, handles reactivation
// ============================================================
export async function runDailyAutomation() {
  const restaurants = await prisma.restaurant.findMany();
  let totalSent = 0;

  for (const r of restaurants) {
    // Find active reactivation template
    const reactivationTpl = await prisma.messageTemplate.findFirst({
      where: {
        restaurantId: r.id,
        hsmTemplateName: "reactivation_v1",
        isActive: true,
      },
    });
    if (!reactivationTpl) continue;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - r.reactivationAfterDays);

    // Find inactive customers eligible for reactivation
    const customers = await prisma.customer.findMany({
      where: {
        restaurantId: r.id,
        marketingOptInAt: { not: null },
        contactableStatus: "contactable",
        whatsappOptInStatus: "granted",
        totalVisits: { gte: 1 },
        lastVisitAt: { lte: cutoffDate },
        // Not already reactivated recently (cooldown 30 days)
        OR: [
          { lastReactivationSentAt: null },
          { lastReactivationSentAt: { lte: cutoffDate } },
        ],
      },
    });

    // Build per-restaurant WhatsApp credentials for reactivation
    const reactivationCredentials: WhatsAppCredentials | undefined =
      r.waAccessToken && r.waPhoneNumberId
        ? { accessToken: r.waAccessToken, phoneNumberId: r.waPhoneNumberId }
        : undefined;

    for (const c of customers) {
      const name = c.name ?? "Cliente";
      const discount = getDiscountForTier(c.tier as Tier, r);

      const result = await sendAndLog(r.id, c.id, c.phone, "reactivation", [name, String(discount)], {
        daysSinceVisit: r.reactivationAfterDays,
        tier: c.tier,
        discount,
      }, reactivationCredentials);

      if (result) {
        await prisma.customer.update({
          where: { id: c.id },
          data: { lastReactivationSentAt: new Date() },
        });
        totalSent++;
      }

      // Throttle: 100ms between messages
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`[Loyalty:Cron] Daily automation complete: ${totalSent} reactivation messages sent`);
  return { sent: totalSent };
}

// ============================================================
// Helpers
// ============================================================

function getDiscountForTier(tier: Tier, r: { discountFrequente: number; discountPrata: number; discountOuro: number }): number {
  switch (tier) {
    case "ouro": return r.discountOuro;
    case "prata": return r.discountPrata;
    case "frequente": return r.discountFrequente;
    default: return 0;
  }
}

function getVisitsForTier(tier: Tier, r: { tierFrequenteMinVisits: number; tierPrataMinVisits: number; tierOuroMinVisits: number }): number {
  switch (tier) {
    case "frequente": return r.tierFrequenteMinVisits;
    case "prata": return r.tierPrataMinVisits;
    case "ouro": return r.tierOuroMinVisits;
    default: return 0;
  }
}

function getNextTier(current: Tier): Tier | null {
  const idx = TIER_ORDER.indexOf(current);
  return idx < TIER_ORDER.length - 1 ? TIER_ORDER[idx + 1] : null;
}

function getBenefitsForTier(tier: Tier, discount: number): string {
  switch (tier) {
    case "frequente": return `${discount}% de desconto na proxima visita`;
    case "prata": return `${discount}% de desconto + prioridade nas reservas`;
    case "ouro": return `${discount}% de desconto + sobremesa gratis + acesso VIP`;
    default: return "";
  }
}

// Visit-triggered templates bypass monthly cap (customer initiated the action)
const VISIT_TRIGGERED_TEMPLATES = new Set([
  "milestone_halfway",
  "reward_earned",
  "surprise_discount",
  "loyalty_vip",
  "post_visit_thanks",
]);

async function isUnderMonthlyCap(
  restaurantId: string,
  customerId: string,
  templateKey: string
): Promise<boolean> {
  // Visit-triggered messages always allowed (customer initiated)
  if (VISIT_TRIGGERED_TEMPLATES.has(templateKey)) return true;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { maxMsgsPerCustomerMonth: true },
  });
  const maxPerMonth = restaurant?.maxMsgsPerCustomerMonth ?? 5;

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const sentThisMonth = await prisma.automationLog.count({
    where: {
      customerId,
      restaurantId,
      status: "sent",
      createdAt: { gte: monthStart },
    },
  });

  if (sentThisMonth >= maxPerMonth) {
    console.log(
      `[Loyalty] Monthly cap reached: customer=${customerId} sent=${sentThisMonth}/${maxPerMonth} template=${templateKey} — skipping`
    );
    return false;
  }
  return true;
}

async function sendAndLog(
  restaurantId: string,
  customerId: string,
  phone: string,
  templateKey: string,
  params: string[],
  metadata: Record<string, unknown>,
  credentials?: WhatsAppCredentials
): Promise<boolean> {
  // Check monthly cap (visit-triggered messages bypass this)
  if (!(await isUnderMonthlyCap(restaurantId, customerId, templateKey))) {
    return false;
  }

  try {
    const result = await whatsappProvider.sendTemplate(
      phone,
      `${templateKey}_v1`,
      "pt_BR",
      params,
      credentials
    );

    await prisma.automationLog.create({
      data: {
        restaurantId,
        customerId,
        templateKey,
        status: result.success ? "sent" : "failed",
        providerMsgId: result.providerMsgId ?? null,
        metadata: metadata as any,
      },
    });

    return result.success;
  } catch (err) {
    console.error(`[Loyalty] sendAndLog failed: template=${templateKey} customer=${customerId}`, err);

    await prisma.automationLog.create({
      data: {
        restaurantId,
        customerId,
        templateKey,
        status: "failed",
        metadata: { ...metadata, error: (err as Error).message },
      },
    });

    return false;
  }
}
