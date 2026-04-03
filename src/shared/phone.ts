/**
 * Centralized phone normalization — E.164 format for Brazil (+55).
 * Strips spaces, dashes, parens. Ensures +55 prefix.
 * Validates result matches Brazilian E.164 format.
 */
export function normalizePhone(phone: string): string {
  // Strip non-digit characters except leading +
  const stripped = phone.replace(/[^\d+]/g, "");

  let normalized: string;

  // Already E.164 with country code
  if (stripped.startsWith("+")) {
    normalized = stripped;
  }
  // Brazilian number without country code (10-11 digits: 2-digit area + 8-9 digit number)
  else if (/^\d{10,11}$/.test(stripped)) {
    normalized = `+55${stripped}`;
  }
  // Looks like it has country code (55 + 10-11 digits)
  else if (stripped.startsWith("55") && stripped.length >= 12 && stripped.length <= 13) {
    normalized = `+${stripped}`;
  }
  // Default: prepend +
  else {
    normalized = stripped.startsWith("+") ? stripped : `+${stripped}`;
  }

  return normalized;
}

/**
 * Validates that a phone is a valid Brazilian E.164 number.
 * Format: +55 + 2-digit area code + 8-9 digit number = +55XXXXXXXXXXX
 */
export function isValidBrazilianPhone(phone: string): boolean {
  return /^\+55\d{10,11}$/.test(phone);
}
