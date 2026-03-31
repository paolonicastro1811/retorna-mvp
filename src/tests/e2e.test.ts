/**
 * E2E Test — Flusso core completo Reactivation MVP
 *
 * Usa embedded-postgres per un test completamente self-contained.
 * Esegue: seed → visits → lifecycle → campaign → dispatch → new visit → attribution → ROI
 */

import EmbeddedPostgres from "embedded-postgres";
import { execSync } from "child_process";
import { PrismaClient } from "@prisma/client";

// ── Helpers ──────────────────────────────────────────────

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

// ── Main ─────────────────────────────────────────────────

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: "./tmp-pg-e2e",
    user: "test",
    password: "test",
    port: 54320,
  });

  let prisma: PrismaClient | null = null;

  try {
    // ── 0. Start embedded postgres ──
    log("SETUP", "Starting embedded PostgreSQL...");
    await pg.initialise();
    await pg.start();
    await pg.createDatabase("reactivation_e2e");
    ok("Embedded PostgreSQL running on port 54320");

    const dbUrl =
      "postgresql://test:test@localhost:54320/reactivation_e2e";
    process.env.DATABASE_URL = dbUrl;

    // Run prisma migrate
    log("SETUP", "Running Prisma migrations...");
    execSync(`npx prisma migrate dev --name e2e_init --skip-generate`, {
      env: { ...process.env, DATABASE_URL: dbUrl },
      stdio: "pipe",
    });
    ok("Migrations applied");

    // Init Prisma client
    prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
    await prisma.$connect();
    ok("Prisma client connected");

    // ══════════════════════════════════════════════════════
    // STEP 1 — Create restaurant
    // ══════════════════════════════════════════════════════
    log("STEP 1", "Create restaurant");

    const restaurant = await prisma.restaurant.create({
      data: {
        name: "Churrascaria Fogo Vivo",
        phone: "+5511999990000",
        timezone: "America/Sao_Paulo",
        attributionWindowDays: 30,
      },
    });
    ok(`Restaurant created: id=${restaurant.id}, name=${restaurant.name}`);
    assert(restaurant.attributionWindowDays === 30, "attributionWindowDays = 30");

    // ══════════════════════════════════════════════════════
    // STEP 2 — Create customers with visit history
    // ══════════════════════════════════════════════════════
    log("STEP 2", "Create customers + visit history");

    const now = new Date();
    const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

    // Customer 1: ACTIVE — visited 5 days ago, frequent
    const c1 = await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        phone: "+5511900000001",
        name: "Carlos Silva",
      },
    });
    for (const [dAgo, amount] of [[5, 120], [12, 95], [18, 110], [25, 130]] as const) {
      await prisma.customerEvent.create({
        data: {
          customerId: c1.id,
          restaurantId: restaurant.id,
          eventType: "visit",
          amount,
          occurredAt: daysAgo(dAgo),
        },
      });
    }
    ok(`Carlos (active, frequent): 4 visits, last 5 days ago`);

    // Customer 2: AT_RISK — last visit 45 days ago
    const c2 = await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        phone: "+5511900000002",
        name: "Ana Souza",
      },
    });
    for (const [dAgo, amount] of [[45, 200], [80, 180]] as const) {
      await prisma.customerEvent.create({
        data: {
          customerId: c2.id,
          restaurantId: restaurant.id,
          eventType: "visit",
          amount,
          occurredAt: daysAgo(dAgo),
        },
      });
    }
    ok(`Ana (at_risk): 2 visits, last 45 days ago`);

    // Customer 3: INACTIVE — last visit 90 days ago, high spender
    const c3 = await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        phone: "+5511900000003",
        name: "Roberto Lima",
      },
    });
    for (const [dAgo, amount] of [[90, 350], [120, 400], [150, 380]] as const) {
      await prisma.customerEvent.create({
        data: {
          customerId: c3.id,
          restaurantId: restaurant.id,
          eventType: "visit",
          amount,
          occurredAt: daysAgo(dAgo),
        },
      });
    }
    ok(`Roberto (inactive, high_spender): 3 visits, last 90 days ago`);

    // Customer 4: INACTIVE — last visit 70 days ago, low spender
    const c4 = await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        phone: "+5511900000004",
        name: "Lucia Ferreira",
      },
    });
    await prisma.customerEvent.create({
      data: {
        customerId: c4.id,
        restaurantId: restaurant.id,
        eventType: "visit",
        amount: 45,
        occurredAt: daysAgo(70),
      },
    });
    ok(`Lucia (inactive, low_spender): 1 visit, last 70 days ago`);

    // Customer 5: NEW — no visits at all
    const c5 = await prisma.customer.create({
      data: {
        restaurantId: restaurant.id,
        phone: "+5511900000005",
        name: "Pedro Santos",
      },
    });
    ok(`Pedro (no visits): 0 visits`);

    // ══════════════════════════════════════════════════════
    // STEP 3 — Update customer metrics (simulate what recordVisit does)
    // ══════════════════════════════════════════════════════
    log("STEP 3", "Update customer metrics");

    // Import the service (now that DATABASE_URL is set)
    const { customerEventService } = await import("../services/customerEvent.service");

    for (const cust of [c1, c2, c3, c4, c5]) {
      await customerEventService.updateCustomerMetrics(cust.id);
    }

    const metricsC1 = await prisma.customer.findUnique({ where: { id: c1.id } });
    const metricsC3 = await prisma.customer.findUnique({ where: { id: c3.id } });
    assert(metricsC1!.totalVisits === 4, `Carlos totalVisits=4 (got ${metricsC1!.totalVisits})`);
    assert(metricsC3!.totalSpent === 1130, `Roberto totalSpent=1130 (got ${metricsC3!.totalSpent})`);
    assert(metricsC3!.avgTicket > 0, `Roberto avgTicket=${metricsC3!.avgTicket}`);
    ok("Metrics updated for all customers");

    // ══════════════════════════════════════════════════════
    // STEP 4 — Lifecycle refresh
    // ══════════════════════════════════════════════════════
    log("STEP 4", "Lifecycle refresh + segmentation");

    const { segmentationService } = await import("../services/segmentation.service");
    const refreshResult = await segmentationService.refreshAllForRestaurant(restaurant.id);
    ok(`Refreshed ${refreshResult.updated} customers`);

    const afterRefresh = await prisma.customer.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { phone: "asc" },
    });

    for (const c of afterRefresh) {
      console.log(
        `    ${c.name?.padEnd(20)} lifecycle=${c.lifecycleStatus.padEnd(10)} frequent=${c.isFrequent} highSpender=${c.isHighSpender}`
      );
    }

    const carlos = afterRefresh.find((c) => c.id === c1.id)!;
    const ana = afterRefresh.find((c) => c.id === c2.id)!;
    const roberto = afterRefresh.find((c) => c.id === c3.id)!;
    const lucia = afterRefresh.find((c) => c.id === c4.id)!;
    const pedro = afterRefresh.find((c) => c.id === c5.id)!;

    assert(carlos.lifecycleStatus === "active", `Carlos = active (got ${carlos.lifecycleStatus})`);
    assert(ana.lifecycleStatus === "at_risk", `Ana = at_risk (got ${ana.lifecycleStatus})`);
    assert(roberto.lifecycleStatus === "inactive", `Roberto = inactive (got ${roberto.lifecycleStatus})`);
    assert(lucia.lifecycleStatus === "inactive", `Lucia = inactive (got ${lucia.lifecycleStatus})`);
    assert(pedro.lifecycleStatus === "inactive", `Pedro = inactive (got ${pedro.lifecycleStatus})`);
    assert(carlos.isFrequent === true, `Carlos isFrequent=true`);
    assert(roberto.isHighSpender === true, `Roberto isHighSpender=true`);

    // ══════════════════════════════════════════════════════
    // STEP 5 — Create message template
    // ══════════════════════════════════════════════════════
    log("STEP 5", "Create message template");

    const template = await prisma.messageTemplate.create({
      data: {
        restaurantId: restaurant.id,
        name: "Reactivation V1",
        body: "Oi {{name}}! Sentimos sua falta na Churrascaria Fogo Vivo. Volte e ganhe 10% de desconto!",
        channel: "whatsapp",
      },
    });
    ok(`Template created: id=${template.id}`);

    // ══════════════════════════════════════════════════════
    // STEP 6 — Create campaign targeting inactive customers
    // ══════════════════════════════════════════════════════
    log("STEP 6", "Create campaign (inactive customers)");

    const { campaignService } = await import("../services/campaign.service");

    const campaign = await campaignService.create({
      restaurantId: restaurant.id,
      name: "Reactivation Marzo 2026",
      segmentRules: { lifecycle: ["inactive"] },
      templateId: template.id,
    });
    ok(`Campaign created: id=${campaign.id}, status=${campaign.status}`);

    // ══════════════════════════════════════════════════════
    // STEP 7 — Build audience
    // ══════════════════════════════════════════════════════
    log("STEP 7", "Build audience");

    const audienceResult = await campaignService.buildAudience(campaign.id);
    ok(`Audience built: ${audienceResult.audienceSize} customers`);

    const audienceItems = await prisma.campaignAudienceItem.findMany({
      where: { campaignId: campaign.id },
      include: { customer: true },
    });
    for (const item of audienceItems) {
      console.log(`    → ${item.customer.name} (${item.customer.phone})`);
    }

    // Roberto, Lucia, Pedro should be in audience (inactive)
    const audienceIds = audienceItems.map((a) => a.customerId);
    assert(audienceIds.includes(c3.id), "Roberto in audience (inactive)");
    assert(audienceIds.includes(c4.id), "Lucia in audience (inactive)");
    assert(audienceIds.includes(c5.id), "Pedro in audience (inactive)");
    assert(!audienceIds.includes(c1.id), "Carlos NOT in audience (active)");
    assert(!audienceIds.includes(c2.id), "Ana NOT in audience (at_risk)");

    const campaignAfterBuild = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert(campaignAfterBuild!.status === "ready", `Campaign status=ready (got ${campaignAfterBuild!.status})`);

    // ══════════════════════════════════════════════════════
    // STEP 8 — Queue messages
    // ══════════════════════════════════════════════════════
    log("STEP 8", "Queue messages");

    const { messagingService } = await import("../services/messaging.service");

    const queueResult = await messagingService.queueMessages(campaign.id);
    ok(`Messages queued: ${queueResult.queued}`);
    assert(queueResult.queued === 3, `Expected 3 queued (got ${queueResult.queued})`);

    const queuedMsgs = await prisma.outboundMessage.findMany({
      where: { campaignId: campaign.id },
    });
    for (const msg of queuedMsgs) {
      console.log(`    → to=${msg.phone} status=${msg.status} body="${msg.body.slice(0, 50)}..."`);
    }

    // ══════════════════════════════════════════════════════
    // STEP 9 — Dispatch messages (uses WhatsApp stub)
    // ══════════════════════════════════════════════════════
    log("STEP 9", "Dispatch messages (stub mode)");

    const dispatchResult = await messagingService.dispatchCampaign(campaign.id);
    ok(`Dispatch: sent=${dispatchResult.sent}, failed=${dispatchResult.failed}, total=${dispatchResult.total}`);
    assert(dispatchResult.sent === 3, `All 3 sent (got ${dispatchResult.sent})`);
    assert(dispatchResult.failed === 0, `0 failed (got ${dispatchResult.failed})`);

    // Verify message statuses
    const sentMsgs = await prisma.outboundMessage.findMany({
      where: { campaignId: campaign.id },
    });
    for (const msg of sentMsgs) {
      assert(msg.status === "sent", `Message to ${msg.phone} status=sent (got ${msg.status})`);
      assert(msg.providerMsgId !== null, `Message to ${msg.phone} has providerMsgId`);
      assert(msg.sentAt !== null, `Message to ${msg.phone} has sentAt`);
    }

    // Verify campaign completed
    const campaignAfterDispatch = await prisma.campaign.findUnique({ where: { id: campaign.id } });
    assert(campaignAfterDispatch!.status === "completed", `Campaign status=completed`);

    // Verify message events created
    const events = await prisma.messageEvent.findMany({
      where: { messageId: { in: sentMsgs.map((m) => m.id) } },
    });
    assert(events.length === 3, `3 message events created (got ${events.length})`);

    // ══════════════════════════════════════════════════════
    // STEP 10 — Simulate delivery status update via webhook logic
    // ══════════════════════════════════════════════════════
    log("STEP 10", "Simulate webhook delivery status updates");

    const robertoMsg = sentMsgs.find((m) => m.customerId === c3.id)!;
    await messagingService.updateDeliveryStatus(robertoMsg.providerMsgId!, "delivered");
    await messagingService.updateDeliveryStatus(robertoMsg.providerMsgId!, "read");

    const robertoMsgAfter = await prisma.outboundMessage.findUnique({ where: { id: robertoMsg.id } });
    assert(robertoMsgAfter!.status === "read", `Roberto msg status=read (got ${robertoMsgAfter!.status})`);
    assert(robertoMsgAfter!.deliveredAt !== null, "Roberto msg has deliveredAt");
    assert(robertoMsgAfter!.readAt !== null, "Roberto msg has readAt");
    ok("Delivery status updates processed correctly");

    // ══════════════════════════════════════════════════════
    // STEP 11 — Roberto returns! Record new visit (should trigger attribution)
    // ══════════════════════════════════════════════════════
    log("STEP 11", "Roberto returns — record new visit with amount R$280");

    const visitResult = await customerEventService.recordVisit({
      restaurantId: restaurant.id,
      phone: "+5511900000003",
      customerName: "Roberto Lima",
      amount: 280,
    });
    ok(`Visit recorded: eventId=${visitResult.event.id}`);

    // ══════════════════════════════════════════════════════
    // STEP 12 — Verify attribution
    // ══════════════════════════════════════════════════════
    log("STEP 12", "Verify attribution");

    const attribution = await prisma.reactivationAttribution.findFirst({
      where: { customerId: c3.id },
      include: { message: true, visit: true, customer: true },
    });

    assert(attribution !== null, "Attribution created for Roberto");
    if (attribution) {
      assert(attribution.revenue === 280, `Revenue=280 (got ${attribution.revenue})`);
      assert(attribution.messageId === robertoMsg.id, `Attributed to correct message`);
      assert(attribution.visitId === visitResult.event.id, `Attributed to correct visit`);
      ok(`Attribution: message=${attribution.messageId} → visit=${attribution.visitId} → R$${attribution.revenue}`);
    }

    // Verify lastReactivatedAt updated
    const robertoAfter = await prisma.customer.findUnique({ where: { id: c3.id } });
    assert(robertoAfter!.lastReactivatedAt !== null, "Roberto lastReactivatedAt is set");
    ok(`Roberto lastReactivatedAt=${robertoAfter!.lastReactivatedAt?.toISOString()}`);

    // Verify metrics updated
    assert(robertoAfter!.totalVisits === 4, `Roberto totalVisits=4 (got ${robertoAfter!.totalVisits})`);
    assert(robertoAfter!.totalSpent === 1410, `Roberto totalSpent=1410 (got ${robertoAfter!.totalSpent})`);

    // ══════════════════════════════════════════════════════
    // STEP 13 — Verify ROI
    // ══════════════════════════════════════════════════════
    log("STEP 13", "Verify ROI");

    const { attributionService } = await import("../services/attribution.service");
    const roi = await attributionService.getRestaurantROI(restaurant.id);
    ok(`ROI: totalRevenue=R$${roi.totalRevenue}, attributions=${roi.count}`);
    assert(roi.totalRevenue === 280, `Total attributed revenue=280 (got ${roi.totalRevenue})`);
    assert(roi.count === 1, `Attribution count=1 (got ${roi.count})`);

    // ══════════════════════════════════════════════════════
    // STEP 14 — Verify 1:1 constraints
    // ══════════════════════════════════════════════════════
    log("STEP 14", "Verify 1:1 attribution constraints");

    // Same visit should NOT get double attribution
    const { attributionService: attrSvc2 } = await import("../services/attribution.service");
    const doubleAttr = await attrSvc2.tryCreateAttribution(
      c3.id,
      visitResult.event.id,
      restaurant.id,
      280
    );
    assert(doubleAttr === null, "Double attribution on same visit blocked");

    // Roberto visits again — message already attributed, should NOT create new attribution
    const visit2 = await customerEventService.recordVisit({
      restaurantId: restaurant.id,
      phone: "+5511900000003",
      customerName: "Roberto Lima",
      amount: 150,
    });

    const attr2 = await prisma.reactivationAttribution.findFirst({
      where: { visitId: visit2.event.id },
    });
    assert(attr2 === null, "Second visit NOT attributed (message already used)");

    const roiFinal = await attributionService.getRestaurantROI(restaurant.id);
    assert(roiFinal.totalRevenue === 280, `ROI unchanged: R$${roiFinal.totalRevenue} (still 280)`);
    assert(roiFinal.count === 1, `Still 1 attribution (got ${roiFinal.count})`);
    ok("1:1 constraints verified: 1 visit → 1 msg, 1 msg → 1 reactivation");

    // ══════════════════════════════════════════════════════
    // FINAL SUMMARY
    // ══════════════════════════════════════════════════════
    log("SUMMARY", "Final state");

    const finalCustomers = await prisma.customer.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { phone: "asc" },
    });
    console.log("\n  CUSTOMERS:");
    for (const c of finalCustomers) {
      console.log(
        `    ${c.name?.padEnd(20)} visits=${c.totalVisits} spent=R$${c.totalSpent.toFixed(0).padStart(5)} avg=R$${c.avgTicket.toFixed(0).padStart(4)} lifecycle=${c.lifecycleStatus.padEnd(10)} reactivatedAt=${c.lastReactivatedAt?.toISOString().slice(0, 10) ?? "—"}`
      );
    }

    const finalMsgs = await prisma.outboundMessage.findMany({
      where: { campaignId: campaign.id },
      include: { customer: true },
    });
    console.log("\n  OUTBOUND MESSAGES:");
    for (const m of finalMsgs) {
      console.log(
        `    → ${m.customer.name?.padEnd(20)} status=${m.status.padEnd(10)} providerMsgId=${m.providerMsgId?.slice(0, 20)}`
      );
    }

    const finalAttrs = await prisma.reactivationAttribution.findMany({
      include: { customer: true, message: true },
    });
    console.log("\n  ATTRIBUTIONS:");
    for (const a of finalAttrs) {
      console.log(
        `    → ${a.customer.name?.padEnd(20)} revenue=R$${a.revenue} msgId=${a.messageId.slice(0, 12)}...`
      );
    }

    console.log(`\n  ROI: R$${roiFinal.totalRevenue} from ${roiFinal.count} reactivation(s)`);

    // ── VERDICT ──
    if (process.exitCode === 1) {
      console.log("\n\n❌ TEST END-TO-END NON SUPERATO\n");
    } else {
      console.log("\n\n✅ TEST END-TO-END SUPERATO\n");
    }
  } catch (err) {
    console.error("\n\n💥 FATAL ERROR:", err);
    console.log("\n❌ TEST END-TO-END NON SUPERATO\n");
    process.exitCode = 1;
  } finally {
    if (prisma) await prisma.$disconnect();
    try {
      await pg.stop();
    } catch {
      // ignore
    }
    // Cleanup temp dir
    try {
      const fs = await import("fs");
      fs.rmSync("./tmp-pg-e2e", { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
}

main();
