// ============================================================
// LoyaltyService — Automatic tier management + message triggers
//
// Two entry points:
// 1. onVisitRegistered() — called synchronously after each visit
//    Handles: tier upgrade, streak, surprise, post-visit thanks
// 2. runDailyAutomation() — called by cron every day
//    Handles: reactivation messages, streak expiry
// ============================================================

import { prisma } from "../database/client";
import { whatsappProvider } from "./whatsapp.provider";

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

  // Find active templates for this restaurant
  const templates = await prisma.messageTemplate.findMany({
    where: { restaurantId: r.id, isActive: true },
  });
  const templateMap = new Map(templates.map((t) => [t.hsmTemplateName, t]));

  // 5a. Post-visit thanks
  if (templateMap.has("post_visit_thanks_v1")) {
    const discount = getDiscountForTier(newTier, r);
    const nextTier = getNextTier(newTier);
    const visitsToNext = nextTier ? getVisitsForTier(nextTier, r) - currentVisits : 0;
    const progresso = nextTier
      ? `Faltam ${visitsToNext} visitas para o nivel ${TIER_NAMES_PT[nextTier]} ${TIER_EMOJI[nextTier]}`
      : `Voce ja e nivel maximo: Ouro ${TIER_EMOJI.ouro}`;

    await sendAndLog(r.id, customerId, phone, "post_visit_thanks", [name, String(currentVisits), progresso], {
      visits: currentVisits,
      tier: newTier,
    });
  }

  // 5b. Tier upgrade
  if (tierChanged && templateMap.has("tier_upgrade_v1")) {
    const discount = getDiscountForTier(newTier, r);
    const beneficios = getBenefitsForTier(newTier, discount);

    await sendAndLog(r.id, customerId, phone, "tier_upgrade", [name, TIER_EMOJI[newTier], TIER_NAMES_PT[newTier], beneficios], {
      oldTier,
      newTier,
      visits: currentVisits,
    });
  }

  // 5c. Reward earned (at tier threshold exact visits)
  const thresholds = [r.tierFrequenteMinVisits, r.tierPrataMinVisits, r.tierOuroMinVisits];
  if (thresholds.includes(currentVisits) && templateMap.has("reward_earned_v1")) {
    const discount = getDiscountForTier(newTier, r);
    await sendAndLog(r.id, customerId, phone, "reward_earned", [name, String(currentVisits), String(discount)], {
      visits: currentVisits,
      discount,
    });
  }

  // 5d. Streak reminder (if approaching target)
  if (
    newStreak > 0 &&
    newStreak < r.streakTargetVisits &&
    templateMap.has("streak_reminder_v1")
  ) {
    const faltam = r.streakTargetVisits - newStreak;
    const prazoDate = new Date(now.getTime() + (r.streakWindowDays * 24 * 60 * 60 * 1000));
    const prazo = prazoDate.toLocaleDateString("pt-BR", { weekday: "long" });

    await sendAndLog(r.id, customerId, phone, "streak_reminder", [name, String(newStreak), String(faltam), prazo], {
      streak: newStreak,
      target: r.streakTargetVisits,
    });
  }

  // 5e. Surprise reward
  if (triggerSurprise && templateMap.has("surprise_reward_v1")) {
    await sendAndLog(r.id, customerId, phone, "surprise_reward", [name], {
      visits: currentVisits,
    });
  }

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

    for (const c of customers) {
      const name = c.name ?? "Cliente";
      const discount = getDiscountForTier(c.tier as Tier, r);

      const result = await sendAndLog(r.id, c.id, c.phone, "reactivation", [name, String(discount)], {
        daysSinceVisit: r.reactivationAfterDays,
        tier: c.tier,
        discount,
      });

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

async function sendAndLog(
  restaurantId: string,
  customerId: string,
  phone: string,
  templateKey: string,
  params: string[],
  metadata: Record<string, unknown>
): Promise<boolean> {
  try {
    const result = await whatsappProvider.sendTemplate(
      phone,
      `${templateKey}_v1`,
      "pt_BR",
      params
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
