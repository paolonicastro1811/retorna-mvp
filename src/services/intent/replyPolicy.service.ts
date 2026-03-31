// ============================================================
// ReplyPolicyService — Maps classification → reply message
// ============================================================

import { ClassificationResult, NextAction } from "./intent.types";

// --- PT-BR Reply Templates ---
const TEMPLATES: Record<string, string> = {
  // Booking flow
  ask_date:
    "Ótimo! Vamos reservar uma mesa para você! 🍽️\nQual a data, horário e quantas pessoas?",
  ask_time:
    "Perfeito! Já tenho a data. Qual horário você prefere e quantas pessoas serão?",
  ask_party_size:
    "Quase lá! Quantas pessoas serão na mesa?",
  confirm_booking:
    "Perfeito! Vou confirmar sua reserva:\n📅 Data: {{date}}\n🕐 Horário: {{time}}\n👥 Pessoas: {{partySize}}\n\nEstá tudo certo? Responda SIM para confirmar.",

  // Info templates
  menu_info:
    "Nosso cardápio é bem variado! 🍕\nVou pedir para a equipe te enviar o menu completo. Um momento!",
  hours_location:
    "Obrigado pelo interesse! 📍\nVou encaminhar para a equipe te passar todas as informações sobre horários e localização. Um momento!",
  promo_info:
    "Temos promoções especiais! 🎉\nVou verificar as ofertas disponíveis e te respondo em seguida!",
  generic_help:
    "Olá! 😊 Como posso te ajudar?\n\n• Reservas\n• Cardápio\n• Horários e localização\n• Promoções\n\nÉ só me dizer!",

  // Escalation
  escalate:
    "Entendi! Vou encaminhar sua mensagem para nossa equipe. Alguém vai te responder em breve! 🙏",
};

function buildBookingAskMessage(result: ClassificationResult): string {
  const { bookingState } = result;
  if (!bookingState.date) return TEMPLATES.ask_date;
  if (!bookingState.time) return TEMPLATES.ask_time;
  if (!bookingState.partySize) return TEMPLATES.ask_party_size;
  // All present — shouldn't reach here, but fallback
  return TEMPLATES.ask_date;
}

function buildConfirmMessage(result: ClassificationResult): string {
  const { bookingState } = result;
  return TEMPLATES.confirm_booking
    .replace("{{date}}", bookingState.date ?? "—")
    .replace("{{time}}", bookingState.time ?? "—")
    .replace("{{partySize}}", String(bookingState.partySize ?? "—"));
}

export function getReplyMessage(result: ClassificationResult): string {
  switch (result.nextAction) {
    case NextAction.ASK_BOOKING_DETAILS:
      return buildBookingAskMessage(result);

    case NextAction.CONFIRM_BOOKING:
      return buildConfirmMessage(result);

    case NextAction.ESCALATE:
      return TEMPLATES.escalate;

    case NextAction.REPLY_TEMPLATE:
    default:
      return TEMPLATES[result.replyTemplateKey ?? "generic_help"] ?? TEMPLATES.generic_help;
  }
}
