// ============================================================
// Enums e costanti condivise — Reactivation MVP
// ============================================================

// --- Event Types (solo "visit" per MVP) ---
export const EventType = {
  VISIT: "visit",
} as const;
export type EventType = (typeof EventType)[keyof typeof EventType];

// --- Lifecycle Status ---
export const LifecycleStatus = {
  ACTIVE: "active",
  AT_RISK: "at_risk",
  INACTIVE: "inactive",
} as const;
export type LifecycleStatus =
  (typeof LifecycleStatus)[keyof typeof LifecycleStatus];

// --- Campaign Status ---
export const CampaignStatus = {
  DRAFT: "draft",
  BUILDING: "building",
  READY: "ready",
  SENDING: "sending",
  COMPLETED: "completed",
} as const;
export type CampaignStatus =
  (typeof CampaignStatus)[keyof typeof CampaignStatus];

// --- Message Status ---
export const MessageStatus = {
  QUEUED: "queued",
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
} as const;
export type MessageStatus =
  (typeof MessageStatus)[keyof typeof MessageStatus];

// --- Message Event Type ---
export const MessageEventType = {
  SENT: "sent",
  DELIVERED: "delivered",
  READ: "read",
  FAILED: "failed",
  REPLY: "reply",
} as const;
export type MessageEventType =
  (typeof MessageEventType)[keyof typeof MessageEventType];

// --- Channel ---
export const Channel = {
  WHATSAPP: "whatsapp",
} as const;
export type Channel = (typeof Channel)[keyof typeof Channel];

// --- WhatsApp Opt-In Status ---
export const OptInStatus = {
  UNKNOWN: "unknown",
  GRANTED: "granted",
  REVOKED: "revoked",
} as const;
export type OptInStatus = (typeof OptInStatus)[keyof typeof OptInStatus];

// --- Contactable Status ---
export const ContactableStatus = {
  CONTACTABLE: "contactable",
  DO_NOT_CONTACT: "do_not_contact",
} as const;
export type ContactableStatus =
  (typeof ContactableStatus)[keyof typeof ContactableStatus];

// --- Opt-out keywords (case-insensitive) ---
export const OPT_OUT_KEYWORDS = ["stop", "parar", "cancelar"] as const;

// --- Data deletion keywords (LGPD Art. 18 — direito de eliminação) ---
export const DATA_DELETE_KEYWORDS = ["apagar", "deletar", "excluir meus dados"] as const;

// --- LGPD message footer ---
export const LGPD_MESSAGE_FOOTER =
  "\n\nResponda STOP para não receber mais mensagens";

// --- Acquisition Source ---
export const AcquisitionSource = {
  WHATSAPP_INBOUND: "whatsapp_inbound",
  IMPORT: "import",
} as const;
export type AcquisitionSource =
  (typeof AcquisitionSource)[keyof typeof AcquisitionSource];

// --- Welcome auto-reply message (PT-BR) ---
export const WELCOME_AUTO_REPLY_MESSAGE =
  "Olá! 😊\n\nObrigado por falar com a gente.\n\nPodemos te enviar novidades e convites ocasionais do restaurante pelo WhatsApp.\n\nSe não quiser receber mais mensagens, responda STOP a qualquer momento.";

// --- Segment Rules shape ---
export interface SegmentRules {
  lifecycle?: LifecycleStatus[];
  flags?: ("frequent" | "high_spender")[];
}

// --- Lifecycle thresholds (configurabili per restaurant in futuro) ---
export const LIFECYCLE_THRESHOLDS = {
  ACTIVE_MAX_DAYS: 30,
  AT_RISK_MAX_DAYS: 60,
  // > 60 days = inactive
} as const;

// --- Segmentation thresholds ---
export const SEGMENTATION_THRESHOLDS = {
  FREQUENT_MIN_VISITS_30D: 4,
  HIGH_SPENDER_PERCENTILE: 0.75, // top 25%
} as const;

// Attribution window: letto da restaurant.attributionWindowDays (default 30 in schema)
