import { prisma } from "../database/client";
import { campaignService } from "../services/campaign.service";
import { CampaignStatus } from "../shared/enums";

/**
 * Audience Build Job
 * Cerca campagne in stato "draft" con segmentRules definite
 * e costruisce l'audience. Pensato per trigger manuale o cron.
 */
export async function runAudienceBuild() {
  console.log("[Job:AudienceBuild] Starting...");

  const campaigns = await prisma.campaign.findMany({
    where: { status: CampaignStatus.DRAFT },
  });

  let built = 0;

  for (const campaign of campaigns) {
    try {
      const result = await campaignService.buildAudience(campaign.id);
      console.log(
        `[Job:AudienceBuild] Campaign "${campaign.name}": audience=${result.audienceSize}`
      );
      built++;
    } catch (err) {
      console.error(
        `[Job:AudienceBuild] Error for campaign ${campaign.id}:`,
        err
      );
    }
  }

  console.log(`[Job:AudienceBuild] Done. Campaigns built: ${built}`);
  return { built };
}
