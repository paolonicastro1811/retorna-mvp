import type { OutboundMessage as PrismaOutboundMessage } from "@prisma/client";
import type { MessageStatus } from "../shared/enums";

export type OutboundMessage = PrismaOutboundMessage;

export interface QueueMessageInput {
  campaignId: string;
  customerId: string;
  restaurantId: string;
  phone: string;
  body: string;
}

export interface UpdateDeliveryInput {
  status: MessageStatus;
  providerMsgId?: string;
  failReason?: string;
}
