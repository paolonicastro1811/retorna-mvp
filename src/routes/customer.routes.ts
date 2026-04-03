import { Router, Request, Response } from "express";
import { customerRepository } from "../repositories/customer.repository";
import { prisma } from "../database/client";
import { param } from "../shared/params";

const router = Router();

router.get("/:restaurantId/customers", async (req: Request, res: Response) => {
  try {
    const customers = await customerRepository.findByRestaurant(
      param(req, "restaurantId")
    );
    res.json(customers);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

/**
 * GET /restaurants/:restaurantId/customers/search?q=5511
 * Typeahead search by phone or name (min 3 chars, max 5 results)
 */
router.get("/:restaurantId/customers/search", async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const q = (req.query.q as string || "").trim();
    if (q.length < 3) return res.json([]);

    const customers = await prisma.customer.findMany({
      where: {
        restaurantId,
        deletedAt: null,
        OR: [
          { phone: { contains: q } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        tier: true,
        totalVisits: true,
        currentStreak: true,
        streakUpdatedAt: true,
        lastVisitAt: true,
        lifecycleStatus: true,
      },
      take: 5,
    });
    res.json(customers);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get(
  "/:restaurantId/customers/:customerId",
  async (req: Request, res: Response) => {
    try {
      const customer = await customerRepository.findById(param(req, "customerId"));
      if (!customer || customer.restaurantId !== param(req, "restaurantId")) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json(customer);
    } catch (err) {
      console.error('[Route] Error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * GET /restaurants/:restaurantId/customers/:customerId/data-export
 *
 * LGPD Art. 18 — Right of access: returns ALL data stored about the customer.
 */
router.get(
  "/:restaurantId/customers/:customerId/data-export",
  async (req: Request, res: Response) => {
    try {
      const customerId = param(req, "customerId");
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
        include: {
          events: true,
          inboundMessages: true,
          messages: true,
          audienceItems: true,
          attributions: true,
        },
      });
      if (!customer || customer.restaurantId !== param(req, "restaurantId")) {
        return res.status(404).json({ error: "Not found" });
      }
      res.json({
        customer,
        _lgpd: "Full data export per LGPD Art. 18 — direito de acesso",
      });
    } catch (err) {
      console.error('[Route] Error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * PATCH /restaurants/:restaurantId/customers/:customerId/status
 *
 * Update customer lifecycle status (active/inactive).
 * Used by dashboard owner to manually toggle status.
 */
router.patch(
  "/:restaurantId/customers/:customerId/status",
  async (req: Request, res: Response) => {
    try {
      const customerId = param(req, "customerId");
      const { lifecycleStatus } = req.body;
      if (!lifecycleStatus || !["active", "inactive"].includes(lifecycleStatus)) {
        return res.status(400).json({ error: "lifecycleStatus must be 'active' or 'inactive'" });
      }
      const customer = await customerRepository.findById(customerId);
      if (!customer || customer.restaurantId !== param(req, "restaurantId")) {
        return res.status(404).json({ error: "Not found" });
      }

      const updated = await customerRepository.updateFlags(customerId, { lifecycleStatus });
      res.json(updated);
    } catch (err) {
      console.error('[Route] Error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * PATCH /restaurants/:restaurantId/customers/:customerId/last-visit-amount
 *
 * Manually correct the last visit amount (e.g. typo fix by restaurant owner).
 */
router.patch(
  "/:restaurantId/customers/:customerId/last-visit-amount",
  async (req: Request, res: Response) => {
    try {
      const customerId = param(req, "customerId");
      const { amount } = req.body;
      if (amount == null || typeof amount !== "number" || amount < 0) {
        return res.status(400).json({ error: "amount must be a non-negative number" });
      }
      const customer = await customerRepository.findById(customerId);
      if (!customer || customer.restaurantId !== param(req, "restaurantId")) {
        return res.status(404).json({ error: "Not found" });
      }

      // Update lastVisitAmount and recalculate totalSpent
      // Find the last event and update its amount too
      const lastEvent = await prisma.customerEvent.findFirst({
        where: { customerId, eventType: "visit" },
        orderBy: { occurredAt: "desc" },
      });

      if (lastEvent) {
        const oldAmount = lastEvent.amount ?? 0;
        const diff = amount - oldAmount;
        // Atomic: update event + customer metrics in one transaction
        await prisma.$transaction([
          prisma.customerEvent.update({
            where: { id: lastEvent.id },
            data: { amount },
          }),
          prisma.customer.update({
            where: { id: customerId },
            data: {
              lastVisitAmount: amount,
              totalSpent: Math.max(0, (customer.totalSpent ?? 0) + diff),
              avgTicket: customer.totalVisits > 0
                ? Math.round((((customer.totalSpent ?? 0) + diff) / customer.totalVisits) * 100) / 100
                : 0,
            },
          }),
        ]);
      } else {
        await prisma.customer.update({
          where: { id: customerId },
          data: { lastVisitAmount: amount },
        });
      }

      const updated = await customerRepository.findById(customerId);
      res.json(updated);
    } catch (err) {
      console.error('[Route] Error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

/**
 * DELETE /restaurants/:restaurantId/customers/:customerId
 *
 * LGPD Art. 18 — Right to deletion: soft-deletes customer
 * by setting deletedAt timestamp and anonymizing PII (name, phone).
 * Data is retained for audit trail but rendered non-identifiable.
 *
 * Also available via WhatsApp keyword: APAGAR / DELETAR
 */
router.delete(
  "/:restaurantId/customers/:customerId",
  async (req: Request, res: Response) => {
    try {
      const customerId = param(req, "customerId");
      const customer = await prisma.customer.findUnique({
        where: { id: customerId },
      });
      if (!customer || customer.restaurantId !== param(req, "restaurantId")) {
        return res.status(404).json({ error: "Not found" });
      }

      // Soft-delete: anonymize PII + set deletedAt
      await prisma.customer.update({
        where: { id: customerId },
        data: {
          deletedAt: new Date(),
          name: null,
          phone: `deleted_${customerId}`,
          contactableStatus: "do_not_contact",
          whatsappOptInStatus: "revoked",
          lifecycleStatus: "inactive",
        },
      });

      console.log(
        `[LGPD] Customer soft-deleted: id=${customerId} phone=${customer.phone}`
      );

      res.json({
        deleted: true,
        customerId,
        _lgpd: "Dados do cliente anonimizados e marcados como excluidos conforme LGPD Art. 18",
      });
    } catch (err) {
      console.error('[Route] Error:', err);
      res.status(500).json({ error: 'Erro interno do servidor' });
    }
  }
);

export const customerRouter = router;
