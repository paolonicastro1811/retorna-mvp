// ============================================================
// Campaign Rate Limits Service
// Enforces anti-spam rules for custom campaigns:
//   - Max custom campaigns per restaurant per month
//   - Min interval between campaigns
//   - Max messages per customer per month (auto + custom combined)
//   - Sending hours restriction (9:00-20:00)
//   - Opt-out rate monitoring
// ============================================================

import { prisma } from "../database/client";

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  details?: {
    customCampaignsThisMonth?: number;
    maxCustomCampaigns?: number;
    daysSinceLastCampaign?: number;
    minIntervalDays?: number;
    optOutRate?: number;
  };
}

/**
 * Check if a restaurant can dispatch a custom campaign.
 * Returns allowed=false with reason if any limit is exceeded.
 */
export async function checkCampaignLimits(restaurantId: string): Promise<LimitCheckResult> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) return { allowed: false, reason: "Restaurante nao encontrado." };

  const now = new Date();

  // 1. Sending hours (9:00-20:00 in restaurant timezone)
  const hour = getHourInTimezone(now, restaurant.timezone);
  if (hour < 9 || hour >= 20) {
    return {
      allowed: false,
      reason: `Fora do horario de envio (9h-20h). Horario atual: ${hour}h. Agende para amanha.`,
    };
  }

  // 2. Max custom campaigns per month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const customCampaignsThisMonth = await prisma.campaign.count({
    where: {
      restaurantId,
      status: "completed",
      template: { isCustom: true },
      completedAt: { gte: monthStart },
    },
  });

  if (customCampaignsThisMonth >= restaurant.maxCustomCampaignsMonth) {
    return {
      allowed: false,
      reason: `Limite de campanhas custom atingido (${customCampaignsThisMonth}/${restaurant.maxCustomCampaignsMonth} este mes). Aguarde o proximo mes.`,
      details: {
        customCampaignsThisMonth,
        maxCustomCampaigns: restaurant.maxCustomCampaignsMonth,
      },
    };
  }

  // 3. Min interval between campaigns
  const lastCampaign = await prisma.campaign.findFirst({
    where: {
      restaurantId,
      status: "completed",
      template: { isCustom: true },
    },
    orderBy: { completedAt: "desc" },
  });

  if (lastCampaign?.completedAt) {
    const daysSince = Math.floor((now.getTime() - lastCampaign.completedAt.getTime()) / (24 * 60 * 60 * 1000));
    if (daysSince < restaurant.minCampaignIntervalDays) {
      return {
        allowed: false,
        reason: `Intervalo minimo entre campanhas: ${restaurant.minCampaignIntervalDays} dias. Ultima campanha foi ha ${daysSince} dia(s). Aguarde mais ${restaurant.minCampaignIntervalDays - daysSince} dia(s).`,
        details: {
          daysSinceLastCampaign: daysSince,
          minIntervalDays: restaurant.minCampaignIntervalDays,
        },
      };
    }
  }

  // 4. Opt-out rate check (last 30 days)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const [totalCustomers, optedOutCustomers] = await Promise.all([
    prisma.customer.count({
      where: { restaurantId, marketingOptInAt: { not: null } },
    }),
    prisma.customer.count({
      where: {
        restaurantId,
        contactableStatus: "do_not_contact",
        updatedAt: { gte: thirtyDaysAgo },
      },
    }),
  ]);

  if (totalCustomers > 0) {
    const optOutRate = (optedOutCustomers / totalCustomers) * 100;
    if (optOutRate > 5) {
      return {
        allowed: false,
        reason: `Taxa de opt-out alta (${optOutRate.toFixed(1)}%). Muitos clientes cancelaram. Revise sua estrategia de mensagens antes de enviar novas campanhas.`,
        details: { optOutRate },
      };
    }
  }

  return {
    allowed: true,
    details: {
      customCampaignsThisMonth,
      maxCustomCampaigns: restaurant.maxCustomCampaignsMonth,
    },
  };
}

/**
 * Filter audience: remove customers who already received max messages this month.
 * Counts both automation logs (auto templates) and outbound messages (campaigns).
 */
export async function filterAudienceByMessageLimit(
  restaurantId: string,
  customerIds: string[]
): Promise<{ allowed: string[]; blocked: number }> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) return { allowed: [], blocked: customerIds.length };

  const maxPerMonth = restaurant.maxMsgsPerCustomerMonth;
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const allowed: string[] = [];
  let blocked = 0;

  // Batch check: count messages per customer this month
  for (const customerId of customerIds) {
    const [autoCount, campaignCount] = await Promise.all([
      prisma.automationLog.count({
        where: {
          restaurantId,
          customerId,
          status: "sent",
          createdAt: { gte: monthStart },
        },
      }),
      prisma.outboundMessage.count({
        where: {
          restaurantId,
          customerId,
          status: { in: ["sent", "delivered", "read"] },
          createdAt: { gte: monthStart },
        },
      }),
    ]);

    const totalThisMonth = autoCount + campaignCount;

    if (totalThisMonth < maxPerMonth) {
      allowed.push(customerId);
    } else {
      blocked++;
    }
  }

  return { allowed, blocked };
}

// --- Helpers ---

function getHourInTimezone(date: Date, timezone: string): number {
  try {
    const timeStr = date.toLocaleString("en-US", { timeZone: timezone, hour: "numeric", hour12: false });
    return parseInt(timeStr, 10);
  } catch {
    // Fallback: assume Sao Paulo (UTC-3)
    return (date.getUTCHours() - 3 + 24) % 24;
  }
}
