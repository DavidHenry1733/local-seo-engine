/**
 * PharmaConnect Authority & AI Readiness Engine V1 — publish-readiness audit layer.
 * Read-only: scans existing profile, visual pages, ecosystem, campaigns, images, indexing/visibility.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import {
  VISUAL_EXPERIENCE_BENCHMARK_SERVICES,
  VISUAL_EXPERIENCE_SERVICE_CONFIG,
  VISUAL_EXPERIENCE_ROOT,
  type VisualExperienceServiceId,
} from "./pharmacyVisualExperienceConfig.ts";
import { buildPageSlotCards } from "./pharmacyImageOperatingSystem.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { isReviewerProfileComplete } from "./pharmacyRealEnhancementActionsService.ts";
import { getServicePublishingSettings } from "./pharmacyPublishingSettingsService.ts";
import { resolveAuthoritativePublicationCanonical } from "./pharmacyPublicationCanonicalAuthority.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const WORKSPACE_ROOT = PHARMACY_WORKSPACE_ROOT;
export const AUTHORITY_READINESS_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-authority-readiness");

export const AUTHORITY_CATEGORIES = [
  "humanExpertise",
  "pharmacyLocalAuthority",
  "clinicalTrust",
  "informationGain",
  "aiCitationReadiness",
  "structuredDataReadiness",
  "contentEcosystemSupport",
  "technicalPublishReadiness",
] as const;

export type AuthorityCategory = (typeof AUTHORITY_CATEGORIES)[number];

export const AUTHORITY_CATEGORY_LABELS: Record<AuthorityCategory, string> = {
  humanExpertise: "Human Expertise",
  pharmacyLocalAuthority: "Pharmacy Local Authority",
  clinicalTrust: "Clinical Trust",
  informationGain: "Information Gain",
  aiCitationReadiness: "AI Citation Readiness",
  structuredDataReadiness: "Structured Data Readiness",
  contentEcosystemSupport: "Content Ecosystem Support",
  technicalPublishReadiness: "Technical Publish Readiness",
};

export type AuthorityReadinessLabel = "Excellent" | "Strong" | "Needs Enhancement" | "Not Ready";
export type PublishGate = "PASS" | "PASS_WITH_RECOMMENDATIONS" | "FAIL";

export interface SignalEvidence {
  signal: string;
  present: boolean;
  detail: string;
}

export interface ServiceAuthorityAudit {
  serviceId: string;
  serviceName: string;
  pageUrl: string;
  overallScore: number;
  label: AuthorityReadinessLabel;
  publishGate: PublishGate;
  categoryScores: Record<AuthorityCategory, number>;
  missingSignals: string[];
  criticalIssues: string[];
  recommendedEnhancements: string[];
  evidence: Record<AuthorityCategory, SignalEvidence[]>;
  lastAuditedAt: string;
}

export interface PharmacyAuthorityReadinessDoc {
  slug: string;
  pharmacyName: string;
  updatedAt: string;
  version: 1;
  services: ServiceAuthorityAudit[];
  summary: {
    averageScore: number;
    label: AuthorityReadinessLabel;
    publishGate: PublishGate;
    servicesAudited: number;
  };
}

export interface AuthorityReadinessDashboard {
  slug: string;
  pharmacyName: string;
  brandPrimaryColor: string;
  doc: PharmacyAuthorityReadinessDoc;
  selectedServiceId: string;
  selectedAudit: ServiceAuthorityAudit | null;
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function stripHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function textIncludes(text: string, ...needles: string[]): boolean {
  const hay = text.toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
}

function getJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const m of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(m[1] ?? ""));
    } catch {
      /* skip invalid */
    }
  }
  return blocks;
}

function flattenSchemaTypes(node: unknown, types = new Set<string>()): Set<string> {
  if (!node || typeof node !== "object") return types;
  if (Array.isArray(node)) {
    for (const item of node) flattenSchemaTypes(item, types);
    return types;
  }
  const obj = node as Record<string, unknown>;
  const t = obj["@type"];
  if (typeof t === "string") types.add(t);
  if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && types.add(x));
  for (const v of Object.values(obj)) flattenSchemaTypes(v, types);
  return types;
}

interface AuditContext {
  slug: string;
  serviceId: VisualExperienceServiceId;
  html: string;
  text: string;
  profile: PharmacyProfileData;
  pageProfile: ReturnType<typeof buildPharmacyServicePageProfile>;
  schemaTypes: Set<string>;
  ecosystemAssetIds: string[];
  publishingSettings: ReturnType<typeof getServicePublishingSettings>;
}

const VISUAL_PAGE_MISSING_SIGNAL = "Visual service page not built";
const VISUAL_PAGE_MISSING_CRITICAL = "Visual service page HTML missing — run visual build pipeline";

function visualPagePath(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, VISUAL_EXPERIENCE_ROOT, safeSlug(slug), serviceId, "index.html");
}

function isVisualExperienceServiceId(serviceId: string): serviceId is VisualExperienceServiceId {
  return VISUAL_EXPERIENCE_BENCHMARK_SERVICES.includes(serviceId as VisualExperienceServiceId);
}

function storedAuditReportsVisualPageMissing(audit: ServiceAuthorityAudit | null): boolean {
  if (!audit) return false;
  return (
    audit.criticalIssues.includes(VISUAL_PAGE_MISSING_CRITICAL) ||
    audit.missingSignals.includes(VISUAL_PAGE_MISSING_SIGNAL)
  );
}

/** Stored publish-gate audits must be re-run when they predate or contradict the live visual HTML. */
function storedAuthorityAuditNeedsLiveRefresh(
  slug: string,
  serviceId: string,
  stored: ServiceAuthorityAudit | null,
): boolean {
  if (!isVisualExperienceServiceId(serviceId)) return false;
  const pagePath = visualPagePath(slug, serviceId);
  const htmlExists = fs.existsSync(pagePath);
  if (storedAuditReportsVisualPageMissing(stored) && htmlExists) return true;
  if (stored && !storedAuditReportsVisualPageMissing(stored) && !htmlExists) return true;
  if (htmlExists && stored?.lastAuditedAt) {
    const auditedAt = Date.parse(stored.lastAuditedAt);
    if (Number.isFinite(auditedAt) && fs.statSync(pagePath).mtimeMs > auditedAt) return true;
  }
  return false;
}

function persistRefreshedServiceAudit(slug: string, live: ServiceAuthorityAudit): void {
  const doc = loadPharmacyAuthorityReadiness(slug);
  if (!doc) return;
  const services = doc.services.map((svc) => (svc.serviceId === live.serviceId ? live : svc));
  if (!services.some((svc) => svc.serviceId === live.serviceId)) services.push(live);
  savePharmacyAuthorityReadiness({
    ...doc,
    slug: safeSlug(slug),
    updatedAt: live.lastAuditedAt,
    services,
  });
}

function resolveServiceAuthorityAuditForPublishGate(
  slug: string,
  serviceId: string,
): ServiceAuthorityAudit | null {
  const stored = getServiceAuthorityAudit(slug, serviceId);
  if (!storedAuthorityAuditNeedsLiveRefresh(slug, serviceId, stored)) return stored;
  if (!isVisualExperienceServiceId(serviceId)) return stored;
  const live = auditServiceAuthorityReadiness(slug, serviceId);
  persistRefreshedServiceAudit(slug, live);
  return live;
}

function ecosystemIndexPath(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", safeSlug(slug), serviceId, "_ecosystem-index.json");
}

function scoreCategory(signals: SignalEvidence[]): number {
  if (!signals.length) return 0;
  const present = signals.filter((s) => s.present).length;
  return Math.round((present / signals.length) * 100);
}

function auditHumanExpertise(ctx: AuditContext): SignalEvidence[] {
  const { html, text, profile } = ctx;
  const superintendent = profile.superintendentPharmacistName || profile.superintendentName || "";
  const reviewerName = profile.reviewerName || superintendent;
  const hasReviewerProfile = isReviewerProfileComplete(profile);
  return [
    {
      signal: "Named pharmacist / reviewer",
      present: Boolean(reviewerName) && (hasReviewerProfile || textIncludes(text, reviewerName.split(" ")[0] || "")),
      detail: hasReviewerProfile ? `${profile.reviewerName} (${profile.reviewerRole})` : reviewerName || "No reviewer in profile",
    },
    {
      signal: "Superintendent pharmacist",
      present: Boolean(superintendent),
      detail: superintendent || "Missing superintendent name",
    },
    {
      signal: "Professional role stated",
      present: Boolean(profile.reviewerRole) || textIncludes(text, "pharmacist", "superintendent"),
      detail: profile.reviewerRole || "Pharmacist professional role in page copy",
    },
    {
      signal: "GPhC registration details",
      present:
        Boolean(profile.reviewerGphcNumber || (profile.gphcNumber && !profile.gphcNumberMarkedMissing)) ||
        textIncludes(text, "gphc", "general pharmaceutical council"),
      detail: profile.reviewerGphcNumber || profile.gphcNumber ? `GPhC ${profile.reviewerGphcNumber || profile.gphcNumber}` : "GPhC not confirmed",
    },
    {
      signal: "Years experience",
      present: Boolean(profile.reviewerExperienceYears || profile.yearsServingCommunity) || textIncludes(text, "years", "serving"),
      detail: profile.reviewerExperienceYears || profile.yearsServingCommunity || "Years serving community not stated",
    },
    {
      signal: "Review date",
      present: Boolean(profile.clinicalReviewDate) || textIncludes(text, "reviewed", "last updated", "review date"),
      detail: profile.clinicalReviewDate || "Formal clinical review date on page",
    },
    {
      signal: "Next review date",
      present: Boolean(profile.nextReviewDate) || textIncludes(text, "next review", "review by"),
      detail: profile.nextReviewDate || "Scheduled next review date",
    },
    {
      signal: "Professional accountability statement",
      present: hasReviewerProfile || textIncludes(text, "duty", "accountability", "registered", "professional"),
      detail: hasReviewerProfile ? "Reviewer profile complete in Profile Dashboard" : "Accountability / registration statement",
    },
  ];
}

function auditPharmacyLocalAuthority(ctx: AuditContext): SignalEvidence[] {
  const { html, text, profile, pageProfile } = ctx;
  const hasMap = /<iframe[^>]+google\.com\/maps/i.test(html) || /map-placeholder|#local-access/i.test(html);
  return [
    { signal: "Pharmacy name", present: textIncludes(text, pageProfile.pharmacyName), detail: pageProfile.pharmacyName },
    { signal: "Town / city", present: textIncludes(text, pageProfile.town), detail: pageProfile.town },
    {
      signal: "Address",
      present: Boolean(profile.addressLine1) && textIncludes(text, profile.postcode || profile.addressLine1),
      detail: [profile.addressLine1, profile.postcode].filter(Boolean).join(", "),
    },
    { signal: "Phone", present: textIncludes(text, profile.phone) || /tel:/i.test(html), detail: profile.phone },
    {
      signal: "Opening hours",
      present: textIncludes(text, "opening", "hours", "monday", "open") || /hours-placeholder/i.test(html),
      detail: "Opening hours or hours section",
    },
    { signal: "Map", present: hasMap, detail: hasMap ? "Map or local access section" : "No map embed" },
    {
      signal: "Coverage areas",
      present: (profile.rankingAreas?.length || 0) > 0 && textIncludes(text, ...(profile.rankingAreas || []).slice(0, 2)),
      detail: (profile.rankingAreas || []).join(", ") || "No coverage areas",
    },
    {
      signal: "Consultation room",
      present: profile.consultationRoomAvailable === true || textIncludes(text, "consultation room", "private consultation"),
      detail: "Consultation room availability",
    },
    {
      signal: "NHS service availability",
      present: profile.nhsServicesAvailable !== false && textIncludes(text, "nhs"),
      detail: "NHS services referenced",
    },
    {
      signal: "Private service availability",
      present: profile.privateServicesAvailable !== false && textIncludes(text, "private"),
      detail: "Private services referenced",
    },
    {
      signal: "Local access wording",
      present: /#local-access|data-template-block="local"/i.test(html) || textIncludes(text, "patients in", "nearby areas"),
      detail: "Local access section",
    },
  ];
}

function auditClinicalTrust(ctx: AuditContext): SignalEvidence[] {
  const { text, html } = ctx;
  return [
    { signal: "Eligibility", present: textIncludes(text, "eligible", "eligibility", "who can"), detail: "Eligibility criteria" },
    { signal: "Exclusions", present: textIncludes(text, "not eligible", "exclusion", "not suitable", "cannot"), detail: "Exclusion criteria" },
    {
      signal: "When to seek urgent help",
      present: textIncludes(text, "urgent", "999", "a&e", "emergency", "nhs 111"),
      detail: "Urgent care escalation",
    },
    { signal: "Safety warnings", present: textIncludes(text, "safety", "red flag", "warning", "seek"), detail: "Safety warnings" },
    {
      signal: "During consultation",
      present: textIncludes(text, "consultation", "assess", "during your visit", "private consultation room"),
      detail: "Consultation process",
    },
    {
      signal: "After consultation",
      present: textIncludes(text, "follow-up", "after", "outcome", "referral", "next steps"),
      detail: "Post-consultation guidance",
    },
    { signal: "Escalation advice", present: textIncludes(text, "refer", "gp", "111", "urgent care"), detail: "Escalation pathways" },
    { signal: "Patient expectations", present: textIncludes(text, "expect", "outcome", "what happens"), detail: "Patient expectations" },
    {
      signal: "Service limitations",
      present: textIncludes(text, "not suitable", "limitation", "cannot treat", "minor illness"),
      detail: "Service scope limits",
    },
  ];
}

function auditInformationGain(ctx: AuditContext): SignalEvidence[] {
  const { text, profile, pageProfile } = ctx;
  return [
    {
      signal: "Local booking process",
      present: textIncludes(text, profile.bookingMethod || "book", "call", "appointment"),
      detail: profile.bookingMethod || "Booking process",
    },
    {
      signal: "What patients should bring",
      present: textIncludes(text, "bring", "medication list", "allergies", "sample"),
      detail: "Patient preparation items",
    },
    {
      signal: "Appointment / walk-in options",
      present: textIncludes(text, "walk-in", "appointment", "book", "call"),
      detail: "Access options",
    },
    {
      signal: "Local service availability",
      present: textIncludes(text, pageProfile.town, "available", "offer"),
      detail: "Local availability wording",
    },
    {
      signal: "Local contact process",
      present: /tel:/i.test(ctx.html) || textIncludes(text, profile.phone),
      detail: "Contact process",
    },
    {
      signal: "Nearby area relevance",
      present: (profile.nearbyAreas?.length || profile.rankingAreas?.length || 0) > 0,
      detail: (profile.nearbyAreas || profile.rankingAreas || []).slice(0, 3).join(", "),
    },
    {
      signal: "Pharmacy-specific service notes",
      present: textIncludes(text, pageProfile.pharmacyName, "brook pharmacy"),
      detail: "Pharmacy-branded service notes",
    },
    {
      signal: "Consultation room access",
      present: textIncludes(text, "consultation room", "private room"),
      detail: "Consultation room access",
    },
    {
      signal: "Practical next steps",
      present: textIncludes(text, "call", "contact", "book", "visit"),
      detail: "Actionable next steps",
    },
    {
      signal: "Service-specific patient preparation",
      present: textIncludes(text, "before your", "prepare", "bring", "when you arrive"),
      detail: "Pre-appointment preparation",
    },
  ];
}

function auditAiCitationReadiness(ctx: AuditContext): SignalEvidence[] {
  const { html, text } = ctx;
  const faqCount = (html.match(/class="faq-q"|cluster-faq-item/gi) || []).length;
  return [
    {
      signal: "Clear short-answer blocks",
      present: textIncludes(text, "is an nhs", "lets you", "pharmacy first is", "service that"),
      detail: "Concise service definition",
    },
    { signal: "FAQs", present: faqCount >= 3, detail: `${faqCount} FAQ items detected` },
    { signal: "Concise definitions", present: /what .+ is|service definition|#service-definition/i.test(html), detail: "Definition section" },
    { signal: "Factual statements", present: text.length > 800, detail: `~${text.split(/\s+/).length} words of factual copy` },
    { signal: "Structured headings", present: (html.match(/<h2[^>]*>/gi) || []).length >= 4, detail: "Multiple H2 sections" },
    { signal: "Service-specific questions", present: faqCount >= 4, detail: "Service FAQs" },
    { signal: "Local service answers", present: textIncludes(text, ctx.pageProfile.town), detail: "Localised answers" },
    { signal: "Page summary", present: /<meta name="description"/i.test(html), detail: "Meta description summary" },
    { signal: "Schema candidates", present: ctx.schemaTypes.size > 0, detail: [...ctx.schemaTypes].slice(0, 5).join(", ") },
    {
      signal: "Reviewer attribution",
      present: textIncludes(text, "superintendent", "pharmacist", "gphc"),
      detail: "Expert attribution",
    },
  ];
}

function auditStructuredDataReadiness(ctx: AuditContext): SignalEvidence[] {
  const types = ctx.schemaTypes;
  const has = (...names: string[]) => names.some((n) => types.has(n));
  return [
    { signal: "LocalBusiness", present: has("LocalBusiness"), detail: has("LocalBusiness") ? "Present" : "Missing" },
    { signal: "Pharmacy", present: has("Pharmacy"), detail: has("Pharmacy") ? "Present" : "Missing" },
    { signal: "MedicalBusiness", present: has("MedicalBusiness"), detail: has("MedicalBusiness") ? "Present" : "Missing" },
    { signal: "WebPage", present: has("WebPage"), detail: has("WebPage") ? "Present" : "Opportunity" },
    { signal: "FAQPage", present: has("FAQPage"), detail: has("FAQPage") ? "Present" : "Missing" },
    { signal: "BreadcrumbList", present: has("BreadcrumbList"), detail: has("BreadcrumbList") ? "Present" : "Opportunity" },
    { signal: "ImageObject", present: has("ImageObject") || /<img[^>]+alt=/i.test(ctx.html), detail: "ImageObject or img alt" },
    { signal: "Organization", present: has("Organization"), detail: has("Organization") ? "Present" : "Opportunity" },
    { signal: "Person / reviewer", present: has("Person"), detail: has("Person") ? "Present" : "Missing superintendent Person" },
    {
      signal: "reviewedBy / author equivalent",
      present: has("Person") || /employee|author|reviewedBy/i.test(ctx.html),
      detail: "Reviewer schema or equivalent",
    },
  ];
}

function auditContentEcosystemSupport(ctx: AuditContext): SignalEvidence[] {
  const ids = new Set(ctx.ecosystemAssetIds);
  const hasBlog = ctx.ecosystemAssetIds.some((id) => id.startsWith("what-is") || id.startsWith("can-a") || id.includes("blog"));
  return [
    { signal: "Service page", present: ids.has("root-service-page"), detail: ids.has("root-service-page") ? "Present" : "Missing" },
    { signal: "Local page", present: ids.has("local-service-page"), detail: ids.has("local-service-page") ? "Present" : "Missing" },
    { signal: "Guide", present: ids.has("patient-guide"), detail: ids.has("patient-guide") ? "Present" : "Missing" },
    { signal: "FAQ page", present: ids.has("faq-page"), detail: ids.has("faq-page") ? "Present" : "Missing" },
    { signal: "Blogs", present: hasBlog, detail: hasBlog ? "Blog assets found" : "No blog posts" },
    { signal: "Social posts", present: ids.has("social-pack"), detail: ids.has("social-pack") ? "Present" : "Missing" },
    { signal: "GBP posts", present: ids.has("gbp-pack"), detail: ids.has("gbp-pack") ? "Present" : "Missing" },
    { signal: "Email sequence", present: ids.has("email-sequence"), detail: ids.has("email-sequence") ? "Present" : "Missing" },
    { signal: "Video script", present: ids.has("video-script"), detail: ids.has("video-script") ? "Present" : "Missing" },
    { signal: "Internal support assets", present: ctx.ecosystemAssetIds.length >= 5, detail: `${ctx.ecosystemAssetIds.length} ecosystem assets` },
  ];
}

function auditTechnicalPublishReadiness(ctx: AuditContext): SignalEvidence[] {
  const { html, slug, serviceId, publishingSettings } = ctx;
  const slots = buildPageSlotCards(slug, serviceId);
  const imagesAssigned = slots.filter((s) => s.status === "assigned").length;
  const imgs = [...html.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
  const imgsWithAlt = imgs.filter((tag) => /alt="[^"]+"/i.test(tag) && !/alt=""/i.test(tag)).length;
  const placeholderVisible =
    /class="v3-placeholder"/i.test(html) ||
    /data-image-missing="true"/i.test(html) ||
    (/map-placeholder/i.test(html) && !/<iframe[^>]+google\.com\/maps/i.test(html));
  const demoWording = /\b(demo superintendent|lorem ipsum|placeholder text|mock pharmacy)\b/i.test(stripHtml(html));
  const hasCanonical = Boolean(publishingSettings?.canonicalUrl) || /<link[^>]+rel="canonical"/i.test(html);
  const indexable = publishingSettings?.noindex === false || !/name="robots"[^>]+noindex|noindex,\s*nofollow/i.test(html);
  return [
    { signal: "Page title", present: /<title>[^<]{10,}<\/title>/i.test(html), detail: "Title tag present" },
    { signal: "Meta description", present: /<meta name="description"/i.test(html), detail: "Meta description" },
    { signal: "H1", present: /<h1[^>]*>[\s\S]*?<\/h1>/i.test(html), detail: "Primary H1" },
    { signal: "Canonical", present: hasCanonical, detail: publishingSettings?.canonicalUrl || "Canonical URL" },
    { signal: "Indexable (no noindex)", present: indexable, detail: indexable ? "Indexable for live publish" : "noindex detected" },
    { signal: "Images assigned", present: imagesAssigned >= 3, detail: `${imagesAssigned}/4 page slots assigned` },
    { signal: "Alt text", present: imgs.length > 0 && imgsWithAlt >= Math.min(3, imgs.length), detail: `${imgsWithAlt}/${imgs.length} images with alt` },
    { signal: "CTA", present: /class="btn"|#contact|Speak To A Pharmacist/i.test(html), detail: "Call-to-action" },
    { signal: "Footer", present: /#site-footer|<footer/i.test(html), detail: "Site footer" },
    { signal: "Map", present: /#local-access|<iframe[^>]+maps/i.test(html), detail: "Map section" },
    { signal: "No placeholder text", present: !placeholderVisible, detail: placeholderVisible ? "Placeholder elements visible" : "No visible placeholders" },
    { signal: "No demo/mock wording", present: !demoWording && !/x-demo-pharmacy":true/i.test(html), detail: demoWording ? "Demo wording detected" : "Clean copy" },
    {
      signal: "No broken image placeholders",
      present: !/data-image-missing="true"/i.test(html),
      detail: "Images resolve on page",
    },
  ];
}

function labelFromScore(score: number): AuthorityReadinessLabel {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 60) return "Needs Enhancement";
  return "Not Ready";
}

function publishGateFrom(score: number, criticalIssues: string[]): PublishGate {
  if (criticalIssues.length > 0 || score < 60) return "FAIL";
  if (score >= 90) return "PASS";
  return "PASS_WITH_RECOMMENDATIONS";
}

function buildRecommendations(
  categoryScores: Record<AuthorityCategory, number>,
  evidence: Record<AuthorityCategory, SignalEvidence[]>,
): string[] {
  const recs: string[] = [];
  for (const cat of AUTHORITY_CATEGORIES) {
    if (categoryScores[cat] >= 85) continue;
    const missing = evidence[cat].filter((s) => !s.present).slice(0, 2);
    for (const m of missing) {
      recs.push(`${AUTHORITY_CATEGORY_LABELS[cat]}: add ${m.signal.toLowerCase()}`);
    }
  }
  return recs.slice(0, 12);
}

export function auditServiceAuthorityReadiness(slug: string, serviceId: VisualExperienceServiceId): ServiceAuthorityAudit {
  const s = safeSlug(slug);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId]?.serviceName || serviceId;
  const pagePath = visualPagePath(s, serviceId);
  const pageUrl = `/api/pharmacy-visual-experience/${serviceId}/?slug=${s}`;

  if (!fs.existsSync(pagePath)) {
    return {
      serviceId,
      serviceName,
      pageUrl,
      overallScore: 0,
      label: "Not Ready",
      publishGate: "FAIL",
      categoryScores: Object.fromEntries(AUTHORITY_CATEGORIES.map((c) => [c, 0])) as Record<AuthorityCategory, number>,
      missingSignals: [VISUAL_PAGE_MISSING_SIGNAL],
      criticalIssues: [VISUAL_PAGE_MISSING_CRITICAL],
      recommendedEnhancements: ["Build visual experience page before publish audit"],
      evidence: Object.fromEntries(AUTHORITY_CATEGORIES.map((c) => [c, []])) as Record<AuthorityCategory, SignalEvidence[]>,
      lastAuditedAt: new Date().toISOString(),
    };
  }

  const html = fs.readFileSync(pagePath, "utf8");
  const text = stripHtml(html);
  const profileDoc = loadPharmacyProfile(s);
  const profile = profileDoc.data;
  const pageProfile = buildPharmacyServicePageProfile(s);

  const schemaTypes = new Set<string>();
  for (const block of getJsonLdBlocks(html)) flattenSchemaTypes(block, schemaTypes);

  let ecosystemAssetIds: string[] = [];
  const ecoPath = ecosystemIndexPath(s, serviceId);
  if (fs.existsSync(ecoPath)) {
    try {
      const eco = JSON.parse(fs.readFileSync(ecoPath, "utf8")) as { assets?: Array<{ id: string }> };
      ecosystemAssetIds = (eco.assets || []).map((a) => a.id);
    } catch {
      /* ignore */
    }
  }

  const ctx: AuditContext = {
    slug: s,
    serviceId,
    html,
    text,
    profile,
    pageProfile,
    schemaTypes,
    ecosystemAssetIds,
    publishingSettings: getServicePublishingSettings(s, serviceId),
  };

  const evidence: Record<AuthorityCategory, SignalEvidence[]> = {
    humanExpertise: auditHumanExpertise(ctx),
    pharmacyLocalAuthority: auditPharmacyLocalAuthority(ctx),
    clinicalTrust: auditClinicalTrust(ctx),
    informationGain: auditInformationGain(ctx),
    aiCitationReadiness: auditAiCitationReadiness(ctx),
    structuredDataReadiness: auditStructuredDataReadiness(ctx),
    contentEcosystemSupport: auditContentEcosystemSupport(ctx),
    technicalPublishReadiness: auditTechnicalPublishReadiness(ctx),
  };

  const categoryScores = Object.fromEntries(
    AUTHORITY_CATEGORIES.map((c) => [c, scoreCategory(evidence[c])]),
  ) as Record<AuthorityCategory, number>;

  const overallScore = Math.round(
    AUTHORITY_CATEGORIES.reduce((sum, c) => sum + categoryScores[c], 0) / AUTHORITY_CATEGORIES.length,
  );

  const missingSignals = AUTHORITY_CATEGORIES.flatMap((c) =>
    evidence[c].filter((e) => !e.present).map((e) => `${AUTHORITY_CATEGORY_LABELS[c]}: ${e.signal}`),
  );

  const criticalIssues: string[] = [];
  const publishing = getServicePublishingSettings(s, serviceId);
  if (!/<h1[^>]*>/i.test(html)) criticalIssues.push("Missing H1 on service page");
  if (!/<meta name="description"/i.test(html)) criticalIssues.push("Missing meta description");
  if (/class="v3-placeholder"|data-image-missing="true"/i.test(html)) criticalIssues.push("Visible image placeholder on page");
  const htmlNoindex = /name="robots"[^>]+noindex|noindex,\s*nofollow/i.test(html);
  if (htmlNoindex && publishing?.noindex !== false) {
    criticalIssues.push("Page marked noindex — remove before live publish");
  }
  if (profile.demoMode || profile.trustDataStatus === "mock") {
    criticalIssues.push("Profile trust data still marked demo/mock — verify live credentials before publish");
  }
  if (categoryScores.technicalPublishReadiness < 50) criticalIssues.push("Technical publish readiness below minimum threshold");

  const label = labelFromScore(overallScore);
  const publishGate = publishGateFrom(overallScore, criticalIssues);

  return {
    serviceId,
    serviceName,
    pageUrl,
    overallScore,
    label,
    publishGate,
    categoryScores,
    missingSignals,
    criticalIssues,
    recommendedEnhancements: buildRecommendations(categoryScores, evidence),
    evidence,
    lastAuditedAt: new Date().toISOString(),
  };
}

export function buildPharmacyAuthorityReadinessDoc(slug: string): PharmacyAuthorityReadinessDoc {
  const s = safeSlug(slug);
  const pageProfile = buildPharmacyServicePageProfile(s);
  const services = VISUAL_EXPERIENCE_BENCHMARK_SERVICES.map((serviceId) => auditServiceAuthorityReadiness(s, serviceId));
  const averageScore = Math.round(services.reduce((sum, svc) => sum + svc.overallScore, 0) / services.length);
  const worstGate = services.some((svc) => svc.publishGate === "FAIL")
    ? "FAIL"
    : services.some((svc) => svc.publishGate === "PASS_WITH_RECOMMENDATIONS")
      ? "PASS_WITH_RECOMMENDATIONS"
      : "PASS";

  return {
    slug: s,
    pharmacyName: pageProfile.pharmacyName,
    updatedAt: new Date().toISOString(),
    version: 1,
    services,
    summary: {
      averageScore,
      label: labelFromScore(averageScore),
      publishGate: worstGate,
      servicesAudited: services.length,
    },
  };
}

export function authorityReadinessPath(slug: string): string {
  fs.mkdirSync(AUTHORITY_READINESS_DIR, { recursive: true });
  return path.join(AUTHORITY_READINESS_DIR, `${safeSlug(slug)}.json`);
}

export function loadPharmacyAuthorityReadiness(slug: string): PharmacyAuthorityReadinessDoc | null {
  const file = authorityReadinessPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PharmacyAuthorityReadinessDoc;
  } catch {
    return null;
  }
}

export function savePharmacyAuthorityReadiness(doc: PharmacyAuthorityReadinessDoc): string {
  const file = authorityReadinessPath(doc.slug);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  return file;
}

export function refreshPharmacyAuthorityReadiness(slug: string): PharmacyAuthorityReadinessDoc {
  const doc = buildPharmacyAuthorityReadinessDoc(slug);
  savePharmacyAuthorityReadiness(doc);
  return doc;
}

function overlayAuthoritativeCanonicalOnAudit(
  slug: string,
  serviceId: string,
  audit: ServiceAuthorityAudit,
): ServiceAuthorityAudit {
  const canonical = resolveAuthoritativePublicationCanonical({ slug, serviceId }).canonicalUrl;
  const tech = audit.evidence?.technicalPublishReadiness;
  if (!Array.isArray(tech) || !tech.some((item) => item.signal === "Canonical")) return audit;
  return {
    ...audit,
    evidence: {
      ...audit.evidence,
      technicalPublishReadiness: tech.map((item) =>
        item.signal === "Canonical" ? { ...item, present: Boolean(canonical), detail: canonical } : item,
      ),
    },
  };
}

export function getServiceAuthorityAudit(slug: string, serviceId: string): ServiceAuthorityAudit | null {
  const doc = loadPharmacyAuthorityReadiness(slug);
  const audit = doc
    ? doc.services.find((s) => s.serviceId === serviceId) || null
    : auditServiceAuthorityReadiness(slug, serviceId as VisualExperienceServiceId);
  return audit ? overlayAuthoritativeCanonicalOnAudit(slug, serviceId, audit) : null;
}

export function buildAuthorityReadinessDashboard(
  slug: string,
  options?: { serviceId?: string },
): AuthorityReadinessDashboard {
  const s = safeSlug(slug);
  const pageProfile = buildPharmacyServicePageProfile(s);
  let doc = loadPharmacyAuthorityReadiness(s);
  if (!doc) doc = refreshPharmacyAuthorityReadiness(s);
  const selectedServiceId =
    options?.serviceId && VISUAL_EXPERIENCE_BENCHMARK_SERVICES.includes(options.serviceId as VisualExperienceServiceId)
      ? options.serviceId
      : doc.services[0]?.serviceId || "pharmacy-first";
  const selectedAuditRaw = doc.services.find((svc) => svc.serviceId === selectedServiceId) || null;
  const selectedAudit = selectedAuditRaw
    ? overlayAuthoritativeCanonicalOnAudit(s, selectedServiceId, selectedAuditRaw)
    : null;
  return {
    slug: s,
    pharmacyName: pageProfile.pharmacyName,
    brandPrimaryColor: pageProfile.brandPrimaryColor,
    doc,
    selectedServiceId,
    selectedAudit,
  };
}

export interface AuthorityPublishGateSnapshot {
  overallScore: number;
  label: AuthorityReadinessLabel;
  publishGate: PublishGate;
  topMissingSignals: string[];
  topCriticalIssues: string[];
  topBlockers: string[];
  launchImpact: string;
  auditUrl: string;
  livePublishReady: boolean;
}

function resolveLaunchImpact(publishGate: PublishGate): string {
  if (publishGate === "PASS") {
    return "Authority audit cleared — no blockers for live publish or indexing.";
  }
  if (publishGate === "PASS_WITH_RECOMMENDATIONS") {
    return "Live publish allowed with recommendations — address missing signals to strengthen E-E-A-T before final sign-off.";
  }
  return "Live publish and indexing blocked until trust, expertise, canonical, noindex and structured readiness blockers are resolved.";
}

export function getAuthorityPublishGateSnapshot(slug: string, serviceId: string): AuthorityPublishGateSnapshot {
  const audit = resolveServiceAuthorityAuditForPublishGate(slug, serviceId);
  const auditUrl = `/api/pharmacy-authority-readiness?slug=${safeSlug(slug)}&service=${serviceId}`;
  if (!audit) {
    return {
      overallScore: 0,
      label: "Not Ready",
      publishGate: "FAIL",
      topMissingSignals: ["Authority audit not run"],
      topCriticalIssues: ["Authority audit not run"],
      topBlockers: ["Authority audit not run"],
      launchImpact: resolveLaunchImpact("FAIL"),
      auditUrl,
      livePublishReady: false,
    };
  }
  const topCriticalIssues = audit.criticalIssues.slice(0, 3);
  const topMissingSignals = audit.missingSignals.slice(0, 3);
  const topBlockers = [...topCriticalIssues, ...topMissingSignals.filter((m) => !topCriticalIssues.includes(m))].slice(0, 3);
  return {
    overallScore: audit.overallScore,
    label: audit.label,
    publishGate: audit.publishGate,
    topMissingSignals,
    topCriticalIssues,
    topBlockers,
    launchImpact: resolveLaunchImpact(audit.publishGate),
    auditUrl,
    livePublishReady: audit.publishGate !== "FAIL",
  };
}

export function getAuthoritySummaryForCampaign(slug: string, serviceId: string): AuthorityPublishGateSnapshot {
  return getAuthorityPublishGateSnapshot(slug, serviceId);
}

export function buildAuthorityGrowthActionDrafts(
  slug: string,
): Array<{
  id: string;
  title: string;
  reason: string;
  evidence: string[];
  recommendedNextStep: string;
  linkedModule: string;
  linkedUrl: string;
  serviceId: string;
  priority: "Critical" | "High" | "Medium";
}> {
  const s = safeSlug(slug);
  const doc = loadPharmacyAuthorityReadiness(s);
  if (!doc) return [];

  const drafts: Array<{
    id: string;
    title: string;
    reason: string;
    evidence: string[];
    recommendedNextStep: string;
    linkedModule: string;
    linkedUrl: string;
    serviceId: string;
    priority: "Critical" | "High" | "Medium";
  }> = [];
  const seen = new Set<string>();

  for (const audit of doc.services) {
    if (audit.publishGate === "PASS") continue;
    const auditUrl = `/api/pharmacy-authority-readiness?slug=${s}&service=${audit.serviceId}`;
    const profileUrl = `/api/pharmacy-profile-dashboard?slug=${s}#section-professional-review`;

    const add = (
      id: string,
      title: string,
      reason: string,
      evidence: string[],
      step: string,
      module: string,
      url: string,
      priority: "Critical" | "High" | "Medium",
    ) => {
      const key = `${audit.serviceId}:${id}`;
      if (seen.has(key)) return;
      seen.add(key);
      drafts.push({
        id: `authority-${audit.serviceId}-${id}`,
        title,
        reason,
        evidence,
        recommendedNextStep: step,
        linkedModule: module,
        linkedUrl: url,
        serviceId: audit.serviceId,
        priority,
      });
    };

    for (const issue of audit.criticalIssues) {
      const lower = issue.toLowerCase();
      if (lower.includes("noindex")) {
        add(
          "remove-noindex",
          `Remove noindex before live publish (${audit.serviceName})`,
          "Authority audit flagged noindex on the service page — blocks live indexing.",
          [issue],
          "Remove noindex meta tag before submitting for live publish.",
          "Authority Audit",
          auditUrl,
          "Critical",
        );
      } else if (lower.includes("demo") || lower.includes("mock")) {
        add(
          "replace-demo-trust",
          `Replace demo trust profile with verified pharmacy details (${audit.serviceName})`,
          "Profile trust data still marked demo/mock — verify live credentials before publish.",
          [issue],
          "Update superintendent, GPhC and NHS links with verified live credentials.",
          "Profile Dashboard",
          profileUrl,
          "Critical",
        );
      }
    }

    for (const signal of audit.missingSignals) {
      const lower = signal.toLowerCase();
      if (lower.includes("reviewer") || lower.includes("named pharmacist")) {
        add(
          "add-reviewer",
          `Add named professional reviewer (${audit.serviceName})`,
          "Human expertise signal missing — named pharmacist or clinical reviewer required.",
          [signal],
          "Add reviewer name, role and qualifications in Profile Dashboard.",
          "Profile Dashboard",
          profileUrl,
          "High",
        );
      } else if (lower.includes("review date") && !lower.includes("next review")) {
        add(
          "add-clinical-review-date",
          `Add clinical review date (${audit.serviceName})`,
          "Formal clinical review date missing from authority audit.",
          [signal],
          "Set clinicalReviewDate in Profile Dashboard professional review section.",
          "Profile Dashboard",
          profileUrl,
          "High",
        );
      } else if (lower.includes("next review")) {
        add(
          "add-next-review-date",
          `Add next review date (${audit.serviceName})`,
          "Scheduled next review date missing — required for clinical trust signals.",
          [signal],
          "Set nextReviewDate in Profile Dashboard professional review section.",
          "Profile Dashboard",
          profileUrl,
          "High",
        );
      } else if (lower.includes("canonical")) {
        add(
          "add-canonical",
          `Add canonical URL (${audit.serviceName})`,
          "Technical publish readiness blocked — canonical URL missing.",
          [signal],
          "Review authority audit technical signals and confirm canonical before live publish.",
          "Authority Audit",
          auditUrl,
          "Critical",
        );
      }
    }

    if (audit.publishGate === "FAIL" && audit.criticalIssues.length === 0 && audit.missingSignals.length > 0) {
      add(
        "resolve-authority-blockers",
        `Resolve Authority & AI Readiness blockers (${audit.serviceName})`,
        "Publish gate failed — address missing authority signals before live publish.",
        audit.missingSignals.slice(0, 3),
        "Review full authority audit and close top blockers.",
        "Authority Audit",
        auditUrl,
        "Critical",
      );
    }
  }

  return drafts;
}
