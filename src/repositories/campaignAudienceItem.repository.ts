import { prisma } from "../database/client";

export const campaignAudienceItemRepository = {
  async createMany(campaignId: string, customerIds: string[]) {
    const data = customerIds.map((customerId) => ({
      campaignId,
      customerId,
    }));
    return prisma.campaignAudienceItem.createMany({
      data,
      skipDuplicates: true,
    });
  },

  async findByCampaign(campaignId: string) {
    return prisma.campaignAudienceItem.findMany({
      where: { campaignId },
      include: { customer: true },
    });
  },

  async countByCampaign(campaignId: string) {
    return prisma.campaignAudienceItem.count({ where: { campaignId } });
  },

  async deleteByCampaign(campaignId: string) {
    return prisma.campaignAudienceItem.deleteMany({ where: { campaignId } });
  },
};
