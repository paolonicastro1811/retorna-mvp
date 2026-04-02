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
  const todayStartUtc = new Date(dateParts + "T00:00:00Z");
  const tomorrowStartUtc = new Date(todayStartUtc.getTime() + 24 * 60 * 60 * 1000);

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

    // Today's revenue from visit events
    prisma.customerEvent.aggregate({
      where: {
        restaurantId,
        eventType: "visit",
        occurredAt: { gte: todayStartUtc, lt: tomorrowStartUtc },
      },
      _sum: { amount: true },
      _count: true,
    }),

    // Distinct customers served today
    prisma.customerEvent.findMany({
      where: {
        restaurantId,
        eventType: "visit",
        occurredAt: { gte: todayStartUtc, lt: tomorrowStartUtc },
      },
      select: { customerId: true },
      distinct: ["customerId"],
    }),

    // Today's reservations with table info
    prisma.reservation.findMany({
      where: {
        restaurantId,
        date: {
          gte: todayStartUtc,
          lt: tomorrowStartUtc,
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
