import { Prisma } from "@prisma/client";
import { prisma } from "../database/client";
import type { CreateImportJobInput } from "../models/importJob.model";

export const importJobRepository = {
  async create(data: CreateImportJobInput) {
    return prisma.importJob.create({ data });
  },

  async findById(id: string) {
    return prisma.importJob.findUnique({ where: { id } });
  },

  async updateProgress(
    id: string,
    data: {
      status?: string;
      totalRows?: number;
      processedRows?: number;
      errorRows?: number;
      errors?: Record<string, unknown> | null;
    }
  ) {
    const updateData: Prisma.ImportJobUpdateInput = {
      ...(data.status !== undefined && { status: data.status }),
      ...(data.totalRows !== undefined && { totalRows: data.totalRows }),
      ...(data.processedRows !== undefined && { processedRows: data.processedRows }),
      ...(data.errorRows !== undefined && { errorRows: data.errorRows }),
      ...(data.errors !== undefined && {
        errors: data.errors === null
          ? Prisma.JsonNull
          : (data.errors as Prisma.InputJsonValue),
      }),
    };
    return prisma.importJob.update({ where: { id }, data: updateData });
  },

  async findByRestaurant(restaurantId: string) {
    return prisma.importJob.findMany({
      where: { restaurantId },
      orderBy: { createdAt: "desc" },
    });
  },
};
