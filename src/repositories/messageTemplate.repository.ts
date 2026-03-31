import { prisma } from "../database/client";
import type { CreateTemplateInput } from "../models/messageTemplate.model";

export const messageTemplateRepository = {
  async findById(id: string) {
    return prisma.messageTemplate.findUnique({ where: { id } });
  },

  async findByRestaurant(restaurantId: string) {
    return prisma.messageTemplate.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });
  },

  async create(data: CreateTemplateInput) {
    return prisma.messageTemplate.create({ data });
  },

  async update(id: string, data: { name?: string; body?: string; isActive?: boolean }) {
    return prisma.messageTemplate.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.messageTemplate.delete({ where: { id } });
  },
};
