import type { ReactivationAttribution as PrismaReactivationAttribution } from "@prisma/client";

export type ReactivationAttribution = PrismaReactivationAttribution;

export interface CreateAttributionInput {
  messageId: string;
  customerId: string;
  visitId: string;
  revenue: number;
}
