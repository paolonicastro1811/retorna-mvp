import type { Restaurant as PrismaRestaurant } from "@prisma/client";

export type Restaurant = PrismaRestaurant;

export interface CreateRestaurantInput {
  name: string;
  phone?: string;
  plan?: string;
  timezone?: string;
  attributionWindowDays?: number;
}

export interface UpdateRestaurantInput {
  name?: string;
  phone?: string;
  plan?: string;
  timezone?: string;
  attributionWindowDays?: number;
  tierFrequenteMinVisits?: number;
  tierPrataMinVisits?: number;
  tierOuroMinVisits?: number;
  discountFrequente?: number;
  discountPrata?: number;
  discountOuro?: number;
  streakTargetVisits?: number;
  streakWindowDays?: number;
  reactivationAfterDays?: number;
  surpriseEveryMinVisits?: number;
  surpriseEveryMaxVisits?: number;
}
