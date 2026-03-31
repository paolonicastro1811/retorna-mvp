import { prisma } from "../database/client";
import type { QueueMessageInput } from "../models/outboundMessage.model";
import { MessageStatus } from "../shared/enums";

export const outboundMessageRepository = {
  async findById(id: string) {
    return prisma.outboundMessage.findUnique({ where: { id } });
  },

  async findByProviderMsgId(providerMsgId: string) {
    return prisma.outboundMessage.findUnique({ where: { providerMsgId } });
  },

  async findByCampaign(campaignId: string) {
    return prisma.outboundMessage.findMany({
      where: { campaignId },
      orderBy: { createdAt: "desc" },
    });
  },

  async findQueuedByCampaign(campaignId: string) {
    return prisma.outboundMessage.findMany({
      where: { campaignId, status: MessageStatus.QUEUED },
    });
  },

  async create(data: QueueMessageInput) {
    return prisma.outboundMessage.create({ data });
  },

  async createMany(data: QueueMessageInput[]) {
    return prisma.outboundMessage.createMany({ data });
  },

  async updateStatus(
    id: string,
    status: string,
    extra?: { providerMsgId?: string; failReason?: string }
  ) {
    const timestamps: Record<string, Date> = {};
    if (status === MessageStatus.SENT) timestamps.sentAt = new Date();
    if (status === MessageStatus.DELIVERED) timestamps.deliveredAt = new Date();
    if (status === MessageStatus.READ) timestamps.readAt = new Date();
    if (status === MessageStatus.FAILED) timestamps.failedAt = new Date();

    return prisma.outboundMessage.update({
      where: { id },
      data: { status, ...timestamps, ...extra },
    });
  },

  async findLastDeliveredToCustomer(customerId: string) {
    return prisma.outboundMessage.findFirst({
      where: {
        customerId,
        status: { in: [MessageStatus.DELIVERED, MessageStatus.READ, MessageStatus.SENT] },
      },
      orderBy: { sentAt: "desc" },
    });
  },

  async countByCampaignAndStatus(campaignId: string) {
    return prisma.outboundMessage.groupBy({
      by: ["status"],
      where: { campaignId },
      _count: true,
    });
  },
};
