import { outboundMessageRepository } from "../repositories/outboundMessage.repository";
import { messageEventRepository } from "../repositories/messageEvent.repository";
import { campaignRepository } from "../repositories/campaign.repository";
import { campaignAudienceItemRepository } from "../repositories/campaignAudienceItem.repository";
import { messageTemplateRepository } from "../repositories/messageTemplate.repository";
import { whatsappProvider, WhatsAppCredentials } from "./whatsapp.provider";
import { prisma } from "../database/client";
import {
  MessageStatus,
  MessageEventType,
  CampaignStatus,
  LGPD_MESSAGE_FOOTER,
} from "../shared/enums";

export const messagingService = {
  /**
   * queueMessages — Crea OutboundMessage per ogni membro dell'audience.
   * Interpola il template con i dati del cliente.
   */
  async queueMessages(campaignId: string) {
    const campaign = await campaignRepository.findById(campaignId);
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
    if (!campaign.templateId)
      throw new Error(`Campaign ${campaignId} has no template`);

    const template = await messageTemplateRepository.findById(
      campaign.templateId
    );
    if (!template) throw new Error(`Template ${campaign.templateId} not found`);

    // Campaign messages MUST use Meta-approved HSM templates (business-initiated)
    if (!template.hsmTemplateName) {
      throw new Error(
        `Template "${template.name}" has no HSM template name. ` +
        `Campaign messages require a Meta-approved template. ` +
        `Set hsmTemplateName in the template configuration.`
      );
    }

    const audienceItems =
      await campaignAudienceItemRepository.findByCampaign(campaignId);

    const messages = audienceItems.map((item) => ({
      campaignId,
      customerId: item.customerId,
      restaurantId: campaign.restaurantId,
      phone: item.customer.phone,
      // body stored for display/logging; actual send uses HSM template
      body: interpolateTemplate(template.body, {
        name: item.customer.name ?? "Cliente",
      }) + LGPD_MESSAGE_FOOTER,
      // Store HSM info for dispatch
      hsmTemplateName: template.hsmTemplateName!,
      hsmLanguage: template.hsmLanguage ?? "pt_BR",
    }));

    if (messages.length > 0) {
      await outboundMessageRepository.createMany(messages);
    }

    return { queued: messages.length };
  },

  /**
   * sendMessage — Invia un singolo messaggio via WhatsApp provider.
   * Fetches per-restaurant WhatsApp credentials if available.
   */
  async sendMessage(messageId: string) {
    const message = await outboundMessageRepository.findById(messageId) as any;
    if (!message) throw new Error(`Message ${messageId} not found`);

    // Fetch per-restaurant WhatsApp credentials
    const credentials = await getRestaurantCredentials(message.restaurantId);

    // Use HSM template for campaign messages (business-initiated), plain text for others
    const result = message.hsmTemplateName
      ? await whatsappProvider.sendTemplate(
          message.phone,
          message.hsmTemplateName,
          message.hsmLanguage ?? "pt_BR",
          extractTemplateParams(message.body),
          credentials
        )
      : await whatsappProvider.sendMessage(message.phone, message.body, credentials);

    if (result.success) {
      await outboundMessageRepository.updateStatus(messageId, MessageStatus.SENT, {
        providerMsgId: result.providerMsgId,
      });
      await messageEventRepository.create({
        messageId,
        eventType: MessageEventType.SENT,
      });
    } else {
      await outboundMessageRepository.updateStatus(messageId, MessageStatus.FAILED, {
        failReason: result.error,
      });
      await messageEventRepository.create({
        messageId,
        eventType: MessageEventType.FAILED,
        payload: { error: result.error },
      });
    }

    return result;
  },

  /**
   * updateDeliveryStatus — Aggiorna lo stato di delivery di un messaggio.
   * Chiamato dal webhook WhatsApp.
   */
  async updateDeliveryStatus(
    providerMsgId: string,
    status: string,
    timestamp?: Date
  ) {
    const message =
      await outboundMessageRepository.findByProviderMsgId(providerMsgId);
    if (!message) {
      console.warn(
        `[Messaging] updateDeliveryStatus: message not found for providerMsgId=${providerMsgId}`
      );
      return null;
    }

    // Mappa status WhatsApp → nostro status
    const statusMap: Record<string, string> = {
      sent: MessageStatus.SENT,
      delivered: MessageStatus.DELIVERED,
      read: MessageStatus.READ,
      failed: MessageStatus.FAILED,
    };

    const mappedStatus = statusMap[status];
    if (!mappedStatus) {
      console.warn(`[Messaging] Unknown status: ${status}`);
      return null;
    }

    await outboundMessageRepository.updateStatus(message.id, mappedStatus);
    await messageEventRepository.create({
      messageId: message.id,
      eventType: status,
      payload: { timestamp: timestamp?.toISOString() },
    });

    return message;
  },

  /**
   * dispatchCampaign — Invia tutti i messaggi queued di una campagna.
   * Throttled: 50ms delay between messages to respect Meta rate limits.
   */
  async dispatchCampaign(campaignId: string) {
    await campaignRepository.updateStatus(campaignId, CampaignStatus.SENDING);

    const queued =
      await outboundMessageRepository.findQueuedByCampaign(campaignId);

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < queued.length; i++) {
      const result = await this.sendMessage(queued[i].id);
      if (result.success) sent++;
      else failed++;

      // Throttle: 50ms between messages (~20 msg/sec, safe for all Meta tiers)
      if (i < queued.length - 1) {
        await new Promise((r) => setTimeout(r, DISPATCH_THROTTLE_MS));
      }
    }

    await campaignRepository.updateStatus(campaignId, CampaignStatus.COMPLETED);

    return { sent, failed, total: queued.length };
  },
};

// --- Constants ---
const DISPATCH_THROTTLE_MS = 50; // 50ms between campaign messages

// --- Helpers ---

function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

/**
 * extractTemplateParams — Extracts parameter values from interpolated body
 * for HSM template. Returns customer name (first interpolated value).
 */
/**
 * getRestaurantCredentials — Fetch per-restaurant WhatsApp credentials.
 * Returns undefined if not configured (falls back to global env vars in provider).
 */
async function getRestaurantCredentials(restaurantId: string): Promise<WhatsAppCredentials | undefined> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { waAccessToken: true, waPhoneNumberId: true },
  });

  if (restaurant?.waAccessToken && restaurant?.waPhoneNumberId) {
    return {
      accessToken: restaurant.waAccessToken,
      phoneNumberId: restaurant.waPhoneNumberId,
    };
  }

  return undefined;
}

function extractTemplateParams(body: string): string[] {
  // The body is already interpolated; extract the name before LGPD footer
  const withoutFooter = body.replace(LGPD_MESSAGE_FOOTER, "").trim();
  // For now, the only parameter is the customer name.
  // This matches the standard reactivation template: "Oi {{1}}, ..."
  // We extract the first word/name after common greetings
  const nameMatch = withoutFooter.match(/^(?:Oi|Ola|Olá|E aí|Fala),?\s+([^!,.]+)/i);
  return nameMatch ? [nameMatch[1].trim()] : ["Cliente"];
}
