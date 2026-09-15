/**
 * Shared website phone candidate validation for Business Intelligence import.
 * Invalid fragments must never become Confirmed website evidence.
 */

export interface PhoneValidationResult {
  raw: string;
  normalised: string;
  digits: string;
  valid: boolean;
  reason: string;
}

const TAG_OR_NOISE = /^(tel:|phone:|call:|fax:)?\s*/i;

export function extractPhoneDigits(raw: string): string {
  const cleaned = String(raw || "").trim().replace(TAG_OR_NOISE, "");
  let digits = cleaned.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) {
    digits = "+" + digits.slice(1).replace(/\D/g, "");
  } else {
    digits = digits.replace(/\D/g, "");
  }
  return digits;
}

export function normalizePhoneCandidate(raw: string): string {
  const trimmed = String(raw || "").trim().replace(TAG_OR_NOISE, "").replace(/\s+/g, " ");
  return trimmed;
}

/**
 * Basic structural validation for UK (and +44) telephone numbers.
 * Rejects truncated/malformed fragments such as "059) 0 0 60".
 */
export function validateWebsitePhoneCandidate(raw: string): PhoneValidationResult {
  const normalised = normalizePhoneCandidate(raw);
  const digits = extractPhoneDigits(normalised);

  if (!normalised) {
    return { raw, normalised: "", digits: "", valid: false, reason: "empty" };
  }

  // Unbalanced / fragment punctuation
  const open = (normalised.match(/\(/g) || []).length;
  const close = (normalised.match(/\)/g) || []).length;
  if (open !== close) {
    return { raw, normalised, digits, valid: false, reason: "unbalanced-parens" };
  }

  // Reject sparse digit fragments with excessive separators (e.g. "059) 0 0 60")
  const digitOnly = digits.replace(/^\+/, "");
  if (digitOnly.length < 10) {
    return { raw, normalised, digits, valid: false, reason: "too-few-digits" };
  }
  if (digitOnly.length > 15) {
    return { raw, normalised, digits, valid: false, reason: "too-many-digits" };
  }

  // UK national: 0 + 9–10 further digits; international +44 then 9–10
  const ukNational = /^0[1-9]\d{8,9}$/;
  const ukIntl = /^\+44[1-9]\d{8,9}$/;
  const genericIntl = /^\+[1-9]\d{9,14}$/;

  if (ukNational.test(digitOnly) || ukIntl.test(digits) || genericIntl.test(digits)) {
    // Reject if the visible candidate looks like a mangled OCR/HTML fragment
    if (/\d\s+\d\s+\d/.test(normalised) && digitOnly.length < 11 && /[()]/.test(normalised)) {
      return { raw, normalised, digits, valid: false, reason: "fragment-pattern" };
    }
    return { raw, normalised, digits, valid: true, reason: "ok" };
  }

  // Allow other plausible E.164-ish national numbers (10–11 digits starting with 0)
  if (/^0\d{9,10}$/.test(digitOnly)) {
    return { raw, normalised, digits, valid: true, reason: "ok-national" };
  }

  return { raw, normalised, digits, valid: false, reason: "structure-rejected" };
}

export function isValidWebsitePhone(raw: string): boolean {
  return validateWebsitePhoneCandidate(raw).valid;
}
