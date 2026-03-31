import { customerRepository } from "../repositories/customer.repository";
import { customerEventRepository } from "../repositories/customerEvent.repository";
import {
  LifecycleStatus,
  LIFECYCLE_THRESHOLDS,
  SEGMENTATION_THRESHOLDS,
} from "../shared/enums";

export const segmentationService = {
  /**
   * computeLifecycle — Calcola lifecycle_status basato su lastVisitAt.
   * active: ultima visita <= 30 giorni
   * at_risk: ultima visita 31-60 giorni
   * inactive: ultima visita > 60 giorni oppure mai visitato
   */
  computeLifecycle(lastVisitAt: Date | null): LifecycleStatus {
    if (!lastVisitAt) return LifecycleStatus.INACTIVE;

    const daysSinceVisit = Math.floor(
      (Date.now() - lastVisitAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceVisit <= LIFECYCLE_THRESHOLDS.ACTIVE_MAX_DAYS) {
      return LifecycleStatus.ACTIVE;
    }
    if (daysSinceVisit <= LIFECYCLE_THRESHOLDS.AT_RISK_MAX_DAYS) {
      return LifecycleStatus.AT_RISK;
    }
    return LifecycleStatus.INACTIVE;
  },

  /**
   * computeFrequent — Cliente con >= 4 visite negli ultimi 30 giorni
   */
  async computeFrequent(customerId: string): Promise<boolean> {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const recentVisits = await customerEventRepository.findVisitsSince(
      customerId,
      since
    );
    return recentVisits.length >= SEGMENTATION_THRESHOLDS.FREQUENT_MIN_VISITS_30D;
  },

  /**
   * computeHighSpender — Cliente nel top 25% per avgTicket del ristorante
   */
  async computeHighSpender(
    customerId: string,
    restaurantId: string
  ): Promise<boolean> {
    const allCustomers =
      await customerRepository.findAllByRestaurant(restaurantId);
    if (allCustomers.length === 0) return false;

    const customer = allCustomers.find((c) => c.id === customerId);
    if (!customer || customer.totalVisits === 0) return false;

    const tickets = allCustomers
      .filter((c) => c.totalVisits > 0)
      .map((c) => c.avgTicket)
      .sort((a, b) => a - b);

    if (tickets.length === 0) return false;

    const thresholdIndex = Math.floor(
      tickets.length * SEGMENTATION_THRESHOLDS.HIGH_SPENDER_PERCENTILE
    );
    const threshold = tickets[thresholdIndex] ?? 0;

    return customer.avgTicket >= threshold;
  },

  /**
   * refreshCustomer — Ricalcola lifecycle + flags per un singolo customer
   */
  async refreshCustomer(customerId: string) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) return;

    const lifecycleStatus = this.computeLifecycle(customer.lastVisitAt);
    const isFrequent = await this.computeFrequent(customerId);
    const isHighSpender = await this.computeHighSpender(
      customerId,
      customer.restaurantId
    );

    await customerRepository.updateFlags(customerId, {
      lifecycleStatus,
      isFrequent,
      isHighSpender,
    });
  },

  /**
   * refreshAllForRestaurant — Batch refresh per tutti i clienti di un ristorante
   */
  async refreshAllForRestaurant(restaurantId: string) {
    const customers =
      await customerRepository.findAllByRestaurant(restaurantId);

    let updated = 0;
    for (const customer of customers) {
      const lifecycleStatus = this.computeLifecycle(customer.lastVisitAt);
      const isFrequent = await this.computeFrequent(customer.id);
      const isHighSpender = await this.computeHighSpender(
        customer.id,
        restaurantId
      );

      await customerRepository.updateFlags(customer.id, {
        lifecycleStatus,
        isFrequent,
        isHighSpender,
      });
      updated++;
    }

    return { updated };
  },
};
