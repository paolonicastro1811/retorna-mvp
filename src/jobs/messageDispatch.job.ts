import { prisma } from "../database/client";
import { messagingService } from "../services/messaging.service";
import { CampaignStatus } from "../shared/enums";

/**
 * Message Dispatch Job
 * Cerca campagne in stato "ready", genera i messaggi e li invia.
 * Pensato per trigger manuale o cron.
 */
export async function runMessageDispatch() {
  console.log("[Job:MessageDispatch] Starting...");

  const campaigns = await prisma.campaign.findMany({
    where: { status: CampaignStatus.READY },
    include: { template: true },
  });

  let totalSent = 0;
  let totalFailed = 0;

  for (const campaign of campaigns) {
    if (!campaign.templateId) {
      console.warn(
        `[Job:MessageDispatch] Campaign "${campaign.name}" has no template, skipping`
      );
      continue;
    }

    try {
      // Queue messages
      const queueResult = await messagingService.queueMessages(campaign.id);
      console.log(
        `[Job:MessageDispatch] Campaign "${campaign.name}": queued=${queueResult.queued}`
      );

      // Dispatch
      const dispatchResult = await messagingService.dispatchCampaign(campaign.id);
      totalSent += dispatchResult.sent;
      totalFailed += dispatchResult.failed;

      console.log(
        `[Job:MessageDispatch] Campaign "${campaign.name}": sent=${dispatchResult.sent}, failed=${dispatchResult.failed}`
      );
    } catch (err) {
      console.error(
        `[Job:MessageDispatch] Error for campaign ${campaign.id}:`,
        err
      );
    }
  }

  console.log(
    `[Job:MessageDispatch] Done. Total sent: ${totalSent}, failed: ${totalFailed}`
  );
  return { totalSent, totalFailed };
}
