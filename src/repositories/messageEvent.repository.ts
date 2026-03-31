import { Prisma } from "@prisma/client";
import { prisma } from "../database/client";
import type { CreateMessageEventInput } from "../models/messageEvent.model";

export const messageEventRepository = {
  async create(data: CreateMessageEventInput) {
    return prisma.messageEvent.create({
      data: {
        messageId: data.messageId,
        eventType: data.eventType,
        payload: (data.payload as Prisma.InputJsonValue) ?? undefined,
      },
    });
  },

  async findByMessage(messageId: string) {
    return prisma.messageEvent.findMany({
      where: { messageId },
      orderBy: { createdAt: "asc" },
    });
  },
};
