/**
 * PharmaConnect Authority Enhancement Engine V1 — advisory improvement consultant.
 * Read-only: analyses existing pages, profile, ecosystem, competitor and bridge data.
 * Does NOT modify content, masters, templates or publish anything.
 */
import fs from "node:fs";
import path from "node:path";
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
import { getServiceAuthorityAudit, WORKSPACE_ROOT } from "./pharmacyAuthorityReadinessService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { readPharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";
import { loadGapAnalysis } from "./pharmacyCompetitorGapAnalysis.ts";
import { loadOpportunityEngineResult } from "./pharmacyOpportunityEngine.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { isReviewerProfileComplete } from "./pharmacyRealEnhancementActionsService.ts";
import { getServicePublishingSettings } from "./pharmacyPublishingSettingsService.ts";

export const AUTHORITY_ENHANCEMENT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-authority-enhancements");

export const ENHANCEMENT_CATEGORIES = [
  "humanExpertise",
  "localAuthority",
  "informationGain",
  "aiCitation",
  "clinicalTrust",
  "contentDepth",
  "contentEcosystem",
  "technicalQuality",
  "competitorDifferentiation",
  "patientExperience",
] as const;

export type EnhancementCategory = (typeof ENHANCEMENT_CATEGORIES)[number];

export const ENHANCEMENT_CATEGORY_LABELS: Record<EnhancementCategory, string> = {
  humanExpertise: "Human Expertise",
  localAuthority: "Local Authority",
  informationGain: "Information Gain",
  aiCitation: "AI Citation",
  clinicalTrust: "Clinical Trust",
  contentDepth: "Content Depth",
  contentEcosystem: "Content Ecosystem",
  technicalQuality: "Technical Quality",
  competitorDifferentiation: "Competitor Differentiation",
  patientExperience: "Patient Experience",
};

export type EnhancementDifficulty = "Easy" | "Medium" | "Advanced";
export type EnhancementImpact = "Low" | "Medium" | "High";

export interface EnhancementSignal {
  id: string;
  label: string;
  category: EnhancementCategory;
  present: boolean;
  detail: string;
}

export interface EnhancementRecommendation {
  id: string;
  title: string;
  category: EnhancementCategory;
  reason: string;
  evidence: string[];
  difficulty: EnhancementDifficulty;
  estimatedImpact: EnhancementImpact;
  estimatedScoreGain: number;
  estimatedAiGain: number;
  estimatedVisibilityGain: number;
  linkedModule: string;
  linkedUrl: string;
  recommendedNextAction: string;
  signalId: string;
}

export interface EnhancementCategoryScore {
  category: EnhancementCategory;
  label: string;
  signalCount: number;
  presentCount: number;
  currentScore: number;
  potentialScore: number;
  improvementPotential: number;
  opportunityScore: number;
  estimatedAuthorityGain: number;
  estimatedAiCitationGain: number;
  estimatedLocalVisibilityGain: number;
}

export interface ServiceAuthorityEnhancement {
  serviceId: string;
  serviceName: string;
  pageUrl: string;
  currentAuthorityScore: number;
  potentialAuthorityScore: number;
  estimatedOverallImprovement: number;
  totalRecommendations: number;
  easyWins: number;
  highImpactImprovements: number;
  categoryScores: EnhancementCategoryScore[];
  signals: EnhancementSignal[];
  recommendations: EnhancementRecommendation[];
  topRecommendations: EnhancementRecommendation[];
  lastAnalysedAt: string;
}

export interface PharmacyAuthorityEnhancementDoc {
  slug: string;
  pharmacyName: string;
  version: 1;
  updatedAt: string;
  summary: {
    averageCurrentScore: number;
    averagePotentialScore: number;
    totalRecommendations: number;
    easyWins: number;
    highImpactImprovements: number;
    estimatedOverallImprovement: number;
    servicesAnalysed: number;
  };
  services: ServiceAuthorityEnhancement[];
}

export interface AuthorityEnhancementDashboard {
  slug: string;
  pharmacyName: string;
  brandPrimaryColor: string;
  doc: PharmacyAuthorityEnhancementDoc;
  selectedServiceId: string;
  selectedEnhancement: ServiceAuthorityEnhancement | null;
}

interface SignalDef {
  id: string;
  label: string;
  category: EnhancementCategory;
  check: (ctx: EnhancementContext) => { present: boolean; detail: string };
  difficulty: EnhancementDifficulty;
  impact: EnhancementImpact;
  scoreGain: number;
  aiGain: number;
  visibilityGain: number;
  linkedModule: string;
  linkedUrl: (ctx: EnhancementContext) => string;
  nextAction: string;
  reason: string;
}

interface EnhancementContext {
  slug: string;
  serviceId: VisualExperienceServiceId;
  serviceName: string;
  html: string;
  text: string;
  profile: PharmacyProfileData;
  pageProfile: ReturnType<typeof buildPharmacyServicePageProfile>;
  schemaTypes: Set<string>;
  ecosystemAssetIds: string[];
  publishingSettings: ReturnType<typeof getServicePublishingSettings>;
  competitorGapLevel: string | null;
  competitorCoveragePct: number;
  visibilityStatus: string;
  indexingStatus: string;
  growthActionCount: number;
  opportunityCount: number;
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

function includes(text: string, ...needles: string[]): boolean {
  const hay = text.toLowerCase();
  return needles.some((n) => n && hay.includes(n.toLowerCase()));
}

function getJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  for (const m of html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    try {
      blocks.push(JSON.parse(m[1] ?? ""));
    } catch {
      /* skip */
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

function visualPagePath(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, VISUAL_EXPERIENCE_ROOT, safeSlug(slug), serviceId, "index.html");
}

function ecosystemIndexPath(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", safeSlug(slug), serviceId, "_ecosystem-index.json");
}

function profileUrl(ctx: EnhancementContext, hash = ""): string {
  return `/api/pharmacy-profile-dashboard?slug=${ctx.slug}${hash}`;
}

function auditUrl(ctx: EnhancementContext): string {
  return `/api/pharmacy-authority-readiness?slug=${ctx.slug}&service=${ctx.serviceId}`;
}

function enhancementUrl(ctx: EnhancementContext): string {
  return `/api/pharmacy-authority-enhancements?slug=${ctx.slug}&service=${ctx.serviceId}`;
}

function campaignUrl(ctx: EnhancementContext): string {
  return `/api/pharmacy-campaigns?slug=${ctx.slug}&serviceId=${ctx.serviceId}`;
}

function ecosystemUrl(ctx: EnhancementContext): string {
  return `/api/pharmacy-content-ecosystem-preview/${ctx.serviceId}/`;
}

function competitorUrl(ctx: EnhancementContext): string {
  return `/api/pharmacy-competitor-dashboard?slug=${ctx.slug}`;
}

function sig(
  id: string,
  label: string,
  category: EnhancementCategory,
  check: SignalDef["check"],
  opts: Partial<Omit<SignalDef, "id" | "label" | "category" | "check">> & Pick<SignalDef, "reason" | "nextAction">,
): SignalDef {
  return {
    id,
    label,
    category,
    check,
    difficulty: opts.difficulty ?? "Medium",
    impact: opts.impact ?? "Medium",
    scoreGain: opts.scoreGain ?? 2,
    aiGain: opts.aiGain ?? (category === "aiCitation" ? 3 : 1),
    visibilityGain: opts.visibilityGain ?? (category === "localAuthority" ? 3 : 1),
    linkedModule: opts.linkedModule ?? "Authority Enhancement",
    linkedUrl: opts.linkedUrl ?? enhancementUrl,
    reason: opts.reason,
    nextAction: opts.nextAction,
  };
}

function buildSignalDefinitions(): SignalDef[] {
  const defs: SignalDef[] = [];

  // ── 1 HUMAN EXPERTISE (15) ──
  defs.push(
    sig("he-reviewer-bio", "Reviewer biography", "humanExpertise", (c) => ({
      present: isReviewerProfileComplete(c.profile) || (includes(c.text, "bio", "background", "qualified", "experience as") && includes(c.text, c.profile.superintendentPharmacistName?.split(" ")[0] || "pharmacist")),
      detail: c.profile.reviewerBio || "Professional biography for named reviewer",
    }), { reason: "Named reviewer biography strengthens E-E-A-T and patient trust.", nextAction: "Add reviewer bio in Profile Dashboard professional review section.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c, "#section-professional-review"), impact: "High", scoreGain: 4 }),
    sig("he-years-experience", "Years experience stated", "humanExpertise", (c) => ({
      present: Boolean(c.profile.yearsServingCommunity) || includes(c.text, "years", "decades", "serving"),
      detail: c.profile.yearsServingCommunity || "Years of experience not stated",
    }), { reason: "Years of community service signals established local expertise.", nextAction: "Add yearsServingCommunity in profile trust section.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c, "#section-trust"), difficulty: "Easy", scoreGain: 3 }),
    sig("he-professional-interests", "Professional interests", "humanExpertise", (c) => ({
      present: includes(c.text, "special interest", "clinical interest", "passionate about", "focus on"),
      detail: "Clinical or professional interests mentioned",
    }), { reason: "Professional interests humanise expertise beyond generic pharmacy copy.", nextAction: "Add 2–3 clinical interests for the superintendent pharmacist.", impact: "Medium", scoreGain: 2 }),
    sig("he-specialist-services", "Specialist services expertise", "humanExpertise", (c) => ({
      present: includes(c.text, "specialist", "specialise", "expert in", "trained in"),
      detail: "Specialist service expertise referenced",
    }), { reason: "Specialist credentials differentiate from generic AI pharmacy content.", nextAction: "Highlight pharmacist training relevant to this service.", scoreGain: 3 }),
    sig("he-independent-prescriber", "Independent prescriber", "humanExpertise", (c) => ({
      present: includes(c.text, "independent prescriber", "prescribing pharmacist", "ip qualification"),
      detail: "Independent prescriber status",
    }), { reason: "Independent prescriber status is a strong clinical authority signal.", nextAction: "State IP qualification if applicable in trust layer.", impact: "High", scoreGain: 4 }),
    sig("he-languages-spoken", "Languages spoken", "humanExpertise", (c) => ({
      present: (c.profile.languagesSpoken?.length || 0) > 0 || includes(c.text, "language", "urdu", "punjabi", "polish"),
      detail: (c.profile.languagesSpoken || []).join(", ") || "Languages not listed",
    }), { reason: "Multilingual support improves local accessibility and trust.", nextAction: "Add languagesSpoken in profile and surface on service page.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c), difficulty: "Easy", scoreGain: 2, visibilityGain: 2 }),
    sig("he-community-involvement", "Community involvement", "humanExpertise", (c) => ({
      present: includes(c.text, "community", "local group", "charity", "sponsor", "volunteer"),
      detail: "Community involvement referenced",
    }), { reason: "Community ties reinforce local authority beyond clinical facts.", nextAction: "Add community pharmacy involvement examples.", scoreGain: 2, visibilityGain: 3 }),
    sig("he-clinical-interests", "Clinical interests", "humanExpertise", (c) => ({
      present: includes(c.text, "clinical area", "women's health", "diabetes", "respiratory", "vaccination"),
      detail: "Specific clinical interest areas",
    }), { reason: "Named clinical interests support topical authority.", nextAction: "Reference relevant clinical focus areas for this service.", scoreGain: 2 }),
    sig("he-professional-memberships", "Professional memberships", "humanExpertise", (c) => ({
      present: (c.profile.accreditations?.length || 0) > 0 || includes(c.text, "member of", "rps", "royal pharmaceutical", "cppe"),
      detail: (c.profile.accreditations || []).join(", ") || "No memberships listed",
    }), { reason: "Professional body membership validates ongoing clinical standards.", nextAction: "Add accreditations in profile.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c), difficulty: "Easy", scoreGain: 3 }),
    sig("he-professional-photo", "Professional photo", "humanExpertise", (c) => {
      const slots = buildPageSlotCards(c.slug, c.serviceId);
      const trustAssigned = slots.find((s) => s.slot === "trust")?.status === "assigned";
      return {
        present: Boolean(c.profile.reviewerPhoto) || trustAssigned || /trust.*img|superintendent.*img|professional.*photo|reviewer.*img/i.test(c.html),
        detail: "Professional reviewer photo on page",
      };
    }, { reason: "Professional photo increases human trust and E-E-A-T.", nextAction: "Assign trust slot image with pharmacist headshot.", linkedModule: "Image Library", linkedUrl: (c) => `/api/pharmacy-image-library?slug=${c.slug}&service=${c.serviceId}&slot=trust`, impact: "Medium", scoreGain: 3 }),
    sig("he-review-frequency", "Review frequency stated", "humanExpertise", (c) => ({
      present: Boolean(c.profile.clinicalReviewDate) || includes(c.text, "reviewed annually", "review cycle", "reviewed every", "review schedule"),
      detail: c.profile.clinicalReviewDate || "Content review frequency",
    }), { reason: "Review frequency demonstrates ongoing clinical governance.", nextAction: "Set clinicalReviewDate in Profile Dashboard.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c, "#section-professional-review"), scoreGain: 2 }),
    sig("he-clinical-review-workflow", "Clinical review workflow", "humanExpertise", (c) => ({
      present: includes(c.text, "clinical review", "reviewed by", "review process", "governance"),
      detail: "Clinical review workflow described",
    }), { reason: "Visible review workflow supports YMYL trust requirements.", nextAction: "Describe clinical review process in trust section.", impact: "High", scoreGain: 4 }),
    sig("he-named-accountability", "Named accountability", "humanExpertise", (c) => ({
      present: isReviewerProfileComplete(c.profile) || (Boolean(c.profile.superintendentPharmacistName) && includes(c.text, c.profile.superintendentPharmacistName.split(" ")[0] || "")),
      detail: c.profile.reviewerName || c.profile.superintendentPharmacistName || "No named accountable pharmacist",
    }), { reason: "Named accountability is required for strong human expertise signals.", nextAction: "Complete reviewer profile in Profile Dashboard.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c, "#section-professional-review"), impact: "High", scoreGain: 5 }),
    sig("he-reviewer-schema", "Reviewer schema opportunity", "humanExpertise", (c) => ({
      present: c.schemaTypes.has("Person") && includes(c.html, "reviewedBy"),
      detail: c.schemaTypes.has("Person") ? "Person schema present" : "Person / reviewedBy schema missing",
    }), { reason: "Person schema helps search engines attribute clinical expertise.", nextAction: "Add Person schema with reviewer credentials.", difficulty: "Advanced", impact: "High", scoreGain: 4, aiGain: 4 }),
    sig("he-patient-trust-wording", "Patient trust wording", "humanExpertise", (c) => ({
      present: includes(c.text, "registered pharmacist", "gphc", "accountable", "professional standards"),
      detail: "Patient-facing trust wording",
    }), { reason: "Clear trust wording reassures patients about professional oversight.", nextAction: "Strengthen trust statements near service introduction.", difficulty: "Easy", scoreGain: 2 }),
    sig("he-professional-review-panel", "Professional review panel", "humanExpertise", (c) => ({
      present: /trust-panel|review-panel|professional-review|data-template-block="trust"/i.test(c.html),
      detail: "Dedicated professional review panel",
    }), { reason: "Visible review panel separates expertise from marketing copy.", nextAction: "Ensure trust template block shows reviewer details.", scoreGain: 3 }),
  );

  // ── 2 LOCAL AUTHORITY (15) ──
  defs.push(
    sig("la-coverage-areas", "Coverage areas", "localAuthority", (c) => ({
      present: (c.profile.rankingAreas?.length || 0) > 0 && includes(c.text, ...(c.profile.rankingAreas || []).slice(0, 2)),
      detail: (c.profile.rankingAreas || []).join(", ") || "Coverage areas not on page",
    }), { reason: "Named coverage areas strengthen local relevance signals.", nextAction: "Surface rankingAreas in local access section.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c, "#section-coverage"), difficulty: "Easy", visibilityGain: 5, scoreGain: 4 }),
    sig("la-neighbourhood-mentions", "Neighbourhood mentions", "localAuthority", (c) => ({
      present: (c.profile.nearbyAreas?.length || 0) > 0 && includes(c.text, ...(c.profile.nearbyAreas || []).slice(0, 2)),
      detail: (c.profile.nearbyAreas || []).slice(0, 4).join(", ") || "No neighbourhood mentions",
    }), { reason: "Neighbourhood names differentiate from generic national content.", nextAction: "Add nearbyAreas references in local section.", visibilityGain: 4, scoreGain: 3 }),
    sig("la-directions", "Directions guidance", "localAuthority", (c) => ({
      present: includes(c.text, "directions", "how to find", "located on", "turn left", "opposite"),
      detail: "Practical directions",
    }), { reason: "Directions help local patients and map pack relevance.", nextAction: "Add brief directions from main roads.", visibilityGain: 3, scoreGain: 2 }),
    sig("la-parking", "Parking information", "localAuthority", (c) => ({
      present: includes(c.text, "parking", "car park", "free parking", "on-site parking"),
      detail: "Parking information",
    }), { reason: "Parking is a top local patient question unlikely on AI summaries.", nextAction: "Add parking availability near local access.", visibilityGain: 4, scoreGain: 3 }),
    sig("la-public-transport", "Public transport", "localAuthority", (c) => ({
      present: includes(c.text, "bus", "tram", "train", "metro", "public transport"),
      detail: "Public transport access",
    }), { reason: "Transport links support local journey planning.", nextAction: "Mention nearest bus or tram stops.", scoreGain: 2, visibilityGain: 3 }),
    sig("la-disabled-access", "Disabled access", "localAuthority", (c) => ({
      present: includes(c.text, "wheelchair", "disabled access", "step-free", "accessible"),
      detail: "Accessibility information",
    }), { reason: "Accessibility information improves inclusivity and local usefulness.", nextAction: "State step-free access if available.", scoreGain: 2 }),
    sig("la-opening-hours-detail", "Opening hours detail", "localAuthority", (c) => ({
      present: includes(c.text, "monday", "tuesday", "open until", "closed") || /openingHours/i.test(c.html),
      detail: "Detailed opening hours",
    }), { reason: "Detailed hours support local pack and patient planning.", nextAction: "Ensure daily hours appear in local section.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c), difficulty: "Easy", visibilityGain: 4, scoreGain: 3 }),
    sig("la-collection-options", "Collection options", "localAuthority", (c) => ({
      present: includes(c.text, "collect", "collection", "ready for collection", "pick up"),
      detail: "Prescription collection options",
    }), { reason: "Collection workflow is pharmacy-specific local utility.", nextAction: "Describe prescription collection process.", scoreGain: 2 }),
    sig("la-delivery", "Delivery service", "localAuthority", (c) => ({
      present: c.profile.homeDeliveryAvailable || includes(c.text, "delivery", "deliver to"),
      detail: "Delivery availability",
    }), { reason: "Delivery options are key local differentiators.", nextAction: "State delivery areas if offered.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c), scoreGain: 2, visibilityGain: 3 }),
    sig("la-local-landmarks", "Local landmarks", "localAuthority", (c) => ({
      present: includes(c.text, "near", "next to", "opposite", "behind", "adjacent"),
      detail: "Local landmark references",
    }), { reason: "Landmarks help patients find the pharmacy and boost local uniqueness.", nextAction: "Reference a well-known local landmark.", visibilityGain: 4, scoreGain: 2 }),
    sig("la-nearby-surgeries", "Nearby surgeries", "localAuthority", (c) => ({
      present: includes(c.text, "gp surgery", "medical centre", "health centre", "doctor"),
      detail: "Nearby GP / surgery references",
    }), { reason: "GP relationships signal integrated local healthcare.", nextAction: "Mention local GP partnerships if applicable.", scoreGain: 2, visibilityGain: 2 }),
    sig("la-nearby-hospitals", "Nearby hospitals", "localAuthority", (c) => ({
      present: includes(c.text, "hospital", "a&e", "urgent treatment centre"),
      detail: "Hospital proximity context",
    }), { reason: "Hospital context helps escalation and local health journey.", nextAction: "Reference nearest hospital for urgent care context.", scoreGain: 2 }),
    sig("la-emergency-services", "Emergency services guidance", "localAuthority", (c) => ({
      present: includes(c.text, "999", "emergency", "a&e", "nhs 111"),
      detail: "Emergency services guidance",
    }), { reason: "Emergency guidance is essential YMYL local trust content.", nextAction: "Clarify when to use 999 vs pharmacy vs GP.", impact: "High", scoreGain: 4 }),
    sig("la-out-of-hours", "Out-of-hours advice", "localAuthority", (c) => ({
      present: includes(c.text, "out of hours", "outside opening", "when we are closed", "111"),
      detail: "Out-of-hours patient advice",
    }), { reason: "Out-of-hours guidance reduces patient uncertainty.", nextAction: "Add what to do when pharmacy is closed.", scoreGain: 3 }),
    sig("la-nhs-integration", "Local NHS integration", "localAuthority", (c) => ({
      present: c.profile.nhsServicesAvailable !== false && includes(c.text, "nhs", "integrated care", "icb", "primary care network"),
      detail: "NHS integration referenced",
    }), { reason: "NHS integration signals legitimate local healthcare role.", nextAction: "Reference NHS service delivery context.", scoreGain: 3 }),
    sig("la-patient-journey", "Local patient journey", "localAuthority", (c) => ({
      present: includes(c.text, "when you arrive", "at our pharmacy", "visit us", "your visit"),
      detail: "Local visit journey described",
    }), { reason: "Local patient journey content adds information gain.", nextAction: "Describe step-by-step visit experience.", scoreGain: 3, visibilityGain: 2 }),
    sig("la-town-faqs", "Town-specific FAQs", "localAuthority", (c) => ({
      present: includes(c.text, c.pageProfile.town) && (c.html.match(/faq-q|cluster-faq-item/gi) || []).length >= 2,
      detail: "Town mentioned in FAQs",
    }), { reason: "Town-specific FAQs target local long-tail queries.", nextAction: "Add FAQs mentioning your town and nearby areas.", visibilityGain: 5, scoreGain: 4, aiGain: 3 }),
    sig("la-community-references", "Community references", "localAuthority", (c) => ({
      present: includes(c.text, "community", "local residents", "families in", "patients in"),
      detail: "Community-focused language",
    }), { reason: "Community references reinforce hyperlocal relevance.", nextAction: "Use community-focused language in local section.", scoreGain: 2, visibilityGain: 2 }),
    sig("la-gbp-consistency", "GBP consistency", "localAuthority", (c) => ({
      present: Boolean(c.profile.googleBusinessProfileUrl) || Boolean(c.profile.googlePlaceId),
      detail: c.profile.googleBusinessProfileUrl ? "GBP URL in profile" : "GBP not linked in profile",
    }), { reason: "GBP consistency supports local pack and NAP alignment.", nextAction: "Link googleBusinessProfileUrl in profile.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c), difficulty: "Easy", visibilityGain: 5, scoreGain: 3 }),
  );

  // ── 3 INFORMATION GAIN (15) ──
  const infoSignals: Array<[string, string, string, string]> = [
    ["ig-arrival", "What happens when you arrive", "when you arrive", "Arrival process not described"],
    ["ig-consultation-time", "Average consultation time", "minutes", "Consultation duration not stated"],
    ["ig-documents-bring", "Documents to bring", "bring", "Patient preparation list missing"],
    ["ig-prescription-collection", "Prescription collection", "prescription", "Collection process unclear"],
    ["ig-private-alternatives", "Private alternatives", "private", "Private options not mentioned"],
    ["ig-seasonal-advice", "Seasonal advice", "season", "Seasonal context missing"],
    ["ig-busy-periods", "Busy periods", "busy", "Peak times not mentioned"],
    ["ig-walk-in", "Walk-in expectations", "walk-in", "Walk-in guidance missing"],
    ["ig-appointment-expect", "Appointment expectations", "appointment", "Appointment process unclear"],
    ["ig-aftercare", "Aftercare guidance", "aftercare", "Aftercare not covered"],
    ["ig-referral-pathway", "Referral pathway", "refer", "Referral pathway unclear"],
    ["ig-patient-prep", "Patient preparation", "prepare", "Preparation steps missing"],
    ["ig-practical-advice", "Practical advice", "tip", "Practical tips missing"],
    ["ig-misconceptions", "Common misconceptions", "myth", "Misconceptions not addressed"],
    ["ig-typical-questions", "Typical patient questions", "patients often ask", "Common questions not surfaced"],
  ];
  for (const [id, label, needle, missing] of infoSignals) {
    defs.push(
      sig(id, label, "informationGain", (c) => ({
        present: includes(c.text, needle, label.toLowerCase().split(" ").pop() || needle),
        detail: includes(c.text, needle) ? "Present in page copy" : missing,
      }), {
        reason: `${label} adds unique pharmacy-specific value unlikely on generic AI pages.`,
        nextAction: `Add a short section covering: ${label.toLowerCase()}.`,
        impact: "Medium",
        scoreGain: 3,
        aiGain: 2,
      }),
    );
  }

  // ── 4 AI CITATION (15) ──
  defs.push(
    sig("ai-definition-blocks", "Definition blocks", "aiCitation", (c) => ({
      present: includes(c.text, "is a", "is an", "refers to", "means") && includes(c.text, "service", "pharmacy"),
      detail: "Clear service definition",
    }), { reason: "Definition blocks are highly citable by AI systems.", nextAction: "Add a 2-sentence plain-English service definition.", aiGain: 5, impact: "High", scoreGain: 4 }),
    sig("ai-short-answers", "Short factual answers", "aiCitation", (c) => ({
      present: (c.html.match(/<p[^>]*>[^<]{40,200}<\/p>/gi) || []).length >= 5,
      detail: "Concise answer paragraphs",
    }), { reason: "Short factual paragraphs are ideal AI citation candidates.", nextAction: "Break long paragraphs into concise factual blocks.", aiGain: 4, scoreGain: 3 }),
    sig("ai-faq-quality", "FAQ quality", "aiCitation", (c) => ({
      present: (c.html.match(/faq-q|cluster-faq-item/gi) || []).length >= 5,
      detail: `${(c.html.match(/faq-q|cluster-faq-item/gi) || []).length} FAQ items`,
    }), { reason: "Quality FAQs directly feed AI answer engines.", nextAction: "Expand FAQs to 6+ service-specific questions.", aiGain: 5, impact: "High", scoreGain: 4 }),
    sig("ai-entity-clarity", "Entity clarity", "aiCitation", (c) => ({
      present: includes(c.text, c.pageProfile.pharmacyName) && includes(c.text, c.pageProfile.town),
      detail: "Pharmacy and location entities clear",
    }), { reason: "Clear entity naming helps AI attribute facts correctly.", nextAction: "Lead with pharmacy name + town in opening paragraph.", aiGain: 3, difficulty: "Easy", scoreGain: 2 }),
    sig("ai-service-summary", "Service summaries", "aiCitation", (c) => ({
      present: /<meta name="description"[^>]+content="[^"]{50,}"/i.test(c.html),
      detail: "Meta service summary",
    }), { reason: "Service summaries provide citable overview text.", nextAction: "Optimise meta description as factual summary.", aiGain: 3, scoreGain: 2 }),
    sig("ai-bullet-explanations", "Bullet explanations", "aiCitation", (c) => ({
      present: (c.html.match(/<li[^>]*>/gi) || []).length >= 6,
      detail: "Bullet point explanations",
    }), { reason: "Bullets are easily extracted by AI summarisation.", nextAction: "Convert dense paragraphs to bullet lists where appropriate.", aiGain: 4, scoreGain: 2 }),
    sig("ai-evidence-backed", "Evidence-backed statements", "aiCitation", (c) => ({
      present: includes(c.text, "nhs", "clinical", "guidance", "recommended", "evidence"),
      detail: "Evidence-backed claims",
    }), { reason: "Evidence references increase citation trustworthiness.", nextAction: "Reference NHS or clinical guidance where applicable.", aiGain: 4, scoreGain: 3 }),
    sig("ai-clear-terminology", "Clear terminology", "aiCitation", (c) => ({
      present: includes(c.text, "also known as", "called", "term", "means"),
      detail: "Terminology explained",
    }), { reason: "Defined terminology reduces AI misinterpretation.", nextAction: "Define key clinical terms in plain English.", aiGain: 3, scoreGain: 2 }),
    sig("ai-direct-answers", "Direct answers", "aiCitation", (c) => ({
      present: (c.html.match(/\?<\/|faq-a|answer:/gi) || []).length >= 3,
      detail: "Direct Q&A answer format",
    }), { reason: "Direct answer format matches AI retrieval patterns.", nextAction: "Structure FAQs as explicit question-answer pairs.", aiGain: 5, scoreGain: 3 }),
    sig("ai-context-blocks", "Context blocks", "aiCitation", (c) => ({
      present: includes(c.text, "in the uk", "in england", "for patients", "at a pharmacy"),
      detail: "Contextual framing blocks",
    }), { reason: "Context blocks anchor facts to UK pharmacy setting.", nextAction: "Add UK pharmacy context to key sections.", aiGain: 3, scoreGain: 2 }),
    sig("ai-myth-fact", "Myth vs fact", "aiCitation", (c) => ({
      present: includes(c.text, "myth", "fact", "misconception", "true or false"),
      detail: "Myth vs fact content",
    }), { reason: "Myth/fact sections are highly shared by AI systems.", nextAction: "Add 2–3 myth vs fact items for this service.", aiGain: 5, impact: "High", scoreGain: 3 }),
    sig("ai-quick-reference", "Quick reference tables", "aiCitation", (c) => ({
      present: /<table/i.test(c.html) || includes(c.text, "quick reference", "at a glance"),
      detail: "Quick reference format",
    }), { reason: "Reference tables provide structured citable data.", nextAction: "Add a quick-reference table (e.g. eligibility, times, costs).", aiGain: 4, scoreGain: 3 }),
    sig("ai-h2-structure", "Structured H2 sections", "aiCitation", (c) => ({
      present: (c.html.match(/<h2[^>]*>/gi) || []).length >= 5,
      detail: `${(c.html.match(/<h2[^>]*>/gi) || []).length} H2 sections`,
    }), { reason: "Structured headings help AI segment citable content.", nextAction: "Ensure 5+ descriptive H2 sections.", aiGain: 3, difficulty: "Easy", scoreGain: 2 }),
    sig("ai-local-answers", "Local service answers", "aiCitation", (c) => ({
      present: includes(c.text, c.pageProfile.town) && (c.html.match(/faq-q|cluster-faq-item/gi) || []).length >= 3,
      detail: "Localised FAQ answers",
    }), { reason: "Local answers differentiate from national AI responses.", nextAction: "Localise FAQ answers with town and pharmacy name.", aiGain: 4, visibilityGain: 3, scoreGain: 3 }),
    sig("ai-attribution", "Expert attribution", "aiCitation", (c) => ({
      present: includes(c.text, "reviewed by", "superintendent", "pharmacist"),
      detail: "Expert attribution for citations",
    }), { reason: "Attribution links facts to accountable experts.", nextAction: "Add 'Reviewed by [Name], Superintendent Pharmacist'.", aiGain: 4, impact: "High", scoreGain: 3 }),
  );

  // ── 5 CLINICAL TRUST (15) ──
  const clinicalSignals: Array<[string, string, ...string[]]> = [
    ["ct-safety-wording", "Safety wording", "safety", "warning", "caution"],
    ["ct-escalation", "Escalation pathways", "escalat", "refer", "gp", "111"],
    ["ct-eligibility", "Eligibility criteria", "eligible", "who can", "qualify"],
    ["ct-exclusions", "Exclusions stated", "not eligible", "exclusion", "cannot"],
    ["ct-red-flags", "Red flags", "red flag", "seek urgent", "999"],
    ["ct-what-next", "What happens next", "next step", "what happens", "then we"],
    ["ct-clinical-review", "Clinical review noted", "clinical review", "reviewed by"],
    ["ct-review-schedule", "Review schedule", "next review", "review date"],
    ["ct-reassurance", "Patient reassurance", "reassur", "comfort", "support you"],
    ["ct-outcomes", "Expected outcomes", "outcome", "expect", "result"],
    ["ct-limitations", "Service limitations", "not suitable", "limitation", "cannot treat"],
    ["ct-consultation-process", "Consultation process", "consultation", "assessment", "private room"],
    ["ct-follow-up", "Follow-up guidance", "follow-up", "follow up", "return if"],
    ["ct-medication-safety", "Medication safety", "medication", "drug interaction", "allergy"],
    ["ct-child-eligibility", "Paediatric eligibility", "child", "under 16", "paediatric"],
  ];
  for (const [id, label, ...needles] of clinicalSignals) {
    defs.push(
      sig(id, label, "clinicalTrust", (c) => {
        if (id === "ct-clinical-review") {
          return {
            present: Boolean(c.profile.clinicalReviewDate) || includes(c.text, ...needles),
            detail: c.profile.clinicalReviewDate || (includes(c.text, ...needles) ? "Present" : `${label} not detected`),
          };
        }
        if (id === "ct-review-schedule") {
          return {
            present: Boolean(c.profile.nextReviewDate) || includes(c.text, ...needles),
            detail: c.profile.nextReviewDate || (includes(c.text, ...needles) ? "Present" : `${label} not detected`),
          };
        }
        return {
          present: includes(c.text, ...needles),
          detail: includes(c.text, ...needles) ? "Present" : `${label} not detected`,
        };
      }, {
        reason: `${label} is essential YMYL clinical trust content.`,
        nextAction: `Add or strengthen ${label.toLowerCase()} in clinical sections.`,
        impact: id === "ct-red-flags" || id === "ct-eligibility" ? "High" : "Medium",
        scoreGain: id.startsWith("ct-red") || id.startsWith("ct-elig") ? 4 : 3,
      }),
    );
  }

  // ── 6 CONTENT DEPTH (15) ──
  defs.push(
    sig("cd-topic-coverage", "Topic coverage", "contentDepth", (c) => ({ present: c.text.split(/\s+/).length >= 1200, detail: `~${c.text.split(/\s+/).length} words` }), { reason: "Comprehensive topic coverage supports topical authority.", nextAction: "Expand thin sections using ecosystem assets.", scoreGain: 4 }),
    sig("cd-topic-completeness", "Topic completeness", "contentDepth", (c) => ({ present: (c.html.match(/<h2[^>]*>/gi) || []).length >= 6, detail: "Section completeness" }), { reason: "Complete topic coverage across standard sections.", nextAction: "Review master section checklist for gaps.", scoreGain: 3 }),
    sig("cd-section-balance", "Section balance", "contentDepth", (c) => ({ present: !/lorem ipsum|placeholder text/i.test(c.text), detail: "Balanced sections" }), { reason: "Balanced sections avoid thin or bloated areas.", nextAction: "Audit section word counts for balance.", scoreGain: 2 }),
    sig("cd-readability", "Readability", "contentDepth", (c) => ({ present: (c.html.match(/<p[^>]*>/gi) || []).length >= 10, detail: "Paragraph structure" }), { reason: "Good readability improves engagement and quality signals.", nextAction: "Break long blocks into scannable paragraphs.", difficulty: "Easy", scoreGain: 2 }),
    sig("cd-examples", "Supporting examples", "contentDepth", (c) => ({ present: includes(c.text, "for example", "such as", "including"), detail: "Examples present" }), { reason: "Examples add information gain and clarity.", nextAction: "Add 2–3 practical patient examples.", scoreGain: 2 }),
    sig("cd-images-present", "Images present", "contentDepth", (c) => ({ present: (c.html.match(/<img/gi) || []).length >= 3, detail: "Images on page" }), { reason: "Images support engagement and E-E-A-T.", nextAction: "Assign hero, support and trust images.", linkedModule: "Image Library", linkedUrl: (c) => `/api/pharmacy-image-library?slug=${c.slug}&service=${c.serviceId}`, scoreGain: 3 }),
    sig("cd-captions", "Image captions", "contentDepth", (c) => ({ present: includes(c.html, "figcaption") || includes(c.html, "caption"), detail: "Image captions" }), { reason: "Captions add context for images and accessibility.", nextAction: "Add descriptive captions to key images.", scoreGain: 2 }),
    sig("cd-internal-links", "Internal links", "contentDepth", (c) => ({ present: (c.html.match(/href="[^"]*pharmacy-visual-experience|href="[^"]*content-ecosystem/gi) || []).length >= 1, detail: "Internal cross-links" }), { reason: "Internal links distribute authority across ecosystem.", nextAction: "Link to FAQ, guide and local pages.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, scoreGain: 3 }),
    sig("cd-supporting-assets", "Supporting assets linked", "contentDepth", (c) => ({ present: c.ecosystemAssetIds.length >= 4, detail: `${c.ecosystemAssetIds.length} ecosystem assets` }), { reason: "Linked supporting assets deepen topical coverage.", nextAction: "Cross-link patient guide and FAQ from service page.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, scoreGain: 3 }),
    sig("cd-local-page", "Local page depth", "contentDepth", (c) => ({ present: c.ecosystemAssetIds.includes("local-service-page"), detail: "Local page in ecosystem" }), { reason: "Local page adds geographic content depth.", nextAction: "Generate and link local service page.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, visibilityGain: 4, scoreGain: 3 }),
    sig("cd-faq-depth", "FAQ depth", "contentDepth", (c) => ({ present: c.ecosystemAssetIds.includes("faq-page"), detail: "Dedicated FAQ asset" }), { reason: "Dedicated FAQ page expands question coverage.", nextAction: "Ensure FAQ page exists in ecosystem.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, scoreGain: 3, aiGain: 3 }),
    sig("cd-guide-depth", "Patient guide depth", "contentDepth", (c) => ({ present: c.ecosystemAssetIds.includes("patient-guide"), detail: "Patient guide asset" }), { reason: "Patient guide adds long-form supporting depth.", nextAction: "Link patient guide from service page.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, scoreGain: 3 }),
    sig("cd-unique-sections", "Unique sections", "contentDepth", (c) => ({ present: includes(c.text, c.pageProfile.pharmacyName) && c.text.split(/\s+/).length >= 900, detail: "Pharmacy-branded depth" }), { reason: "Pharmacy-specific depth beats generic content.", nextAction: "Add pharmacy-branded practical sections.", scoreGain: 3 }),
    sig("cd-heading-hierarchy", "Heading hierarchy", "contentDepth", (c) => ({ present: /<h1[^>]*>/i.test(c.html) && (c.html.match(/<h2[^>]*>/gi) || []).length >= 3, detail: "H1 + H2 hierarchy" }), { reason: "Proper heading hierarchy aids structure and SEO.", nextAction: "Verify single H1 and logical H2 order.", difficulty: "Easy", scoreGain: 2 }),
    sig("cd-content-freshness", "Content freshness signals", "contentDepth", (c) => ({ present: includes(c.text, "updated", "reviewed", "2024", "2025", "2026"), detail: "Freshness indicators" }), { reason: "Freshness signals ongoing maintenance.", nextAction: "Add last reviewed date.", scoreGain: 2 }),
  );

  // ── 7 CONTENT ECOSYSTEM (15) ──
  const ecoAssets: Array<[string, string, string]> = [
    ["ce-blogs", "Supporting blogs", "what-is"],
    ["ce-guides", "Patient guides", "patient-guide"],
    ["ce-gbp-posts", "GBP posts", "gbp-pack"],
    ["ce-email", "Email sequence", "email-sequence"],
    ["ce-video", "Video script", "video-script"],
    ["ce-patient-guide", "Patient guide page", "patient-guide"],
    ["ce-faqs", "FAQ page", "faq-page"],
    ["ce-social", "Social posts", "social-pack"],
    ["ce-local-page", "Local service page", "local-service-page"],
    ["ce-service-page", "Root service page", "root-service-page"],
  ];
  for (const [id, label, assetId] of ecoAssets) {
    defs.push(
      sig(id, label, "contentEcosystem", (c) => ({
        present: c.ecosystemAssetIds.some((a) => a.includes(assetId)),
        detail: c.ecosystemAssetIds.some((a) => a.includes(assetId)) ? "Asset available" : "Asset missing",
      }), {
        reason: `${label} extend reach and topical authority without new page generation.`,
        nextAction: `Ensure ${label.toLowerCase()} exists and is cross-linked.`,
        linkedModule: "Content Ecosystem",
        linkedUrl: ecosystemUrl,
        scoreGain: 3,
      }),
    );
  }
  defs.push(
    sig("ce-cross-links", "Cross-links between assets", "contentEcosystem", (c) => ({ present: (c.html.match(/content-ecosystem|faq-page|patient-guide/gi) || []).length >= 1, detail: "Cross-links present" }), { reason: "Cross-linking binds ecosystem into authority cluster.", nextAction: "Add links to FAQ, guide and local pages.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, scoreGain: 4 }),
    sig("ce-asset-count", "Ecosystem asset count", "contentEcosystem", (c) => ({ present: c.ecosystemAssetIds.length >= 7, detail: `${c.ecosystemAssetIds.length} assets` }), { reason: "Rich ecosystem supports long-term visibility.", nextAction: "Generate full ecosystem if below 7 assets.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, impact: "High", scoreGain: 5 }),
    sig("ce-promotion-ready", "Promotion-ready packs", "contentEcosystem", (c) => ({ present: c.ecosystemAssetIds.some((a) => a.includes("social")) && c.ecosystemAssetIds.some((a) => a.includes("gbp")), detail: "Social + GBP packs" }), { reason: "Promotion packs amplify published content.", nextAction: "Use GBP and social packs from ecosystem.", linkedModule: "Campaign OS", linkedUrl: campaignUrl, scoreGain: 3 }),
    sig("ce-email-nurture", "Email nurture sequence", "contentEcosystem", (c) => ({ present: c.ecosystemAssetIds.some((a) => a.includes("email")), detail: "Email sequence" }), { reason: "Email extends patient journey beyond the page.", nextAction: "Review email sequence in ecosystem.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, scoreGain: 2 }),
    sig("ce-video-support", "Video script support", "contentEcosystem", (c) => ({ present: c.ecosystemAssetIds.some((a) => a.includes("video")), detail: "Video script" }), { reason: "Video scripts support multimodal authority.", nextAction: "Review video script for social proof.", linkedModule: "Content Ecosystem", linkedUrl: ecosystemUrl, scoreGain: 2 }),
  );

  // ── 8 TECHNICAL QUALITY (15) ──
  defs.push(
    sig("tq-schema-localbusiness", "LocalBusiness schema", "technicalQuality", (c) => ({ present: c.schemaTypes.has("LocalBusiness") || c.schemaTypes.has("Pharmacy"), detail: "LocalBusiness schema" }), { reason: "LocalBusiness schema supports local entity recognition.", nextAction: "Verify LocalBusiness JSON-LD on page.", difficulty: "Advanced", scoreGain: 4, aiGain: 2 }),
    sig("tq-schema-faq", "FAQPage schema", "technicalQuality", (c) => ({ present: c.schemaTypes.has("FAQPage"), detail: "FAQPage schema" }), { reason: "FAQ schema enables rich results and AI extraction.", nextAction: "Add FAQPage structured data.", difficulty: "Advanced", aiGain: 5, scoreGain: 4 }),
    sig("tq-schema-breadcrumb", "BreadcrumbList schema", "technicalQuality", (c) => ({ present: c.schemaTypes.has("BreadcrumbList"), detail: "Breadcrumb schema" }), { reason: "Breadcrumbs improve navigation signals.", nextAction: "Add BreadcrumbList JSON-LD.", difficulty: "Advanced", scoreGain: 3 }),
    sig("tq-canonical", "Canonical URL", "technicalQuality", (c) => ({
      present: Boolean(c.publishingSettings?.canonicalUrl) || /<link[^>]+rel="canonical"/i.test(c.html),
      detail: c.publishingSettings?.canonicalUrl || "Canonical tag",
    }), { reason: "Canonical prevents duplicate content issues.", nextAction: "Add canonical URL in Publishing Settings.", linkedModule: "Publishing Settings", linkedUrl: (c) => `/api/pharmacy-publishing-settings?slug=${c.slug}&service=${c.serviceId}`, impact: "High", scoreGain: 5 }),
    sig("tq-meta-quality", "Meta description quality", "technicalQuality", (c) => ({ present: /<meta name="description"[^>]+content="[^"]{80,160}"/i.test(c.html), detail: "Meta description length" }), { reason: "Quality meta description improves CTR and summarisation.", nextAction: "Optimise meta description to 80–160 characters.", difficulty: "Easy", scoreGain: 3 }),
    sig("tq-title-quality", "Title tag quality", "technicalQuality", (c) => ({ present: /<title>[^<]{20,70}<\/title>/i.test(c.html), detail: "Title tag" }), { reason: "Optimised title supports rankings and AI context.", nextAction: "Ensure title includes service + town + pharmacy.", difficulty: "Easy", scoreGain: 3, visibilityGain: 2 }),
    sig("tq-images-assigned", "Images assigned", "technicalQuality", (c) => {
      const slots = buildPageSlotCards(c.slug, c.serviceId);
      const n = slots.filter((s) => s.status === "assigned").length;
      return { present: n >= 4, detail: `${n}/4 slots assigned` };
    }, { reason: "Full image assignment removes placeholder quality issues.", nextAction: "Assign all 4 image library slots.", linkedModule: "Image Library", linkedUrl: (c) => `/api/pharmacy-image-library?slug=${c.slug}&service=${c.serviceId}`, difficulty: "Easy", scoreGain: 4 }),
    sig("tq-alt-text", "Image alt text", "technicalQuality", (c) => {
      const imgs = [...c.html.matchAll(/<img[^>]*>/gi)].map((m) => m[0]);
      const withAlt = imgs.filter((t) => /alt="[^"]+"/i.test(t) && !/alt=""/i.test(t)).length;
      return { present: imgs.length > 0 && withAlt >= Math.min(3, imgs.length), detail: `${withAlt}/${imgs.length} with alt` };
    }, { reason: "Alt text supports accessibility and image search.", nextAction: "Add descriptive alt text to all images.", difficulty: "Easy", scoreGain: 3 }),
    sig("tq-headings-semantic", "Structured headings", "technicalQuality", (c) => ({ present: /<h1[^>]*>/i.test(c.html) && (c.html.match(/<h2[^>]*>/gi) || []).length >= 4, detail: "Semantic headings" }), { reason: "Semantic headings aid crawlers and accessibility.", nextAction: "Audit heading order and uniqueness.", difficulty: "Easy", scoreGain: 2 }),
    sig("tq-accessibility", "Accessibility basics", "technicalQuality", (c) => ({ present: /lang="en"/i.test(c.html) && (c.html.match(/alt="[^"]+"/gi) || []).length >= 2, detail: "Basic accessibility" }), { reason: "Accessibility supports quality and compliance.", nextAction: "Verify lang attribute and alt text coverage.", scoreGain: 2 }),
    sig("tq-internal-nav", "Internal navigation links", "technicalQuality", (c) => ({ present: /#site-footer|<nav/i.test(c.html), detail: "Internal nav" }), { reason: "Internal navigation distributes link equity.", nextAction: "Ensure footer nav links to key services.", scoreGain: 2 }),
    sig("tq-no-noindex", "Indexable for live", "technicalQuality", (c) => ({
      present: c.publishingSettings?.noindex === false || !/noindex/i.test(c.html),
      detail: c.publishingSettings?.noindex === false ? "Indexable in publishing settings" : /noindex/i.test(c.html) ? "noindex detected" : "Indexable",
    }), { reason: "noindex blocks all visibility gains.", nextAction: "Set noindex to false in Publishing Settings.", linkedModule: "Publishing Settings", linkedUrl: (c) => `/api/pharmacy-publishing-settings?slug=${c.slug}&service=${c.serviceId}`, impact: "High", scoreGain: 5, visibilityGain: 5 }),
    sig("tq-no-demo", "No demo wording", "technicalQuality", (c) => ({ present: !/\b(demo superintendent|mock pharmacy|lorem ipsum)\b/i.test(c.text), detail: "Demo wording check" }), { reason: "Demo wording destroys trust signals.", nextAction: "Replace demo credentials with verified profile data.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c, "#section-trust"), impact: "High", scoreGain: 5 }),
    sig("tq-cta-present", "CTA present", "technicalQuality", (c) => ({ present: /class="btn"|#contact|tel:/i.test(c.html), detail: "Call-to-action" }), { reason: "Clear CTA converts authority into action.", nextAction: "Verify primary CTA is visible above fold.", difficulty: "Easy", scoreGain: 2 }),
    sig("tq-page-speed-hints", "Page speed opportunities", "technicalQuality", (c) => ({ present: !/data-image-missing="true"/i.test(c.html) && !/v3-placeholder/i.test(c.html), detail: "No broken placeholders" }), { reason: "Missing assets hurt perceived quality and speed.", nextAction: "Resolve image placeholders and missing assets.", scoreGain: 3 }),
  );

  // ── 9 COMPETITOR DIFFERENTIATION (15) ──
  defs.push(
    sig("comp-unique-sections", "Unique sections vs competitors", "competitorDifferentiation", (c) => ({
      present: includes(c.text, c.pageProfile.pharmacyName) && c.text.split(/\s+/).length >= 1000,
      detail: "Pharmacy-branded unique content",
    }), { reason: "Unique sections differentiate from competitor template pages.", nextAction: "Add pharmacy-specific sections competitors lack.", linkedModule: "Competitor Dashboard", linkedUrl: competitorUrl, impact: "High", scoreGain: 4, visibilityGain: 4 }),
    sig("comp-unique-faqs", "Unique FAQs", "competitorDifferentiation", (c) => ({
      present: (c.html.match(/faq-q|cluster-faq-item/gi) || []).length >= 5 && includes(c.text, c.pageProfile.town),
      detail: "Local unique FAQs",
    }), { reason: "Local FAQs competitors may not answer.", nextAction: "Add town-specific FAQs from patient questions.", linkedModule: "Competitor Dashboard", linkedUrl: competitorUrl, aiGain: 4, scoreGain: 4 }),
    sig("comp-local-diff", "Local differentiators", "competitorDifferentiation", (c) => ({
      present: (c.profile.uniqueSellingPoints?.length || 0) > 0 || includes(c.text, "only pharmacy", "first in", "specialist"),
      detail: (c.profile.uniqueSellingPoints || []).slice(0, 2).join(", ") || "No USPs",
    }), { reason: "Local differentiators win vs chain competitors.", nextAction: "Surface uniqueSellingPoints on service page.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c), visibilityGain: 5, scoreGain: 4 }),
    sig("comp-trust-opportunity", "Trust opportunities", "competitorDifferentiation", (c) => ({
      present: includes(c.text, "gphc", "nhs") && Boolean(c.profile.gphcPremisesUrl),
      detail: "Trust credentials vs competitors",
    }), { reason: "Stronger trust than competitors supports conversion.", nextAction: "Compare trust block vs competitor dashboard.", linkedModule: "Competitor Dashboard", linkedUrl: competitorUrl, scoreGain: 3 }),
    sig("comp-service-diff", "Service differentiation", "competitorDifferentiation", (c) => ({
      present: includes(c.text, "we offer", "our service", "at our pharmacy", c.pageProfile.pharmacyName),
      detail: "Service differentiation wording",
    }), { reason: "Clear differentiation prevents commodity positioning.", nextAction: "Lead with how your pharmacy delivers this service.", scoreGain: 3 }),
    sig("comp-gap-high", "High gap opportunity", "competitorDifferentiation", (c) => ({
      present: c.competitorGapLevel !== "high",
      detail: c.competitorGapLevel ? `${c.competitorGapLevel} gap` : "No gap data",
    }), { reason: "High competitor gap = major visibility opportunity.", nextAction: "Prioritise this service — high competitor gap detected.", linkedModule: "Competitor Dashboard", linkedUrl: competitorUrl, impact: "High", visibilityGain: 5, scoreGain: 5 }),
    sig("comp-coverage-gap", "Coverage gap closure", "competitorDifferentiation", (c) => ({
      present: c.competitorCoveragePct >= 50,
      detail: `${c.competitorCoveragePct}% competitor coverage`,
    }), { reason: "Closing coverage gaps captures competitor traffic.", nextAction: "Review competitor coverage report for this service.", linkedModule: "Competitor Dashboard", linkedUrl: competitorUrl, visibilityGain: 4, scoreGain: 3 }),
    sig("comp-opportunity-actions", "Opportunity engine alignment", "competitorDifferentiation", (c) => ({
      present: c.opportunityCount > 0,
      detail: `${c.opportunityCount} opportunities tracked`,
    }), { reason: "Align enhancements with opportunity engine priorities.", nextAction: "Review opportunity engine for this service.", linkedModule: "Opportunity Engine", linkedUrl: (c) => `/api/pharmacy-campaigns?slug=${c.slug}#opportunity-engine`, scoreGain: 2 }),
    sig("comp-growth-actions", "Growth action alignment", "competitorDifferentiation", (c) => ({
      present: c.growthActionCount > 0,
      detail: `${c.growthActionCount} growth actions`,
    }), { reason: "Enhancement should align with existing growth actions.", nextAction: "Cross-reference growth action plan.", linkedModule: "Growth Actions", linkedUrl: (c) => `/api/pharmacy-growth-actions?slug=${c.slug}`, scoreGain: 2 }),
    sig("comp-visibility-status", "Visibility building", "competitorDifferentiation", (c) => ({
      present: c.visibilityStatus === "visible" || c.visibilityStatus === "building",
      detail: `Visibility: ${c.visibilityStatus}`,
    }), { reason: "Visibility tracking validates competitive progress.", nextAction: "Refresh visibility after enhancements.", linkedModule: "Visibility Bridge", linkedUrl: (c) => `/api/pharmacy-growth-dashboard?slug=${c.slug}#visibility`, scoreGain: 2, visibilityGain: 3 }),
    sig("comp-indexing-status", "Indexing progress", "competitorDifferentiation", (c) => ({
      present: c.indexingStatus === "indexed" || c.indexingStatus === "submitted",
      detail: `Indexing: ${c.indexingStatus}`,
    }), { reason: "Indexed pages compete for visibility.", nextAction: "Submit for indexing after authority gate passes.", linkedModule: "Indexing Bridge", linkedUrl: (c) => `/api/pharmacy-growth-dashboard?slug=${c.slug}#indexing`, scoreGain: 2 }),
    sig("comp-patient-questions", "Patient questions addressed", "competitorDifferentiation", (c) => ({
      present: (c.profile.patientQuestions?.length || 0) > 0,
      detail: (c.profile.patientQuestions || []).slice(0, 2).join("; ") || "No patient questions in profile",
    }), { reason: "Answering real patient questions beats generic competitor copy.", nextAction: "Convert profile patientQuestions into FAQs.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c), scoreGain: 3, aiGain: 3 }),
    sig("comp-usp-surface", "USPs on page", "competitorDifferentiation", (c) => ({
      present: (c.profile.uniqueSellingPoints?.length || 0) > 0 && includes(c.text, ...(c.profile.uniqueSellingPoints || []).slice(0, 1)),
      detail: "USPs surfaced on page",
    }), { reason: "USPs must appear on page to differentiate.", nextAction: "Add unique selling points to service introduction.", scoreGain: 3, visibilityGain: 3 }),
    sig("comp-local-keywords", "Local keyword integration", "competitorDifferentiation", (c) => ({
      present: includes(c.text, c.pageProfile.town) && includes(c.text, c.serviceName.toLowerCase()),
      detail: "Town + service in copy",
    }), { reason: "Local keyword integration targets competitive SERPs.", nextAction: "Ensure town + service name in H1 and intro.", visibilityGain: 4, scoreGain: 3 }),
    sig("comp-content-depth-vs-comp", "Content depth vs competitors", "competitorDifferentiation", (c) => ({
      present: c.text.split(/\s+/).length >= 1500,
      detail: `~${c.text.split(/\s+/).length} words`,
    }), { reason: "Deeper content often outranks thinner competitor pages.", nextAction: "Expand content using ecosystem assets to exceed competitor depth.", impact: "High", scoreGain: 5, visibilityGain: 4 }),
  );

  // ── 10 PATIENT EXPERIENCE (15) ──
  defs.push(
    sig("px-ease-understanding", "Ease of understanding", "patientExperience", (c) => ({ present: includes(c.text, "simply", "plain english", "easy to", "clear") || c.text.split(/\s+/).length >= 800, detail: "Readable copy" }), { reason: "Easy-to-understand copy improves patient confidence.", nextAction: "Simplify clinical jargon in patient-facing sections.", scoreGain: 3 }),
    sig("px-readability", "Readability score", "patientExperience", (c) => ({ present: (c.html.match(/<p[^>]*>/gi) || []).length >= 8, detail: "Paragraph structure" }), { reason: "Scannable content improves patient experience.", nextAction: "Use shorter paragraphs and subheadings.", difficulty: "Easy", scoreGain: 2 }),
    sig("px-accessibility", "Accessibility", "patientExperience", (c) => ({ present: /lang="en"/i.test(c.html), detail: "Language attribute" }), { reason: "Accessibility supports all patients.", nextAction: "Verify lang attribute and contrast.", scoreGain: 2 }),
    sig("px-action-clarity", "Action clarity", "patientExperience", (c) => ({ present: includes(c.text, "call", "book", "visit", "contact") && /tel:|class="btn"/i.test(c.html), detail: "Clear actions" }), { reason: "Patients need obvious next steps.", nextAction: "Make primary action visible in hero and contact sections.", scoreGain: 3 }),
    sig("px-booking-clarity", "Booking clarity", "patientExperience", (c) => ({ present: Boolean(c.profile.bookingUrl) || includes(c.text, "book", "appointment", c.profile.bookingMethod || "call"), detail: c.profile.bookingMethod || "Booking method" }), { reason: "Clear booking path reduces friction.", nextAction: "State exactly how to book this service.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c, "#section-cta"), difficulty: "Easy", scoreGain: 3 }),
    sig("px-confidence", "Patient confidence", "patientExperience", (c) => ({ present: includes(c.text, "confident", "trust", "professional", "registered"), detail: "Confidence-building language" }), { reason: "Confidence language supports conversion.", nextAction: "Add reassurance near CTA.", scoreGain: 2 }),
    sig("px-reassurance", "Reassurance content", "patientExperience", (c) => ({ present: includes(c.text, "reassur", "comfort", "support", "here to help"), detail: "Reassurance present" }), { reason: "Reassurance reduces anxiety for healthcare decisions.", nextAction: "Add empathetic reassurance in introduction.", scoreGain: 2 }),
    sig("px-cta-quality", "CTA quality", "patientExperience", (c) => ({ present: includes(c.text, c.profile.preferredCta || "book") && /class="btn"/i.test(c.html), detail: c.profile.preferredCta || "CTA" }), { reason: "Strong CTA converts trust into bookings.", nextAction: "Align CTA text with profile preferredCta.", linkedModule: "Profile Dashboard", linkedUrl: (c) => profileUrl(c, "#section-cta"), difficulty: "Easy", scoreGain: 3 }),
    sig("px-phone-visible", "Phone number visible", "patientExperience", (c) => ({ present: /tel:/i.test(c.html) || includes(c.text, c.profile.phone), detail: c.profile.phone }), { reason: "Visible phone number supports immediate action.", nextAction: "Ensure click-to-call phone in header and contact.", difficulty: "Easy", scoreGain: 2 }),
    sig("px-hours-visible", "Hours visible", "patientExperience", (c) => ({ present: includes(c.text, "open", "hours", "monday"), detail: "Opening hours visible" }), { reason: "Hours prevent wasted visits.", nextAction: "Show opening hours in local section.", difficulty: "Easy", scoreGain: 2 }),
    sig("px-map-visible", "Map visible", "patientExperience", (c) => ({ present: /google\.com\/maps|#local-access/i.test(c.html), detail: "Map section" }), { reason: "Map helps patients find the pharmacy.", nextAction: "Ensure map embed in local access.", scoreGain: 2, visibilityGain: 2 }),
    sig("px-contact-options", "Multiple contact options", "patientExperience", (c) => ({ present: /tel:/i.test(c.html) && (includes(c.text, "email") || includes(c.text, "book")), detail: "Contact options" }), { reason: "Multiple contact paths suit different patients.", nextAction: "Offer phone, booking and email options.", scoreGain: 2 }),
    sig("px-expectations-set", "Expectations set", "patientExperience", (c) => ({ present: includes(c.text, "expect", "during", "visit", "appointment"), detail: "Expectations managed" }), { reason: "Setting expectations reduces dissatisfaction.", nextAction: "Add 'what to expect' section.", scoreGain: 3 }),
    sig("px-mobile-friendly", "Mobile-friendly structure", "patientExperience", (c) => ({ present: /<meta name="viewport"/i.test(c.html), detail: "Viewport meta" }), { reason: "Mobile structure supports majority of patients.", nextAction: "Verify viewport and tap targets.", difficulty: "Easy", scoreGain: 2 }),
    sig("px-trust-near-cta", "Trust near CTA", "patientExperience", (c) => ({ present: includes(c.text, "gphc") && /class="btn"|#contact/i.test(c.html), detail: "Trust signals near action" }), { reason: "Trust near CTA improves conversion confidence.", nextAction: "Place GPhC/trust badge adjacent to primary CTA.", scoreGain: 3 }),
  );

  return defs;
}

const ALL_SIGNAL_DEFS = buildSignalDefinitions();

function buildEnhancementContext(slug: string, serviceId: VisualExperienceServiceId): EnhancementContext | null {
  const s = safeSlug(slug);
  const pagePath = visualPagePath(s, serviceId);
  if (!fs.existsSync(pagePath)) return null;

  const html = fs.readFileSync(pagePath, "utf8");
  const text = stripHtml(html);
  const profileDoc = loadPharmacyProfile(s);
  const profile = profileDoc.data;
  const pageProfile = buildPharmacyServicePageProfile(s);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId]?.serviceName || serviceId;

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

  const gap = loadGapAnalysis(s);
  const coverage = gap?.serviceCoverage?.find((row) => row.serviceId === serviceId);
  const visibility = readPharmacyVisibilityReport(s);
  const visSvc = visibility?.services.find((v) => v.serviceId === serviceId);
  const registry = readPharmacyRegistry(s);
  const rootPage = registry?.pages.find((p) => p.serviceId === serviceId && p.pageType === "service") || null;
  const growthPlan = readPharmacyGrowthActionPlan(s);
  const opp = loadOpportunityEngineResult(s);

  return {
    slug: s,
    serviceId,
    serviceName,
    html,
    text,
    profile,
    pageProfile,
    schemaTypes,
    ecosystemAssetIds,
    publishingSettings: getServicePublishingSettings(s, serviceId),
    competitorGapLevel: coverage?.gapLevel || null,
    competitorCoveragePct: coverage?.competitorCoveragePct ?? 0,
    visibilityStatus: visSvc?.visibilityStatus || "unknown",
    indexingStatus: rootPage?.indexingStatus || "not_registered",
    growthActionCount: growthPlan?.totalActions ?? 0,
    opportunityCount: (opp?.opportunities || []).filter((o) => o.relatedServices?.includes(serviceId)).length,
  };
}

function scoreCategory(signals: EnhancementSignal[]): Omit<EnhancementCategoryScore, "category" | "label"> {
  const signalCount = signals.length;
  const presentCount = signals.filter((s) => s.present).length;
  const currentScore = signalCount ? Math.round((presentCount / signalCount) * 100) : 0;
  const potentialScore = 100;
  const improvementPotential = potentialScore - currentScore;
  const opportunityScore = improvementPotential;
  return {
    signalCount,
    presentCount,
    currentScore,
    potentialScore,
    improvementPotential,
    opportunityScore,
    estimatedAuthorityGain: Math.round(improvementPotential * 0.35),
    estimatedAiCitationGain: Math.round(improvementPotential * 0.2),
    estimatedLocalVisibilityGain: Math.round(improvementPotential * 0.25),
  };
}

function buildRecommendations(ctx: EnhancementContext, signals: EnhancementSignal[]): EnhancementRecommendation[] {
  const signalById = new Map(signals.map((s) => [s.id, s]));
  const recs: EnhancementRecommendation[] = [];

  for (const def of ALL_SIGNAL_DEFS) {
    const signal = signalById.get(def.id);
    if (!signal || signal.present) continue;
    recs.push({
      id: `rec-${ctx.serviceId}-${def.id}`,
      title: `Enhance: ${def.label}`,
      category: def.category,
      reason: def.reason,
      evidence: [signal.detail, `Category: ${ENHANCEMENT_CATEGORY_LABELS[def.category]}`],
      difficulty: def.difficulty,
      estimatedImpact: def.impact,
      estimatedScoreGain: def.scoreGain,
      estimatedAiGain: def.aiGain,
      estimatedVisibilityGain: def.visibilityGain,
      linkedModule: def.linkedModule,
      linkedUrl: def.linkedUrl(ctx),
      recommendedNextAction: def.nextAction,
      signalId: def.id,
    });
  }

  return recs.sort((a, b) => {
    const impactW = { High: 3, Medium: 2, Low: 1 };
    const diffW = { Easy: 3, Medium: 2, Advanced: 1 };
    const scoreA = impactW[a.estimatedImpact] * 10 + diffW[a.difficulty] * 3 + a.estimatedScoreGain;
    const scoreB = impactW[b.estimatedImpact] * 10 + diffW[b.difficulty] * 3 + b.estimatedScoreGain;
    return scoreB - scoreA || a.title.localeCompare(b.title);
  });
}

export function analyseServiceAuthorityEnhancement(slug: string, serviceId: VisualExperienceServiceId): ServiceAuthorityEnhancement {
  const s = safeSlug(slug);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId]?.serviceName || serviceId;
  const pageUrl = `/api/pharmacy-visual-experience/${serviceId}/?slug=${s}`;
  const audit = getServiceAuthorityAudit(s, serviceId);

  const ctx = buildEnhancementContext(s, serviceId);
  if (!ctx) {
    return {
      serviceId,
      serviceName,
      pageUrl,
      currentAuthorityScore: 0,
      potentialAuthorityScore: 0,
      estimatedOverallImprovement: 0,
      totalRecommendations: 0,
      easyWins: 0,
      highImpactImprovements: 0,
      categoryScores: ENHANCEMENT_CATEGORIES.map((cat) => ({
        category: cat,
        label: ENHANCEMENT_CATEGORY_LABELS[cat],
        signalCount: 0,
        presentCount: 0,
        currentScore: 0,
        potentialScore: 100,
        improvementPotential: 100,
        opportunityScore: 100,
        estimatedAuthorityGain: 35,
        estimatedAiCitationGain: 20,
        estimatedLocalVisibilityGain: 25,
      })),
      signals: [],
      recommendations: [{
        id: `rec-${serviceId}-build-page`,
        title: "Build visual service page first",
        category: "technicalQuality",
        reason: "Enhancement analysis requires a built visual page.",
        evidence: ["Visual page HTML not found"],
        difficulty: "Advanced",
        estimatedImpact: "High",
        estimatedScoreGain: 50,
        estimatedAiGain: 10,
        estimatedVisibilityGain: 20,
        linkedModule: "Visual Experience",
        linkedUrl: pageUrl,
        recommendedNextAction: "Run pharmacy visual build pipeline.",
        signalId: "build-page",
      }],
      topRecommendations: [],
      lastAnalysedAt: new Date().toISOString(),
    };
  }

  const signals: EnhancementSignal[] = ALL_SIGNAL_DEFS.map((def) => {
    const result = def.check(ctx);
    return { id: def.id, label: def.label, category: def.category, present: result.present, detail: result.detail };
  });

  const categoryScores: EnhancementCategoryScore[] = ENHANCEMENT_CATEGORIES.map((cat) => {
    const catSignals = signals.filter((sig) => sig.category === cat);
    const scored = scoreCategory(catSignals);
    return { category: cat, label: ENHANCEMENT_CATEGORY_LABELS[cat], ...scored };
  });

  const recommendations = buildRecommendations(ctx, signals);
  const easyWins = recommendations.filter((r) => r.difficulty === "Easy").length;
  const highImpactImprovements = recommendations.filter((r) => r.estimatedImpact === "High").length;

  const currentAuthorityScore = audit?.overallScore ?? Math.round(
    categoryScores.reduce((sum, c) => sum + c.currentScore, 0) / categoryScores.length,
  );
  const potentialAuthorityScore = Math.min(100, currentAuthorityScore + Math.round(
    recommendations.reduce((sum, r) => sum + r.estimatedScoreGain, 0) * 0.15,
  ));
  const estimatedOverallImprovement = Math.max(0, potentialAuthorityScore - currentAuthorityScore);

  return {
    serviceId,
    serviceName,
    pageUrl,
    currentAuthorityScore,
    potentialAuthorityScore,
    estimatedOverallImprovement,
    totalRecommendations: recommendations.length,
    easyWins,
    highImpactImprovements,
    categoryScores,
    signals,
    recommendations,
    topRecommendations: recommendations.slice(0, 10),
    lastAnalysedAt: new Date().toISOString(),
  };
}

export function buildPharmacyAuthorityEnhancementDoc(slug: string): PharmacyAuthorityEnhancementDoc {
  const s = safeSlug(slug);
  const pageProfile = buildPharmacyServicePageProfile(s);
  const services = VISUAL_EXPERIENCE_BENCHMARK_SERVICES.map((serviceId) =>
    analyseServiceAuthorityEnhancement(s, serviceId),
  );

  const averageCurrentScore = Math.round(services.reduce((sum, svc) => sum + svc.currentAuthorityScore, 0) / services.length);
  const averagePotentialScore = Math.round(services.reduce((sum, svc) => sum + svc.potentialAuthorityScore, 0) / services.length);

  return {
    slug: s,
    pharmacyName: pageProfile.pharmacyName,
    version: 1,
    updatedAt: new Date().toISOString(),
    summary: {
      averageCurrentScore,
      averagePotentialScore,
      totalRecommendations: services.reduce((sum, svc) => sum + svc.totalRecommendations, 0),
      easyWins: services.reduce((sum, svc) => sum + svc.easyWins, 0),
      highImpactImprovements: services.reduce((sum, svc) => sum + svc.highImpactImprovements, 0),
      estimatedOverallImprovement: averagePotentialScore - averageCurrentScore,
      servicesAnalysed: services.length,
    },
    services,
  };
}

export function authorityEnhancementPath(slug: string): string {
  fs.mkdirSync(AUTHORITY_ENHANCEMENT_DIR, { recursive: true });
  return path.join(AUTHORITY_ENHANCEMENT_DIR, `${safeSlug(slug)}.json`);
}

export function loadPharmacyAuthorityEnhancement(slug: string): PharmacyAuthorityEnhancementDoc | null {
  const file = authorityEnhancementPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PharmacyAuthorityEnhancementDoc;
  } catch {
    return null;
  }
}

export function savePharmacyAuthorityEnhancement(doc: PharmacyAuthorityEnhancementDoc): string {
  const file = authorityEnhancementPath(doc.slug);
  fs.writeFileSync(file, JSON.stringify(doc, null, 2));
  return file;
}

export function refreshPharmacyAuthorityEnhancement(slug: string): PharmacyAuthorityEnhancementDoc {
  const doc = buildPharmacyAuthorityEnhancementDoc(slug);
  savePharmacyAuthorityEnhancement(doc);
  return doc;
}

export function getServiceAuthorityEnhancement(slug: string, serviceId: string): ServiceAuthorityEnhancement | null {
  const doc = loadPharmacyAuthorityEnhancement(slug);
  if (doc) return doc.services.find((s) => s.serviceId === serviceId) || null;
  return analyseServiceAuthorityEnhancement(slug, serviceId as VisualExperienceServiceId);
}

export function getEnhancementSummaryForCampaign(slug: string, serviceId: string): {
  currentScore: number;
  potentialScore: number;
  totalRecommendations: number;
  easyWins: number;
  highImpactImprovements: number;
  estimatedImprovement: number;
  topRecommendations: EnhancementRecommendation[];
  enhancementUrl: string;
} {
  const enhancement = getServiceAuthorityEnhancement(slug, serviceId);
  const s = safeSlug(slug);
  if (!enhancement) {
    return {
      currentScore: 0,
      potentialScore: 0,
      totalRecommendations: 0,
      easyWins: 0,
      highImpactImprovements: 0,
      estimatedImprovement: 0,
      topRecommendations: [],
      enhancementUrl: `/api/pharmacy-authority-enhancements?slug=${s}&service=${serviceId}`,
    };
  }
  return {
    currentScore: enhancement.currentAuthorityScore,
    potentialScore: enhancement.potentialAuthorityScore,
    totalRecommendations: enhancement.totalRecommendations,
    easyWins: enhancement.easyWins,
    highImpactImprovements: enhancement.highImpactImprovements,
    estimatedImprovement: enhancement.estimatedOverallImprovement,
    topRecommendations: enhancement.topRecommendations,
    enhancementUrl: `/api/pharmacy-authority-enhancements?slug=${s}&service=${serviceId}`,
  };
}

export function buildAuthorityEnhancementDashboard(
  slug: string,
  options?: { serviceId?: string; category?: string; difficulty?: string; impact?: string },
): AuthorityEnhancementDashboard & { filters: { category: string; difficulty: string; impact: string } } {
  const s = safeSlug(slug);
  const pageProfile = buildPharmacyServicePageProfile(s);
  let doc = loadPharmacyAuthorityEnhancement(s);
  if (!doc) doc = refreshPharmacyAuthorityEnhancement(s);

  const selectedServiceId =
    options?.serviceId && VISUAL_EXPERIENCE_BENCHMARK_SERVICES.includes(options.serviceId as VisualExperienceServiceId)
      ? options.serviceId
      : doc.services[0]?.serviceId || "pharmacy-first";

  let selectedEnhancement = doc.services.find((svc) => svc.serviceId === selectedServiceId) || null;

  if (selectedEnhancement && (options?.category || options?.difficulty || options?.impact)) {
    const filtered = selectedEnhancement.recommendations.filter((r) => {
      if (options.category && options.category !== "all" && r.category !== options.category) return false;
      if (options.difficulty && options.difficulty !== "all" && r.difficulty !== options.difficulty) return false;
      if (options.impact && options.impact !== "all" && r.estimatedImpact !== options.impact) return false;
      return true;
    });
    selectedEnhancement = { ...selectedEnhancement, recommendations: filtered, topRecommendations: filtered.slice(0, 10) };
  }

  return {
    slug: s,
    pharmacyName: pageProfile.pharmacyName,
    brandPrimaryColor: pageProfile.brandPrimaryColor,
    doc,
    selectedServiceId,
    selectedEnhancement,
    filters: {
      category: options?.category || "all",
      difficulty: options?.difficulty || "all",
      impact: options?.impact || "all",
    },
  };
}

export function countEnhancementSignals(): number {
  return ALL_SIGNAL_DEFS.length;
}
