import { Router, Request, Response } from "express";
import { campaignService } from "../services/campaign.service";
import { messagingService } from "../services/messaging.service";
import { messageTemplateRepository } from "../repositories/messageTemplate.repository";
import { outboundMessageRepository } from "../repositories/outboundMessage.repository";
import { param } from "../shared/params";
import { prisma } from "../database/client";

const router = Router();

// --- Templates ---

router.get("/:restaurantId/templates", async (req: Request, res: Response) => {
  const templates = await messageTemplateRepository.findByRestaurant(
    param(req, "restaurantId")
  );
  res.json(templates);
});

router.post("/:restaurantId/templates", async (req: Request, res: Response) => {
  const { name, body } = req.body;
  if (!name || !body)
    return res.status(400).json({ error: "name and body are required" });
  const template = await messageTemplateRepository.create({
    restaurantId: param(req, "restaurantId"),
    name,
    body,
  });
  res.status(201).json(template);
});

router.patch("/:restaurantId/templates/:templateId", async (req: Request, res: Response) => {
  const { isActive } = req.body;
  if (typeof isActive !== "boolean")
    return res.status(400).json({ error: "isActive (boolean) is required" });
  const updated = await messageTemplateRepository.update(
    param(req, "templateId"),
    { isActive }
  );
  res.json(updated);
});

// --- Campaigns ---

router.get("/:restaurantId/campaigns", async (req: Request, res: Response) => {
  const campaigns = await campaignService.findByRestaurant(
    param(req, "restaurantId")
  );
  res.json(campaigns);
});

router.post("/:restaurantId/campaigns", async (req: Request, res: Response) => {
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
});

router.get("/campaigns/:campaignId", async (req: Request, res: Response) => {
  const campaign = await campaignService.findById(param(req, "campaignId"));
  if (!campaign) return res.status(404).json({ error: "Not found" });
  res.json(campaign);
});

router.post("/campaigns/:campaignId/build", async (req: Request, res: Response) => {
  try {
    const result = await campaignService.buildAudience(param(req, "campaignId"));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/campaigns/:campaignId/queue", async (req: Request, res: Response) => {
  try {
    const result = await messagingService.queueMessages(param(req, "campaignId"));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.post("/campaigns/:campaignId/dispatch", async (req: Request, res: Response) => {
  try {
    const result = await messagingService.dispatchCampaign(param(req, "campaignId"));
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

router.get("/campaigns/:campaignId/messages", async (req: Request, res: Response) => {
  const messages = await outboundMessageRepository.findByCampaign(
    param(req, "campaignId")
  );
  res.json(messages);
});

router.get("/campaigns/:campaignId/stats", async (req: Request, res: Response) => {
  const stats = await outboundMessageRepository.countByCampaignAndStatus(
    param(req, "campaignId")
  );
  res.json(stats);
});

// --- Automation Logs (loyalty system) ---

router.get("/:restaurantId/automation-stats", async (req: Request, res: Response) => {
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
});

export const campaignRouter = router;
