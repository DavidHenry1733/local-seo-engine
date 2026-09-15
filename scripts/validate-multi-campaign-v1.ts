#!/usr/bin/env npx tsx
/**
 * Multi-Campaign Validation V1 — all four benchmark services end-to-end.
 * Produces data/platform-validation/multi-campaign-validation-v1.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeProfileData, auditPharmacyProfile } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { buildPharmacyCampaignControlCentre } from "../src/pharmacy/pharmacyCampaignControlCentreService.ts";
import { buildPageSlotCards, loadImageAssignments } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import {
  auditServiceAuthorityReadiness,
  refreshPharmacyAuthorityReadiness,
} from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import {
  loadPharmacyAuthorityEnhancement,
  refreshPharmacyAuthorityEnhancement,
} from "../src/pharmacy/pharmacyAuthorityEnhancementService.ts";
import { readPharmacyGrowthActionPlan } from "../src/pharmacy/pharmacyGrowthActionPlanService.ts";
import { readPharmacyCampaignLaunchQueue } from "../src/pharmacy/pharmacyCampaignLaunchQueueService.ts";
import { buildPlatformOperationalWorkflow } from "../src/pharmacy/pharmacyPlatformOperationalWorkflowService.ts";
import {
  getEnhancementWorkspaceProgress,
} from "../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { getServicePublishingSettings } from "../src/pharmacy/pharmacyPublishingSettingsService.ts";
import { isReviewerProfileComplete } from "../src/pharmacy/pharmacyRealEnhancementActionsService.ts";
import {
  VISUAL_EXPERIENCE_BENCHMARK_SERVICES,
  VISUAL_EXPERIENCE_SERVICE_CONFIG,
  type VisualExperienceServiceId,
} from "../src/pharmacy/pharmacyVisualExperienceConfig.ts";
import { readPharmacyRegistry, readPharmacyIndexingSummary } from "../src/pharmacy/pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "../src/pharmacy/pharmacyVisibilityBridgeService.ts";
import { loadOpportunityEngineResult } from "../src/pharmacy/pharmacyOpportunityEngine.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = process.argv[2] || "pharmaconnect";

type Status = "PASS" | "WARNING" | "FAIL";
type Priority = "Critical" | "High" | "Medium" | "Low";

interface Issue {
  id: string;
  summary: string;
  recommendedFix: string;
  priority: Priority;
}

interface CheckItem {
  id: string;
  label: string;
  status: Status;
  detail: string;
}

interface StageResult {
  stage: number;
  name: string;
  status: Status;
  checks: CheckItem[];
  issues: Issue[];
  screenshotPath: string | null;
}

interface CampaignValidation {
  serviceId: VisualExperienceServiceId;
  serviceName: string;
  campaignId: string;
  campaignName: string;
  overallStatus: Status;
  passPct: number;
  stagesPassed: number;
  stagesWarning: number;
  stagesFailed: number;
  stages: StageResult[];
  blockers: string[];
  recommendedRepairs: string[];
}

const CAMPAIGN_IDS: Record<VisualExperienceServiceId, string> = {
  "pharmacy-first": "debea4b8-72a8-4511-9fb3-e3ab5dc16ba1",
  "blood-pressure-checks": "2e5cf653-7df3-4918-96f8-c99d687b764b",
  "travel-vaccinations": "86c92269-9c0e-4347-9aed-6561f1ab617b",
  "emergency-contraception": "61d6088c-9ea1-48d9-9ad8-79ecc059f63c",
};

function worstStatus(checks: CheckItem[]): Status {
  if (checks.some((c) => c.status === "FAIL")) return "FAIL";
  if (checks.some((c) => c.status === "WARNING")) return "WARNING";
  return "PASS";
}

function stageStatus(checks: CheckItem[], issues: Issue[]): Status {
  if (issues.some((i) => i.priority === "Critical")) return "FAIL";
  return worstStatus(checks);
}

function readJson<T>(rel: string): T {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8")) as T;
}

function readVisualHtml(serviceId: string): string {
  const p = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, serviceId, "index.html");
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf8");
}

function duplicateSupportImages(html: string): boolean {
  return [...html.matchAll(/<img\b[^>]*data-image-slot="support"/gi)].length > 1;
}

function validateCampaign(
  serviceId: VisualExperienceServiceId,
  shared: {
    profile: ReturnType<typeof normalizeProfileData>;
    profileAudit: ReturnType<typeof auditPharmacyProfile>;
    controlCentre: ReturnType<typeof buildPharmacyCampaignControlCentre>;
    launchQueue: ReturnType<typeof readPharmacyCampaignLaunchQueue>;
    growth: ReturnType<typeof readPharmacyGrowthActionPlan>;
    enhancement: ReturnType<typeof loadPharmacyAuthorityEnhancement>;
    workflow: ReturnType<typeof buildPlatformOperationalWorkflow>;
    registry: ReturnType<typeof readPharmacyRegistry>;
    indexingSummary: ReturnType<typeof readPharmacyIndexingSummary>;
    visibility: ReturnType<typeof readPharmacyVisibilityReport>;
    opportunity: ReturnType<typeof loadOpportunityEngineResult>;
    imgDoc: ReturnType<typeof loadImageAssignments>;
    imgAssignments: { assignments: Record<string, { altText?: string }>; uploads: unknown[] };
  },
): CampaignValidation {
  const campaignId = CAMPAIGN_IDS[serviceId];
  const serviceName = VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId].serviceName;
  const enriched = shared.controlCentre.campaigns.find((c) => c.id === campaignId);
  const campaign = enriched;
  const audit = auditServiceAuthorityReadiness(SLUG, serviceId);
  const bpEnh = shared.enhancement?.services.find((s) => s.serviceId === serviceId);
  const bpQueue = shared.launchQueue?.campaigns.find((c) => c.serviceId === serviceId);
  const publishing = getServicePublishingSettings(SLUG, serviceId);
  const slots = buildPageSlotCards(SLUG, serviceId, campaignId);
  const assigned = slots.filter((s) => s.status === "assigned");
  const serviceAssignments = Object.keys(shared.imgAssignments.assignments).filter((k) => k.startsWith(`${serviceId}:`));
  const html = readVisualHtml(serviceId);
  const registryPage = shared.registry?.pages.find((p) => p.serviceId === serviceId && p.pageType === "service");
  const visibilitySvc = shared.visibility?.services.find((s) => s.serviceId === serviceId);
  const pubWorkflow = shared.workflow?.publishingWorkflow.find((s) => s.serviceId === serviceId);
  const imageCentreRow = shared.workflow?.imageCentre.services.find((s) => s.serviceId === serviceId);
  const progress = getEnhancementWorkspaceProgress(SLUG, serviceId);
  const publishIndex = readJson<{ pages: Array<{ serviceId: string; pageType: string; generatedAt: string }> }>(
    `output/pharmacy-publish/${SLUG}/_publish-index.json`,
  );
  const publishPages = (publishIndex?.pages || []).filter((p) => p.serviceId === serviceId);

  const stages: StageResult[] = [];

  // Stage 1 — Business Profile (shared profile, validated per campaign context)
  const s1Checks: CheckItem[] = [
    { id: "pharmacy", label: "Correct pharmacy", status: shared.profile.pharmacyName === "Brook Pharmacy" ? "PASS" : "FAIL", detail: shared.profile.pharmacyName },
    { id: "branding", label: "Branding", status: shared.profile.logoUrl && shared.profile.brandPrimaryColor ? "PASS" : "WARNING", detail: shared.profile.logoUrl || "no logo" },
    { id: "trust", label: "Trust profile", status: !shared.profile.demoMode && shared.profile.gphcNumber ? "PASS" : "FAIL", detail: `GPhC ${shared.profile.gphcNumber}` },
    { id: "reviewer", label: "Reviewer", status: isReviewerProfileComplete(shared.profile) ? "PASS" : "FAIL", detail: shared.profile.reviewerName || "missing" },
    { id: "professional-review", label: "Professional review", status: shared.profile.clinicalReviewDate && shared.profile.nextReviewDate ? "PASS" : "FAIL", detail: `${shared.profile.clinicalReviewDate || "?"} → ${shared.profile.nextReviewDate || "?"}` },
  ];
  stages.push({ stage: 1, name: "Business Profile", status: stageStatus(s1Checks, []), checks: s1Checks, issues: [], screenshotPath: null });

  // Stage 2 — Campaign Creation
  const s2Checks: CheckItem[] = [
    { id: "exists", label: "Campaign exists", status: campaign ? "PASS" : "FAIL", detail: campaign?.name || "missing" },
    { id: "visible", label: "Campaign visible in OS", status: enriched ? "PASS" : "FAIL", detail: enriched?.status || "missing" },
    { id: "service", label: "Service selected", status: campaign?.serviceId === serviceId ? "PASS" : "FAIL", detail: serviceId },
    { id: "areas", label: "Areas selected", status: shared.profile.rankingAreas.length >= 1 ? "PASS" : "WARNING", detail: shared.profile.rankingAreas.join(", ") },
  ];
  stages.push({ stage: 2, name: "Campaign Creation", status: stageStatus(s2Checks, []), checks: s2Checks, issues: [], screenshotPath: null });

  // Stage 3 — Image Workflow
  const s3Issues: Issue[] = [];
  const badAlt = serviceAssignments.some((k) => /undefined/.test(shared.imgAssignments.assignments[k]?.altText || ""));
  if (badAlt) {
    s3Issues.push({ id: "alt-undefined", summary: "Alt text contains undefined", recommendedFix: "Re-assign images with profile context", priority: "Medium" });
  }
  const s3Checks: CheckItem[] = [
    { id: "library", label: "Image library", status: shared.imgDoc ? "PASS" : "FAIL", detail: "operating system loaded" },
    { id: "upload", label: "Upload records", status: (shared.imgAssignments.uploads as unknown[]).length > 0 ? "PASS" : "WARNING", detail: `${(shared.imgAssignments.uploads as unknown[]).length} uploads` },
    { id: "assignments", label: "Assignments", status: assigned.length >= 4 ? "PASS" : "FAIL", detail: `${assigned.length}/4 slots` },
    { id: "preview", label: "Preview", status: html.includes("data-image-slot") ? "PASS" : "FAIL", detail: "visual HTML slot markers" },
    { id: "image-centre", label: "Campaign Image Centre", status: enriched && enriched.imageAssignedCount >= 3 ? "PASS" : "WARNING", detail: enriched ? `${enriched.imageAssignedCount}/${enriched.imageTotalSlots}` : "n/a" },
    { id: "visual-page", label: "Visual page", status: html.length > 0 ? "PASS" : "FAIL", detail: html ? "built" : "missing HTML" },
  ];
  stages.push({ stage: 3, name: "Image Workflow", status: stageStatus(s3Checks, s3Issues), checks: s3Checks, issues: s3Issues, screenshotPath: null });

  // Stage 4 — Visual Experience
  const s4Issues: Issue[] = [];
  if (duplicateSupportImages(html)) {
    s4Issues.push({ id: "dup-support", summary: "Support image rendered twice", recommendedFix: "Remove duplicate support band image panel", priority: "Medium" });
  }
  const s4Checks: CheckItem[] = [
    { id: "template", label: "Approved template", status: html.includes("data-template-block") ? "PASS" : "FAIL", detail: "V3 template blocks" },
    { id: "branding", label: "Branding", status: html.includes("Brook Pharmacy") && html.includes("#005eb8") ? "PASS" : "WARNING", detail: "name + NHS blue" },
    { id: "localisation", label: "Localisation", status: html.includes("Rotherham") ? "PASS" : "FAIL", detail: "Rotherham coverage" },
    { id: "images", label: "Images", status: !html.includes('data-image-missing="true"') ? "PASS" : "FAIL", detail: "no broken markers" },
    { id: "logo", label: "Logo", status: html.includes("/assets/pharmacy-logos/pharmaconnect.svg") ? "PASS" : "FAIL", detail: "header logo" },
    { id: "cta", label: "CTA", status: /Speak To A Pharmacist|tel:01709210731/i.test(html) ? "PASS" : "FAIL", detail: "primary CTA" },
    { id: "map", label: "Map", status: /google\.com\/maps/i.test(html) ? "PASS" : "FAIL", detail: "maps embed" },
    { id: "footer", label: "Footer", status: /id="site-footer"/i.test(html) ? "PASS" : "FAIL", detail: "site footer" },
    { id: "mobile", label: "Mobile", status: /<meta name="viewport"/i.test(html) ? "PASS" : "FAIL", detail: "viewport meta" },
  ];
  stages.push({
    stage: 4,
    name: "Visual Experience",
    status: stageStatus(s4Checks, s4Issues),
    checks: s4Checks,
    issues: s4Issues,
    screenshotPath: `output/pharmacy-visual-experience/${SLUG}/${serviceId}/index.html`,
  });

  // Stage 5 — QA
  const s5Issues: Issue[] = audit.criticalIssues.map((issue, i) => ({
    id: `S5-critical-${i}`,
    summary: issue,
    recommendedFix: "Resolve before live publish",
    priority: "Critical" as Priority,
  }));
  const s5Checks: CheckItem[] = [
    { id: "authority", label: "Authority Audit", status: audit.overallScore >= 90 ? "PASS" : audit.overallScore >= 75 ? "WARNING" : "FAIL", detail: `score=${audit.overallScore} gate=${audit.publishGate}` },
    { id: "enhancement", label: "Enhancement Engine", status: bpEnh ? "PASS" : "FAIL", detail: bpEnh ? `${bpEnh.recommendations.length} recs` : "missing" },
    { id: "launch-queue", label: "Launch Queue", status: bpQueue ? "PASS" : "FAIL", detail: bpQueue ? `${bpQueue.tasks.length} tasks` : "missing" },
    { id: "growth", label: "Growth Actions", status: shared.growth && shared.growth.totalActions > 0 ? "PASS" : "WARNING", detail: shared.growth ? `${shared.growth.totalActions} actions` : "none" },
  ];
  stages.push({ stage: 5, name: "Quality Assurance", status: stageStatus(s5Checks, s5Issues), checks: s5Checks, issues: s5Issues, screenshotPath: null });

  // Stage 6 — Real Enhancement Actions
  const s6Checks: CheckItem[] = [
    { id: "reviewer", label: "Reviewer", status: isReviewerProfileComplete(shared.profile) ? "PASS" : "FAIL", detail: shared.profile.reviewerName || "missing" },
    { id: "review-date", label: "Review Date", status: shared.profile.clinicalReviewDate ? "PASS" : "FAIL", detail: shared.profile.clinicalReviewDate || "missing" },
    { id: "next-review", label: "Next Review", status: shared.profile.nextReviewDate ? "PASS" : "FAIL", detail: shared.profile.nextReviewDate || "missing" },
    { id: "canonical", label: "Canonical", status: Boolean(publishing?.canonicalUrl) ? "PASS" : "FAIL", detail: publishing?.canonicalUrl || "missing" },
    { id: "noindex", label: "Noindex", status: publishing?.noindex === false ? "PASS" : "FAIL", detail: publishing?.noindex === false ? "indexable" : "noindex true" },
    { id: "images", label: "Images", status: assigned.length >= 3 ? "PASS" : "FAIL", detail: `${assigned.length}/4 assigned` },
  ];
  stages.push({ stage: 6, name: "Real Enhancement Actions", status: stageStatus(s6Checks, []), checks: s6Checks, issues: [], screenshotPath: null });

  // Stage 7 — Publish Workflow
  const s7Issues: Issue[] = [];
  if (audit.publishGate === "FAIL") {
    s7Issues.push({ id: "publish-gate-fail", summary: "Publish gate FAIL", recommendedFix: audit.criticalIssues.join("; ") || "Raise authority score and clear blockers", priority: "Critical" });
  }
  const s7Checks: CheckItem[] = [
    { id: "publish-ready", label: "Publish ready", status: audit.publishGate !== "FAIL" && audit.criticalIssues.length === 0 ? "PASS" : "FAIL", detail: audit.publishGate },
    { id: "published", label: "Published", status: publishPages.some((p) => p.pageType === "service") ? "PASS" : "FAIL", detail: `${publishPages.length} publish pages` },
    { id: "registry", label: "Publishing registry", status: registryPage ? "PASS" : "FAIL", detail: registryPage?.indexingStatus || "not registered" },
    { id: "publish-history", label: "Publishing history", status: registryPage?.lastPublishedAt || publishPages[0]?.generatedAt ? "PASS" : "WARNING", detail: registryPage?.lastPublishedAt || publishPages[0]?.generatedAt || "no timestamp" },
    { id: "publish-status", label: "Publishing status", status: campaign?.publishingStatus === "published" || publishPages.length > 1 ? "PASS" : "WARNING", detail: campaign?.publishingStatus || "unknown" },
  ];
  stages.push({ stage: 7, name: "Publish Workflow", status: stageStatus(s7Checks, s7Issues), checks: s7Checks, issues: s7Issues, screenshotPath: null });

  // Stage 8 — Indexing Workflow
  const s8Checks: CheckItem[] = [
    { id: "submission", label: "Indexing submission", status: registryPage?.submittedAt ? "PASS" : "WARNING", detail: registryPage?.submittedAt || "not submitted" },
    { id: "queue", label: "Indexing queue", status: shared.indexingSummary ? "PASS" : "FAIL", detail: shared.indexingSummary ? `${shared.indexingSummary.indexed} indexed` : "missing" },
    { id: "status", label: "Indexing status", status: (campaign?.indexingStatus === "indexed" || registryPage?.indexingStatus === "indexed") ? "PASS" : "WARNING", detail: campaign?.indexingStatus || registryPage?.indexingStatus || "unknown" },
    { id: "refresh", label: "Indexing refresh", status: registryPage?.lastCheckedAt ? "PASS" : "WARNING", detail: registryPage?.lastCheckedAt || "never" },
    { id: "indexed", label: "Indexed state", status: registryPage?.indexingStatus === "indexed" ? "PASS" : "FAIL", detail: registryPage?.indexingStatus || "not indexed" },
  ];
  stages.push({ stage: 8, name: "Indexing Workflow", status: stageStatus(s8Checks, []), checks: s8Checks, issues: [], screenshotPath: null });

  // Stage 9 — Visibility Workflow
  const s9Checks: CheckItem[] = [
    { id: "tracking", label: "Visibility tracking", status: visibilitySvc ? "PASS" : "FAIL", detail: visibilitySvc?.visibilityStatus || "missing" },
    { id: "keywords", label: "Keyword tracking", status: visibilitySvc?.primaryKeyword ? "PASS" : "WARNING", detail: visibilitySvc?.primaryKeyword || "none" },
    { id: "authority", label: "Authority score", status: audit.overallScore >= 90 ? "PASS" : "WARNING", detail: String(audit.overallScore) },
    { id: "opportunity", label: "Opportunity engine", status: shared.opportunity && shared.opportunity.opportunities.length > 0 ? "PASS" : "WARNING", detail: shared.opportunity ? `${shared.opportunity.opportunities.length} opportunities` : "none" },
    { id: "monitoring", label: "Monthly monitoring", status: shared.visibility?.lastCheckedAt ? "PASS" : "WARNING", detail: shared.visibility?.lastCheckedAt || "not checked" },
  ];
  stages.push({ stage: 9, name: "Visibility Workflow", status: stageStatus(s9Checks, []), checks: s9Checks, issues: [], screenshotPath: null });

  // Stage 10 — Campaign Operating System
  const s10Checks: CheckItem[] = [
    { id: "campaign-os", label: "Campaign OS", status: enriched?.operatingSystem ? "PASS" : "FAIL", detail: enriched?.operatingSystem ? `health=${enriched.operatingSystem.health.score}` : "missing" },
    { id: "image-centre", label: "Image Centre", status: imageCentreRow ? "PASS" : "FAIL", detail: imageCentreRow ? `${imageCentreRow.completionPct}% complete` : "missing" },
    { id: "authority-audit", label: "Authority Audit", status: enriched?.authorityScore != null ? "PASS" : "FAIL", detail: enriched ? `score=${enriched.authorityScore}` : "missing" },
    { id: "enhancement-ws", label: "Enhancement Workspace", status: progress ? "PASS" : "FAIL", detail: progress ? `real=${progress.realCompleted}` : "missing" },
    { id: "launch-queue", label: "Launch Queue", status: enriched?.launchQueue ? "PASS" : "WARNING", detail: enriched?.launchQueue ? `${enriched.launchQueue.tasks.length} tasks` : "missing" },
    { id: "publishing", label: "Publishing", status: pubWorkflow ? "PASS" : "FAIL", detail: pubWorkflow?.currentStageLabel || "missing" },
    { id: "indexing", label: "Indexing", status: registryPage ? "PASS" : "FAIL", detail: registryPage?.indexingStatus || "missing" },
    { id: "visibility", label: "Visibility", status: visibilitySvc ? "PASS" : "FAIL", detail: visibilitySvc?.visibilityStatus || "missing" },
    { id: "growth", label: "Growth Actions", status: shared.growth ? "PASS" : "WARNING", detail: shared.growth ? `${shared.growth.pendingActions} pending` : "none" },
  ];
  stages.push({ stage: 10, name: "Campaign Operating System", status: stageStatus(s10Checks, []), checks: s10Checks, issues: [], screenshotPath: null });

  const stagesPassed = stages.filter((s) => s.status === "PASS").length;
  const stagesWarning = stages.filter((s) => s.status === "WARNING").length;
  const stagesFailed = stages.filter((s) => s.status === "FAIL").length;
  const totalChecks = stages.reduce((n, s) => n + s.checks.length, 0);
  const passedChecks = stages.reduce((n, s) => n + s.checks.filter((c) => c.status === "PASS").length, 0);
  const passPct = totalChecks ? Math.round((passedChecks / totalChecks) * 100) : 0;
  const overallStatus: Status = stagesFailed > 0 ? "FAIL" : stagesWarning > 0 ? "WARNING" : "PASS";

  const blockers = [
    ...stages.flatMap((s) => s.issues.filter((i) => i.priority === "Critical").map((i) => i.summary)),
    ...stages.flatMap((s) => s.checks.filter((c) => c.status === "FAIL").map((c) => `${s.name}: ${c.label}`)),
  ].filter((v, i, a) => a.indexOf(v) === i);

  const recommendedRepairs = stages.flatMap((s) => s.issues.map((i) => i.recommendedFix)).filter((v, i, a) => a.indexOf(v) === i);

  return {
    serviceId,
    serviceName,
    campaignId,
    campaignName: campaign?.name || serviceName,
    overallStatus,
    passPct,
    stagesPassed,
    stagesWarning,
    stagesFailed,
    stages,
    blockers,
    recommendedRepairs,
  };
}

// ── Run validation ──
refreshPharmacyAuthorityReadiness(SLUG);
refreshPharmacyAuthorityEnhancement(SLUG);

const profileRaw = readJson<{ data: Record<string, unknown> }>(`data/pharmacy-profiles/${SLUG}.json`);
const profile = normalizeProfileData(profileRaw.data);
const profileAudit = auditPharmacyProfile(SLUG, profile);
const controlCentre = buildPharmacyCampaignControlCentre(SLUG);
const launchQueue = readPharmacyCampaignLaunchQueue(SLUG);
const growth = readPharmacyGrowthActionPlan(SLUG);
const enhancement = loadPharmacyAuthorityEnhancement(SLUG);
const workflow = buildPlatformOperationalWorkflow(SLUG);
const registry = readPharmacyRegistry(SLUG);
const indexingSummary = readPharmacyIndexingSummary(SLUG);
const visibility = readPharmacyVisibilityReport(SLUG);
const opportunity = loadOpportunityEngineResult(SLUG);
const imgDoc = loadImageAssignments(SLUG);
const imgAssignments = readJson<{ assignments: Record<string, { altText?: string }>; uploads: unknown[] }>(
  `data/pharmacy-image-assignments/${SLUG}.json`,
);

const shared = {
  profile,
  profileAudit,
  controlCentre,
  launchQueue,
  growth,
  enhancement,
  workflow,
  registry,
  indexingSummary,
  visibility,
  opportunity,
  imgDoc,
  imgAssignments,
};

const campaigns = VISUAL_EXPERIENCE_BENCHMARK_SERVICES.map((serviceId) => validateCampaign(serviceId, shared));

const totalChecksAll = campaigns.reduce((n, c) => n + c.stages.reduce((m, s) => m + s.checks.length, 0), 0);
const passedChecksAll = campaigns.reduce(
  (n, c) => n + c.stages.reduce((m, s) => m + s.checks.filter((ch) => ch.status === "PASS").length, 0),
  0,
);

const report = {
  version: 1,
  validatedAt: new Date().toISOString(),
  slug: SLUG,
  pharmacy: profile.pharmacyName,
  benchmarkServices: [...VISUAL_EXPERIENCE_BENCHMARK_SERVICES],
  summary: {
    overallStatus: campaigns.some((c) => c.overallStatus === "FAIL")
      ? "FAIL"
      : campaigns.some((c) => c.overallStatus === "WARNING")
        ? "WARNING"
        : "PASS",
    campaignsPassed: campaigns.filter((c) => c.overallStatus === "PASS").length,
    campaignsWarning: campaigns.filter((c) => c.overallStatus === "WARNING").length,
    campaignsFailed: campaigns.filter((c) => c.overallStatus === "FAIL").length,
    passPct: totalChecksAll ? Math.round((passedChecksAll / totalChecksAll) * 100) : 0,
    totalChecks: totalChecksAll,
    passedChecks: passedChecksAll,
    platformProven: campaigns.every((c) => c.overallStatus === "PASS"),
  },
  campaigns,
  allBlockers: campaigns.flatMap((c) => c.blockers.map((b) => ({ serviceId: c.serviceId, blocker: b }))),
  recommendedRepairs: [...new Set(campaigns.flatMap((c) => c.recommendedRepairs))],
};

const outDir = path.join(ROOT, "data/platform-validation");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "multi-campaign-validation-v1.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\nMulti-Campaign Validation V1 — ${SLUG}`);
for (const c of campaigns) {
  console.log(`\n${c.serviceName} (${c.serviceId}): ${c.overallStatus} — ${c.passPct}% (${c.stagesPassed}/10 stages PASS)`);
  for (const s of c.stages.filter((st) => st.status !== "PASS")) {
    console.log(`  Stage ${s.stage} ${s.name}: ${s.status}`);
    for (const ch of s.checks.filter((x) => x.status !== "PASS")) {
      console.log(`    ✗ ${ch.label}: ${ch.detail}`);
    }
  }
}
console.log(`\nPlatform: ${report.summary.overallStatus} | PASS ${report.summary.passPct}% | ${report.summary.campaignsPassed}/4 campaigns PASS`);
console.log(`Report: ${outPath}\n`);
process.exit(report.summary.overallStatus === "FAIL" ? 1 : 0);
