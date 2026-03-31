import type { MessageEvent as PrismaMessageEvent } from "@prisma/client";

export type MessageEvent = PrismaMessageEvent;

export interface CreateMessageEventInput {
  messageId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}
