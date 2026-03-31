import { Router, Request, Response } from "express";
import { restaurantRepository } from "../repositories/restaurant.repository";
import { param } from "../shared/params";
import { prisma } from "../database/client";

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
  const { name, phone, timezone, plan } = req.body;
  if (!name) return res.status(400).json({ error: "name is required" });
  const restaurant = await restaurantRepository.create({
    name,
    phone,
    timezone,
    ...(plan && { plan }),
  });
  res.status(201).json(restaurant);
});

router.put("/:id", async (req: Request, res: Response) => {
  const {
    name, phone, timezone, plan,
    tierFrequenteMinVisits, tierPrataMinVisits, tierOuroMinVisits,
    discountFrequente, discountPrata, discountOuro,
    streakTargetVisits, streakWindowDays, reactivationAfterDays,
    surpriseEveryMinVisits, surpriseEveryMaxVisits,
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
  const { tables } = req.body; // [{ tableNumber: 1, seats: 4 }, ...]

  if (!Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ error: "tables array is required" });
  }

  // Delete existing and recreate (simpler for bulk setup)
  await prisma.restaurantTable.deleteMany({ where: { restaurantId } });

  const created = await prisma.restaurantTable.createMany({
    data: tables.map((t: { tableNumber: number; seats: number }) => ({
      restaurantId,
      tableNumber: t.tableNumber,
      seats: t.seats,
    })),
  });

  const result = await prisma.restaurantTable.findMany({
    where: { restaurantId },
    orderBy: { tableNumber: "asc" },
  });
  res.status(201).json(result);
});

router.delete("/:restaurantId/tables/:tableId", async (req: Request, res: Response) => {
  await prisma.restaurantTable.delete({
    where: { id: param(req, "tableId") },
  });
  res.sendStatus(204);
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
