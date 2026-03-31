import { Prisma } from "@prisma/client";
import { prisma } from "../database/client";
import type { CreateCampaignInput } from "../models/campaign.model";
import type { SegmentRules } from "../shared/enums";

export const campaignRepository = {
  async findById(id: string) {
    return prisma.campaign.findUnique({
      where: { id },
      include: { template: true, _count: { select: { audience: true, messages: true } } },
    });
  },

  async findByRestaurant(restaurantId: string) {
    return prisma.campaign.findMany({
      where: { restaurantId },
      include: { _count: { select: { audience: true, messages: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: CreateCampaignInput) {
    return prisma.campaign.create({
      data: {
        restaurantId: data.restaurantId,
        name: data.name,
        segmentRules: data.segmentRules as unknown as Prisma.InputJsonValue,
        templateId: data.templateId,
        scheduledAt: data.scheduledAt,
      },
    });
  },

  async updateStatus(id: string, status: string) {
    const timestamps: Record<string, Date> = {};
    if (status === "sending") timestamps.startedAt = new Date();
    if (status === "completed") timestamps.completedAt = new Date();

    return prisma.campaign.update({
      where: { id },
      data: { status, ...timestamps },
    });
  },

  async findReadyToSend() {
    return prisma.campaign.findMany({
      where: { status: "ready" },
      include: { template: true },
    });
  },

  async getSegmentRules(id: string): Promise<SegmentRules | null> {
    const campaign = await prisma.campaign.findUnique({
      where: { id },
      select: { segmentRules: true },
    });
    return campaign?.segmentRules as SegmentRules | null;
  },
};
