import { Router, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { restaurantRepository } from "../repositories/restaurant.repository";
import { param } from "../shared/params";
import { prisma } from "../database/client";
import { generateLayout } from "../services/layoutGenerator.service";
import { signJwt } from "../middleware/jwtAuth";

const router = Router();

router.get("/", async (_req: Request, res: Response) => {
  const restaurants = await restaurantRepository.findAll();
  res.json(restaurants);
});

router.get("/:id", async (req: Request, res: Response) => {
  const restaurant = await restaurantRepository.findById(param(req, "id"));
  if (!restaurant) return res.status(404).json({ error: "Not found" });
  res.json(restaurant);
});

router.post("/", async (req: Request, res: Response) => {
  const { name, phone, timezone, plan, email, ownerName } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const restaurant = await restaurantRepository.create({
    name,
    phone,
    timezone,
    ...(plan && { plan }),
  });

  // Create owner user + JWT if email provided (onboarding flow)
  let user = null;
  let token = null;
  if (email) {
    const normalizedEmail = email.toLowerCase().trim();
    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!existingUser) {
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: ownerName || name,
          restaurantId: restaurant.id,
        },
      });
      // Auto-login: generate JWT so user enters the dashboard immediately
      token = signJwt({
        userId: user.id,
        email: user.email,
        restaurantId: restaurant.id,
      });
    }
  }

  res.status(201).json({ ...restaurant, user, token });
});

router.put("/:id", async (req: Request, res: Response) => {
  const {
    name, phone, timezone, plan,
    tierFrequenteMinVisits, tierPrataMinVisits, tierOuroMinVisits,
    discountFrequente, discountPrata, discountOuro,
    streakTargetVisits, streakWindowDays, reactivationAfterDays,
    surpriseEveryMinVisits, surpriseEveryMaxVisits,
    avgMealDurationMinutes,
  } = req.body;
  const restaurant = await restaurantRepository.update(param(req, "id"), {
    name, phone, timezone,
    ...(plan && { plan }),
    ...(tierFrequenteMinVisits != null && { tierFrequenteMinVisits: Number(tierFrequenteMinVisits) }),
    ...(tierPrataMinVisits != null && { tierPrataMinVisits: Number(tierPrataMinVisits) }),
    ...(tierOuroMinVisits != null && { tierOuroMinVisits: Number(tierOuroMinVisits) }),
    ...(discountFrequente != null && { discountFrequente: Number(discountFrequente) }),
    ...(discountPrata != null && { discountPrata: Number(discountPrata) }),
    ...(discountOuro != null && { discountOuro: Number(discountOuro) }),
    ...(streakTargetVisits != null && { streakTargetVisits: Number(streakTargetVisits) }),
    ...(streakWindowDays != null && { streakWindowDays: Number(streakWindowDays) }),
    ...(reactivationAfterDays != null && { reactivationAfterDays: Number(reactivationAfterDays) }),
    ...(surpriseEveryMinVisits != null && { surpriseEveryMinVisits: Number(surpriseEveryMinVisits) }),
    ...(surpriseEveryMaxVisits != null && { surpriseEveryMaxVisits: Number(surpriseEveryMaxVisits) }),
    ...(avgMealDurationMinutes != null && { avgMealDurationMinutes: Number(avgMealDurationMinutes) }),
  });
  res.json(restaurant);
});

router.delete("/:id", async (req: Request, res: Response) => {
  await restaurantRepository.delete(param(req, "id"));
  res.sendStatus(204);
});

// ============================================================
// TABLES — CRUD per tavoli del ristorante
// ============================================================

router.get("/:restaurantId/tables", async (req: Request, res: Response) => {
  const tables = await prisma.restaurantTable.findMany({
    where: { restaurantId: param(req, "restaurantId") },
    orderBy: { tableNumber: "asc" },
  });
  res.json(tables);
});

router.post("/:restaurantId/tables", async (req: Request, res: Response) => {
  const restaurantId = param(req, "restaurantId");
  const { tables } = req.body;

  if (!Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ error: "tables array is required" });
  }

  await prisma.restaurantTable.deleteMany({ where: { restaurantId } });

  await prisma.restaurantTable.createMany({
    data: tables.map((t: any) => ({
      restaurantId,
      tableNumber: t.tableNumber,
      seats: t.seats,
      label: t.label ?? null,
      posX: t.posX ?? null,
      posY: t.posY ?? null,
      width: t.width ?? null,
      height: t.height ?? null,
    })),
  });

  const result = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    orderBy: { tableNumber: "asc" },
  });
  res.status(201).json(result);
});

// Update single table (position, size, seats, label, etc.)
router.patch("/:restaurantId/tables/:tableId", async (req: Request, res: Response) => {
  const { posX, posY, width, height, label, seats, tableNumber } = req.body;
  const updated = await prisma.restaurantTable.update({
    where: { id: param(req, "tableId") },
    data: {
      ...(posX != null && { posX: Number(posX) }),
      ...(posY != null && { posY: Number(posY) }),
      ...(width != null && { width: Number(width) }),
      ...(height != null && { height: Number(height) }),
      ...(label !== undefined && { label }),
      ...(seats != null && { seats: Number(seats) }),
      ...(tableNumber != null && { tableNumber: Number(tableNumber) }),
    },
  });
  res.json(updated);
});

// Add single table — finds first available number (fills gaps)
router.post("/:restaurantId/tables/single", async (req: Request, res: Response) => {
  const restaurantId = param(req, "restaurantId");
  const { seats, label, posX, posY, width, height } = req.body;
  // Find first available table number (fills gaps: if 1,2,4 exist → assigns 3)
  const existing = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    select: { tableNumber: true },
    orderBy: { tableNumber: "asc" },
  });
  const usedNumbers = new Set(existing.map((t) => t.tableNumber));
  let nextNumber = 1;
  while (usedNumbers.has(nextNumber)) nextNumber++;

  const table = await prisma.restaurantTable.create({
    data: {
      restaurantId,
      tableNumber: nextNumber,
      seats: Number(seats) || 4,
      label: label || null,
      posX: Number(posX) ?? 50,
      posY: Number(posY) ?? 50,
      width: Number(width) || 10,
      height: Number(height) || 10,
    },
  });
  res.status(201).json(table);
});

// Delete ALL tables (reset)
router.delete("/:restaurantId/tables", async (req: Request, res: Response) => {
  const restaurantId = param(req, "restaurantId");
  await prisma.restaurantTable.deleteMany({ where: { restaurantId } });
  await prisma.restaurant.update({ where: { id: restaurantId }, data: { roomLayout: Prisma.DbNull } });
  res.sendStatus(204);
});

router.delete("/:restaurantId/tables/:tableId", async (req: Request, res: Response) => {
  await prisma.restaurantTable.delete({
    where: { id: param(req, "tableId") },
  });
  res.sendStatus(204);
});

// AI-generate restaurant layout from description (max 5/month)
const AI_GENERATE_LIMIT = 5;
const aiGenerateUsage = new Map<string, { count: number; month: string }>();

router.get("/:restaurantId/tables/generate-usage", async (req: Request, res: Response) => {
  const restaurantId = param(req, "restaurantId");
  const currentMonth = new Date().toISOString().slice(0, 7); // "2026-03"
  const usage = aiGenerateUsage.get(restaurantId);
  const used = (usage && usage.month === currentMonth) ? usage.count : 0;
  res.json({ used, limit: AI_GENERATE_LIMIT, remaining: AI_GENERATE_LIMIT - used });
});

router.post("/:restaurantId/tables/generate", async (req: Request, res: Response) => {
  const restaurantId = param(req, "restaurantId");
  const { description } = req.body;

  if (!description) {
    return res.status(400).json({ error: "description is required" });
  }

  // Rate limit: 5 per month per restaurant
  const currentMonth = new Date().toISOString().slice(0, 7);
  const usage = aiGenerateUsage.get(restaurantId);
  const currentCount = (usage && usage.month === currentMonth) ? usage.count : 0;
  if (currentCount >= AI_GENERATE_LIMIT) {
    return res.status(429).json({
      error: `Limite de ${AI_GENERATE_LIMIT} geracoes por mes atingido. Tente novamente no proximo mes.`,
      used: currentCount,
      limit: AI_GENERATE_LIMIT,
    });
  }

  try {
    const layout = await generateLayout(description);

    // Increment usage
    aiGenerateUsage.set(restaurantId, { count: currentCount + 1, month: currentMonth });

    // Save room layout metadata on restaurant
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { roomLayout: { roomShape: layout.roomShape, roomDescription: layout.roomDescription } },
    });

    // Replace tables
    await prisma.restaurantTable.deleteMany({ where: { restaurantId } });
    await prisma.restaurantTable.createMany({
      data: layout.tables.map((t) => ({
        restaurantId,
        tableNumber: t.tableNumber,
        seats: t.seats,
        label: t.label ?? null,
        posX: t.posX,
        posY: t.posY,
        width: t.width,
        height: t.height,
      })),
    });

    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId },
      orderBy: { tableNumber: "asc" },
    });

    res.json({ layout: { roomShape: layout.roomShape, roomDescription: layout.roomDescription }, tables });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================
// HOURS — Orari di apertura del ristorante
// ============================================================

router.get("/:restaurantId/hours", async (req: Request, res: Response) => {
  const hours = await prisma.restaurantHours.findMany({
    where: { restaurantId: param(req, "restaurantId") },
    orderBy: { dayOfWeek: "asc" },
  });
  res.json(hours);
});

router.post("/:restaurantId/hours", async (req: Request, res: Response) => {
  const restaurantId = param(req, "restaurantId");
  const { hours } = req.body; // [{ dayOfWeek: 0, openTime: "11:30", closeTime: "23:00", isClosed: false }, ...]

  if (!Array.isArray(hours)) {
    return res.status(400).json({ error: "hours array is required" });
  }

  // Delete existing and recreate
  await prisma.restaurantHours.deleteMany({ where: { restaurantId } });

  const created = await prisma.restaurantHours.createMany({
    data: hours.map((h: { dayOfWeek: number; openTime: string; closeTime: string; isClosed?: boolean }) => ({
      restaurantId,
      dayOfWeek: h.dayOfWeek,
      openTime: h.openTime,
      closeTime: h.closeTime,
      isClosed: h.isClosed ?? false,
    })),
  });

  const result = await prisma.restaurantHours.findMany({
    where: { restaurantId },
    orderBy: { dayOfWeek: "asc" },
  });
  res.status(201).json(result);
});

export const restaurantRouter = router;
