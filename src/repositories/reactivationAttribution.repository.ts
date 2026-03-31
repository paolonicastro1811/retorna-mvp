import { prisma } from "../database/client";
import type { CreateAttributionInput } from "../models/reactivationAttribution.model";

export const reactivationAttributionRepository = {
  async create(data: CreateAttributionInput) {
    return prisma.reactivationAttribution.create({ data });
  },

  async findByVisitId(visitId: string) {
    return prisma.reactivationAttribution.findUnique({
      where: { visitId },
    });
  },

  async findByMessageId(messageId: string) {
    return prisma.reactivationAttribution.findUnique({
      where: { messageId },
    });
  },

  async findByCustomer(customerId: string) {
    return prisma.reactivationAttribution.findMany({
      where: { customerId },
      include: { message: true, visit: true },
      orderBy: { createdAt: "desc" },
    });
  },

  async sumRevenueByRestaurant(restaurantId: string, since?: Date) {
    const result = await prisma.reactivationAttribution.aggregate({
      where: {
        message: { restaurantId },
        ...(since && { createdAt: { gte: since } }),
      },
      _sum: { revenue: true },
      _count: true,
    });
    return {
      totalRevenue: result._sum.revenue ?? 0,
      count: result._count,
    };
  },

  async findByRestaurant(restaurantId: string, since?: Date) {
    return prisma.reactivationAttribution.findMany({
      where: {
        message: { restaurantId },
        ...(since && { createdAt: { gte: since } }),
      },
      include: { message: true, visit: true, customer: true },
      orderBy: { createdAt: "desc" },
    });
  },
};
