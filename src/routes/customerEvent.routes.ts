import { Router, Request, Response } from "express";
import { customerEventService } from "../services/customerEvent.service";
import { customerEventRepository } from "../repositories/customerEvent.repository";
import { param } from "../shared/params";
import { onVisitRegistered } from "../services/loyalty.service";
import { prisma } from "../database/client";
import { validate } from "../middleware/validate";
import { recordVisitSchema } from "../schemas";

const TIER_ORDER = ["novo", "frequente", "prata", "ouro"];

const router = Router();

/**
 * POST /restaurants/:restaurantId/visits — Registra uma visita
 * Returns enriched response with loyalty feedback
 */
router.post("/:restaurantId/visits", validate(recordVisitSchema), async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const { phone, customerName, amount, occurredAt } = req.body;

    if (!phone) return res.status(400).json({ error: "phone is required" });

    const result = await customerEventService.recordVisit({
      restaurantId,
      phone,
      customerName,
      amount: amount != null ? Number(amount) : undefined,
      occurredAt: occurredAt ? new Date(occurredAt) : undefined,
    });

    // Fire-and-forget: trigger loyalty automation (tier upgrade, messages, etc.)
    onVisitRegistered(result.customer.id).catch((err) =>
      console.error("[Loyalty] onVisitRegistered error:", err)
    );

    // Build loyalty feedback from updated customer + restaurant config
    let loyaltyFeedback = null;
    try {
      const [updatedCustomer, restaurant] = await Promise.all([
        prisma.customer.findUnique({ where: { id: result.customer.id } }),
        prisma.restaurant.findUnique({ where: { id: restaurantId } }),
      ]);
      if (updatedCustomer && restaurant) {
        const tier = updatedCustomer.tier as string;
        const tierIdx = TIER_ORDER.indexOf(tier);
        const nextTier = tierIdx < TIER_ORDER.length - 1 ? TIER_ORDER[tierIdx + 1] : null;
        const thresholds: Record<string, number> = {
          frequente: restaurant.tierFrequenteMinVisits,
          prata: restaurant.tierPrataMinVisits,
          ouro: restaurant.tierOuroMinVisits,
        };
        const visitsToNextTier = nextTier ? Math.max(0, thresholds[nextTier] - updatedCustomer.totalVisits) : 0;

        loyaltyFeedback = {
          tier,
          nextTier,
          visitsToNextTier,
          currentStreak: updatedCustomer.currentStreak,
          streakTarget: restaurant.streakTargetVisits,
          totalVisits: updatedCustomer.totalVisits,
        };
      }
    } catch (_) { /* non-blocking */ }

    res.status(201).json({ ...result, loyaltyFeedback });
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /restaurants/:restaurantId/customers/:customerId/events
 */
router.get(
  "/:restaurantId/customers/:customerId/events",
  async (req: Request, res: Response) => {
    try {
      const customerId = param(req, "customerId");
      const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { restaurantId: true } });
      if (!customer || customer.restaurantId !== param(req, "restaurantId")) {
        return res.status(404).json({ error: "Not found" });
      }
      const events = await customerEventRepository.findByCustomer(customerId);
      res.json(events);
    } catch (err) {
      console.error('[Route] Error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export const customerEventRouter = router;
