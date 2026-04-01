import dotenv from "dotenv";
dotenv.config({ override: true });
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cron from "node-cron";

import { restaurantRouter } from "./routes/restaurant.routes";
import { customerRouter } from "./routes/customer.routes";
import { customerEventRouter } from "./routes/customerEvent.routes";
import { campaignRouter } from "./routes/campaign.routes";
import { attributionRouter } from "./routes/attribution.routes";
import { jobRouter } from "./routes/job.routes";
import { whatsappWebhookRouter } from "./webhooks/whatsapp.webhook";
import { demoRouter } from "./routes/demo.routes";
import { reservationRouter } from "./routes/reservation.routes";
import { runLifecycleRefresh } from "./jobs/lifecycleRefresh.job";
import { runPostVisitConsent } from "./jobs/postVisitConsent.job";
import { runDailyAutomation } from "./services/loyalty.service";
import { liveStatsRouter } from "./routes/liveStats.routes";
import { prisma } from "./database/client";

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS: restrict to known origins ---
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000"];

// --- API Key auth middleware (skip webhook + health) ---
const API_KEY = process.env.API_KEY; // optional: set in .env to enable auth
function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  if (!API_KEY) return next(); // auth disabled if no key set
  const key = req.headers["x-api-key"] || req.query.apiKey;
  if (key === API_KEY) return next();
  res.status(401).json({ error: "Unauthorized — invalid or missing API key" });
}

// --- Global request logger (first middleware — logs everything) ---
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} from=${req.ip}`);
  next();
});

// --- Middleware ---
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, mobile)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: "1mb" }));

// --- Rate limiting ---
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minuto
  max: 120,             // max 120 req/min per IP (Meta sends bursts)
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,             // max 200 req/min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

// --- Webhook routes (BEFORE helmet — helmet can interfere with webhook payloads) ---
app.use("/webhooks/whatsapp", webhookLimiter, whatsappWebhookRouter);

// --- Health check ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Helmet (after webhooks — not needed for Meta server-to-server calls) ---
app.use(helmet());

// --- Routes (protected by API key if API_KEY is set + rate limited) ---
app.use("/restaurants", apiLimiter, apiKeyAuth, restaurantRouter);
app.use("/restaurants", apiKeyAuth, customerRouter);
app.use("/restaurants", apiKeyAuth, customerEventRouter);
app.use("/restaurants", apiKeyAuth, campaignRouter);
app.use("/restaurants", apiKeyAuth, attributionRouter);
app.use("/restaurants", apiKeyAuth, reservationRouter);
app.use("/restaurants", apiKeyAuth, liveStatsRouter);
app.use("/jobs", apiKeyAuth, jobRouter);
app.use("/demo", apiKeyAuth, demoRouter);

// --- Cron Jobs ---
// Lifecycle refresh: a cada hora
cron.schedule("0 * * * *", async () => {
  try {
    await runLifecycleRefresh();
  } catch (err) {
    console.error("[Cron:LifecycleRefresh] Error:", err);
  }
});

// Auto-complete seated reservations: a cada 5 minutos
cron.schedule("*/5 * * * *", async () => {
  try {
    // For each restaurant, check seated reservations past their meal duration
    const restaurants = await prisma.restaurant.findMany({
      select: { id: true, avgMealDurationMinutes: true },
    });
    let completed = 0;
    for (const r of restaurants) {
      const durationMs = (r.avgMealDurationMinutes ?? 90) * 60 * 1000;
      const cutoff = new Date(Date.now() - durationMs);
      const result = await prisma.reservation.updateMany({
        where: {
          restaurantId: r.id,
          status: "seated",
          seatedAt: { not: null, lte: cutoff },
        },
        data: { status: "completed" },
      });
      completed += result.count;
    }
    if (completed > 0) {
      console.log(`[Cron:AutoComplete] ${completed} reservation(s) auto-completed`);
    }
  } catch (err) {
    console.error("[Cron:AutoComplete] Error:", err);
  }
});

// Post-visit consent: ogni 15 minuti — sends "Foi um prazer" 2h after visit
cron.schedule("*/15 * * * *", async () => {
  try {
    const result = await runPostVisitConsent();
    if (result.sent > 0 || result.errors > 0) {
      console.log(`[Cron:PostVisitConsent] ${result.sent} sent, ${result.errors} errors`);
    }
  } catch (err) {
    console.error("[Cron:PostVisitConsent] Error:", err);
  }
});

// Loyalty automation: todo dia as 10:00 (horario do restaurante)
cron.schedule("0 10 * * *", async () => {
  try {
    console.log("[Cron:Loyalty] Running daily automation...");
    const result = await runDailyAutomation();
    console.log(`[Cron:Loyalty] Done: ${result.sent} messages sent`);
  } catch (err) {
    console.error("[Cron:Loyalty] Error:", err);
  }
});

// --- Manual trigger for loyalty automation (for testing) ---
app.post("/jobs/loyalty-automation", async (_req, res) => {
  try {
    const result = await runDailyAutomation();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- Global error handler ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`[Server] Reactivation MVP running on port ${PORT}`);
  console.log(`[Server] CORS: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[Server] Auth: ${API_KEY ? "API key required" : "disabled (set API_KEY to enable)"}`);
});

export default app;
