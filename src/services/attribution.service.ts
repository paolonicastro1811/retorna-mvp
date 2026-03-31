import { outboundMessageRepository } from "../repositories/outboundMessage.repository";
import { reactivationAttributionRepository } from "../repositories/reactivationAttribution.repository";
import { restaurantRepository } from "../repositories/restaurant.repository";
import { customerRepository } from "../repositories/customer.repository";
import { customerEventRepository } from "../repositories/customerEvent.repository";

export const attributionService = {
  /**
   * tryCreateAttribution — Last-touch attribution.
   * Quando un cliente fa una visit, cerca l'ultimo messaggio inviato
   * entro la finestra di attribuzione letta da restaurant.attributionWindowDays.
   * Regole:
   *   - una visit -> un solo messaggio attribuito
   *   - un messaggio -> al massimo una reactivation
   * Dopo la creazione, aggiorna customer.lastReactivatedAt.
   */
  async tryCreateAttribution(
    customerId: string,
    visitId: string,
    restaurantId: string,
    revenue?: number
  ) {
    if (!revenue || revenue <= 0) return null;

    // Controlla se questa visit ha gia' un'attribution
    const existingVisit =
      await reactivationAttributionRepository.findByVisitId(visitId);
    if (existingVisit) return null;

    // Cerca l'ultimo messaggio delivered/sent al cliente
    const lastMessage =
      await outboundMessageRepository.findLastDeliveredToCustomer(customerId);
    if (!lastMessage || !lastMessage.sentAt) return null;

    // Leggi la finestra di attribuzione dal restaurant
    const restaurant = await restaurantRepository.findById(restaurantId);
    if (!restaurant) return null;

    const windowMs = restaurant.attributionWindowDays * 24 * 60 * 60 * 1000;
    const timeSinceMessage = Date.now() - lastMessage.sentAt.getTime();
    if (timeSinceMessage > windowMs) return null;

    // Controlla se questo messaggio ha gia' un'attribution
    const existingMessage =
      await reactivationAttributionRepository.findByMessageId(lastMessage.id);
    if (existingMessage) return null;

    // Crea attribution
    const attribution = await reactivationAttributionRepository.create({
      messageId: lastMessage.id,
      customerId,
      visitId,
      revenue,
    });

    // Aggiorna customer.lastReactivatedAt con il timestamp della visit attribuita
    const visit = await customerEventRepository.findById(visitId);
    if (visit) {
      await customerRepository.updateLastReactivatedAt(
        customerId,
        visit.occurredAt
      );
    }

    return attribution;
  },

  /**
   * getRestaurantROI — Revenue attribuita per ristorante
   */
  async getRestaurantROI(restaurantId: string, since?: Date) {
    return reactivationAttributionRepository.sumRevenueByRestaurant(
      restaurantId,
      since
    );
  },

  /**
   * getAttributionsByRestaurant — Lista dettagliata attributions
   */
  async getAttributionsByRestaurant(restaurantId: string, since?: Date) {
    return reactivationAttributionRepository.findByRestaurant(
      restaurantId,
      since
    );
  },
};
