import { campaignRepository } from "../repositories/campaign.repository";
import { campaignAudienceItemRepository } from "../repositories/campaignAudienceItem.repository";
import { customerRepository } from "../repositories/customer.repository";
import { messageTemplateRepository } from "../repositories/messageTemplate.repository";
import { prisma } from "../database/client";
import type { CreateCampaignInput } from "../models/campaign.model";
import type { SegmentRules, LifecycleStatus } from "../shared/enums";
import { CampaignStatus, OptInStatus, ContactableStatus } from "../shared/enums";

// Per-customer cooldown: minimum days between campaign messages
const CAMPAIGN_COOLDOWN_DAYS = 7;

export const campaignService = {
  async create(input: CreateCampaignInput) {
    return campaignRepository.create(input);
  },

  async findById(id: string) {
    return campaignRepository.findById(id);
  },

  async findByRestaurant(restaurantId: string) {
    return campaignRepository.findByRestaurant(restaurantId);
  },

  /**
   * buildAudience — Popola campaign_audience_items in base a segmentRules.
   *
   * Eligibility (compliant flow — LGPD):
   * - whatsapp_opt_in_status = "granted" (customer initiated WhatsApp contact)
   * - contactable_status = "contactable" (not opted-out)
   * - totalVisits >= 1 (at least one real visit — no leads without visits)
   * - marketingOptInAt IS NOT NULL (explicit marketing consent via SIM/SI)
   * - lifecycle matches target segment
   *
   * Customers from historical imports remain ineligible unless they
   * later initiate WhatsApp contact, have at least one visit, AND
   * explicitly consent to marketing messages.
   */
  async buildAudience(campaignId: string) {
    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    await campaignRepository.updateStatus(campaignId, CampaignStatus.BUILDING);

    const rules = campaign.segmentRules as unknown as SegmentRules;

    // Costruisci filtri
    const filters: {
      lifecycle?: LifecycleStatus[];
      isFrequent?: boolean;
      isHighSpender?: boolean;
    } = {};

    if (rules.lifecycle && rules.lifecycle.length > 0) {
      filters.lifecycle = rules.lifecycle;
    }
    if (rules.flags) {
      if (rules.flags.includes("frequent")) filters.isFrequent = true;
      if (rules.flags.includes("high_spender")) filters.isHighSpender = true;
    }

    // LGPD compliance: only include opted-in + contactable customers
    const allMatching = await customerRepository.findByFlags(
      campaign.restaurantId,
      filters
    );

    // Per-customer cooldown: exclude customers who received a campaign message
    // in the last CAMPAIGN_COOLDOWN_DAYS days (prevents message fatigue)
    const cooldownDate = new Date();
    cooldownDate.setDate(cooldownDate.getDate() - CAMPAIGN_COOLDOWN_DAYS);

    const recentRecipientIds = new Set(
      (
        await prisma.outboundMessage.findMany({
          where: {
            restaurantId: campaign.restaurantId,
            createdAt: { gte: cooldownDate },
            status: { not: "failed" },
          },
          select: { customerId: true },
          distinct: ["customerId"],
        })
      ).map((m) => m.customerId)
    );

    const customers = allMatching.filter(
      (c) =>
        c.whatsappOptInStatus === OptInStatus.GRANTED &&
        c.contactableStatus === ContactableStatus.CONTACTABLE &&
        c.totalVisits >= 1 &&
        c.marketingOptInAt !== null && // LGPD: explicit marketing consent required
        !recentRecipientIds.has(c.id) // Cooldown: no repeat within 7 days
    );

    // Pulisci audience precedente e ricrea
    await campaignAudienceItemRepository.deleteByCampaign(campaignId);
    await campaignAudienceItemRepository.createMany(
      campaignId,
      customers.map((c) => c.id)
    );

    await campaignRepository.updateStatus(campaignId, CampaignStatus.READY);

    return { audienceSize: customers.length };
  },

  /**
   * getAudience — Restituisce i clienti in audience
   */
  async getAudience(campaignId: string) {
    return campaignAudienceItemRepository.findByCampaign(campaignId);
  },

  /**
   * getTemplate — Restituisce il template associato
   */
  async getTemplate(templateId: string) {
    return messageTemplateRepository.findById(templateId);
  },
};
