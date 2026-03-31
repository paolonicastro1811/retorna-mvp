import type { Campaign as PrismaCampaign } from "@prisma/client";
import type { SegmentRules } from "../shared/enums";

export type Campaign = PrismaCampaign;

export interface CreateCampaignInput {
  restaurantId: string;
  name: string;
  segmentRules: SegmentRules;
  templateId?: string;
  scheduledAt?: Date;
}
