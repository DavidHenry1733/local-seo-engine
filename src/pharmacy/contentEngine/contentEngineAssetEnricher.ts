/**
 * Tenant-specific enrichment for satellite assets (blog, guide, social, GBP, email).
 * Ensures every asset mentions the correct pharmacy, CTA, and service context.
 */
import type { ContentGenerationContext } from "./contentGenerationContextTypes.ts";
import { applyContextTokens } from "./contentEngineTokens.ts";

function mentionsPharmacy(text: string, pharmacyName: string): boolean {
  if (!pharmacyName) return false;
  return text.toLowerCase().includes(pharmacyName.toLowerCase());
}

function mentionsPhone(text: string, phone: string): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  return text.includes(phone) || (digits.length >= 6 && text.replace(/\D/g, "").includes(digits));
}

export function enrichSatelliteText(
  text: string,
  ctx: ContentGenerationContext,
  assetType: "blog" | "guide" | "social" | "gbp" | "email" | "video" | "faq",
): string {
  let out = applyContextTokens(text, ctx).trim();
  const { pharmacyName } = ctx.profile;
  const { phone } = ctx.cta;
  const { serviceName } = ctx;
  const area = ctx.localArea;

  if (!mentionsPharmacy(out, pharmacyName) && pharmacyName) {
    const prefix =
      assetType === "social"
        ? `${pharmacyName}: `
        : assetType === "email"
          ? `From ${pharmacyName} — `
          : "";
    out = `${prefix}${out}`;
  }

  if (!mentionsPhone(out, phone) && phone && (assetType === "social" || assetType === "gbp" || assetType === "email")) {
    out = `${out.replace(/\s+$/, "")} Call ${phone}${area ? ` (${area})` : ""}.`.trim();
  }

  if (assetType === "guide" || assetType === "blog") {
    if (ctx.reviewer.name && !out.toLowerCase().includes(ctx.reviewer.name.toLowerCase())) {
      out = `${out}\n\nReviewed by ${ctx.reviewer.name}${ctx.reviewer.role ? `, ${ctx.reviewer.role}` : ""}.`;
    }
  }

  if (assetType === "email" && ctx.cta.bookingUrl && !out.includes(ctx.cta.bookingUrl)) {
    out = `${out}\n\nBook: ${ctx.cta.bookingUrl}`;
  }

  if (!out.toLowerCase().includes(serviceName.toLowerCase()) && serviceName) {
    out = `${serviceName} — ${out}`;
  }

  return out.replace(/\s{2,}/g, " ").trim();
}

export function enrichSatelliteTitle(title: string, ctx: ContentGenerationContext): string {
  const out = applyContextTokens(title, ctx);
  if (mentionsPharmacy(out, ctx.profile.pharmacyName)) return out;
  return `${out} | ${ctx.profile.pharmacyName}`;
}
