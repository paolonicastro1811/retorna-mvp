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
    const result = await messagingService.queueMessages(param(req, "campaignId"));
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

    // Summary by templateKey + status
    const logs = await prisma.automationLog.groupBy({
      by: ["templateKey", "status"],
      where: { restaurantId },
      _count: { id: true },
    });

    // Recent logs (last 50)
    const recent = await prisma.automationLog.findMany({
      where: { restaurantId },
      include: { customer: { select: { name: true, phone: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Daily counts (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const daily = await prisma.automationLog.groupBy({
      by: ["templateKey"],
      where: { restaurantId, createdAt: { gte: thirtyDaysAgo }, status: "sent" },
      _count: { id: true },
    });

    // Tier distribution
    const tiers = await prisma.customer.groupBy({
      by: ["tier"],
      where: { restaurantId },
      _count: { id: true },
    });

    res.json({
      summary: logs.map((l) => ({
        templateKey: l.templateKey,
        status: l.status,
        count: l._count.id,
      })),
      recent: recent.map((r) => ({
        id: r.id,
        templateKey: r.templateKey,
        status: r.status,
        customerName: r.customer?.name ?? "—",
        customerPhone: r.customer?.phone ?? "",
        createdAt: r.createdAt,
      })),
      last30Days: daily.map((d) => ({
        templateKey: d.templateKey,
        count: d._count.id,
      })),
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
