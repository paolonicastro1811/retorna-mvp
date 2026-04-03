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
import { runSurpriseDiscount } from "./jobs/surpriseDiscount.job";
import { pollMetaTemplateStatuses } from "./services/metaTemplate.service";
import { liveStatsRouter } from "./routes/liveStats.routes";
import whatsappConnectRouter from "./routes/whatsapp-connect.routes";
import { prisma } from "./database/client";
import { jwtAuth } from "./middleware/jwtAuth";
import { tenantGuard } from "./middleware/tenantGuard";
import { subscriptionGuard } from "./middleware/subscriptionGuard";
import { billingRouter, stripeWebhookRouter } from "./routes/billing.routes";

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

// --- Stripe webhook (BEFORE express.json — needs truly raw body for signature) ---
app.use("/webhooks/stripe", express.raw({ type: "application/json" }), stripeWebhookRouter);

// --- JSON parser (verify callback captures raw body for WhatsApp HMAC) ---
app.use(express.json({
  limit: "1mb",
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));

// --- WhatsApp webhook (AFTER express.json — needs parsed body + raw for HMAC) ---
app.use("/webhooks/whatsapp", webhookLimiter, whatsappWebhookRouter);

// --- Auth routes (public — no auth required) ---
app.use("/auth", apiLimiter, authRouter);

// --- Health check ---
app.get("/health", async (_req, res) => {
  let dbStatus = "unknown";
  let dbError = "";
  try {
    const result = await prisma.$queryRaw`SELECT 1 as ok`;
    dbStatus = "connected";
  } catch (e: any) {
    dbStatus = "error";
    dbError = e.message || String(e);
  }
  res.json({ status: "ok", timestamp: new Date().toISOString(), db: dbStatus, dbError: dbError || undefined });
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
  // Allow POST /restaurants/check-duplicate without auth (onboarding step 1)
  if (req.method === "POST" && req.path === "/check-duplicate") {
    return onboardingLimiter(req, res, next);
  }
  // Everything else requires auth + tenant isolation
  return authMiddleware(req, res, (err?: any) => {
    if (err) return next(err);
    return tenantGuard(req, res, next);
  });
}, restaurantRouter);
app.use("/restaurants", authMiddleware, tenantGuard, subscriptionGuard, customerRouter);
app.use("/restaurants", authMiddleware, tenantGuard, subscriptionGuard, customerEventRouter);
app.use("/restaurants", authMiddleware, tenantGuard, subscriptionGuard, campaignRouter);
app.use("/restaurants", authMiddleware, tenantGuard, subscriptionGuard, attributionRouter);
app.use("/restaurants", authMiddleware, tenantGuard, subscriptionGuard, reservationRouter);
app.use("/restaurants", authMiddleware, tenantGuard, subscriptionGuard, liveStatsRouter);
app.use("/billing", authMiddleware, billingRouter);
app.use("/jobs", authMiddleware, subscriptionGuard, jobRouter);
app.use("/demo", authMiddleware, subscriptionGuard, demoRouter);
app.use("/whatsapp", authMiddleware, subscriptionGuard, whatsappConnectRouter);

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
      const durationMs = (r.avgMealDurationMinutes ?? 60) * 60 * 1000;
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

// Post-visit consent: ogni 15 minuti — sends "Foi um prazer" 24h after visit
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

// WhatsApp token auto-refresh: every day at 3:00 AM
// Refreshes tokens that expire within 7 days → effectively permanent
cron.schedule("0 3 * * *", async () => {
  try {
    const FB_APP_ID = process.env.FB_APP_ID;
    const FB_APP_SECRET = process.env.FB_APP_SECRET;
    if (!FB_APP_ID || !FB_APP_SECRET) return;

    // Find restaurants with tokens expiring within 7 days
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const restaurants = await prisma.restaurant.findMany({
      where: {
        waAccessToken: { not: null },
        waTokenExpiresAt: { not: null, lte: sevenDaysFromNow },
      },
      select: { id: true, waAccessToken: true, name: true },
    });

    if (restaurants.length === 0) return;
    console.log(`[Cron:WaTokenRefresh] ${restaurants.length} token(s) expiring soon, refreshing...`);

    let refreshed = 0;
    for (const r of restaurants) {
      try {
        const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${FB_APP_ID}&client_secret=${FB_APP_SECRET}&fb_exchange_token=${r.waAccessToken}`;
        const res = await fetch(url);
        const data = await res.json() as any;

        if (data.access_token) {
          const expiresInMs = (data.expires_in || 5184000) * 1000;
          await prisma.restaurant.update({
            where: { id: r.id },
            data: {
              waAccessToken: data.access_token,
              waTokenExpiresAt: new Date(Date.now() + expiresInMs),
            },
          });
          refreshed++;
          console.log(`[Cron:WaTokenRefresh] Refreshed token for "${r.name}" (expires in ${Math.round(expiresInMs / 86400000)}d)`);
        } else {
          console.error(`[Cron:WaTokenRefresh] Failed for "${r.name}":`, data.error?.message);
        }
      } catch (err) {
        console.error(`[Cron:WaTokenRefresh] Error for "${r.name}":`, err);
      }
    }
    console.log(`[Cron:WaTokenRefresh] Done: ${refreshed}/${restaurants.length} refreshed`);
  } catch (err) {
    console.error("[Cron:WaTokenRefresh] Error:", err);
  }
});

// Loyalty automation: todo dia as 13:00 UTC = 10:00 Brasília
cron.schedule("0 13 * * *", async () => {
  try {
    console.log("[Cron:Loyalty] Running daily automation...");
    const result = await runDailyAutomation();
    console.log(`[Cron:Loyalty] Done: ${result.sent} messages sent`);
  } catch (err) {
    console.error("[Cron:Loyalty] Error:", err);
  }
});

// Surprise discount: todo dia as 17:00 UTC = 14:00 Brasília — random discounts to opted-in customers
cron.schedule("0 17 * * *", async () => {
  try {
    const result = await runSurpriseDiscount();
    if (result.sent > 0 || result.errors > 0) {
      console.log(`[Cron:SurpriseDiscount] ${result.sent} sent, ${result.errors} errors`);
    }
  } catch (err) {
    console.error("[Cron:SurpriseDiscount] Error:", err);
  }
});

// Meta template status polling: every 30 minutes
cron.schedule("*/30 * * * *", async () => {
  try {
    const result = await pollMetaTemplateStatuses();
    if (result.updated > 0 || result.errors > 0) {
      console.log(`[Cron:MetaTemplatePoll] ${result.updated} updated, ${result.errors} errors`);
    }
  } catch (err) {
    console.error("[Cron:MetaTemplatePoll] Error:", err);
  }
});

// --- Manual trigger for loyalty automation (for testing — server-to-server only) ---
app.post("/jobs/loyalty-automation", authMiddleware, async (req, res) => {
  try {
    if ((req as any).user) {
      return res.status(403).json({ error: "Global jobs are restricted to server-to-server API key auth" });
    }
    const result = await runDailyAutomation();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// --- 404 handler (must be before error handler) ---
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: "Route not found" });
});

// --- Global error handler ---
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Error]", err.message);
  res.status(500).json({ error: "Internal server error" });
});

// --- Start ---
const server = app.listen(PORT, () => {
  console.log(`[Server] Retorna running on port ${PORT}`);
  console.log(`[Server] CORS: ${ALLOWED_ORIGINS.join(", ")}`);
  console.log(`[Server] Auth: JWT (Magic Link) + ${API_KEY ? "API key fallback" : "no API key (set API_KEY for server-to-server)"}`);
});

// --- Graceful shutdown ---
async function shutdown(signal: string) {
  console.log(`[Server] ${signal} received, shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log("[Server] Prisma disconnected, exiting.");
    process.exit(0);
  });
  // Force exit after 10s if graceful shutdown hangs
  setTimeout(() => {
    console.error("[Server] Forced exit after timeout");
    process.exit(1);
  }, 10_000);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

export default app;
