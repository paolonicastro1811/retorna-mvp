// ============================================================
// Template AI Review Service
// Uses Claude API (Haiku) to validate custom templates before
// submitting to Meta for approval.
//
// Checks: LGPD compliance, anti-spam, Meta policy, language,
// variable format, length, content quality.
// ============================================================

import Anthropic from "@anthropic-ai/sdk";

export interface AiReviewResult {
  approved: boolean;
  score: number; // 0-100
  issues: string[];
  suggestions: string[];
}

const SYSTEM_PROMPT = `You are a WhatsApp Business template reviewer for Brazilian restaurants.
You must analyze marketing templates and return a JSON evaluation.

Rules to check:
1. LGPD: Template MUST mention opt-out option (e.g. "STOP", "SAIR", "cancelar"). If missing, REJECT.
2. ANTI-SPAM: Reject if ALL CAPS, excessive emoji (>5), aggressive urgency ("ULTIMA CHANCE", "SO HOJE"), or misleading claims.
3. META POLICY: Reject if content mentions alcohol promotion, gambling, adult content, weapons, drugs, tobacco, or discriminatory content.
4. LANGUAGE: Must be in Portuguese (Brazilian). Reject if in another language.
5. VARIABLES: Only {{customer_name}} is allowed as variable. Reject if other unknown variables are used.
6. LENGTH: Body must be ≤1024 characters. Warn if >800.
7. QUALITY: Suggest improvements for clarity, tone, and engagement.

Return ONLY valid JSON (no markdown, no backticks):
{
  "approved": true/false,
  "score": 0-100,
  "issues": ["list of problems found"],
  "suggestions": ["list of improvement suggestions"]
}`;

export async function reviewTemplate(body: string): Promise<AiReviewResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // If no API key, do basic rule-based checks
  if (!apiKey) {
    return basicReview(body);
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Review this WhatsApp marketing template:\n\n"${body}"`,
        },
      ],
    });

    const text = response.content[0].type === "text" ? response.content[0].text : "";
    const result = JSON.parse(text) as AiReviewResult;

    // Always enforce LGPD opt-out check regardless of AI response
    if (!hasOptOut(body) && result.approved) {
      result.approved = false;
      result.score = Math.min(result.score, 30);
      result.issues.push("Falta opcao de opt-out (LGPD obrigatorio). Adicione: Responda SAIR para nao receber mais mensagens.");
    }

    return result;
  } catch (err) {
    console.error("[AiReview] Claude API error, falling back to basic review:", err);
    return basicReview(body);
  }
}

// --- Basic rule-based review (fallback when no API key) ---
function basicReview(body: string): AiReviewResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let score = 100;

  // 1. LGPD opt-out
  if (!hasOptOut(body)) {
    issues.push("Falta opcao de opt-out (LGPD obrigatorio). Adicione: Responda SAIR para nao receber mais mensagens.");
    score -= 40;
  }

  // 2. Length
  if (body.length > 1024) {
    issues.push(`Mensagem muito longa (${body.length}/1024 caracteres). Reduza o texto.`);
    score -= 20;
  } else if (body.length > 800) {
    suggestions.push(`Mensagem longa (${body.length}/1024). Considere reduzir para melhor legibilidade.`);
    score -= 5;
  }

  // 3. ALL CAPS check
  const words = body.split(/\s+/);
  const capsWords = words.filter((w) => w.length > 3 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (capsWords.length > 3) {
    issues.push("Muitas palavras em MAIUSCULAS. Meta pode rejeitar templates agressivos.");
    score -= 15;
  }

  // 4. Excessive emoji
  const emojiCount = (body.match(/[\u{1F600}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu) || []).length;
  if (emojiCount > 5) {
    issues.push(`Muitos emojis (${emojiCount}). Reduza para no maximo 3-4.`);
    score -= 10;
  }

  // 5. Urgency spam patterns
  const spamPatterns = /ULTIMA CHANCE|SO HOJE|URGENTE|NAO PERCA|GRATIS|100% OFF/i;
  if (spamPatterns.test(body)) {
    issues.push("Linguagem de urgencia excessiva pode causar rejeicao pela Meta.");
    score -= 15;
  }

  // 6. Invalid variables
  const variables = body.match(/\{\{(\w+)\}\}/g) || [];
  const allowedVars = ["{{customer_name}}"];
  const invalidVars = variables.filter((v) => !allowedVars.includes(v));
  if (invalidVars.length > 0) {
    issues.push(`Variaveis invalidas: ${invalidVars.join(", ")}. Permitida apenas: {{customer_name}}`);
    score -= 20;
  }

  // 7. Empty or too short
  if (body.trim().length < 20) {
    issues.push("Mensagem muito curta. Templates devem ter conteudo significativo.");
    score -= 30;
  }

  // Quality suggestions
  if (!body.includes("{{customer_name}}")) {
    suggestions.push("Considere usar {{customer_name}} para personalizar a mensagem.");
  }

  score = Math.max(0, Math.min(100, score));

  return {
    approved: issues.length === 0 && score >= 60,
    score,
    issues,
    suggestions,
  };
}

function hasOptOut(body: string): boolean {
  const optOutPatterns = /STOP|SAIR|PARAR|CANCELAR|nao receber|opt.?out/i;
  return optOutPatterns.test(body);
}
