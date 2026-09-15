/**
 * Long-form supporting content quality validation — lockdown V1.
 */
import fs from "node:fs";
import path from "node:path";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import {
  countTenantMentions,
  detectForbiddenHedging,
  longFormPlainText,
  tenantDepthScore,
  validateLongFormHtml,
  validateSupportingPageTemplate,
} from "./pharmacyLongFormContentEngine.ts";
import { getEcosystemRoot } from "./contentEnginePaths.ts";

export const LONG_FORM_MIN_WORDS = 200;

export interface LongFormQualityValidation {
  ok: boolean;
  detail: string;
  longFormTenantDepthValidation: { ok: boolean; detail: string };
  forbiddenHedgingDetected: string[];
  tenantMentionsBySection: Record<string, number>;
  serviceMentionsBySection: Record<string, number>;
  ctaPlacementValidation: { ok: boolean; detail: string };
  reviewerPlacementValidation: { ok: boolean; detail: string };
  genericLongFormWarnings: string[];
  failedLongFormAssets: string[];
  supportingTemplateValidation: { ok: boolean; detail: string; failedPages: string[] };
}

const LONG_FORM_ASSETS = [
  { id: "supporting-service-page", rel: `pages/{serviceId}/index.html` },
  { id: "patient-guide", rel: `pages/{serviceId}-guide/index.html` },
  { id: "what-is", rel: `pages/what-is-{serviceId}/index.html` },
  { id: "who-should", rel: `pages/who-should-consider-{serviceId}/index.html` },
  { id: "need-to-know", rel: `pages/{serviceId}-what-you-need-to-know/index.html` },
  { id: "faq-page", rel: `pages/{serviceId}-faqs/index.html` },
] as const;

function assetPath(ecoRoot: string, serviceId: string, rel: string): string {
  return path.join(ecoRoot, rel.replace(/\{serviceId\}/g, serviceId));
}

export function validateLongFormQuality(
  ctx: ContentGenerationContext,
): LongFormQualityValidation {
  const ecoRoot = getEcosystemRoot(ctx.serviceId, ctx.resolvedSlug);
  const pharmacyName = ctx.profile.pharmacyName;
  const serviceName = ctx.serviceName;
  const forbiddenHedgingDetected: string[] = [];
  const tenantMentionsBySection: Record<string, number> = {};
  const serviceMentionsBySection: Record<string, number> = {};
  const genericLongFormWarnings: string[] = [];
  const failedLongFormAssets: string[] = [];

  let ctaOk = true;
  let reviewerOk = true;
  const templateFailedPages: string[] = [];

  for (const asset of LONG_FORM_ASSETS) {
    const file = assetPath(ecoRoot, ctx.serviceId, asset.rel);
    if (!fs.existsSync(file)) {
      failedLongFormAssets.push(`${asset.id}:missing`);
      genericLongFormWarnings.push(`${asset.id}: file missing`);
      continue;
    }

    const html = fs.readFileSync(file, "utf8");
    const text = longFormPlainText(html);
    const articleHtml = html.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[0] || html;
    const templateCheck = validateSupportingPageTemplate(html);
    if (!templateCheck.ok) {
      templateFailedPages.push(`${asset.id}:${templateCheck.issues.join(",")}`);
    }
    const check = validateLongFormHtml(html, ctx, asset.id);

    tenantMentionsBySection[asset.id] = countTenantMentions(text, pharmacyName);
    serviceMentionsBySection[asset.id] = (text.match(new RegExp(serviceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length;

    const hedging = detectForbiddenHedging(text);
    if (hedging.length) {
      forbiddenHedgingDetected.push(...hedging.map((h) => `${asset.id}:${h}`));
    }

    const depth = tenantDepthScore(text, pharmacyName);
    if (!depth.middle) {
      genericLongFormWarnings.push(`${asset.id}: tenant only in intro/footer`);
    }

    const lastQ = text.slice(Math.floor(text.length * 0.75));
    if (!lastQ.includes(ctx.cta.phone) && !articleHtml.includes("tel:")) {
      ctaOk = false;
    }

    if (asset.id !== "faq-page" && !/reviewed by/i.test(text)) {
      reviewerOk = false;
    }

    if (!check.ok) {
      failedLongFormAssets.push(`${asset.id}:${check.warnings.join(",")}`);
      genericLongFormWarnings.push(...check.warnings.map((w) => `${asset.id}: ${w}`));
    }
  }

  const depthOk = Object.entries(tenantMentionsBySection).every(([, n]) => n >= 3);
  const templateOk = templateFailedPages.length === 0;

  const result: LongFormQualityValidation = {
    ok:
      failedLongFormAssets.length === 0 &&
      forbiddenHedgingDetected.length === 0 &&
      depthOk &&
      ctaOk &&
      reviewerOk &&
      templateOk,
    detail: "",
    longFormTenantDepthValidation: {
      ok: depthOk,
      detail: depthOk ? "tenant mentions throughout" : "thin tenant depth in body",
    },
    forbiddenHedgingDetected,
    tenantMentionsBySection,
    serviceMentionsBySection,
    ctaPlacementValidation: {
      ok: ctaOk,
      detail: ctaOk ? "CTA present near end" : "CTA missing in long-form assets",
    },
    reviewerPlacementValidation: {
      ok: reviewerOk,
      detail: reviewerOk ? "reviewer present" : "reviewer missing from long-form assets",
    },
    genericLongFormWarnings,
    failedLongFormAssets,
    supportingTemplateValidation: {
      ok: templateOk,
      detail: templateOk ? "supporting pages use current long-form shell" : `template issues: ${templateFailedPages.slice(0, 4).join("; ")}`,
      failedPages: templateFailedPages,
    },
  };

  result.detail = result.ok
    ? "long-form quality ok"
    : `failed: ${failedLongFormAssets.slice(0, 5).join("; ")}`;

  return result;
}
