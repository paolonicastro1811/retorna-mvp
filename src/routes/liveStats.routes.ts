import { Router, Request, Response } from "express";
import { prisma } from "../database/client";
import { param } from "../shared/params";

const router = Router();

/**
 * GET /restaurants/:restaurantId/live-stats
 * Returns real-time dashboard data: tables, revenue, reservations
 */
router.get("/:restaurantId/live-stats", async (req: Request, res: Response) => {
  const restaurantId = param(req, "restaurantId");

  // Get restaurant timezone (default Sao Paulo)
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { timezone: true },
  });
  const tz = restaurant?.timezone || "America/Sao_Paulo";

  // Calculate "today" boundaries in restaurant timezone using Intl
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // returns "YYYY-MM-DD"

  // For @db.Date fields (reservation.date): UTC midnight is correct
  const todayDateUtc = new Date(dateParts + "T00:00:00Z");
  const tomorrowDateUtc = new Date(todayDateUtc.getTime() + 86400000);

  // For full timestamps (customerEvent.occurredAt): need restaurant-local midnight as UTC
  // Compute TZ offset: format noon UTC in restaurant TZ → difference = offset
  const noonUtc = new Date(dateParts + "T12:00:00Z");
  const localHourAtNoon = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(noonUtc)
  );
  const tzOffsetMs = (localHourAtNoon - 12) * 3600000; // e.g., -3h for São Paulo
  const todayStartLocal = new Date(todayDateUtc.getTime() - tzOffsetMs);
  const tomorrowStartLocal = new Date(todayStartLocal.getTime() + 86400000);

  // Run all queries in parallel
  const [
    tablesTotal,
    seatedReservations,
    revenueAgg,
    todayVisitEvents,
    todayReservations,
  ] = await Promise.all([
    // Total active tables
    prisma.restaurantTable.count({
      where: { restaurantId, isActive: true },
    }),

    // Currently seated reservations (distinct tables)
    prisma.reservation.findMany({
      where: {
        restaurantId,
        status: "seated",
      },
      select: { tableId: true },
      distinct: ["tableId"],
    }),

    // Today's revenue from visit events (uses restaurant-local "today")
    prisma.customerEvent.aggregate({
      where: {
        restaurantId,
        eventType: "visit",
        occurredAt: { gte: todayStartLocal, lt: tomorrowStartLocal },
      },
      _sum: { amount: true },
      _count: true,
    }),

    // Distinct customers served today (uses restaurant-local "today")
    prisma.customerEvent.findMany({
      where: {
        restaurantId,
        eventType: "visit",
        occurredAt: { gte: todayStartLocal, lt: tomorrowStartLocal },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    }),

    // Today's reservations with table info (@db.Date → UTC midnight comparison)
    prisma.reservation.findMany({
      where: {
        restaurantId,
        date: {
          gte: todayDateUtc,
          lt: tomorrowDateUtc,
        },
        status: { notIn: ["cancelled"] },
      },
      include: {
        table: { select: { tableNumber: true, label: true, seats: true } },
      },
      orderBy: { time: "asc" },
    }),
  ]);

  const tablesOccupied = seatedReservations.filter((r) => r.tableId).length;
  const revenueToday = revenueAgg._sum.amount ?? 0;
  const customersServedToday = todayVisitEvents.length;
  const avgTicketToday =
    customersServedToday > 0
      ? Math.round((revenueToday / customersServedToday) * 100) / 100
      : 0;

  res.json({
    tablesOccupied,
    tablesTotal,
    revenueToday,
    customersServedToday,
    avgTicketToday,
    reservations: todayReservations,
  });
});

export const liveStatsRouter = router;
