import type { Customer as PrismaCustomer } from "@prisma/client";
import type { LifecycleStatus } from "../shared/enums";

export type Customer = PrismaCustomer;

export interface CreateCustomerInput {
  restaurantId: string;
  phone: string;
  name?: string;
}

export interface UpdateCustomerMetrics {
  totalVisits: number;
  totalSpent: number;
  avgTicket: number;
  lastVisitAt: Date | null;
}

export interface UpdateCustomerFlags {
  isFrequent?: boolean;
  isHighSpender?: boolean;
  lifecycleStatus?: LifecycleStatus;
}
