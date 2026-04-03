import { Router, Request, Response } from "express";
import { campaignService } from "../services/campaign.service";
import { messagingService } from "../services/messaging.service";
import { messageTemplateRepository } from "../repositories/messageTemplate.repository";
import { outboundMessageRepository } from "../repositories/outboundMessage.repository";
import { param } from "../shared/params";
import { prisma } from "../database/client";
import { validate } from "../middleware/validate";
import { createCampaignSchema, createTemplateSchema } from "../schemas";
import { reviewTemplate } from "../services/templateAiReview.service";
import { submitTemplateToMeta, deleteTemplateFromMeta } from "../services/metaTemplate.service";
import { checkCampaignLimits } from "../services/campaignLimits.service";

const router = Router();

/** Verify campaign belongs to the authenticated user's restaurant */
async function verifyCampaignOwner(req: Request, res: Response): Promise<boolean> {
  const user = (req as any).user;
  if (!user?.restaurantId) { res.status(403).json({ error: "Forbidden" }); return false; }
  const campaign = await prisma.campaign.findUnique({
    where: { id: param(req, "campaignId") },
    select: { restaurantId: true },
  });
  if (!campaign) { res.status(404).json({ error: "Not found" }); return false; }
  if (campaign.restaurantId !== user.restaurantId) {
    res.status(403).json({ error: "Forbidden — you cannot access this campaign" });
    return false;
  }
  return true;
}

// --- Templates ---

router.get("/:restaurantId/templates", async (req: Request, res: Response) => {
  try {
    const templates = await messageTemplateRepository.findByRestaurant(
      param(req, "restaurantId")
    );
    res.json(templates);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post("/:restaurantId/templates", validate(createTemplateSchema), async (req: Request, res: Response) => {
  try {
    const { name, body } = req.body;
    if (!name || !body)
      return res.status(400).json({ error: "name and body are required" });
    const template = await messageTemplateRepository.create({
      restaurantId: param(req, "restaurantId"),
      name,
      body,
    });
    res.status(201).json(template);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.patch("/:restaurantId/templates/:templateId", async (req: Request, res: Response) => {
  try {
    const { isActive } = req.body;
    if (typeof isActive !== "boolean")
      return res.status(400).json({ error: "isActive (boolean) is required" });

    // post_visit_thanks is mandatory for Meta compliance — cannot be disabled
    const template = await prisma.messageTemplate.findUnique({ where: { id: param(req, "templateId") } });
    if (!template || template.restaurantId !== param(req, "restaurantId")) {
      return res.status(404).json({ error: "Template nao encontrado" });
    }
    if (template.hsmTemplateName === "post_visit_thanks_v1" && !isActive) {
      return res.status(403).json({ error: "Template de consentimento é obrigatório e não pode ser desativado." });
    }

    const updated = await messageTemplateRepository.update(
      param(req, "templateId"),
      { isActive }
    );
    res.json(updated);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// --- Custom Templates: Create + AI Review ---

router.post("/:restaurantId/templates/custom", async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const { name, body } = req.body;
    if (!name || !body) return res.status(400).json({ error: "name and body are required" });

    // Validate template name: 3-60 chars, alphanumeric + spaces/hyphens/underscores
    const trimmedName = name.trim();
    if (trimmedName.length < 3 || trimmedName.length > 60) {
      return res.status(400).json({ error: "Nome do template deve ter entre 3 e 60 caracteres" });
    }
    if (!/^[\w\s\-áàãâéêíóôõúüçÁÀÃÂÉÊÍÓÔÕÚÜÇ]+$/.test(trimmedName)) {
      return res.status(400).json({ error: "Nome do template contém caracteres inválidos" });
    }

    // Check max custom templates (3 per restaurant)
    const existingCustom = await prisma.messageTemplate.count({
      where: { restaurantId, isCustom: true },
    });
    if (existingCustom >= 3) {
      return res.status(400).json({ error: "Limite de 3 templates custom atingido. Delete um existente para criar outro." });
    }

    // AI review
    const review = await reviewTemplate(body);

    if (!review.approved) {
      return res.status(422).json({
        error: "Template nao aprovado pela revisao AI.",
        review,
      });
    }

    // Create template in DB (AI review already passed at this point)
    const template = await prisma.messageTemplate.create({
      data: {
        restaurantId,
        name,
        body,
        channel: "whatsapp",
        isCustom: true,
        metaStatus: "draft",
        isActive: false,
        aiReviewNotes: JSON.stringify(review),
      },
    });

    res.status(201).json({ template, review });
  } catch (err) {
    console.error("[Route] Error:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// --- AI Review Only (preview before saving) ---

router.post("/:restaurantId/templates/ai-review", async (req: Request, res: Response) => {
  try {
    const { body } = req.body;
    if (!body) return res.status(400).json({ error: "body is required" });
    const review = await reviewTemplate(body);
    res.json(review);
  } catch (err) {
    console.error("[Route] Error:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// --- Submit Custom Template to Meta ---

router.post("/:restaurantId/templates/:templateId/submit-to-meta", async (req: Request, res: Response) => {
  try {
    const templateId = param(req, "templateId");

    const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.restaurantId !== param(req, "restaurantId")) {
      return res.status(404).json({ error: "Template nao encontrado" });
    }
    if (!template.isCustom) return res.status(400).json({ error: "Apenas templates custom podem ser enviados para Meta" });
    if (template.metaStatus === "submitted") return res.status(400).json({ error: "Template ja esta em revisao pela Meta" });
    if (template.metaStatus === "approved") return res.status(400).json({ error: "Template ja esta aprovado" });

    const result = await submitTemplateToMeta(templateId);

    if (result.success) {
      const updated = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
      res.json({ success: true, template: updated });
    } else {
      res.status(400).json({ success: false, error: result.error });
    }
  } catch (err) {
    console.error("[Route] Error:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// --- Delete Custom Template (from Meta + DB) ---

router.delete("/:restaurantId/templates/:templateId", async (req: Request, res: Response) => {
  try {
    const templateId = param(req, "templateId");
    const template = await prisma.messageTemplate.findUnique({ where: { id: templateId } });
    if (!template || template.restaurantId !== param(req, "restaurantId")) {
      return res.status(404).json({ error: "Template nao encontrado" });
    }
    if (!template.isCustom) return res.status(400).json({ error: "Templates padrao nao podem ser deletados" });

    // If submitted to Meta, delete from Meta first
    if (template.metaStatus === "submitted" || template.metaStatus === "approved") {
      await deleteTemplateFromMeta(templateId);
    } else {
      await prisma.messageTemplate.delete({ where: { id: templateId } });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("[Route] Error:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// --- Campaign Limits Check ---

router.get("/:restaurantId/campaign-limits", async (req: Request, res: Response) => {
  try {
    const result = await checkCampaignLimits(param(req, "restaurantId"));
    res.json(result);
  } catch (err) {
    console.error("[Route] Error:", err);
    res.status(500).json({ error: "Erro interno do servidor" });
  }
});

// --- Campaigns ---

router.get("/:restaurantId/campaigns", async (req: Request, res: Response) => {
  try {
    const campaigns = await campaignService.findByRestaurant(
      param(req, "restaurantId")
    );
    res.json(campaigns);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post("/:restaurantId/campaigns", validate(createCampaignSchema), async (req: Request, res: Response) => {
  try {
    const { name, segmentRules, templateId, scheduledAt } = req.body;
    if (!name || !segmentRules)
      return res.status(400).json({ error: "name and segmentRules are required" });

    const campaign = await campaignService.create({
      restaurantId: param(req, "restaurantId"),
      name,
      segmentRules,
      templateId,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
    });
    res.status(201).json(campaign);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get("/campaigns/:campaignId", async (req: Request, res: Response) => {
  try {
    if (!await verifyCampaignOwner(req, res)) return;
    const campaign = await campaignService.findById(param(req, "campaignId"));
    if (!campaign) return res.status(404).json({ error: "Not found" });
    res.json(campaign);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.post("/campaigns/:campaignId/build", async (req: Request, res: Response) => {
  try {
    if (!await verifyCampaignOwner(req, res)) return;
    const result = await campaignService.buildAudience(param(req, "campaignId"));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/campaigns/:campaignId/queue", async (req: Request, res: Response) => {
  try {
    if (!await verifyCampaignOwner(req, res)) return;
    const campaignId = param(req, "campaignId");

    // Atomic status guard: only allow queueing if campaign is READY (prevents duplicate messages)
    const guard = await prisma.campaign.updateMany({
      where: { id: campaignId, status: "ready" },
      data: { status: "ready" }, // no-op update, just validates status atomically
    });
    if (guard.count === 0) {
      return res.status(409).json({ error: "Campaign is not in READY status. Cannot queue messages." });
    }

    const result = await messagingService.queueMessages(campaignId);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/campaigns/:campaignId/dispatch", async (req: Request, res: Response) => {
  try {
    if (!await verifyCampaignOwner(req, res)) return;
    // Check if campaign uses a custom template → enforce limits
    const campaign = await prisma.campaign.findUnique({
      where: { id: param(req, "campaignId") },
      include: { template: true },
    });

    if (campaign?.template?.isCustom) {
      const limits = await checkCampaignLimits(campaign.restaurantId);
      if (!limits.allowed) {
        return res.status(429).json({ error: limits.reason, details: limits.details });
      }
    }

    const result = await messagingService.dispatchCampaign(param(req, "campaignId"));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/campaigns/:campaignId/messages", async (req: Request, res: Response) => {
  try {
    if (!await verifyCampaignOwner(req, res)) return;
    const messages = await outboundMessageRepository.findByCampaign(
      param(req, "campaignId")
    );
    res.json(messages);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.get("/campaigns/:campaignId/stats", async (req: Request, res: Response) => {
  try {
    if (!await verifyCampaignOwner(req, res)) return;
    const stats = await outboundMessageRepository.countByCampaignAndStatus(
      param(req, "campaignId")
    );
    res.json(stats);
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// --- Automation Logs (loyalty system) ---

router.get("/:restaurantId/automation-stats", async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const ATTRIBUTION_WINDOW_DAYS = 7;
    const days = Math.min(365, Math.max(1, parseInt(req.query.days as string) || 90));
    const sinceDate = new Date(Date.now() - days * 86400000);

    // ── 1. All sent automation logs (last 90 days) ──
    const sentLogs = await prisma.automationLog.findMany({
      where: { restaurantId, status: "sent", createdAt: { gte: sinceDate } },
      select: { id: true, customerId: true, templateKey: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    // ── 2. All visits (last 90 days) with amount ──
    const visits = await prisma.customerEvent.findMany({
      where: { restaurantId, eventType: "visit", occurredAt: { gte: sinceDate } },
      select: { id: true, customerId: true, amount: true, occurredAt: true },
      orderBy: { occurredAt: "asc" },
    });

    // ── 3. All reservations (last 90 days) with table info ──
    const reservations = await prisma.reservation.findMany({
      where: { restaurantId, date: { gte: sinceDate }, status: { notIn: ["cancelled", "no_show"] } },
      select: { customerId: true, date: true, tableId: true, table: { select: { tableNumber: true, label: true } } },
    });

    // ── 4. Attribution: match message → first visit within 7 days ──
    const visitsByCustomer = new Map<string, typeof visits>();
    for (const v of visits) {
      const arr = visitsByCustomer.get(v.customerId) || [];
      arr.push(v);
      visitsByCustomer.set(v.customerId, arr);
    }

    const resByCustomer = new Map<string, typeof reservations>();
    for (const r of reservations) {
      if (!r.customerId) continue;
      const arr = resByCustomer.get(r.customerId) || [];
      arr.push(r);
      resByCustomer.set(r.customerId, arr);
    }

    // Per-template aggregation
    const templateStats = new Map<string, { sent: number; returned: number; revenue: number }>();
    // Attributed returns for the "recent returns" list
    const attributedReturns: {
      customerId: string;
      templateKey: string;
      messageSentAt: Date;
      visitAt: Date;
      daysToReturn: number;
      revenue: number;
      tableNumber: number | null;
      tableLabel: string | null;
    }[] = [];

    const usedVisitIds = new Set<string>(); // prevent double-attribution

    for (const log of sentLogs) {
      const key = log.templateKey;
      if (!templateStats.has(key)) templateStats.set(key, { sent: 0, returned: 0, revenue: 0 });
      const stat = templateStats.get(key)!;
      stat.sent++;

      // Find first visit within attribution window
      const customerVisits = visitsByCustomer.get(log.customerId) || [];
      const windowEnd = new Date(log.createdAt.getTime() + ATTRIBUTION_WINDOW_DAYS * 86400000);

      for (const v of customerVisits) {
        if (v.occurredAt <= log.createdAt) continue; // visit must be AFTER message
        if (v.occurredAt > windowEnd) break; // outside window (visits sorted asc)
        if (usedVisitIds.has(v.id)) continue; // already attributed

        usedVisitIds.add(v.id);
        const revenue = v.amount ?? 0;
        stat.returned++;
        stat.revenue += revenue;

        // Find matching reservation for table info
        const customerRes = resByCustomer.get(log.customerId) || [];
        const matchingRes = customerRes.find(r => {
          const resDate = new Date(r.date).toISOString().slice(0, 10);
          const visitDate = v.occurredAt.toISOString().slice(0, 10);
          return resDate === visitDate;
        });

        attributedReturns.push({
          customerId: log.customerId,
          templateKey: key,
          messageSentAt: log.createdAt,
          visitAt: v.occurredAt,
          daysToReturn: Math.ceil((v.occurredAt.getTime() - log.createdAt.getTime()) / 86400000),
          revenue,
          tableNumber: matchingRes?.table?.tableNumber ?? null,
          tableLabel: matchingRes?.table?.label ?? null,
        });
        break; // only first visit per message
      }
    }

    // ── 5. Failed count (all time) ──
    const failedCount = await prisma.automationLog.count({
      where: { restaurantId, status: "failed" },
    });

    // ── 6. Tier distribution ──
    const tiers = await prisma.customer.groupBy({
      by: ["tier"],
      where: { restaurantId },
      _count: { id: true },
    });

    // ── 7. Customer info for attributed returns ──
    const customerIds = [...new Set(attributedReturns.map(a => a.customerId))];
    const customers = customerIds.length > 0
      ? await prisma.customer.findMany({
          where: { id: { in: customerIds } },
          select: { id: true, name: true, phone: true },
        })
      : [];
    const customerMap = new Map(customers.map(c => [c.id, c]));

    // ── 8. Build response ──
    const totalSent = sentLogs.length;
    const totalReturned = attributedReturns.length;
    const totalRevenue = attributedReturns.reduce((s, a) => s + a.revenue, 0);

    res.json({
      // Top KPIs
      kpis: {
        totalSent,
        totalReturned,
        returnRate: totalSent > 0 ? Math.round((totalReturned / totalSent) * 100) : 0,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        roiPerMessage: totalSent > 0 ? Math.round((totalRevenue / totalSent) * 100) / 100 : 0,
        failedCount,
      },
      // Per-template breakdown
      templateBreakdown: Array.from(templateStats.entries())
        .map(([key, s]) => ({
          templateKey: key,
          sent: s.sent,
          returned: s.returned,
          returnRate: s.sent > 0 ? Math.round((s.returned / s.sent) * 100) : 0,
          revenue: Math.round(s.revenue * 100) / 100,
          roiPerMessage: s.sent > 0 ? Math.round((s.revenue / s.sent) * 100) / 100 : 0,
        }))
        .sort((a, b) => b.revenue - a.revenue),
      // Recent attributed returns (last 20)
      recentReturns: attributedReturns
        .sort((a, b) => b.visitAt.getTime() - a.visitAt.getTime())
        .slice(0, 20)
        .map(a => {
          const c = customerMap.get(a.customerId);
          return {
            customerName: c?.name ?? "—",
            customerPhone: c?.phone ?? "",
            templateKey: a.templateKey,
            messageSentAt: a.messageSentAt,
            visitAt: a.visitAt,
            daysToReturn: a.daysToReturn,
            revenue: a.revenue,
            tableNumber: a.tableNumber,
            tableLabel: a.tableLabel,
          };
        }),
      // Tier distribution
      tierDistribution: tiers.map((t) => ({
        tier: t.tier,
        count: t._count.id,
      })),
    });
  } catch (err) {
    console.error('[Route] Error:', err);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export const campaignRouter = router;
