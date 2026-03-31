import { prisma } from "../database/client";
import type {
  CreateRestaurantInput,
  UpdateRestaurantInput,
} from "../models/restaurant.model";

export const restaurantRepository = {
  async findById(id: string) {
    return prisma.restaurant.findUnique({ where: { id } });
  },

  async findAll() {
    return prisma.restaurant.findMany({ orderBy: { createdAt: "desc" } });
  },

  async create(data: CreateRestaurantInput) {
    return prisma.restaurant.create({ data });
  },

  async update(id: string, data: UpdateRestaurantInput) {
    return prisma.restaurant.update({ where: { id }, data });
  },

  async delete(id: string) {
    return prisma.restaurant.delete({ where: { id } });
  },
};
