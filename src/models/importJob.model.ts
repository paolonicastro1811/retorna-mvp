import type { ImportJob as PrismaImportJob } from "@prisma/client";

export type ImportJob = PrismaImportJob;

export interface CreateImportJobInput {
  restaurantId: string;
  fileName?: string;
}
