import type { CustomerEvent as PrismaCustomerEvent } from "@prisma/client";

export type CustomerEvent = PrismaCustomerEvent;

export interface RecordVisitInput {
  restaurantId: string;
  phone: string;
  customerName?: string;
  amount?: number;
  occurredAt?: Date;
}
