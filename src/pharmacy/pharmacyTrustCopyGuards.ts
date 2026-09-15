/**
 * Trust/binding guards — suppress unconfirmed profile claims in rendered copy.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";

export function stripUnconfirmedConsultationRoomClaims(
  text: string,
  profile: PharmacyServicePageProfile,
): string {
  if (profile.consultationRoomAvailable) return String(text || "").trim();

  return String(text || "")
    .trim()
    .replace(/Consultations take place in a private consultation room\.?\s*/gi, "")
    .replace(/directed to private consultation room/gi, "directed to a confidential consultation area")
    .replace(/private consultation room/gi, "confidential consultation area")
    .replace(/Ask about walk-in availability or book a private consultation room appointment when you call\.?/gi, "Ask about walk-in availability when you call.")
    .replace(/book a private consultation room appointment[^.]*\.?\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\.\s*\./g, ".")
    .trim();
}

export function isConditionsSummaryParagraph(text: string): boolean {
  const normalized = String(text || "").trim();
  if (!normalized) return false;
  return (
    /^the service covers:/i.test(normalized) ||
    /^conditions covered include/i.test(normalized) ||
    /^this service covers:/i.test(normalized)
  );
}

export function filterServiceOverviewParagraphs(paragraphs: string[], profile: PharmacyServicePageProfile): string[] {
  const restored = paragraphs
    .map((p) => stripUnconfirmedConsultationRoomClaims(p, profile))
    .map((p) =>
      p.replace(
        /Treatment is supplied only where pathway criter(?!ia\b)/g,
        "Treatment is supplied only where pathway criteria are met; otherwise you receive advice or referral.",
      ),
    )
    .filter((p) => p.trim().length > 0 && !isConditionsSummaryParagraph(p));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const paragraph of restored) {
    const key = paragraph
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/treatment is supplied only where pathway criteria are met; otherwise you receive advice or referral\.?/g, "")
      .trim()
      .slice(0, 160);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(paragraph);
  }
  return out;
}
