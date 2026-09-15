/**
 * Reject known bootstrap / platform fallback button colours when verified brand colours exist.
 * Generic — no tenant-specific overrides.
 */
import { normalizeHex } from "./pharmacyThemeEngine.ts";

const KNOWN_FALLBACK_BUTTON_COLOURS = new Set([
  "#d9534f",
  "#dc3545",
  "#e74c3c",
  "#c9302c",
  "#007bff",
  "#005eb8",
  "#0066cc",
]);

function normalizeButtonHex(value: string | undefined | null): string {
  return normalizeHex(String(value || "").trim(), "");
}

export function resolveBrandButtonColor(input: {
  button?: string;
  primary?: string;
  accent?: string;
  secondary?: string;
}): string {
  const button = normalizeButtonHex(input.button);
  const primary = normalizeButtonHex(input.primary);
  const accent = normalizeButtonHex(input.accent);
  const secondary = normalizeButtonHex(input.secondary);

  const isFallback = !button || KNOWN_FALLBACK_BUTTON_COLOURS.has(button.toLowerCase());
  if (!isFallback) return button;

  if (accent && accent !== button) return accent;
  if (primary && primary !== button) return primary;
  if (secondary && secondary !== button) return secondary;
  return button || primary || accent || "#005eb8";
}
