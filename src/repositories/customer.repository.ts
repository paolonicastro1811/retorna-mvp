import { prisma } from "../database/client";
import type { CreateCustomerInput } from "../models/customer.model";
import type { LifecycleStatus } from "../shared/enums";

export const customerRepository = {
  async findById(id: string) {
    return prisma.customer.findUnique({ where: { id } });
  },

  async findByPhone(restaurantId: string, phone: string) {
    return prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId, phone } },
    });
  },

  async findByRestaurant(restaurantId: string) {
    return prisma.customer.findMany({
      where: { restaurantId, deletedAt: null },
      orderBy: { lastVisitAt: "desc" },
    });
  },

  async findByLifecycle(restaurantId: string, statuses: LifecycleStatus[]) {
    return prisma.customer.findMany({
      where: { restaurantId, deletedAt: null, lifecycleStatus: { in: statuses } },
    });
  },

  async findByFlags(
    restaurantId: string,
    filters: {
      lifecycle?: LifecycleStatus[];
      isFrequent?: boolean;
      isHighSpender?: boolean;
    }
  ) {
    return prisma.customer.findMany({
      where: {
        restaurantId,
        deletedAt: null,
        ...(filters.lifecycle && {
          lifecycleStatus: { in: filters.lifecycle },
        }),
        ...(filters.isFrequent !== undefined && {
          isFrequent: filters.isFrequent,
        }),
        ...(filters.isHighSpender !== undefined && {
          isHighSpender: filters.isHighSpender,
        }),
      },
    });
  },

  async create(data: CreateCustomerInput) {
    return prisma.customer.create({ data });
  },

  async upsertByPhone(restaurantId: string, phone: string, name?: string) {
    return prisma.customer.upsert({
      where: { restaurantId_phone: { restaurantId, phone } },
      create: { restaurantId, phone, name },
      update: { ...(name && { name }) },
    });
  },

  async updateMetrics(
    id: string,
    data: {
      totalVisits: number;
      totalSpent: number;
      avgTicket: number;
      lastVisitAt: Date | null;
      lastVisitAmount?: number | null;
    }
  ) {
    return prisma.customer.update({ where: { id }, data });
  },

  async updateFlags(
    id: string,
    data: {
      lifecycleStatus?: string;
      isFrequent?: boolean;
      isHighSpender?: boolean;
    }
  ) {
    return prisma.customer.update({ where: { id }, data });
  },

  async findAllByRestaurant(restaurantId: string) {
    return prisma.customer.findMany({ where: { restaurantId, deletedAt: null } });
  },

  async countByRestaurant(restaurantId: string) {
    return prisma.customer.count({ where: { restaurantId, deletedAt: null } });
  },

  async updateLastReactivatedAt(id: string, timestamp: Date) {
    return prisma.customer.update({
      where: { id },
      data: { lastReactivatedAt: timestamp },
    });
  },

  async updateOptInStatus(
    id: string,
    status: string,
    optInAt?: Date
  ) {
    return prisma.customer.update({
      where: { id },
      data: {
        whatsappOptInStatus: status,
        ...(optInAt && { whatsappOptInAt: optInAt }),
      },
    });
  },

  async updateContactableStatus(id: string, status: string) {
    return prisma.customer.update({
      where: { id },
      data: { contactableStatus: status },
    });
  },

  async revokeOptIn(id: string) {
    return prisma.customer.update({
      where: { id },
      data: {
        whatsappOptInStatus: "revoked",
        contactableStatus: "do_not_contact",
      },
    });
  },
};
