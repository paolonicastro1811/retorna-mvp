// ============================================================
// BookingService — Programmatic reservation management for Plan B bot
// Used by the webhook to execute AI-decided booking actions.
// ============================================================

import { prisma } from "../database/client";
import { BookingState } from "./intent/intent.types";

const DAY_NAMES_PT = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
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

export interface AvailabilitySlot {
  time: string;
  available: number;
  total: number;
}

export interface AvailabilityResult {
  closed: boolean;
  date: string;
  dayName: string;
  openTime?: string;
  closeTime?: string;
  slots: AvailabilitySlot[];
}

export interface CreateReservationResult {
  success: boolean;
  reservationId?: string;
  error?: string;
  details?: {
    date: string;
    time: string;
    partySize: number;
    customerName: string;
  };
}

export interface CancelReservationResult {
  success: boolean;
  cancelled: number;
  error?: string;
}

export const bookingService = {
  /**
   * getRestaurantContext — Build context string for AI prompt.
   * Includes restaurant name, today's date, hours for the week.
   */
  async getRestaurantContext(restaurantId: string): Promise<string> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { hours: { orderBy: { dayOfWeek: "asc" } } },
    });
    if (!restaurant) return "";

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const dayOfWeek = now.getDay(); // 0=Sunday

    const hoursLines = restaurant.hours.map((h) => {
      const day = DAY_NAMES_PT[h.dayOfWeek];
      if (h.isClosed) return `- ${day}: FECHADO`;
      return `- ${day}: ${h.openTime} às ${h.closeTime}`;
    });

    return [
      `Restaurante: ${restaurant.name}`,
      `Data de hoje: ${today} (${DAY_NAMES_PT[dayOfWeek]})`,
      `Timezone: ${restaurant.timezone}`,
      ``,
      `Horários de funcionamento:`,
      ...hoursLines,
    ].join("\n");
  },

  /**
   * checkAvailability — Check available slots for a date.
   */
  async checkAvailability(
    restaurantId: string,
    dateStr: string,
    partySize: number = 2
  ): Promise<AvailabilityResult> {
    // Fetch restaurant for timezone and meal duration
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true, avgMealDurationMinutes: true },
    });
    const timezone = restaurant?.timezone ?? "America/Sao_Paulo";
    const mealDuration = restaurant?.avgMealDurationMinutes || 90;

    // Parse as UTC midnight — @db.Date fields are stored date-only
    const date = new Date(dateStr + "T00:00:00Z");
    const dayOfWeek = getDayOfWeekInTimezone(dateStr, timezone);
    const dayName = DAY_NAMES_PT[dayOfWeek];

    const hours = await prisma.restaurantHours.findUnique({
      where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek } },
    });

    if (!hours || hours.isClosed) {
      return { closed: true, date: dateStr, dayName, slots: [] };
    }

    // Get tables
    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId, isActive: true, seats: { gte: partySize } },
    });
    const totalTables = tables.length;

    // Get existing reservations for that date
    const nextDay = new Date(date.getTime() + 86400000);
    const reservations = await prisma.reservation.findMany({
      where: {
        restaurantId,
        date: { gte: date, lt: nextDay },
        status: { notIn: ["cancelled", "completed", "no_show"] },
      },
    });

    // Generate 30-min slots with full duration overlap check
    const slots: AvailabilitySlot[] = [];
    const openMin = timeToMinutes(hours.openTime);
    const closeMin = timeToMinutes(hours.closeTime);

    for (let min = openMin; min < closeMin; min += 30) {
      const slotTime = `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
      const slotStart = min;
      const slotEnd = min + mealDuration;

      // Count reservations overlapping this slot (full duration)
      let occupied = 0;
      for (const r of reservations) {
        const rStart = timeToMinutes(r.time);
        const rEnd = r.endTime ? timeToMinutes(r.endTime) : rStart + mealDuration;

        if (rStart < slotEnd && rEnd > slotStart) {
          occupied++;
        }
      }

      const available = Math.max(0, totalTables - occupied);
      slots.push({ time: slotTime, available, total: totalTables });
    }

    return {
      closed: false,
      date: dateStr,
      dayName,
      openTime: hours.openTime,
      closeTime: hours.closeTime,
      slots,
    };
  },

  /**
   * formatAvailabilityForAI — Format availability data as a string for the AI prompt.
   */
  formatAvailabilityForAI(availability: AvailabilityResult): string {
    if (availability.closed) {
      return `O restaurante está FECHADO em ${availability.date} (${availability.dayName}).`;
    }

    const availableSlots = availability.slots.filter((s) => s.available > 0);
    if (availableSlots.length === 0) {
      return `Nenhuma mesa disponível em ${availability.date} (${availability.dayName}). O restaurante está lotado.`;
    }

    const slotLines = availableSlots.map(
      (s) => `  ${s.time} — ${s.available}/${s.total} mesas livres`
    );

    return [
      `Disponibilidade para ${availability.date} (${availability.dayName}):`,
      `Horario: ${availability.openTime} às ${availability.closeTime}`,
      `Slots disponíveis:`,
      ...slotLines,
    ].join("\n");
  },

  /**
   * createReservation — Create a reservation from bot-collected data.
   */
  async createReservation(
    restaurantId: string,
    customerId: string,
    phone: string,
    booking: BookingState
  ): Promise<CreateReservationResult> {
    if (!booking.date || !booking.time || !booking.partySize) {
      return { success: false, error: "Dados incompletos (data, hora ou número de pessoas faltando)" };
    }

    // Validate date — parse as UTC midnight (@db.Date)
    const date = new Date(booking.date + "T00:00:00Z");
    if (isNaN(date.getTime())) {
      return { success: false, error: "Data inválida" };
    }

    // Validate time
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(booking.time)) {
      return { success: false, error: "Horário inválido" };
    }

    // Fetch restaurant for timezone and meal duration
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true, avgMealDurationMinutes: true },
    });
    const timezone = restaurant?.timezone ?? "America/Sao_Paulo";
    const mealDuration = restaurant?.avgMealDurationMinutes || 90;

    // Check restaurant is open
    const dayOfWeek = getDayOfWeekInTimezone(booking.date, timezone);
    const hours = await prisma.restaurantHours.findUnique({
      where: { restaurantId_dayOfWeek: { restaurantId, dayOfWeek } },
    });

    if (!hours || hours.isClosed) {
      return { success: false, error: `Restaurante fechado em ${DAY_NAMES_PT[dayOfWeek]}` };
    }

    // Check time is within hours
    const [bH, bM] = booking.time.split(":").map(Number);
    const bookMin = bH * 60 + bM;
    const [oH, oM] = hours.openTime.split(":").map(Number);
    const [cH, cM] = hours.closeTime.split(":").map(Number);
    if (bookMin < oH * 60 + oM || bookMin >= cH * 60 + cM) {
      return {
        success: false,
        error: `Horário fora do funcionamento (${hours.openTime} às ${hours.closeTime})`,
      };
    }

    // Check availability
    const availability = await this.checkAvailability(restaurantId, booking.date, booking.partySize);
    const slot = availability.slots.find((s) => s.time === booking.time);
    if (!slot || slot.available <= 0) {
      // Find nearest available slot
      const nearest = availability.slots.find((s) => s.available > 0 && s.time >= booking.time!);
      const suggestion = nearest ? ` Proximo horario disponivel: ${nearest.time}` : "";
      return { success: false, error: `Sem disponibilidade para ${booking.time}.${suggestion}` };
    }

    // Auto-assign table
    const tables = await prisma.restaurantTable.findMany({
      where: { restaurantId, isActive: true, seats: { gte: booking.partySize } },
      orderBy: { seats: "asc" }, // smallest suitable table
    });

    // Find a table not already booked at this time (full duration overlap check)
    const newStart = timeToMinutes(booking.time);
    const newEnd = newStart + mealDuration;
    let assignedTableId: string | null = null;

    const nextDay = new Date(date.getTime() + 86400000);

    for (const table of tables) {
      const existingOnTable = await prisma.reservation.findMany({
        where: {
          restaurantId,
          tableId: table.id,
          date: { gte: date, lt: nextDay },
          status: { notIn: ["cancelled", "completed", "no_show"] },
        },
      });
      const hasConflict = existingOnTable.some((r) => {
        const rStart = timeToMinutes(r.time);
        const rEnd = r.endTime ? timeToMinutes(r.endTime) : rStart + mealDuration;
        return newStart < rEnd && newEnd > rStart;
      });
      if (!hasConflict) {
        assignedTableId = table.id;
        break;
      }
    }

    // Create reservation
    const partySize = Math.max(1, Math.min(50, booking.partySize));
    const customerName = booking.customerName ?? null;

    const reservation = await prisma.reservation.create({
      data: {
        restaurantId,
        customerId,
        customerName,
        phone,
        date,
        time: booking.time,
        partySize,
        status: "pending", // Bot-created = pending until restaurant confirms
        source: "whatsapp_bot",
        tableId: assignedTableId,
        notes: "Reserva criada automaticamente via WhatsApp bot",
      },
    });

    // Update customer name if provided and not already set
    if (customerName) {
      await prisma.customer.update({
        where: { id: customerId },
        data: { name: customerName },
      }).catch(() => {}); // ignore if fails
    }

    return {
      success: true,
      reservationId: reservation.id,
      details: {
        date: booking.date,
        time: booking.time,
        partySize,
        customerName: customerName ?? "Cliente",
      },
    };
  },

  /**
   * cancelReservation — Cancel upcoming reservations for a customer.
   * Cancels the next pending/confirmed reservation.
   */
  async cancelReservation(
    restaurantId: string,
    customerId: string
  ): Promise<CancelReservationResult> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    // Find upcoming reservations
    const upcoming = await prisma.reservation.findMany({
      where: {
        restaurantId,
        customerId,
        date: { gte: today },
        status: { in: ["pending", "confirmed"] },
      },
      orderBy: [{ date: "asc" }, { time: "asc" }],
      take: 1,
    });

    if (upcoming.length === 0) {
      return { success: false, cancelled: 0, error: "Nenhuma reserva futura encontrada" };
    }

    await prisma.reservation.update({
      where: { id: upcoming[0].id },
      data: { status: "cancelled" },
    });

    return { success: true, cancelled: 1 };
  },
};
