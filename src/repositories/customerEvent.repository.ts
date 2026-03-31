import { prisma } from "../database/client";
import { EventType } from "../shared/enums";

export const customerEventRepository = {
  async create(data: {
    customerId: string;
    restaurantId: string;
    amount?: number;
    occurredAt: Date;
  }) {
    return prisma.customerEvent.create({
      data: {
        ...data,
        eventType: EventType.VISIT,
      },
    });
  },

  async findByCustomer(customerId: string) {
    return prisma.customerEvent.findMany({
      where: { customerId },
      orderBy: { occurredAt: "desc" },
    });
  },

  async findById(id: string) {
    return prisma.customerEvent.findUnique({ where: { id } });
  },

  async countByCustomer(customerId: string) {
    return prisma.customerEvent.count({ where: { customerId } });
  },

  async sumAmountByCustomer(customerId: string) {
    const result = await prisma.customerEvent.aggregate({
      where: { customerId, amount: { not: null } },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  },

  async findLastVisit(customerId: string) {
    return prisma.customerEvent.findFirst({
      where: { customerId, eventType: EventType.VISIT },
      orderBy: { occurredAt: "desc" },
    });
  },

  async findVisitsSince(customerId: string, since: Date) {
    return prisma.customerEvent.findMany({
      where: {
        customerId,
        eventType: EventType.VISIT,
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: "desc" },
    });
  },

  async findByRestaurantSince(restaurantId: string, since: Date) {
    return prisma.customerEvent.findMany({
      where: {
        restaurantId,
        eventType: EventType.VISIT,
        occurredAt: { gte: since },
      },
      orderBy: { occurredAt: "desc" },
    });
  },
};
