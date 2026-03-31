/**
 * WhatsApp Provider — Meta Cloud API
 *
 * In production (META_ACCESS_TOKEN + META_PHONE_NUMBER_ID set):
 *   Sends real messages via Meta Cloud API with retry on transient failures.
 *
 * In development (env vars missing):
 *   Logs to console and returns a stub providerMsgId.
 *
 * Required env for production:
 *   META_ACCESS_TOKEN      — long-lived System User token from Meta Business Manager
 *   META_PHONE_NUMBER_ID   — WhatsApp phone number ID from Meta App Dashboard
 */

export interface SendMessageResult {
  success: boolean;
  providerMsgId?: string;
  error?: string;
  attempts?: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // ms: 1s, 3s, 5s

// Transient HTTP status codes worth retrying
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const whatsappProvider = {
  /**
   * sendMessage — Send a WhatsApp text message with automatic retry.
   * Retries up to 3 times on transient failures (network errors, 429, 5xx).
   */
  async sendMessage(phone: string, body: string): Promise<SendMessageResult> {
    return this._send(phone, {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body },
    });
  },

  /**
   * sendTemplate — Send a Meta-approved HSM template message.
   * Required for business-initiated conversations (campaigns).
   *
   * @param phone       E.164 phone number
   * @param templateName  Name of the approved template in Meta Business Manager
   * @param language      BCP-47 language code (e.g. "pt_BR")
   * @param parameters    Body parameter values in order (e.g. ["Maria"])
   */
  async sendTemplate(
    phone: string,
    templateName: string,
    language: string,
    parameters: string[] = []
  ): Promise<SendMessageResult> {
    const components: any[] = [];
    if (parameters.length > 0) {
      components.push({
        type: "body",
        parameters: parameters.map((p) => ({ type: "text", text: p })),
      });
    }

    return this._send(phone, {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        ...(components.length > 0 ? { components } : {}),
      },
    });
  },

  /**
   * _send — Internal: send any payload to Meta Cloud API with retry.
   */
  async _send(phone: string, payload: Record<string, unknown>): Promise<SendMessageResult> {
    const token = process.env.META_ACCESS_TOKEN ?? process.env.WHATSAPP_API_TOKEN;
    const phoneNumberId = process.env.META_PHONE_NUMBER_ID ?? process.env.WHATSAPP_PHONE_NUMBER_ID;

    // No credentials → stub mode (development)
    if (!token || !phoneNumberId) {
      const fakeId = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      console.log(
        `[WhatsApp STUB] send to=${phone} type=${payload.type} → providerMsgId=${fakeId}`
      );
      return { success: true, providerMsgId: fakeId, attempts: 1 };
    }

    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
    let lastError = "";

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as {
          messages?: { id: string }[];
          error?: { message: string; code?: number };
        };

        // Success
        if (response.ok && !data.error) {
          if (attempt > 1) {
            console.log(`[WhatsApp] Succeeded on attempt ${attempt} to=${phone}`);
          }
          return {
            success: true,
            providerMsgId: data.messages?.[0]?.id,
            attempts: attempt,
          };
        }

        // Non-retryable error (e.g. 400 bad request, 403 forbidden)
        lastError = data.error?.message ?? `HTTP ${response.status}`;
        if (!RETRYABLE_STATUSES.has(response.status)) {
          return { success: false, error: lastError, attempts: attempt };
        }

        // Retryable error — wait and try again
        console.warn(
          `[WhatsApp] Attempt ${attempt}/${MAX_RETRIES} failed (HTTP ${response.status}): ${lastError}`
        );
      } catch (err) {
        // Network error — retryable
        lastError = err instanceof Error ? err.message : "Network error";
        console.warn(
          `[WhatsApp] Attempt ${attempt}/${MAX_RETRIES} failed (network): ${lastError}`
        );
      }

      // Wait before retry (unless it's the last attempt)
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAYS[attempt - 1]);
      }
    }

    return { success: false, error: `All ${MAX_RETRIES} attempts failed: ${lastError}`, attempts: MAX_RETRIES };
  },
};
