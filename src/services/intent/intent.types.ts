// ============================================================
// Intent Classifier — Type definitions
// ============================================================

export const Intent = {
  BOOKING: "booking_intent",
  CANCEL_BOOKING: "cancel_booking_intent",
  MODIFY_BOOKING: "modify_booking_intent",
  MENU: "menu_intent",
  INFO: "info_intent",
  PROMO: "promo_intent",
  UNKNOWN: "unknown_intent",
} as const;
export type Intent = (typeof Intent)[keyof typeof Intent];

export const NextAction = {
  REPLY_TEMPLATE: "reply_template",
  ASK_BOOKING_DETAILS: "ask_booking_details",
  CONFIRM_BOOKING: "confirm_booking",
  CREATE_RESERVATION: "create_reservation",
  CANCEL_RESERVATION: "cancel_reservation",
  CHECK_AVAILABILITY: "check_availability",
  ESCALATE: "escalate",
} as const;
export type NextAction = (typeof NextAction)[keyof typeof NextAction];

export interface BookingState {
  date?: string;   // e.g. "2026-04-02"
  time?: string;   // e.g. "20:00"
  partySize?: number;
  customerName?: string;
}

export interface ClassificationResult {
  intent: Intent;
  confidence: number;      // 0-1
  nextAction: NextAction;
  bookingState: BookingState;
  replyTemplateKey?: string; // which template to use
}

export interface ConversationMessage {
  role: "customer" | "restaurant";
  text: string;
  timestamp: Date;
}
