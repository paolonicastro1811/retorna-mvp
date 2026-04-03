import { Router, Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { messagingService } from "../services/messaging.service";
import { customerRepository } from "../repositories/customer.repository";
import { OptInStatus, ContactableStatus, OPT_OUT_KEYWORDS, DATA_DELETE_KEYWORDS, AcquisitionSource } from "../shared/enums";
import { whatsappProvider, WhatsAppCredentials } from "../services/whatsapp.provider";
import { prisma } from "../database/client";
import { getConversationWindow, saveConversationReply } from "../services/intent/conversation.service";
import { classifyIntent } from "../services/intent/classifier.service";
import { NextAction } from "../services/intent/intent.types";
import { bookingService } from "../services/booking.service";
import { normalizePhone } from "../shared/phone";

const router = Router();

// Block production without META_APP_SECRET
if (!process.env.META_APP_SECRET) {
  if (process.env.NODE_ENV === "production") {
    console.error("FATAL: META_APP_SECRET must be set in production for webhook signature verification.");
    process.exit(1);
  }
  console.warn("\n" + "!".repeat(70));
  console.warn("!!  WARNING: META_APP_SECRET is not set.                       !!");
  console.warn("!!  Webhook signature verification is DISABLED.                !!");
  console.warn("!!  This is acceptable in development but MUST be set in prod. !!");
  console.warn("!".repeat(70) + "\n");
}

// ============================================================
// Webhook Signature Verification — X-Hub-Signature-256
// Meta signs every webhook payload with HMAC-SHA256 using the
// App Secret. We MUST verify this to prevent spoofed payloads.
// ============================================================
function verifyWebhookSignature(req: Request, res: Response, next: NextFunction) {
  const appSecret = process.env.META_APP_SECRET;

  // Skip verification in development (no secret configured)
  // Startup warning is logged once at import time above
  if (!appSecret) {
    return next();
  }

  const signature = req.headers["x-hub-signature-256"] as string | undefined;
  if (!signature) {
    console.warn("[Webhook:WhatsApp] Missing X-Hub-Signature-256 header — rejecting");
    res.sendStatus(401);
    return;
  }

  // Use raw body bytes for HMAC (express.json verify callback stores req.rawBody)
  const rawBody = (req as any).rawBody;
  const expectedSignature =
    "sha256=" +
    crypto
      .createHmac("sha256", appSecret)
      .update(rawBody || JSON.stringify(req.body))
      .digest("hex");

  const sigBuf = Buffer.from(signature);
  const expectedBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    console.warn("[Webhook:WhatsApp] Invalid X-Hub-Signature-256 — rejecting");
    res.sendStatus(401);
    return;
  }

  next();
}

// ============================================================
// Debounce map: customerId → timer handle
// Waits for the customer to finish typing before responding.
// Each new message resets the timer so multi-message bursts
// are processed as a single conversation turn.
// ============================================================
const REPLY_DELAY_MS = 5_000; // 5 seconds

// --- Webhook idempotency: track processed Meta message IDs (in-memory LRU) ---
const processedMsgIds = new Set<string>();
const MAX_PROCESSED_IDS = 10_000;
function markProcessed(msgId: string): boolean {
  if (processedMsgIds.has(msgId)) return false; // already processed
  if (processedMsgIds.size >= MAX_PROCESSED_IDS) {
    // Evict oldest 2000 entries (Set iterates in insertion order)
    const iter = processedMsgIds.values();
    for (let i = 0; i < 2000; i++) {
      const val = iter.next().value;
      if (val !== undefined) processedMsgIds.delete(val);
    }
  }
  processedMsgIds.add(msgId);
  return true; // first time seeing this message
}
const replyTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * GET /webhooks/whatsapp — Meta webhook verification challenge
 */
router.get("/", (req: Request, res: Response) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  const verifyToken = process.env.META_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN;

  if (!verifyToken) {
    console.error("[Webhook:WhatsApp] META_VERIFY_TOKEN not set in environment");
    res.sendStatus(500);
    return;
  }

  if (mode === "subscribe" && token === verifyToken) {
    console.log("[Webhook:WhatsApp] Verification OK — challenge accepted");
    res.status(200).send(challenge);
    return;
  }

  console.warn(
    `[Webhook:WhatsApp] Verification FAILED — mode=${mode}, token_match=${token === verifyToken}`
  );
  res.sendStatus(403);
});

/**
 * POST /webhooks/whatsapp — Real Meta Cloud API webhook receiver
 *
 * Immediate actions (no delay):
 *   - Delivery status updates
 *   - Auto-create customer, log inbound, opt-in/opt-out
 *
 * Debounced actions (5s delay, reset on new message):
 *   - AI intent classification + reply
 *
 * This lets the customer send multiple messages and get ONE
 * coherent reply that considers all of them.
 */
router.post("/", verifyWebhookSignature, async (req: Request, res: Response) => {
  res.sendStatus(200);

  try {
    const body = req.body;
    const entries = body?.entry;
    if (!Array.isArray(entries)) return;

    for (const entry of entries) {
      const changes = entry?.changes;
      if (!Array.isArray(changes)) continue;

      for (const change of changes) {
        // --- Handle delivery status updates (immediate) ---
        const statuses = change?.value?.statuses;
        if (Array.isArray(statuses)) {
          for (const status of statuses) {
            const providerMsgId = status.id as string | undefined;
            const statusValue = status.status as string | undefined;
            const timestamp = status.timestamp
              ? new Date(Number(status.timestamp) * 1000)
              : undefined;

            if (!providerMsgId || !statusValue) continue;

            await messagingService.updateDeliveryStatus(
              providerMsgId,
              statusValue,
              timestamp
            );

            console.log(
              `[Webhook:WhatsApp] Status update: msgId=${providerMsgId} status=${statusValue}`
            );
          }
        }

        // --- Handle inbound messages ---
        const messages = change?.value?.messages;
        const metadata = change?.value?.metadata;
        const businessPhone = metadata?.display_phone_number as string | undefined;
        const webhookPhoneNumberId = metadata?.phone_number_id as string | undefined;

        if (Array.isArray(messages)) {
          // --- Look up restaurant by phone_number_id (per-restaurant routing) ---
          let waRestaurant: { id: string; waAccessToken: string | null; waPhoneNumberId: string | null } | null = null;
          let waCredentials: WhatsAppCredentials | undefined;

          if (webhookPhoneNumberId) {
            waRestaurant = await prisma.restaurant.findFirst({
              where: { waPhoneNumberId: webhookPhoneNumberId },
              select: { id: true, waAccessToken: true, waPhoneNumberId: true },
            });
            if (waRestaurant?.waAccessToken && waRestaurant?.waPhoneNumberId) {
              waCredentials = {
                accessToken: waRestaurant.waAccessToken,
                phoneNumberId: waRestaurant.waPhoneNumberId,
              };
            } else if (!waRestaurant) {
              console.warn(`[Webhook:WhatsApp] No restaurant found for phone_number_id: ${webhookPhoneNumberId}`);
            }
          }

          for (const msg of messages) {
            // Idempotency: skip already-processed messages (Meta retries)
            const metaMsgId = msg.id as string | undefined;
            if (metaMsgId && !markProcessed(metaMsgId)) {
              console.log(`[Webhook:WhatsApp] Skipping duplicate msg.id=${metaMsgId}`);
              continue;
            }

            const from = msg.from as string | undefined;
            const text = (msg.text?.body as string | undefined)?.trim().toLowerCase();
            const rawText = msg.text?.body as string | undefined;

            if (!from) continue;

            const phoneE164 = normalizePhone(from);

            // Resolve restaurantId first (needed for scoped customer lookup)
            let restaurantId: string | null = waRestaurant?.id ?? null;
            if (!restaurantId && businessPhone) {
              const normalizedBizPhone = normalizePhone(businessPhone);
              const rest = await prisma.restaurant.findFirst({ where: { phone: normalizedBizPhone } });
              if (rest) { restaurantId = rest.id; }
            }
            if (!restaurantId) {
              console.warn(`[Webhook:WhatsApp] No restaurant matched for inbound from ${from} — skipping`);
              continue;
            }

            // Find existing customer scoped to restaurant (prevents cross-tenant leak)
            let customer = await prisma.customer.findUnique({
              where: { restaurantId_phone: { restaurantId, phone: phoneE164 } },
            });

            // --- Auto-create unknown customer (immediate) ---
            if (!customer) {

              customer = await prisma.customer.create({
                data: {
                  restaurantId,
                  phone: phoneE164,
                  lifecycleStatus: "inactive", // inactive until marketing consent
                  whatsappOptInStatus: OptInStatus.GRANTED,
                  whatsappOptInAt: new Date(),
                  contactableStatus: ContactableStatus.CONTACTABLE,
                  acquisitionSource: AcquisitionSource.WHATSAPP_INBOUND,
                },
              });

              console.log(
                `[Webhook:WhatsApp] Auto-created customer=${customer.id} phone=${phoneE164} restaurant=${restaurantId}`
              );
            }

            // --- Log inbound message (rate-limited: max 100/hour per customer) ---
            const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
            const recentCount = await prisma.inboundMessage.count({
              where: { customerId: customer.id, receivedAt: { gte: oneHourAgo } },
            });
            if (recentCount < 100) {
              await prisma.inboundMessage.create({
                data: {
                  restaurantId: customer.restaurantId,
                  customerId: customer.id,
                  phoneE164,
                  messageText: rawText ?? null,
                  receivedAt: new Date(),
                  source: "whatsapp",
                },
              });
            } else {
              console.warn(`[Webhook:WhatsApp] Rate limit: ${phoneE164} exceeded 100 msgs/hour — skipping storage`);
            }

            // --- Opt-out (immediate + confirmation message) ---
            if (text && OPT_OUT_KEYWORDS.some((kw) => text === kw)) {
              await customerRepository.revokeOptIn(customer.id);
              // Send opt-out confirmation (Meta best practice + LGPD transparency)
              await whatsappProvider.sendMessage(
                phoneE164,
                "Pronto! Você não receberá mais mensagens nossas. Se mudar de ideia, é só nos escrever novamente. 😊",
                waCredentials
              );
              console.log(
                `[Webhook:WhatsApp] Opt-out confirmed: customer=${customer.id} phone=${from}`
              );
              continue;
            }

            // --- LGPD Data deletion (Art. 18 — direito de eliminação) ---
            if (text && DATA_DELETE_KEYWORDS.some((kw) => text === kw)) {
              const deleteId = customer.id;
              // Soft-delete: anonymize PII + set deletedAt
              await prisma.customer.update({
                where: { id: deleteId },
                data: {
                  deletedAt: new Date(),
                  name: null,
                  phone: `deleted_${deleteId}`,
                  contactableStatus: "do_not_contact",
                  whatsappOptInStatus: "revoked",
                  lifecycleStatus: "inactive",
                },
              });
              await whatsappProvider.sendMessage(
                phoneE164,
                "Seus dados foram removidos do nosso sistema, conforme seu direito pela LGPD. Se precisar de algo no futuro, e so nos escrever. 🙏",
                waCredentials
              );
              console.log(
                `[LGPD] Customer soft-deleted via WhatsApp: id=${deleteId} phone=${from}`
              );
              continue;
            }

            // --- Marketing opt-in confirmation: "sim" / "si" (immediate) ---
            const MARKETING_OPT_IN_KEYWORDS = ["sim", "si", "quero", "aceito", "claro"];
            if (
              text &&
              MARKETING_OPT_IN_KEYWORDS.includes(text) &&
              customer.marketingNudgeSentAt &&
              !customer.marketingOptInAt
            ) {
              await prisma.customer.update({
                where: { id: customer.id },
                data: {
                  marketingOptInAt: new Date(),
                  lifecycleStatus: "active",
                },
              });
              const confirmMsg = customer.name
                ? `Perfeito, ${customer.name}! 🎉 Vai ser um prazer te manter por dentro das novidades. Ate breve!`
                : `Perfeito! 🎉 Vai ser um prazer te manter por dentro das novidades. Ate breve!\n\nAh, e como posso te chamar? 😊`;
              await whatsappProvider.sendMessage(phoneE164, confirmMsg, waCredentials);
              await saveConversationReply(customer.restaurantId, customer.id, phoneE164, confirmMsg, "marketing_opt_in");
              console.log(
                `[Webhook:WhatsApp] Marketing opt-in confirmed → ACTIVE: customer=${customer.id} phone=${from}`
              );
              continue;
            }

            // --- Marketing opt-out: "não" / "nao" after nudge (immediate) ---
            const MARKETING_OPT_OUT_KEYWORDS = ["nao", "não", "no", "agora nao", "agora não", "depois"];
            if (
              text &&
              MARKETING_OPT_OUT_KEYWORDS.some((kw) => text === kw) &&
              customer.marketingNudgeSentAt &&
              !customer.marketingOptInAt
            ) {
              const name = customer.name ?? "voce";
              const declineMsg = `Tudo bem, ${name}! Sem problema nenhum 😊 Se mudar de ideia, e so falar. Estamos aqui!`;
              await whatsappProvider.sendMessage(phoneE164, declineMsg, waCredentials);
              await saveConversationReply(customer.restaurantId, customer.id, phoneE164, declineMsg, "marketing_opt_decline");
              console.log(
                `[Webhook:WhatsApp] Marketing opt-in declined (stays INACTIVE): customer=${customer.id} phone=${from}`
              );
              continue;
            }

            // --- Name capture after nudge (does NOT auto-consent) ---
            // If nudge was sent, no opt-in yet, and reply looks like a name:
            // → Save the name, then ask for EXPLICIT marketing consent (SIM/NAO)
            if (
              customer.marketingNudgeSentAt &&
              !customer.marketingOptInAt &&
              text &&
              !MARKETING_OPT_IN_KEYWORDS.includes(text) &&
              !MARKETING_OPT_OUT_KEYWORDS.some((kw) => text === kw) &&
              !OPT_OUT_KEYWORDS.some((kw) => text === kw) &&
              !DATA_DELETE_KEYWORDS.some((kw) => text === kw)
            ) {
              const customerName = (rawText ?? "").trim();
              if (customerName && customerName.length >= 2 && customerName.length <= 60) {
                // Save name but do NOT grant marketing consent yet
                await prisma.customer.update({
                  where: { id: customer.id },
                  data: { name: customerName },
                });
                // Ask for explicit consent (LGPD Art. 7 — consentimento explícito)
                const consentMsg = `Prazer, ${customerName}! 😊 Posso te enviar novidades e ofertas exclusivas do restaurante pelo WhatsApp?\n\nResponda SIM para aceitar ou NAO se preferir não receber.`;
                await whatsappProvider.sendMessage(phoneE164, consentMsg, waCredentials);
                await saveConversationReply(customer.restaurantId, customer.id, phoneE164, consentMsg, "marketing_consent_request");
                console.log(
                  `[Webhook:WhatsApp] Name="${customerName}" saved, consent requested: customer=${customer.id}`
                );
                continue;
              }
            }

            // --- Opt-in (immediate) ---
            if (customer.whatsappOptInStatus !== OptInStatus.GRANTED) {
              await customerRepository.updateOptInStatus(
                customer.id,
                OptInStatus.GRANTED,
                new Date()
              );
              console.log(
                `[Webhook:WhatsApp] Opt-in (inbound): customer=${customer.id} phone=${from}`
              );
            }

            // --- Debounced AI reply ---
            // Cancel any pending reply timer for this customer
            const customerId = customer.id;
            const existingTimer = replyTimers.get(customerId);
            if (existingTimer) {
              clearTimeout(existingTimer);
              console.log(
                `[Webhook:WhatsApp] Debounce reset: customer=${customerId} (new message arrived)`
              );
            }

            // Capture values for the closure
            const capturedCustomer = { ...customer };
            const capturedPhone = phoneE164;
            const capturedCredentials = waCredentials;

            // Schedule reply after delay
            const timer = setTimeout(async () => {
              replyTimers.delete(customerId);
              try {
                await processAIReply(capturedCustomer, capturedPhone, capturedCredentials);
              } catch (err) {
                console.error(
                  `[Webhook:WhatsApp] Debounced reply error: customer=${customerId}`,
                  err
                );
              }
            }, REPLY_DELAY_MS);

            replyTimers.set(customerId, timer);
            console.log(
              `[Webhook:WhatsApp] Debounce scheduled: customer=${customerId} (reply in ${REPLY_DELAY_MS / 1000}s)`
            );
          }
        }
      }
    }
  } catch (err) {
    console.error("[Webhook:WhatsApp] Error processing webhook:", err);
  }
});

// ============================================================
// AI Reply — runs after debounce delay
// Reads the full conversation window (all messages the customer
// sent in the burst) and generates one coherent reply.
// ============================================================
async function processAIReply(
  customer: {
    id: string;
    restaurantId: string;
    welcomeAutoReplySentAt: Date | null;
    marketingNudgeSentAt: Date | null;
    marketingOptInAt: Date | null;
  },
  phoneE164: string,
  credentials?: WhatsAppCredentials
) {
  // Re-fetch customer to get latest state (may have changed during debounce)
  const freshCustomer = await prisma.customer.findUnique({
    where: { id: customer.id },
  });
  if (!freshCustomer) return;

  // --- 24h conversation window check (Meta Policy) ---
  const lastInbound = await prisma.inboundMessage.findFirst({
    where: { customerId: freshCustomer.id },
    orderBy: { receivedAt: "desc" },
  });
  if (lastInbound) {
    const hoursSinceLastMessage =
      (Date.now() - lastInbound.receivedAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLastMessage > 24) {
      console.warn(
        `[Webhook:WhatsApp] 24h window expired (${hoursSinceLastMessage.toFixed(1)}h) — skipping reply for customer=${freshCustomer.id}`
      );
      return;
    }
  }

  // --- Fetch restaurant plan ---
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: freshCustomer.restaurantId },
  });
  const plan = (restaurant?.plan ?? "manual") as "manual" | "automatic";
  const isAutomatic = plan === "automatic";

  const conversation = await getConversationWindow(
    freshCustomer.id,
    freshCustomer.restaurantId
  );

  const shouldNudge =
    !freshCustomer.marketingNudgeSentAt &&
    !freshCustomer.marketingOptInAt;

  // --- Plan B: build restaurant context and optionally check availability ---
  let restaurantContext: string | undefined;
  let availabilityInfo: string | undefined;

  if (isAutomatic) {
    restaurantContext = await bookingService.getRestaurantContext(freshCustomer.restaurantId);
  }

  // --- First AI call ---
  let classification = await classifyIntent(conversation, {
    shouldNudgeMarketing: shouldNudge,
    plan,
    restaurantContext,
    availabilityInfo,
  });

  console.log(
    `[Webhook:WhatsApp] Intent: ${classification.intent} (${classification.confidence}) action=${classification.nextAction} plan=${plan} customer=${freshCustomer.id}`
  );

  // --- Plan B: Execute booking actions ---
  if (isAutomatic) {
    // CHECK_AVAILABILITY: AI needs availability data before it can reply properly
    if (classification.nextAction === NextAction.CHECK_AVAILABILITY && classification.bookingState.date) {
      const availability = await bookingService.checkAvailability(
        freshCustomer.restaurantId,
        classification.bookingState.date,
        classification.bookingState.partySize ?? 2
      );
      availabilityInfo = bookingService.formatAvailabilityForAI(availability);

      // Re-classify with availability data
      classification = await classifyIntent(conversation, {
        shouldNudgeMarketing: shouldNudge,
        plan,
        restaurantContext,
        availabilityInfo,
      });

      console.log(
        `[Webhook:WhatsApp] Re-classified with availability: action=${classification.nextAction} customer=${freshCustomer.id}`
      );
    }

    // CREATE_RESERVATION: AI collected all data, execute booking
    if (classification.nextAction === NextAction.CREATE_RESERVATION) {
      const result = await bookingService.createReservation(
        freshCustomer.restaurantId,
        freshCustomer.id,
        phoneE164,
        classification.bookingState
      );

      if (result.success) {
        console.log(
          `[Webhook:WhatsApp] Reservation created: id=${result.reservationId} customer=${freshCustomer.id}`
        );
        // AI already has the confirmation message; if not, we could override here
      } else {
        // Booking failed — tell AI about the error so it can inform the customer
        console.warn(
          `[Webhook:WhatsApp] Reservation FAILED: ${result.error} customer=${freshCustomer.id}`
        );
        // Re-classify with error info so AI can suggest alternatives
        classification = await classifyIntent(conversation, {
          shouldNudgeMarketing: false,
          plan,
          restaurantContext,
          availabilityInfo: `ERRO NA RESERVA: ${result.error}`,
        });
      }
    }

    // CANCEL_RESERVATION: cancel customer's upcoming reservation
    if (classification.nextAction === NextAction.CANCEL_RESERVATION) {
      const result = await bookingService.cancelReservation(
        freshCustomer.restaurantId,
        freshCustomer.id
      );

      if (result.success) {
        console.log(
          `[Webhook:WhatsApp] Reservation cancelled: customer=${freshCustomer.id}`
        );
      } else {
        console.warn(
          `[Webhook:WhatsApp] Cancel FAILED: ${result.error} customer=${freshCustomer.id}`
        );
        // Re-classify with error
        classification = await classifyIntent(conversation, {
          shouldNudgeMarketing: false,
          plan,
          restaurantContext,
          availabilityInfo: `ERRO NO CANCELAMENTO: ${result.error}`,
        });
      }
    }
  }

  // --- Send reply ---
  const replyText = classification.replyMessage;

  // If no explicit credentials, try to load per-restaurant credentials
  let replyCredentials = credentials;
  if (!replyCredentials && restaurant?.waAccessToken && restaurant?.waPhoneNumberId) {
    replyCredentials = {
      accessToken: restaurant.waAccessToken,
      phoneNumberId: restaurant.waPhoneNumberId,
    };
  }

  const sendResult = await whatsappProvider.sendMessage(phoneE164, replyText, replyCredentials);

  if (sendResult.success) {
    const updateData: Record<string, unknown> = {};
    if (!freshCustomer.welcomeAutoReplySentAt) {
      updateData.welcomeAutoReplySentAt = new Date();
    }
    if (shouldNudge) {
      // Atomic: only set if still null (prevents duplicate nudge from concurrent webhooks)
      await prisma.customer.updateMany({
        where: { id: freshCustomer.id, marketingNudgeSentAt: null },
        data: { marketingNudgeSentAt: new Date() },
      });
    }
    if (Object.keys(updateData).length > 0) {
      await prisma.customer.update({
        where: { id: freshCustomer.id },
        data: updateData,
      });
    }
    // Save bot reply to conversation history
    await saveConversationReply(
      freshCustomer.restaurantId,
      freshCustomer.id,
      phoneE164,
      replyText,
      classification.intent
    );

    console.log(
      `[Webhook:WhatsApp] Reply sent: customer=${freshCustomer.id} intent=${classification.intent} providerMsgId=${sendResult.providerMsgId}`
    );
  } else {
    console.error(
      `[Webhook:WhatsApp] Reply FAILED: customer=${freshCustomer.id} error=${sendResult.error}`
    );
  }
}

// findCustomerByPhoneGlobal removed — always use scoped lookup with restaurantId

export const whatsappWebhookRouter = router;
