// ============================================================
// ConversationService — Short-term memory via DB
// ============================================================

import { prisma } from "../../database/client";
import { ConversationMessage } from "./intent.types";

const CONVERSATION_WINDOW_MINUTES = 10;
const MAX_MESSAGES = 10;

/**
 * Retrieves the recent conversation window for a customer.
 * Returns last N messages (both inbound + bot replies) within
 * the time window, ordered oldest→newest.
 */
export async function getConversationWindow(
  customerId: string,
  restaurantId: string
): Promise<ConversationMessage[]> {
  const cutoff = new Date(Date.now() - CONVERSATION_WINDOW_MINUTES * 60_000);

  // Inbound (customer → restaurant)
  const inbound = await prisma.inboundMessage.findMany({
    where: {
      customerId,
      restaurantId,
      receivedAt: { gte: cutoff },
    },
    orderBy: { receivedAt: "desc" },
    take: MAX_MESSAGES,
    select: { messageText: true, receivedAt: true },
  });

  // Bot replies (restaurant → customer)
  const replies = await prisma.conversationReply.findMany({
    where: {
      customerId,
      restaurantId,
      sentAt: { gte: cutoff },
    },
    orderBy: { sentAt: "desc" },
    take: MAX_MESSAGES,
    select: { messageText: true, sentAt: true },
  });

  const messages: ConversationMessage[] = [
    ...inbound.map((m) => ({
      role: "customer" as const,
      text: m.messageText ?? "",
      timestamp: m.receivedAt,
    })),
    ...replies.map((m) => ({
      role: "restaurant" as const,
      text: m.messageText,
      timestamp: m.sentAt,
    })),
  ];

  // Sort oldest→newest, keep last MAX_MESSAGES
  messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  return messages.slice(-MAX_MESSAGES);
}

/**
 * Saves a bot reply to the conversation history.
 */
export async function saveConversationReply(
  restaurantId: string,
  customerId: string,
  phoneE164: string,
  messageText: string,
  intent?: string
): Promise<void> {
  await prisma.conversationReply.create({
    data: {
      restaurantId,
      customerId,
      phoneE164,
      messageText,
      intent: intent ?? null,
      sentAt: new Date(),
    },
  });
}
