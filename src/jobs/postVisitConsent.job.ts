// ============================================================
// Post-Visit Consent Job
// Sends "Foi um prazer" follow-up the day after a visit,
// asking for marketing opt-in consent via WhatsApp.
// Only sends once per customer (checked via welcomeAutoReplySentAt).
// ============================================================

import { prisma } from "../database/client";
import { whatsappProvider, WhatsAppCredentials } from "../services/whatsapp.provider";

export async function runPostVisitConsent(): Promise<{ sent: number; errors: number }> {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const WINDOW_MS = 60 * 60 * 1000; // 1h window to catch visits in cron cycles

  const windowEnd = new Date(Date.now() - ONE_DAY_MS);
  const windowStart = new Date(Date.now() - ONE_DAY_MS - WINDOW_MS);

  // Find visit events within the 2h-2h30m window whose customer
  // has never received the welcome/consent message
  const recentVisits = await prisma.customerEvent.findMany({
    where: {
      eventType: "visit",
      occurredAt: { gte: windowStart, lte: windowEnd },
      customer: {
        welcomeAutoReplySentAt: null,
        contactableStatus: "contactable",
      },
    },
    include: {
      customer: {
        include: {
          restaurant: {
            select: { waAccessToken: true, waPhoneNumberId: true },
          },
        },
      },
    },
    distinct: ["customerId"], // one message per customer even with multiple visits
  });

  let sent = 0;
  let errors = 0;

  for (const visit of recentVisits) {
    const { customer } = visit;
    const name = customer.name ?? "Cliente";

    try {
      // Build per-restaurant WhatsApp credentials
      const waCredentials: WhatsAppCredentials | undefined =
        customer.restaurant?.waAccessToken && customer.restaurant?.waPhoneNumberId
          ? { accessToken: customer.restaurant.waAccessToken, phoneNumberId: customer.restaurant.waPhoneNumberId }
          : undefined;

      const result = await whatsappProvider.sendTemplate(
        customer.phone,
        "post_visit_thanks_v1",
        "pt_BR",
        [name],
        waCredentials
      );

      // Mark customer as having received the welcome message
      await prisma.customer.update({
        where: { id: customer.id },
        data: { welcomeAutoReplySentAt: new Date() },
      });

      // Log the automation
      await prisma.automationLog.create({
        data: {
          restaurantId: customer.restaurantId,
          customerId: customer.id,
          templateKey: "post_visit_consent",
          status: result.success ? "sent" : "failed",
          providerMsgId: result.providerMsgId ?? null,
          metadata: { visitEventId: visit.id, name },
        },
      });

      if (result.success) sent++;
      else errors++;
    } catch (err) {
      console.error(`[PostVisitConsent] Error for customer=${customer.id}:`, err);

      await prisma.automationLog.create({
        data: {
          restaurantId: customer.restaurantId,
          customerId: customer.id,
          templateKey: "post_visit_consent",
          status: "failed",
          metadata: { error: (err as Error).message, visitEventId: visit.id },
        },
      });

      errors++;
    }

    // Throttle: 100ms between messages
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return { sent, errors };
}
