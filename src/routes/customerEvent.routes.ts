import { Router, Request, Response } from "express";
import { customerEventService } from "../services/customerEvent.service";
import { customerEventRepository } from "../repositories/customerEvent.repository";
import { param } from "../shared/params";
import { onVisitRegistered } from "../services/loyalty.service";

const router = Router();

/**
 * POST /restaurants/:restaurantId/visits — Registra una visita
 */
router.post("/:restaurantId/visits", async (req: Request, res: Response) => {
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

  res.status(201).json(result);
});

/**
 * GET /restaurants/:restaurantId/customers/:customerId/events
 */
router.get(
  "/:restaurantId/customers/:customerId/events",
  async (req: Request, res: Response) => {
    const events = await customerEventRepository.findByCustomer(
      param(req, "customerId")
    );
    res.json(events);
  }
);

export const customerEventRouter = router;
