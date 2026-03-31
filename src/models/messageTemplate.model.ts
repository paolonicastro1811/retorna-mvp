import type { MessageTemplate as PrismaMessageTemplate } from "@prisma/client";

export type MessageTemplate = PrismaMessageTemplate;

export interface CreateTemplateInput {
  restaurantId: string;
  name: string;
  body: string;
}
