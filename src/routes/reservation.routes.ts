import { Router, Request, Response } from "express";
import { prisma } from "../database/client";
import { param } from "../shared/params";

const router = Router();

const VALID_STATUSES = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"];
const VALID_SOURCES = ["manual", "whatsapp_bot", "phone"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function addMinutes(time: string, mins: number): string {
  const total = timeToMinutes(time) + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function isValidTimezone(tz: string): boolean {
  try { Intl.DateTimeFormat(undefined, { timeZone: tz }); return true; } catch { return false; }
}

function safeTz(tz: string | null | undefined): string {
  return tz && isValidTimezone(tz) ? tz : "America/Sao_Paulo";
}

/**
 * Get the day-of-week for a date string in a given IANA timezone.
 * Uses UTC noon (not midnight!) so the local date is the same calendar day
 * in all Brazilian timezones (UTC-2 to UTC-5). Returns 0=Sunday.
 */
function getDayOfWeekInTimezone(dateStr: string, timezone: string): number {
  const tz = safeTz(timezone);
  const d = new Date(dateStr + "T12:00:00Z"); // UTC noon — safe for all BR timezones
  const parts = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: tz }).formatToParts(d);
  const dayName = parts.find(p => p.type === "weekday")?.value ?? "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[dayName] ?? 0;
}

// GET /:restaurantId/reservations?date=2026-03-30
router.get("/:restaurantId/reservations", async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const dateStr = req.query.date as string | undefined;

    // ── Auto-complete stale "seated" reservations ──
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { avgMealDurationMinutes: true },
    });
    const durationMs = (restaurant?.avgMealDurationMinutes || 90) * 60 * 1000;
    const cutoff = new Date(Date.now() - durationMs);

    await prisma.reservation.updateMany({
      where: {
        restaurantId,
        status: "seated",
        seatedAt: { not: null, lte: cutoff },
      },
      data: { status: "completed" },
    });

    const where: any = { restaurantId };
    if (dateStr) {
      // Parse as UTC midnight — @db.Date fields are stored date-only (no timezone)
      const d = new Date(dateStr + "T00:00:00Z");
      if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid date" });
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      where.date = { gte: d, lt: next };
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: { table: true, customer: { select: { name: true, phone: true } } },
      orderBy: [{ date: "asc" }, { time: "asc" }],
    });
    res.json(reservations);
  } catch (e: any) {
    console.error("[Reservations GET]", e.message);
    res.status(500).json({ error: "Internal error" });
  }
});

// POST /:restaurantId/reservations
router.post("/:restaurantId/reservations", async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const { customerName, phone, tableId, date, time, endTime, partySize, status, notes, source } = req.body;

    if (!phone || !date || !time) {
      return res.status(400).json({ error: "phone, date, time are required" });
    }
    if (!TIME_RE.test(time)) return res.status(400).json({ error: "Invalid time format (HH:MM)" });
    if (endTime && !TIME_RE.test(endTime)) return res.status(400).json({ error: "Invalid endTime format (HH:MM)" });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}` });
    if (source && !VALID_SOURCES.includes(source)) return res.status(400).json({ error: `Invalid source. Must be: ${VALID_SOURCES.join(", ")}` });

    // FIX 10: Validate endTime is after start time
    if (endTime && timeToMinutes(endTime) <= timeToMinutes(time)) {
      return res.status(400).json({ error: "endTime must be after start time" });
    }

    // Parse as UTC midnight — @db.Date fields are stored date-only
    const parsedDate = new Date(date + "T00:00:00Z");
    if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: "Invalid date" });

    // Fetch restaurant for timezone and avgMealDurationMinutes
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true, avgMealDurationMinutes: true },
    });
    if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

    const mealDuration = restaurant.avgMealDurationMinutes || 90;

    // FIX 1: Validate operating hours
    const dayOfWeek = getDayOfWeekInTimezone(date, restaurant.timezone);
    const hours = await prisma.restaurantHours.findUnique({
      where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek } },
    });

    if (!hours) {
      return res.status(400).json({ error: "Horários do restaurante não configurados para este dia" });
    }
    if (hours.isClosed) {
      return res.status(400).json({ error: "Restaurante fechado neste dia" });
    }
    const bookMin = timeToMinutes(time);
    const openMin = timeToMinutes(hours.openTime);
    const closeMin = timeToMinutes(hours.closeTime);
    if (bookMin < openMin || bookMin >= closeMin) {
      return res.status(400).json({ error: `Horário fora do funcionamento (${hours.openTime}-${hours.closeTime})` });
    }

    const safePartySize = Math.max(1, Math.min(50, parseInt(partySize) || 2));

    // Validate tableId belongs to this restaurant
    if (tableId) {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: tableId, restaurantId, isActive: true },
      });
      if (!table) return res.status(400).json({ error: "Table not found or inactive" });

      // FIX 2: Validate table seats >= partySize
      if (table.seats < safePartySize) {
        return res.status(400).json({ error: `Mesa comporta apenas ${table.seats} pessoas` });
      }

      // FIX 2: Check for table conflicts (overlapping reservations)
      const effectiveEndTime = endTime || addMinutes(time, mealDuration);
      const newStart = timeToMinutes(time);
      const newEnd = timeToMinutes(effectiveEndTime);

      const nextDay = new Date(parsedDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const existingOnTable = await prisma.reservation.findMany({
        where: {
          restaurantId,
          tableId,
          date: { gte: parsedDate, lt: nextDay },
          status: { notIn: ["cancelled", "no_show", "completed"] },
        },
      });

      for (const r of existingOnTable) {
        const rStart = timeToMinutes(r.time);
        const rEnd = r.endTime ? timeToMinutes(r.endTime) : rStart + mealDuration;
        if (newStart < rEnd && newEnd > rStart) {
          return res.status(409).json({ error: "Mesa já reservada neste horário" });
        }
      }
    }

    const reservation = await prisma.reservation.create({
      data: {
        restaurantId,
        customerName: customerName || null,
        phone,
        tableId: tableId || null,
        date: parsedDate,
        time,
        endTime: endTime || null,
        partySize: safePartySize,
        status: status || "pending",
        notes: notes || null,
        source: source || "manual",
      },
      include: { table: true },
    });
    res.status(201).json(reservation);
  } catch (e: any) {
    console.error("[Reservations POST]", e.message);
    res.status(500).json({ error: "Internal error" });
  }
});

// PATCH /:restaurantId/reservations/:reservationId
router.patch("/:restaurantId/reservations/:reservationId", async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const reservationId = param(req, "reservationId");
    const { status, tableId, time, endTime, partySize, notes, customerName, date } = req.body;

    // Validate status
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Must be: ${VALID_STATUSES.join(", ")}` });
    }
    if (time !== undefined && !TIME_RE.test(time)) return res.status(400).json({ error: "Invalid time format (HH:MM)" });
    if (endTime !== undefined && endTime && !TIME_RE.test(endTime)) return res.status(400).json({ error: "Invalid endTime format (HH:MM)" });

    // Validate tableId belongs to this restaurant
    if (tableId) {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: tableId, restaurantId, isActive: true },
      });
      if (!table) return res.status(400).json({ error: "Table not found or inactive" });
    }

    const data: any = {};
    if (status !== undefined) {
      data.status = status;
      // Record timestamp when customer sits down
      if (status === "seated") { data.seatedAt = new Date(); }
      else if (status === "pending" || status === "cancelled") { data.seatedAt = null; }
      // Don't touch seatedAt if status is not provided
    }
    if (tableId !== undefined) data.tableId = tableId || null;
    if (time !== undefined) data.time = time;
    if (endTime !== undefined) data.endTime = endTime || null;
    if (partySize !== undefined) data.partySize = Math.max(1, Math.min(50, parseInt(partySize) || 2));
    if (notes !== undefined) data.notes = notes;
    if (customerName !== undefined) data.customerName = customerName;
    if (date !== undefined) {
      const parsedDate = new Date(date + "T00:00:00Z");
      if (isNaN(parsedDate.getTime())) return res.status(400).json({ error: "Invalid date" });
      data.date = parsedDate;
    }

    // Ownership check: reservation must belong to this restaurant
    const reservation = await prisma.reservation.updateMany({
      where: { id: reservationId, restaurantId },
      data,
    });

    if (reservation.count === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }

    // Return updated reservation
    const updated = await prisma.reservation.findUnique({
      where: { id: reservationId },
      include: { table: true },
    });
    res.json(updated);
  } catch (e: any) {
    console.error("[Reservations PATCH]", e.message);
    res.status(500).json({ error: "Internal error" });
  }
});

// DELETE /:restaurantId/reservations/:reservationId
router.delete("/:restaurantId/reservations/:reservationId", async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const reservationId = param(req, "reservationId");

    // Ownership check
    const deleted = await prisma.reservation.deleteMany({
      where: { id: reservationId, restaurantId },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: "Reservation not found" });
    }
    res.sendStatus(204);
  } catch (e: any) {
    console.error("[Reservations DELETE]", e.message);
    res.status(500).json({ error: "Internal error" });
  }
});

// GET /:restaurantId/reservations/availability?date=2026-03-30&partySize=4
router.get("/:restaurantId/reservations/availability", async (req: Request, res: Response) => {
  try {
    const restaurantId = param(req, "restaurantId");
    const dateStr = req.query.date as string;
    const partySize = Math.max(1, parseInt(req.query.partySize as string) || 2);

    if (!dateStr) return res.status(400).json({ error: "date is required" });

    // Parse as UTC midnight — @db.Date fields are stored date-only
    const d = new Date(dateStr + "T00:00:00Z");
    if (isNaN(d.getTime())) return res.status(400).json({ error: "Invalid date" });

    // Fetch restaurant for timezone and meal duration
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true, avgMealDurationMinutes: true },
    });
    const mealDuration = restaurant?.avgMealDurationMinutes || 90;

    // Use restaurant timezone for day-of-week calculation
    const dayOfWeek = getDayOfWeekInTimezone(dateStr, restaurant?.timezone ?? "America/Sao_Paulo");

    const hours = await prisma.restaurantHours.findUnique({
      where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek } },
    });

    if (!hours || hours.isClosed) {
      return res.json({ closed: true, slots: [] });
    }

    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId, isActive: true, seats: { gte: partySize } },
      orderBy: { seats: "asc" },
    });

    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const existing = await prisma.reservation.findMany({
      where: {
        restaurantId,
        date: { gte: d, lt: next },
        status: { notIn: ["cancelled", "no_show", "completed"] },
      },
    });

    const slots: { time: string; available: number; total: number }[] = [];
    const openMin = timeToMinutes(hours.openTime);
    const closeMin = timeToMinutes(hours.closeTime);

    for (let min = openMin; min < closeMin; min += 30) {
      const timeStr = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
      const slotStart = min;
      const slotEnd = min + mealDuration; // full meal duration overlap check

      // Count occupied tables (assigned) + unassigned reservations overlapping this slot
      const overlapping = existing.filter((r) => {
        const rStart = timeToMinutes(r.time);
        const rEnd = r.endTime ? timeToMinutes(r.endTime) : rStart + mealDuration;
        return rStart < slotEnd && rEnd > slotStart;
      });

      const occupiedTableIds = overlapping.filter(r => r.tableId).map(r => r.tableId);
      const unassignedCount = overlapping.filter(r => !r.tableId).length;
      const availableFromTables = tables.filter(t => !occupiedTableIds.includes(t.id)).length;
      const available = Math.max(0, availableFromTables - unassignedCount);

      slots.push({ time: timeStr, available, total: tables.length });
    }

    res.json({ closed: false, slots });
  } catch (e: any) {
    console.error("[Reservations AVAILABILITY]", e.message);
    res.status(500).json({ error: "Internal error" });
  }
});

export const reservationRouter = router;
