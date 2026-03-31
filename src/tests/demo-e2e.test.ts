/**
 * Demo E2E Test — Testa i 3 endpoint /demo/import, /demo/run-campaign, /demo/report
 * Usa embedded-postgres e chiama gli endpoint HTTP reali.
 */

// @ts-nocheck — embedded-postgres types need moduleResolution:node16
import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "child_process";
import http from "http";

function log(step: string, detail: string) {
  console.log(`\n${"=".repeat(60)}\n[${step}] ${detail}\n${"=".repeat(60)}`);
}

function ok(msg: string) {
  console.log(`  ✓ ${msg}`);
}

function fail(msg: string) {
  console.error(`  ✗ ${msg}`);
  process.exitCode = 1;
}

function assert(condition: boolean, msg: string) {
  if (condition) ok(msg);
  else fail(msg);
}

async function httpRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: "127.0.0.1",
      port: 3099,
      path,
      method,
      headers: { "Content-Type": "application/json" },
    };
    const req = http.request(opts, (res) => {
      let raw = "";
      res.on("data", (chunk) => (raw += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode!, data: JSON.parse(raw) });
        } catch {
          resolve({ status: res.statusCode!, data: raw });
        }
      });
    });
    req.on("error", reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: "./tmp-pg-demo",
    user: "test",
    password: "test",
    port: 54321,
  });

  try {
    // ── Setup DB ──
    log("SETUP", "Starting embedded PostgreSQL...");
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("demo_e2e");
    ok("PostgreSQL running on port 54321");

    const dbUrl = "postgresql://test:test@localhost:54321/demo_e2e";
    process.env.DATABASE_URL = dbUrl;
    process.env.PORT = "3099";

    // Migrations
    execSync(`npx prisma migrate dev --name demo_init --skip-generate`, {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });
    ok("Migrations applied");

    // Start Express server (server.ts auto-listens on process.env.PORT)
    await import("../server");
    await new Promise((r) => setTimeout(r, 1000));
    ok("Express server running on port 3099");

    // ══════════════════════════════════════════════════════
    // STEP 1 — Create restaurant
    // ══════════════════════════════════════════════════════
    log("STEP 1", "Create restaurant via API");

    const { data: restaurant } = await httpRequest("POST", "/restaurants", {
      name: "Boteco do Ze",
      phone: "+5511888880000",
    });
    ok(`Restaurant: id=${restaurant.id}, name=${restaurant.name}`);
    const RID = restaurant.id;

    // ══════════════════════════════════════════════════════
    // STEP 2 — /demo/import
    // ══════════════════════════════════════════════════════
    log("STEP 2", "POST /demo/import — bulk import customers + visits");

    const now = Date.now();
    const daysAgoISO = (d: number) => new Date(now - d * 86400000).toISOString();

    const importPayload = {
      restaurantId: RID,
      customers: [
        { phone: "+5511900001111", name: "Maria Costa" },
        { phone: "+5511900002222", name: "Joao Oliveira" },
        { phone: "+5511900003333", name: "Fernanda Rocha" },
        { phone: "+5511900004444", name: "Bruno Almeida" },
        { phone: "+5511900005555" }, // no name
        { phone: "" }, // invalid — should be logged
      ],
      visits: [
        // Maria: active (recent visits)
        { phone: "+5511900001111", amount: 85, occurredAt: daysAgoISO(3) },
        { phone: "+5511900001111", amount: 92, occurredAt: daysAgoISO(10) },
        { phone: "+5511900001111", amount: 78, occurredAt: daysAgoISO(20) },
        // Joao: at_risk (last visit 40 days ago)
        { phone: "+5511900002222", amount: 150, occurredAt: daysAgoISO(40) },
        { phone: "+5511900002222", amount: 180, occurredAt: daysAgoISO(75) },
        // Fernanda: inactive (last visit 100 days ago, high spender)
        { phone: "+5511900003333", amount: 320, occurredAt: daysAgoISO(100) },
        { phone: "+5511900003333", amount: 290, occurredAt: daysAgoISO(130) },
        { phone: "+5511900003333", amount: 350, occurredAt: daysAgoISO(160) },
        // Bruno: inactive (last visit 80 days ago)
        { phone: "+5511900004444", amount: 55, occurredAt: daysAgoISO(80) },
        // Phone 5555: inactive (last visit 200 days ago)
        { phone: "+5511900005555", amount: 40, occurredAt: daysAgoISO(200) },
        // invalid visit
        { phone: "", amount: 100 },
      ],
    };

    const { data: importResult } = await httpRequest(
      "POST",
      "/demo/import",
      importPayload
    );
    console.log("  Import result:", JSON.stringify(importResult, null, 2));

    assert(importResult.customers_created >= 4, `customers_created >= 4 (got ${importResult.customers_created})`);
    assert(importResult.visits_created >= 10, `visits_created >= 10 (got ${importResult.visits_created})`);
    assert(importResult.errors_count >= 1, `errors logged for invalid records (got ${importResult.errors_count})`);

    // ══════════════════════════════════════════════════════
    // STEP 3 — /demo/run-campaign
    // ══════════════════════════════════════════════════════
    log("STEP 3", "POST /demo/run-campaign");

    const { data: campaignResult } = await httpRequest(
      "POST",
      "/demo/run-campaign",
      { restaurantId: RID }
    );
    console.log("  Campaign result:", JSON.stringify(campaignResult, null, 2));

    assert(campaignResult.campaignId !== null, `campaignId is set`);
    assert(campaignResult.audience_size >= 2, `audience_size >= 2 inactive (got ${campaignResult.audience_size})`);
    assert(campaignResult.messages_sent > 0, `messages_sent > 0 (got ${campaignResult.messages_sent})`);
    assert(campaignResult.messages_sent === campaignResult.audience_size, `all audience members got a message`);

    // ══════════════════════════════════════════════════════
    // STEP 4 — Simulate Fernanda returning (triggers attribution)
    // ══════════════════════════════════════════════════════
    log("STEP 4", "Fernanda returns — POST /restaurants/:id/visits");

    const { data: visitResult } = await httpRequest(
      "POST",
      `/restaurants/${RID}/visits`,
      { phone: "+5511900003333", customerName: "Fernanda Rocha", amount: 280 }
    );
    ok(`Visit recorded: eventId=${visitResult.event.id}`);

    // ══════════════════════════════════════════════════════
    // STEP 5 — /demo/report
    // ══════════════════════════════════════════════════════
    log("STEP 5", "GET /demo/report");

    const { data: report } = await httpRequest(
      "GET",
      `/demo/report?restaurantId=${RID}`
    );
    console.log(
      "  Report result:",
      JSON.stringify(report, null, 2)
    );

    assert(report.restaurant === "Boteco do Ze", `restaurant name correct`);
    assert(report.customers.total >= 5, `total customers >= 5`);
    assert(report.campaigns.contacted_customers >= 2, `contacted >= 2`);
    assert(report.campaigns.total_messages >= 2, `total messages >= 2`);
    assert(report.reactivation.reactivated_customers >= 1, `reactivated >= 1`);
    assert(report.reactivation.total_revenue >= 280, `revenue >= 280`);
    assert(report.reactivation.details.length >= 1, `attribution details present`);
    ok(`ROI estimate: ${report.reactivation.roi_estimate}`);

    // Report con filtro temporale
    const { data: report7d } = await httpRequest(
      "GET",
      `/demo/report?restaurantId=${RID}&days=7`
    );
    ok(`7-day report: revenue=R$${report7d.reactivation.total_revenue}, contacted=${report7d.campaigns.contacted_customers}`);

    // ══════════════════════════════════════════════════════
    // STEP 6 — Cooldown: run campaign again, Fernanda should be excluded
    // ══════════════════════════════════════════════════════
    log("STEP 6", "Run campaign again — verify cooldown");

    const { data: campaign2 } = await httpRequest(
      "POST",
      "/demo/run-campaign",
      { restaurantId: RID }
    );
    console.log("  Second campaign:", JSON.stringify(campaign2, null, 2));

    // Previously contacted customers should be in cooldown
    assert(
      campaign2.audience_size < campaignResult.audience_size || campaign2.audience_size === 0,
      `Audience smaller due to cooldown (was ${campaignResult.audience_size}, now ${campaign2.audience_size})`
    );
    ok("Cooldown working — previously contacted customers excluded");

    // ── VERDICT ──
    if (process.exitCode === 1) {
      console.log("\n\n❌ DEMO E2E NON SUPERATO\n");
    } else {
      console.log("\n\n✅ DEMO E2E SUPERATO\n");
    }
  } catch (err) {
    console.error("\n\n💥 FATAL ERROR:", err);
    console.log("\n❌ DEMO E2E NON SUPERATO\n");
    process.exitCode = 1;
  } finally {
    try { await pg.stop(); } catch {}
    try {
      const fs = await import("fs");
      fs.rmSync("./tmp-pg-demo", { recursive: true, force: true });
    } catch {}
  }
}

main();
