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
import { authRouter } from "./routes/auth.routes";
import { demoRouter } from "./routes/demo.routes";
import { reservationRouter } from "./routes/reservation.routes";
import { runLifecycleRefresh } from "./jobs/lifecycleRefresh.job";
import { runPostVisitConsent } from "./jobs/postVisitConsent.job";
import { runDailyAutomation } from "./services/loyalty.service";
import { liveStatsRouter } from "./routes/liveStats.routes";
import whatsappConnectRouter from "./routes/whatsapp-connect.routes";
import { prisma } from "./database/client";
import { jwtAuth } from "./middleware/jwtAuth";
import { tenantGuard } from "./middleware/tenantGuard";

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS: restrict to known origins ---
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : ["http://localhost:5173", "http://localhost:3000"];

// --- API Key auth middleware (server-to-server) ---
const API_KEY = process.env.API_KEY; // optional: set in .env to enable auth
function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  if (!API_KEY) return next(); // auth disabled if no key set
  const key = req.headers["x-api-key"];
  if (key === API_KEY) return next();
  res.status(401).json({ error: "Unauthorized — invalid or missing API key" });
}

// --- Combined auth middleware: JWT (dashboard) OR API key (server-to-server) ---
function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // If Authorization header present → try JWT
  if (req.headers.authorization?.startsWith("Bearer ")) {
    return jwtAuth(req, res, next);
  }
  // Otherwise fall back to API key (server-to-server, curl, etc.)
  return apiKeyAuth(req, res, next);
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

// --- Auth routes (public — no auth required) ---
app.use("/auth", apiLimiter, authRouter);

// --- Health check ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Helmet (after webhooks — not needed for Meta server-to-server calls) ---
app.use(helmet());

// --- Onboarding rate limiter (stricter for public endpoint) ---
const onboardingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 restaurant creations per IP per 15min
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests — try again later" },
});

// --- Routes (protected by JWT or API key + rate limited) ---
// Onboarding: POST /restaurants is public (creates restaurant + user + JWT)
app.use("/restaurants", apiLimiter, (req: Request, res: Response, next: NextFunction) => {
  // Allow POST /restaurants without auth (onboarding) — with validation
  if (req.method === "POST" && req.path === "/") {
    const { name, email } = req.body;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }
    if (!email || typeof email !== "string" || !email.trim()) {
      return res.status(400).json({ error: "email is required" });
    }
    return onboardingLimiter(req, res, next);
  }
  // Everything else requires auth + tenant isolation
  return authMiddleware(req, res, (err?: any) => {
    if (err) return next(err);
    return tenantGuard(req, res, next);
  });
}, restaurantRouter);
app.use("/restaurants", authMiddleware, tenantGuard, customerRouter);
app.use("/restaurants", authMiddleware, tenantGuard, customerEventRouter);
app.use("/restaurants", authMiddleware, tenantGuard, campaignRouter);
app.use("/restaurants", authMiddleware, tenantGuard, attributionRouter);
app.use("/restaurants", authMiddleware, tenantGuard, reservationRouter);
app.use("/restaurants", authMiddleware, tenantGuard, liveStatsRouter);
app.use("/jobs", authMiddleware, jobRouter);
app.use("/demo", authMiddleware, demoRouter);
app.use("/whatsapp", authMiddleware, whatsappConnectRouter);

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
app.post("/jobs/loyalty-automation", authMiddleware, async (_req, res) => {
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
  console.log(`[Server] Retorna running on port ${PORT}`);
  console.log(`[Server] CORS: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[Server] Auth: JWT (Magic Link) + ${API_KEY ? "API key fallback" : "no API key (set API_KEY for server-to-server)"}`);
});

export default app;
