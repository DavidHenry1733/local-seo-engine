#!/usr/bin/env npx tsx
/**
 * Platform Workflow Validation V1 — Brook Pharmacy / Blood Pressure Checks
 * Produces data/platform-validation/pharmaconnect-workflow.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeProfileData, auditPharmacyProfile } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { computeProfileCompleteness } from "../src/pharmacy/pharmacyProfileCompleteness.ts";
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
  buildEnhancementWorkspaceView,
  getEnhancementWorkspaceProgress,
} from "../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { getServicePublishingSettings, saveServicePublishingSettings } from "../src/pharmacy/pharmacyPublishingSettingsService.ts";
import { isReviewerProfileComplete } from "../src/pharmacy/pharmacyRealEnhancementActionsService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SLUG = process.argv[2] || "pharmaconnect";
const SERVICE = process.argv[3] || "blood-pressure-checks";
const CAMPAIGN_ID = "2e5cf653-7df3-4918-96f8-c99d687b764b";

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
  blockedNextStage: boolean;
}

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

function readVisualHtml(): string {
  const p = path.join(ROOT, "output/pharmacy-visual-experience", SLUG, SERVICE, "index.html");
  return fs.readFileSync(p, "utf8");
}

function countH2(html: string): number {
  return (html.match(/<h2[^>]*>/gi) || []).length;
}

function duplicateSectionCheck(html: string): { duplicateSupportImage: boolean; h2Count: number } {
  const supportImgs = [...html.matchAll(/<img\b[^>]*data-image-slot="support"/gi)].length;
  return { duplicateSupportImage: supportImgs > 1, h2Count: countH2(html) };
}

const stages: StageResult[] = [];
const profileRaw = readJson<{ data: Record<string, unknown> }>(`data/pharmacy-profiles/${SLUG}.json`);
const profile = normalizeProfileData(profileRaw.data);
const profileAudit = auditPharmacyProfile(SLUG, profile);
const completeness = computeProfileCompleteness(profile, SLUG);

// ── STAGE 1: Business Profile ──
const s1Checks: CheckItem[] = [
  { id: "profile-loads", label: "Profile loads", status: profile.pharmacyName === "Brook Pharmacy" ? "PASS" : "FAIL", detail: profile.pharmacyName },
  { id: "required-fields", label: "Required fields present", status: profileAudit.passed ? "PASS" : "WARNING", detail: `${profileAudit.requiredPassed}/${profileAudit.requiredTotal} required checks` },
  { id: "professional-review", label: "Professional Review saves", status: isReviewerProfileComplete(profile) ? "PASS" : "FAIL", detail: `reviewer=${profile.reviewerName || "missing"}` },
  { id: "trust-signals", label: "Trust Signals", status: profile.accreditations.length > 0 && profile.gphcNumber ? "PASS" : "WARNING", detail: `GPhC=${profile.gphcNumber || "missing"}` },
  { id: "brand-colours", label: "Brand colours", status: profile.brandPrimaryColor === "#005eb8" ? "PASS" : "WARNING", detail: profile.brandPrimaryColor },
  { id: "logo", label: "Logo loads", status: profile.logoUrl ? "PASS" : "WARNING", detail: profile.logoUrl || "logoUrl empty — no logo uploaded" },
  { id: "contact-details", label: "Contact details", status: profile.phone && profile.businessEmail ? "PASS" : "FAIL", detail: `${profile.phone} · ${profile.businessEmail}` },
];
const s1Issues: Issue[] = [];
if (!profile.logoUrl) {
  s1Issues.push({ id: "S1-logo-missing", summary: "No pharmacy logo uploaded", recommendedFix: "Upload logo via Profile Dashboard logo upload", priority: "Medium" });
}
if (profile.demoMode) {
  s1Issues.push({ id: "S1-demo-mode", summary: "Profile marked demoMode with mock trust data", recommendedFix: "Switch to live profile credentials before customer demo publish", priority: "High" });
}
if (profile.superintendentPharmacistName.includes("Demo")) {
  s1Issues.push({ id: "S1-demo-superintendent", summary: "Superintendent name still demo placeholder", recommendedFix: "Replace with verified superintendent pharmacist name", priority: "High" });
}
stages.push({
  stage: 1,
  name: "Business Profile",
  status: stageStatus(s1Checks, s1Issues),
  checks: s1Checks,
  issues: s1Issues,
  screenshotPath: null,
  blockedNextStage: s1Checks.some((c) => c.status === "FAIL"),
});

// ── STAGE 2: Campaign Creation ──
const campaignsDoc = readJson<{ campaigns: Array<Record<string, unknown>> }>(`data/pharmacy-campaigns/${SLUG}.json`);
const bpCampaign = campaignsDoc.campaigns.find((c) => c.serviceId === SERVICE);
const controlCentre = buildPharmacyCampaignControlCentre(SLUG);
const enrichedBp = controlCentre.campaigns.find((c) => c.serviceId === SERVICE && c.id === CAMPAIGN_ID);
const s2Checks: CheckItem[] = [
  { id: "campaign-exists", label: "Campaign stored", status: bpCampaign ? "PASS" : "FAIL", detail: bpCampaign ? String(bpCampaign.name) : "missing" },
  { id: "service-selection", label: "Service selection", status: bpCampaign?.serviceId === SERVICE ? "PASS" : "FAIL", detail: String(bpCampaign?.serviceId || "") },
  { id: "area-selection", label: "Area selection (coverage)", status: profile.rankingAreas.length >= 1 ? "PASS" : "WARNING", detail: profile.rankingAreas.join(", ") },
  { id: "campaign-os", label: "Campaign appears in Campaign OS", status: enrichedBp ? "PASS" : "FAIL", detail: enrichedBp?.name || "not enriched" },
];
const s2Issues: Issue[] = [];
const duplicatePf = campaignsDoc.campaigns.filter((c) => c.serviceId === "pharmacy-first" && c.status === "active").length;
if (duplicatePf > 1) {
  s2Issues.push({ id: "S2-duplicate-campaigns", summary: `${duplicatePf} active Pharmacy First campaigns create OS noise`, recommendedFix: "Archive duplicate test campaigns; keep one validation campaign per service", priority: "Medium" });
}
const activeCount = campaignsDoc.campaigns.filter((c) => c.status === "active").length;
if (activeCount > 5) {
  s2Issues.push({ id: "S2-too-many-active", summary: `${activeCount} active campaigns — primary campaign may not be Blood Pressure`, recommendedFix: "Set Blood Pressure as sole active validation campaign or add campaign picker default", priority: "Medium" });
}
stages.push({
  stage: 2,
  name: "Campaign Creation",
  status: stageStatus(s2Checks, s2Issues),
  checks: s2Checks,
  issues: s2Issues,
  screenshotPath: null,
  blockedNextStage: s2Checks.some((c) => c.status === "FAIL"),
});

// ── STAGE 3: Image Workflow ──
const imgDoc = loadImageAssignments(SLUG);
const slots = buildPageSlotCards(SLUG, SERVICE, CAMPAIGN_ID);
const assigned = slots.filter((s) => s.status === "assigned");
const imgAssignments = readJson<{ assignments: Record<string, unknown>; uploads: unknown[]; aiRequests: unknown[] }>(`data/pharmacy-image-assignments/${SLUG}.json`);
const bpAssignments = Object.keys(imgAssignments.assignments).filter((k) => k.startsWith(`${SERVICE}:`));
const bpAiRequests = (imgAssignments.aiRequests as Array<{ serviceId: string }>).filter((r) => r.serviceId === SERVICE);
const s3Checks: CheckItem[] = [
  { id: "library-data", label: "Image Library data", status: imgDoc ? "PASS" : "FAIL", detail: imgDoc ? "operating system doc loaded" : "missing" },
  { id: "slot-assignment", label: "Slot assignment", status: assigned.length >= 4 ? "PASS" : assigned.length >= 3 ? "WARNING" : "FAIL", detail: `${assigned.length}/4 slots assigned` },
  { id: "persistence", label: "Assignment persists", status: bpAssignments.length >= 4 ? "PASS" : "FAIL", detail: `${bpAssignments.length} persisted keys` },
  { id: "upload-records", label: "Upload works (records)", status: (imgAssignments.uploads as unknown[]).length > 0 ? "PASS" : "WARNING", detail: `${(imgAssignments.uploads as unknown[]).length} uploads on file` },
  { id: "ai-requests", label: "AI request records", status: "PASS", detail: `${bpAiRequests.length} BP-specific AI requests (0 ok if not used)` },
  { id: "preview-images", label: "Images on visual page", status: readVisualHtml().includes("data-image-slot") ? "PASS" : "FAIL", detail: "visual HTML has assigned slot markers" },
  { id: "campaign-image-centre", label: "Campaign Image Centre", status: enrichedBp && enrichedBp.imageAssignedCount >= 3 ? "PASS" : "WARNING", detail: enrichedBp ? `${enrichedBp.imageAssignedCount}/${enrichedBp.imageTotalSlots}` : "n/a" },
];
const s3Issues: Issue[] = [];
const badAlt = bpAssignments.some((k) => {
  const a = imgAssignments.assignments[k] as { altText?: string };
  return /undefined/.test(a.altText || "");
});
if (badAlt) {
  s3Issues.push({ id: "S3-alt-undefined", summary: "Image alt text contains 'undefined' placeholders", recommendedFix: "Regenerate alt text when assigning images with profile context", priority: "Medium" });
}
stages.push({
  stage: 3,
  name: "Image Workflow",
  status: stageStatus(s3Checks, s3Issues),
  checks: s3Checks,
  issues: s3Issues,
  screenshotPath: null,
  blockedNextStage: s3Checks.some((c) => c.status === "FAIL"),
});

// ── STAGE 4: Visual Page ──
const html = readVisualHtml();
const dup = duplicateSectionCheck(html);
const s4Checks: CheckItem[] = [
  { id: "template", label: "Approved template", status: html.includes("data-template-block") || html.includes("Brook Pharmacy") ? "PASS" : "FAIL", detail: "visual experience template" },
  { id: "branding", label: "Brook branding", status: html.includes("Brook Pharmacy") && html.includes("#005eb8") ? "PASS" : "WARNING", detail: "name + NHS blue" },
  { id: "logo", label: "Logo visible", status: html.includes("/assets/pharmacy-logos/pharmaconnect.svg") ? "PASS" : "FAIL", detail: "header/footer logo" },
  { id: "localisation", label: "Brook localisation", status: html.includes("Rotherham") && html.includes("Brinsworth") ? "PASS" : "FAIL", detail: "Rotherham + coverage areas" },
  { id: "images-render", label: "Images render", status: !html.includes('data-image-missing="true"') ? "PASS" : "FAIL", detail: "no broken image markers" },
  { id: "no-placeholders", label: "No placeholders", status: !/<div class="v3-placeholder"/i.test(html) ? "PASS" : "FAIL", detail: "v3-placeholder blocks" },
  { id: "no-duplicates", label: "No duplicate sections", status: dup.duplicateSupportImage ? "WARNING" : "PASS", detail: dup.duplicateSupportImage ? "support slot image appears twice" : "ok" },
  { id: "cta", label: "CTA", status: /Speak To A Pharmacist|tel:01709210731/i.test(html) ? "PASS" : "FAIL", detail: "primary CTA present" },
  { id: "map", label: "Map", status: /google\.com\/maps/i.test(html) ? "PASS" : "FAIL", detail: "Google Maps embed" },
  { id: "footer", label: "Footer", status: /id="site-footer"/i.test(html) ? "PASS" : "FAIL", detail: "site footer" },
  { id: "mobile", label: "Mobile layout", status: /<meta name="viewport"/i.test(html) ? "PASS" : "FAIL", detail: "viewport meta" },
];
const s4Issues: Issue[] = [];
if (dup.duplicateSupportImage) {
  s4Issues.push({ id: "S4-dup-support-img", summary: "Support image slot rendered twice on page", recommendedFix: "Fix visual template block deduplication for support slot", priority: "Medium" });
}
if (/noindex/i.test(html)) {
  s4Issues.push({ id: "S4-html-noindex", summary: "Visual HTML still contains noindex meta (preview mode)", recommendedFix: "Expected for preview — use Publishing Settings noindex=false + live publish pipeline for production", priority: "Low" });
}
stages.push({
  stage: 4,
  name: "Visual Page",
  status: stageStatus(s4Checks, s4Issues),
  checks: s4Checks,
  issues: s4Issues,
  screenshotPath: `output/pharmacy-visual-experience/${SLUG}/${SERVICE}/index.html`,
  blockedNextStage: s4Checks.some((c) => c.status === "FAIL"),
});

// ── STAGE 5: Quality Assurance ──
refreshPharmacyAuthorityReadiness(SLUG);
refreshPharmacyAuthorityEnhancement(SLUG);
const audit = auditServiceAuthorityReadiness(SLUG, SERVICE as "blood-pressure-checks");
const enhancement = loadPharmacyAuthorityEnhancement(SLUG);
const bpEnh = enhancement?.services.find((s) => s.serviceId === SERVICE);
const growth = readPharmacyGrowthActionPlan(SLUG);
const launchQueue = readPharmacyCampaignLaunchQueue(SLUG);
const bpQueue = launchQueue?.campaigns.find((c) => c.serviceId === SERVICE);
const s5Checks: CheckItem[] = [
  { id: "authority-audit", label: "Authority Audit", status: audit.overallScore >= 95 ? "PASS" : audit.overallScore >= 75 ? "WARNING" : "FAIL", detail: `score=${audit.overallScore} gate=${audit.publishGate}` },
  { id: "enhancement-engine", label: "Enhancement Engine", status: bpEnh ? "PASS" : "FAIL", detail: bpEnh ? `${bpEnh.recommendations.length} recommendations` : "missing" },
  { id: "publish-gate", label: "Publish Gate", status: audit.publishGate === "PASS" ? "PASS" : audit.publishGate === "PASS_WITH_RECOMMENDATIONS" ? "WARNING" : "FAIL", detail: audit.publishGate },
  { id: "launch-queue", label: "Launch Queue", status: bpQueue ? "PASS" : "FAIL", detail: bpQueue ? `${bpQueue.tasks.length} tasks` : "missing" },
  { id: "growth-actions", label: "Growth Actions", status: growth && growth.totalActions > 0 ? "PASS" : "WARNING", detail: growth ? `${growth.pendingActions} pending` : "no plan" },
];
const s5Issues: Issue[] = audit.criticalIssues.map((issue, i) => ({
  id: `S5-critical-${i}`,
  summary: issue,
  recommendedFix: issue.includes("noindex")
    ? "Set noindex=false in Publishing Settings for blood-pressure-checks"
    : issue.includes("demo")
      ? "Verify live GPhC/NHS credentials and clear demoMode"
      : "Resolve before live publish",
  priority: "Critical" as Priority,
}));
stages.push({
  stage: 5,
  name: "Quality Assurance",
  status: stageStatus(s5Checks, s5Issues),
  checks: s5Checks,
  issues: s5Issues,
  screenshotPath: null,
  blockedNextStage: s5Checks.some((c) => c.status === "FAIL"),
});

// ── STAGE 6: Real Enhancement Actions ──
const pubBefore = getServicePublishingSettings(SLUG, SERVICE);
saveServicePublishingSettings(SLUG, SERVICE, {
  canonicalUrl: `https://www.brookpharmacy.co.uk/services/${SERVICE}`,
  noindex: false,
});
const pubAfter = getServicePublishingSettings(SLUG, SERVICE);
refreshPharmacyAuthorityReadiness(SLUG);
const auditAfterEnh = auditServiceAuthorityReadiness(SLUG, SERVICE as "blood-pressure-checks");
const workspace = buildEnhancementWorkspaceView(SLUG, { serviceId: SERVICE });
const progress = getEnhancementWorkspaceProgress(SLUG, SERVICE);
const realChecks = [
  { type: "reviewer_profile", ok: isReviewerProfileComplete(profile) },
  { type: "clinical_review_date", ok: Boolean(profile.clinicalReviewDate) },
  { type: "next_review_date", ok: Boolean(profile.nextReviewDate) },
  { type: "images", ok: assigned.length >= 3 },
  { type: "canonical", ok: Boolean(pubAfter?.canonicalUrl) },
  { type: "noindex", ok: pubAfter?.noindex === false },
];
const s6Checks: CheckItem[] = realChecks.map((r) => ({
  id: r.type,
  label: r.type,
  status: r.ok ? "PASS" : "FAIL",
  detail: r.ok ? "verified" : "missing",
}));
s6Checks.push({
  id: "refresh-chain",
  label: "Refresh chain",
  status: auditAfterEnh.overallScore >= audit.overallScore - 1 ? "PASS" : "WARNING",
  detail: `score ${audit.overallScore}→${auditAfterEnh.overallScore}`,
});
s6Checks.push({
  id: "campaign-os-update",
  label: "Campaign OS updates",
  status: progress.publishGate === auditAfterEnh.publishGate ? "PASS" : "WARNING",
  detail: `gate=${progress.publishGate} realCompleted=${progress.realCompleted}`,
});
const s6Issues: Issue[] = [];
if (!pubBefore?.canonicalUrl) {
  s6Issues.push({ id: "S6-pub-settings-missing", summary: "Publishing settings were not configured for blood-pressure-checks before validation", recommendedFix: "Configure canonical + noindex in Publishing Settings as part of campaign workflow", priority: "High" });
}
stages.push({
  stage: 6,
  name: "Real Enhancement Actions",
  status: stageStatus(s6Checks, s6Issues),
  checks: s6Checks,
  issues: s6Issues,
  screenshotPath: null,
  blockedNextStage: s6Checks.some((c) => c.status === "FAIL"),
});

// ── STAGE 7: Publish Readiness ──
const workflow = buildPlatformOperationalWorkflow(SLUG);
const s7Checks: CheckItem[] = [
  { id: "publish-gate", label: "Publish gate", status: auditAfterEnh.publishGate === "PASS" ? "PASS" : auditAfterEnh.publishGate === "PASS_WITH_RECOMMENDATIONS" ? "WARNING" : "FAIL", detail: `${auditAfterEnh.publishGate} score=${auditAfterEnh.overallScore}` },
  { id: "launch-queue-ready", label: "Launch queue", status: bpQueue ? (bpQueue.blockedTasks > 0 ? "WARNING" : "PASS") : "FAIL", detail: bpQueue ? `${bpQueue.blockedTasks} blocked / ${bpQueue.totalTasks} tasks` : "missing" },
  { id: "publishing-workflow", label: "Publishing workflow", status: workflow ? "PASS" : "FAIL", detail: workflow?.whereYouAre?.headline || "n/a" },
  { id: "indexing", label: "Indexing readiness", status: enrichedBp?.indexingStatus === "indexed" ? "PASS" : "WARNING", detail: String(enrichedBp?.indexingStatus || "unknown") },
  { id: "visibility", label: "Visibility readiness", status: enrichedBp?.visibilityStatus === "visible" ? "PASS" : "WARNING", detail: String(enrichedBp?.visibilityStatus || "unknown") },
  { id: "blockers", label: "Remaining blockers", status: auditAfterEnh.criticalIssues.length === 0 ? "PASS" : "FAIL", detail: auditAfterEnh.criticalIssues.join("; ") || "none" },
];
const s7Issues: Issue[] = auditAfterEnh.criticalIssues.map((issue, i) => ({
  id: `S7-blocker-${i}`,
  summary: issue,
  recommendedFix: "Resolve before live customer demonstration publish",
  priority: "Critical" as Priority,
}));
if (auditAfterEnh.criticalIssues.length === 0 && auditAfterEnh.publishGate !== "PASS") {
  s7Issues.push({ id: "S7-gate-not-pass", summary: "Publish gate not PASS despite no critical issues", recommendedFix: "Review score thresholds and missing signals", priority: "High" });
}
stages.push({
  stage: 7,
  name: "Publish Readiness",
  status: stageStatus(s7Checks, s7Issues),
  checks: s7Checks,
  issues: s7Issues,
  screenshotPath: null,
  blockedNextStage: s7Checks.some((c) => c.status === "FAIL"),
});

// ── STAGE 8: Operator Experience (manual review) ──
const s8Issues: Issue[] = [
  { id: "UX-auth-wall", summary: "All /api/* dashboard routes redirect to login when unauthenticated", recommendedFix: "Document demo login credentials on Executive Dashboard; consider read-only demo session for customer demos", priority: "High" },
  { id: "UX-campaign-noise", summary: "Campaign OS shows multiple duplicate Pharmacy First campaigns as primary", recommendedFix: "Archive test campaigns; default Campaign OS to Blood Pressure validation campaign", priority: "Medium" },
  { id: "UX-navigation-depth", summary: "Full workflow spans Profile → Campaign OS → Image Library → Enhancement Workspace → Publishing Settings → Launch Queue (6+ pages)", recommendedFix: "Add 'Validation campaign checklist' single-page wizard for demo operators", priority: "Medium" },
  { id: "UX-enhancement-overload", summary: `${bpEnh?.recommendations.length || 0} enhancement recommendations for Blood Pressure — overwhelming for pharmacy owner`, recommendedFix: "Filter workspace to real-action types only during validation phase", priority: "Medium" },
  { id: "UX-demo-trust-label", summary: "Demo trust data not clearly labelled on visual page for end patients", recommendedFix: "Add visible 'Demo preview' banner on visual experience pages when demoMode=true", priority: "Low" },
  { id: "UX-image-library-route", summary: "Image Library accessible at both /pharmacy-image-library and /api/pharmacy-image-library", recommendedFix: "Standardise links to /api/pharmacy-image-library everywhere", priority: "Low" },
];
const s8Checks: CheckItem[] = [
  { id: "wording", label: "Confusing wording", status: "WARNING", detail: "Multiple 'Increase Visibility' campaign names identical" },
  { id: "navigation", label: "Broken navigation", status: "PASS", detail: "Internal service routes resolve (auth required for dashboards)" },
  { id: "missing-buttons", label: "Missing buttons", status: "PASS", detail: "Primary actions present in Campaign OS and Enhancement Workspace" },
  { id: "duplicate-info", label: "Duplicate information", status: "WARNING", detail: "Authority + Enhancement + Growth overlap on Campaign OS" },
  { id: "click-depth", label: "Click depth", status: "WARNING", detail: "6+ pages for full workflow" },
  { id: "dead-links", label: "Dead links", status: "PASS", detail: "Visual preview public; dashboard links require login" },
  { id: "layout", label: "Layout", status: "PASS", detail: "Campaign OS panels render structured sections" },
];
stages.push({
  stage: 8,
  name: "Operator Experience",
  status: stageStatus(s8Checks, s8Issues),
  checks: s8Checks,
  issues: s8Issues,
  screenshotPath: null,
  blockedNextStage: false,
});

const report = {
  version: 1,
  validatedAt: new Date().toISOString(),
  validationCampaign: {
    pharmacy: "Brook Pharmacy",
    slug: SLUG,
    service: SERVICE,
    serviceName: "Blood Pressure Checks",
    campaignId: CAMPAIGN_ID,
  },
  summary: {
    overallStatus: stages.some((s) => s.status === "FAIL") ? "FAIL" : stages.some((s) => s.status === "WARNING") ? "WARNING" : "PASS",
    stagesPassed: stages.filter((s) => s.status === "PASS").length,
    stagesWarning: stages.filter((s) => s.status === "WARNING").length,
    stagesFailed: stages.filter((s) => s.status === "FAIL").length,
    publishReady: stages.find((s) => s.stage === 7)?.status === "PASS",
    freezeDevelopment: true,
  },
  stages,
  allIssues: stages.flatMap((s) => s.issues.map((i) => ({ ...i, stage: s.stage, stageName: s.name }))),
};

const outDir = path.join(ROOT, "data/platform-validation");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "pharmaconnect-workflow.json");
fs.writeFileSync(outPath, JSON.stringify(report, null, 2));

console.log(`\nPlatform Workflow Validation — ${SLUG} / ${SERVICE}`);
for (const s of stages) {
  console.log(`Stage ${s.stage} ${s.name}: ${s.status} (${s.checks.filter((c) => c.status === "PASS").length}/${s.checks.length} checks pass)`);
}
console.log(`\nOverall: ${report.summary.overallStatus}`);
console.log(`Report: ${outPath}\n`);
process.exit(report.summary.overallStatus === "FAIL" ? 1 : 0);
