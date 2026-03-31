import { customerRepository } from "../repositories/customer.repository";
import { customerEventRepository } from "../repositories/customerEvent.repository";
import { attributionService } from "./attribution.service";
import type { RecordVisitInput } from "../models/customerEvent.model";

export const customerEventService = {
  /**
   * recordVisit — Registra una visita per un cliente.
   * 1. Upsert customer (by phone)
   * 2. Crea evento visit
   * 3. Aggiorna metriche aggregate del customer
   * 4. Tenta attribution last-touch
   */
  async recordVisit(input: RecordVisitInput) {
    const { restaurantId, phone, customerName, amount, occurredAt } = input;
    const visitDate = occurredAt ?? new Date();

    // 1. Upsert customer
    const customer = await customerRepository.upsertByPhone(
      restaurantId,
      phone,
      customerName
    );

    // 2. Crea evento
    const event = await customerEventRepository.create({
      customerId: customer.id,
      restaurantId,
      amount,
      occurredAt: visitDate,
    });

    // 3. Aggiorna metriche
    await this.updateCustomerMetrics(customer.id);

    // 4. Attribution last-touch
    await attributionService.tryCreateAttribution(customer.id, event.id, restaurantId, amount);

    return { customer, event };
  },

  /**
   * updateCustomerMetrics — Ricalcola totalVisits, totalSpent, avgTicket, lastVisitAt
   */
  async updateCustomerMetrics(customerId: string) {
    const [visitCount, totalSpent, lastVisit] = await Promise.all([
      customerEventRepository.countByCustomer(customerId),
      customerEventRepository.sumAmountByCustomer(customerId),
      customerEventRepository.findLastVisit(customerId),
    ]);

    const avgTicket = visitCount > 0 ? totalSpent / visitCount : 0;

    await customerRepository.updateMetrics(customerId, {
      totalVisits: visitCount,
      totalSpent,
      avgTicket: Math.round(avgTicket * 100) / 100,
      lastVisitAt: lastVisit?.occurredAt ?? null,
      lastVisitAmount: lastVisit?.amount ?? null,
    });
  },
};
