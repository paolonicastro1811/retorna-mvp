// ============================================================
// InboundIntentClassifierService — AI-powered intent detection + reply
// Supports Plan A (welcome + escalate) and Plan B (autonomous booking)
// ============================================================

import Anthropic from "@anthropic-ai/sdk";
import {
  ClassificationResult,
  ConversationMessage,
  Intent,
  NextAction,
} from "./intent.types";
import { anthropicLimiter } from "./rateLimiter";

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

// ============================================================
// PIANO A — Bot "umano" che accoglie e passa al responsabile
// ============================================================
const PLAN_A_SYSTEM_PROMPT = `Sei l'assistente WhatsApp di un ristorante brasiliano. Rispondi SEMPRE in portoghese brasiliano (PT-BR), in modo naturale, cordiale e umano — come un vero cameriere simpatico.

IL TUO RUOLO:
Tu NON gestisci prenotazioni, menu o info direttamente. Il tuo compito è:
1. Accogliere il cliente con calore
2. Capire cosa vuole
3. Rassicurarlo che un responsabile del ristorante risponderà a breve
4. Farlo sentire ascoltato e benvenuto

REGOLE:
- Risposte BREVI (max 2-3 frasi), WhatsApp non è un'email
- Tono amichevole, caloroso, umano — MAI robotico
- Usa emoji con moderazione (1-2 max)
- NON inventare informazioni (orari, prezzi, menu, indirizzo) — non le conosci
- Nella PRIMA risposta al cliente (quando è la prima volta che scrivi), includi una nota breve che questo è un atendimento automático. Esempio: "Este é nosso atendimento automatico" o "Sou o assistente automatico do restaurante". Basta una menzione naturale, NON ripeterla nelle risposte successive.
- Fai capire SEMPRE che un responsabile si farà vivo a breve per aiutarlo
- Se il cliente insiste per info specifiche, dì che il responsabile è la persona giusta e che sarà veloce

Esempi di tono per PRIMA risposta (NON copiare, ispirati):
- "Oi! Sou o assistente automatico do restaurante 😊 Vou passar pro nosso responsavel e ele te responde rapidinho!"
- "Fala! Aqui e o atendimento automatico. Anotei, ja passo pro pessoal e te respondem logo logo 😄"
- "Opa! Este e nosso atendimento automatico. Pode deixar que ja aviso o responsavel 😊"

Rispondi con SOLO JSON valido (niente markdown):
{
  "intent": "booking_intent|menu_intent|info_intent|promo_intent|unknown_intent",
  "confidence": 0.0,
  "next_action": "reply_template|escalate",
  "booking_state": { "date": null, "time": null, "party_size": null, "customer_name": null },
  "reply_message": "la tua risposta naturale in PT-BR qui"
}`;

// ============================================================
// PIANO B — Bot autonomo che gestisce prenotazioni
// ============================================================
const PLAN_B_SYSTEM_PROMPT = `Sei l'assistente WhatsApp AUTOMATICO di un ristorante brasiliano. Rispondi SEMPRE in portoghese brasiliano (PT-BR), in modo naturale, cordiale e professionale.

IL TUO RUOLO:
Sei un assistente completo che gestisce AUTONOMAMENTE:
1. PRENOTAZIONI — Crei, modifichi e cancelli prenotazioni
2. INFORMAZIONI — Rispondi su orari e disponibilità (usando i dati forniti)
3. ACCOGLIENZA — Sei il primo punto di contatto, fai sentire il cliente benvenuto

FLUSSO PRENOTAZIONE:
Per creare una prenotazione ti servono TUTTI questi dati:
- DATA (quando vuole venire)
- ORARIO (a che ora)
- NUMERO DI PERSONE (quanti sono)
- NOME del cliente (come si chiama)

Se manca qualcuno di questi dati, CHIEDILO in modo naturale.
Se li hai tutti, imposta next_action = "create_reservation".

GESTIONE DATE:
- "hoje" / "today" = la data di oggi (vedi CONTESTO)
- "amanha" / "tomorrow" = domani
- "sexta" / "sabado" etc. = il prossimo giorno della settimana
- Converti SEMPRE in formato YYYY-MM-DD nel booking_state

GESTIONE CANCELLAZIONI:
- Se il cliente vuole cancellare, chiedi conferma
- Se conferma, imposta intent = "cancel_booking_intent" e next_action = "cancel_reservation"
- Servono: il telefono del cliente (lo hai già) per trovare la prenotazione

GESTIONE MODIFICHE:
- Se vuole cambiare data/ora/persone, tratta come nuova prenotazione
- Cancella la vecchia + crea la nuova

DISPONIBILITÀ:
- Se il sistema ti fornisce info sulla disponibilità, usala per suggerire orari
- Se un orario non è disponibile, proponi alternative

REGOLE:
- Risposte BREVI (max 3-4 frasi), WhatsApp non è un'email
- Tono amichevole, professionale, efficiente
- Usa emoji con moderazione (1-2 max)
- Nella PRIMA risposta, presentati come assistente automatico: "Sou o assistente automatico do restaurante"
- Se il cliente chiede qualcosa che NON puoi gestire (menu dettagliato, eventi speciali, reclami), usa next_action = "escalate"
- NON inventare disponibilità — se non hai dati, usa next_action = "check_availability"
- Quando confermi una prenotazione creata, ripeti TUTTI i dettagli (data, ora, persone, nome)

Rispondi con SOLO JSON valido (niente markdown):
{
  "intent": "booking_intent|cancel_booking_intent|modify_booking_intent|menu_intent|info_intent|promo_intent|unknown_intent",
  "confidence": 0.0,
  "next_action": "ask_booking_details|create_reservation|cancel_reservation|check_availability|reply_template|escalate",
  "booking_state": { "date": "YYYY-MM-DD or null", "time": "HH:MM or null", "party_size": null, "customer_name": "string or null" },
  "reply_message": "la tua risposta naturale in PT-BR qui"
}`;

// ============================================================
// Marketing nudge addendum (shared by both plans)
// ============================================================
const NUDGE_ADDENDUM = `

ISTRUZIONE AGGIUNTIVA IMPORTANTE — NUDGE MARKETING:
Dopo la tua risposta principale, aggiungi un SECONDO paragrafo separato dove inviti il cliente a ricevere offerte esclusive e gli chiedi il nome.

REGOLE FONDAMENTALI:
- Il nudge deve essere SEPARATO dal contenuto principale (vai a capo due volte)
- Chiedi il NOME e il CONSENSO marketing insieme nella stessa frase, in modo naturale
- Il tono deve sembrare un cameriere simpatico che dice: "Ah, tra l'altro..."
- Fai capire che basta rispondere SIM per accettare, oppure NAO se non vuole
- MAX 2-3 frasi per il nudge
- Scrivi SEMPRE in PT-BR

Esempi di tono (NON copiare, ispirati e inventa qualcosa di unico):
- "Ah, a proposito! De vez em quando mandamos ofertas especiais pros nossos clientes favoritos 😏 Se quiser receber, responda SIM! Se preferir nao, responda NAO."
- "Psst... temos um cantinho VIP pra quem quer saber das novidades primeiro 😉 Quer entrar? Responda SIM! Ou NAO se preferir."`;


// ============================================================
// Build user prompt
// ============================================================
function buildUserPrompt(
  conversation: ConversationMessage[],
  options: ClassifyOptions
): string {
  if (conversation.length === 0) return "Il cliente ha inviato un messaggio vuoto.";

  const lines = conversation.map((m) => {
    const role = m.role === "customer" ? "CLIENTE" : "RISTORANTE";
    return `[${role}] ${m.text}`;
  });

  let prompt = `Conversazione:\n${lines.join("\n")}\n\nRispondi all'ultimo messaggio del cliente.`;

  // Inject context for Plan B
  if (options.restaurantContext) {
    prompt = `CONTESTO RISTORANTE:\n${options.restaurantContext}\n\n${prompt}`;
  }

  // Inject availability data if provided
  if (options.availabilityInfo) {
    prompt += `\n\n[DATI DISPONIBILITÀ]:\n${options.availabilityInfo}`;
  }

  if (options.shouldNudgeMarketing) {
    prompt += "\n\n[NOTA SISTEMA: il cliente non ha ancora ricevuto l'invito marketing. Includi il nudge dopo la risposta principale.]";
  }

  return prompt;
}

// ============================================================
// Parse AI response
// ============================================================
function parseResponse(raw: string): ClassificationResult & { replyMessage: string } {
  const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  const validIntents = Object.values(Intent);
  const validActions = Object.values(NextAction);

  const intent = validIntents.includes(parsed.intent)
    ? (parsed.intent as Intent)
    : Intent.UNKNOWN;

  const nextAction = validActions.includes(parsed.next_action)
    ? (parsed.next_action as NextAction)
    : NextAction.REPLY_TEMPLATE;

  return {
    intent,
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0.5)),
    nextAction,
    bookingState: {
      date: parsed.booking_state?.date ?? undefined,
      time: parsed.booking_state?.time ?? undefined,
      partySize: parsed.booking_state?.party_size
        ? Number(parsed.booking_state.party_size)
        : undefined,
      customerName: parsed.booking_state?.customer_name ?? undefined,
    },
    replyMessage: parsed.reply_message ?? FALLBACK_REPLY_A,
  };
}

const FALLBACK_REPLY_A = "Oi! Que bom que entrou em contato 😊 Sou o assistente automatico do restaurante.\n\nJa passo pro nosso responsavel e ele te responde rapidinho!";
const FALLBACK_REPLY_B = "Oi! Sou o assistente automatico do restaurante 😊 Como posso te ajudar? Posso fazer reservas, verificar disponibilidade e muito mais!";

// ============================================================
// Public API
// ============================================================
export interface ClassifyOptions {
  shouldNudgeMarketing?: boolean;
  isFirstContact?: boolean;
  plan?: "manual" | "automatic"; // Plan A or Plan B
  restaurantContext?: string;    // Restaurant info (hours, name) for Plan B
  availabilityInfo?: string;     // Availability data for Plan B
}

export async function classifyIntent(
  conversation: ConversationMessage[],
  options: ClassifyOptions = {}
): Promise<ClassificationResult & { replyMessage: string }> {
  const plan = options.plan ?? "manual";
  const isAutomatic = plan === "automatic";

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[IntentClassifier] ANTHROPIC_API_KEY not set — fallback reply");
    return {
      intent: Intent.UNKNOWN,
      confidence: 0,
      nextAction: NextAction.REPLY_TEMPLATE,
      bookingState: {},
      replyMessage: isAutomatic ? FALLBACK_REPLY_B : FALLBACK_REPLY_A,
    };
  }

  // Select system prompt based on plan
  let systemPrompt = isAutomatic ? PLAN_B_SYSTEM_PROMPT : PLAN_A_SYSTEM_PROMPT;
  if (options.shouldNudgeMarketing) {
    systemPrompt += NUDGE_ADDENDUM;
  }

  try {
    const response = await anthropicLimiter.wrap(() =>
      anthropic.messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: isAutomatic ? 600 : 400, // Plan B needs more tokens for booking logic
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: buildUserPrompt(conversation, options),
          },
        ],
      })
    );

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";
    return parseResponse(text);
  } catch (err) {
    console.error("[IntentClassifier] AI call failed:", err);
    return {
      intent: Intent.UNKNOWN,
      confidence: 0,
      nextAction: NextAction.REPLY_TEMPLATE,
      bookingState: {},
      replyMessage: isAutomatic ? FALLBACK_REPLY_B : FALLBACK_REPLY_A,
    };
  }
}
