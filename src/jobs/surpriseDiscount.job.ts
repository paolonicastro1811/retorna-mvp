/**
 * Surprise Discount Job — Daily random discounts to opted-in customers
 *
 * Rules:
 *   20-49 opted-in customers → 1 surprise/day
 *   50-99 opted-in customers → 2 surprises/day
 *   100+  opted-in customers → 3 surprises/day
 *   <20   opted-in customers → no surprises
 *
 * Each customer can only receive 1 surprise per 30 days.
 */

import crypto from "crypto";
import { prisma } from "../database/client";
import { whatsappProvider, WhatsAppCredentials } from "../services/whatsapp.provider";

const TEMPLATE_NAME = "surprise_discount_v1";
const LANGUAGE = "pt_BR";
const DISCOUNT = "10%";
const COOLDOWN_DAYS = 30;

function getSurpriseCount(optedInCount: number): number {
  if (optedInCount >= 100) return 3;
  if (optedInCount >= 50) return 2;
  if (optedInCount >= 20) return 1;
  return 0;
}

export async function runSurpriseDiscount(): Promise<{ sent: number; errors: number }> {
  let totalSent = 0;
  let totalErrors = 0;

  // Find restaurants with WhatsApp connected
  const restaurants = await prisma.restaurant.findMany({
    where: {
      waAccessToken: { not: null },
      waPhoneNumberId: { not: null },
    },
    select: {
      id: true,
      name: true,
      waAccessToken: true,
      waPhoneNumberId: true,
    },
  });

  for (const restaurant of restaurants) {
    // Check if template is active for this restaurant
    const template = await prisma.messageTemplate.findFirst({
      where: {
        restaurantId: restaurant.id,
        hsmTemplateName: TEMPLATE_NAME,
        isActive: true,
      },
    });

    if (!template) continue;

    // Count opted-in customers
    const cooldownDate = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);

    const optedInCustomers = await prisma.customer.findMany({
      where: {
        restaurantId: restaurant.id,
        marketingOptInAt: { not: null },
        contactableStatus: "contactable",
        phone: { not: "" },
      },
      select: { id: true, phone: true, name: true },
    });

    const surpriseCount = getSurpriseCount(optedInCustomers.length);
    if (surpriseCount === 0) continue;

    // Find customers who haven't received a surprise recently
    const recentRecipients = await prisma.automationLog.findMany({
      where: {
        restaurantId: restaurant.id,
        templateKey: "surprise_discount",
        createdAt: { gte: cooldownDate },
      },
      select: { customerId: true },
    });

    const recentIds = new Set(recentRecipients.map((r) => r.customerId));
    const eligible = optedInCustomers.filter((c) => !recentIds.has(c.id));

    if (eligible.length === 0) continue;

    // Pick random customers using crypto-secure randomization
    const selected: typeof eligible = [];
    const pool = [...eligible];
    const pickCount = Math.min(surpriseCount, pool.length);
    for (let i = 0; i < pickCount; i++) {
      const idx = crypto.randomInt(pool.length);
      selected.push(pool.splice(idx, 1)[0]);
    }

    const credentials: WhatsAppCredentials = {
      accessToken: restaurant.waAccessToken!,
      phoneNumberId: restaurant.waPhoneNumberId!,
    };

    console.log(
      `[SurpriseDiscount] ${restaurant.name}: ${optedInCustomers.length} opted-in, sending ${selected.length} surprises`
    );

    for (const customer of selected) {
      try {
        const customerName = customer.name?.split(" ")[0] || "Cliente";
        const result = await whatsappProvider.sendTemplate(
          customer.phone!,
          TEMPLATE_NAME,
          LANGUAGE,
          [customerName, DISCOUNT],
          credentials
        );

        await prisma.automationLog.create({
          data: {
            restaurantId: restaurant.id,
            customerId: customer.id,
            templateKey: "surprise_discount",
            status: result.success ? "sent" : "failed",
            providerMsgId: result.providerMsgId || null,
            metadata: result.error ? { error: result.error } : undefined,
          },
        });

        if (result.success) {
          totalSent++;
        } else {
          totalErrors++;
          console.error(`[SurpriseDiscount] Failed for ${customer.phone}: ${result.error}`);
        }
      } catch (err) {
        totalErrors++;
        console.error(`[SurpriseDiscount] Error for ${customer.phone}:`, err);
      }
    }
  }

  return { sent: totalSent, errors: totalErrors };
}
