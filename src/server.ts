import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import { runDailyAutomation } from "./services/loyalty.service";

const app = express();
const PORT = process.env.PORT || 3000;

// --- Global request logger (first middleware — logs everything) ---
app.use((req, _res, next) => {
  console.log(`[REQ] ${req.method} ${req.url} from=${req.ip} content-type=${req.headers["content-type"] ?? "none"}`);
  next();
});

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- Webhook routes (BEFORE helmet — helmet can interfere with webhook payloads) ---
app.use("/webhooks/whatsapp", whatsappWebhookRouter);

// --- Health check ---
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// --- Helmet (after webhooks — not needed for Meta server-to-server calls) ---
app.use(helmet());

// --- Routes ---
app.use("/restaurants", restaurantRouter);
app.use("/restaurants", customerRouter);
app.use("/restaurants", customerEventRouter);
app.use("/restaurants", campaignRouter);
app.use("/restaurants", attributionRouter);
app.use("/restaurants", reservationRouter);
app.use("/jobs", jobRouter);
app.use("/demo", demoRouter);

// --- Cron Jobs ---
// Lifecycle refresh: ogni ora
cron.schedule("0 * * * *", async () => {
  try {
    await runLifecycleRefresh();
  } catch (err) {
    console.error("[Cron:LifecycleRefresh] Error:", err);
  }
});

// Loyalty automation: ogni giorno alle 10:00 (orario ristorante)
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

// --- Start ---
app.listen(PORT, () => {
  console.log(`[Server] Reactivation MVP running on port ${PORT}`);
});

export default app;
