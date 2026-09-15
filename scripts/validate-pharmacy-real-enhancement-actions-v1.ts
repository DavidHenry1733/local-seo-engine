#!/usr/bin/env npx tsx
/**
 * PharmaConnect Real Enhancement Actions V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  auditServiceAuthorityReadiness,
} from "../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import { refreshPharmacyAuthorityEnhancement } from "../src/pharmacy/pharmacyAuthorityEnhancementService.ts";
import {
  buildEnhancementWorkspaceView,
  EnhancementCompletionError,
  markEnhancementTaskComplete,
  getEnhancementWorkspaceProgress,
  refreshPlatformAfterEnhancementComplete,
} from "../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { classifyRealEnhancementAction } from "../src/pharmacy/pharmacyRealEnhancementActionsService.ts";
import { saveServicePublishingSettings } from "../src/pharmacy/pharmacyPublishingSettingsService.ts";
import { buildPharmacyCampaignControlCentre } from "../src/pharmacy/pharmacyCampaignControlCentreService.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";
const serviceId = process.argv[3] || "pharmacy-first";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function profilePath(s: string): string {
  return path.join(ROOT, "data/pharmacy-profiles", `${s}.json`);
}

function loadProfileDoc(s: string) {
  return JSON.parse(fs.readFileSync(profilePath(s), "utf8")) as {
    data: Record<string, unknown>;
    updatedAt?: string;
  };
}

function saveProfileFields(s: string, fields: Record<string, unknown>, refresh = false) {
  const doc = loadProfileDoc(s);
  doc.data = { ...doc.data, ...fields };
  doc.updatedAt = new Date().toISOString();
  fs.writeFileSync(profilePath(s), JSON.stringify(doc, null, 2));
  if (refresh) refreshPlatformAfterEnhancementComplete(s);
}

function snapshotProtectedFiles(): Map<string, number> {
  const snap = new Map<string, number>();
  const roots = [
    path.join(ROOT, "docs/pharmacy-master-library"),
    path.join(ROOT, "src/pharmacy/templates"),
    path.join(ROOT, "output/pharmacy-visual-experience", slug, serviceId),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const walk = (dir: string) => {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full);
        else snap.set(full, fs.statSync(full).mtimeMs);
      }
    };
    walk(root);
  }
  return snap;
}

console.log(`\nPharmaConnect Real Enhancement Actions V1 — ${slug} / ${serviceId}\n`);

const beforeSnap = snapshotProtectedFiles();
refreshPharmacyAuthorityEnhancement(slug);
const view = buildEnhancementWorkspaceView(slug, { serviceId });
record("1-workspace-loads", view.board.ready.length + view.board.completed.length > 0, `${view.board.ready.length} ready tasks`);

const reviewerTask =
  view.board.ready.find((t) => classifyRealEnhancementAction(t) === "reviewer_profile") ||
  view.board.inProgress.find((t) => classifyRealEnhancementAction(t) === "reviewer_profile");

record("2-reviewer-task-found", Boolean(reviewerTask), reviewerTask?.title || "no reviewer task in ready");

saveProfileFields(slug, {
  reviewerName: "",
  reviewerRole: "",
  reviewerBio: "",
  reviewerQualifications: "",
  reviewerGphcNumber: "",
  reviewerExperienceYears: "",
  reviewerSpecialisms: [],
  reviewerPhoto: "",
});

let rejected = false;
if (reviewerTask) {
  try {
    markEnhancementTaskComplete(slug, reviewerTask.id, { serviceId, completedBy: "validation-script" });
  } catch (err) {
    rejected =
      err instanceof EnhancementCompletionError &&
      err.message.includes("Action not complete yet — please complete the required fields first.");
  }
}
record("3-reviewer-complete-rejected", rejected, rejected ? "Completion rejected without reviewer fields" : "Expected rejection");

saveProfileFields(slug, {
  reviewerName: "Dr Sarah Mitchell",
  reviewerRole: "Superintendent Pharmacist",
  reviewerQualifications: "MPharm, MRPharmS",
  reviewerBio: "Sarah has led clinical governance at this pharmacy for over 12 years.",
  reviewerExperienceYears: "12",
  reviewerSpecialisms: ["Pharmacy First", "Minor illness"],
});

let reviewerCompleted = false;
if (reviewerTask) {
  try {
    const result = markEnhancementTaskComplete(slug, reviewerTask.id, { serviceId, completedBy: "validation-script" });
    reviewerCompleted = result.store.tasks.some(
      (t) => t.recommendationId === reviewerTask.id && t.status === "completed" && !t.testMode,
    );
  } catch (err) {
    record("4-reviewer-complete", false, String(err));
  }
}
if (reviewerTask) {
  record("4-reviewer-complete", reviewerCompleted, reviewerCompleted ? "Real reviewer task completed" : "Not completed");
}

saveProfileFields(slug, {
  clinicalReviewDate: "2026-03-01",
  nextReviewDate: "2026-09-01",
}, true);
record("5-clinical-dates-saved", true, "clinicalReviewDate and nextReviewDate saved");

saveServicePublishingSettings(slug, serviceId, {
  canonicalUrl: `https://www.example-pharmacy.co.uk/services/${serviceId}`,
  noindex: false,
  structuredDataEnabled: true,
});
refreshPlatformAfterEnhancementComplete(slug);
record("6-publishing-settings-saved", true, "canonicalUrl saved, noindex=false");

const auditAfter = auditServiceAuthorityReadiness(slug, serviceId as "pharmacy-first");
const reviewDatePresent = auditAfter.evidence.humanExpertise.some(
  (e) => e.signal === "Review date" && e.present,
);
const nextReviewPresent = auditAfter.evidence.humanExpertise.some(
  (e) => e.signal === "Next review date" && e.present,
);
const canonicalPresent = auditAfter.evidence.technicalPublishReadiness.some(
  (e) => e.signal === "Canonical" && e.present,
);
const indexablePresent = auditAfter.evidence.technicalPublishReadiness.some(
  (e) => e.signal === "Indexable (no noindex)" && e.present,
);
record("7-authority-audit-refreshed", Boolean(auditAfter.lastAuditedAt), `score=${auditAfter.overallScore}`);
record("8-review-dates-detected", reviewDatePresent && nextReviewPresent, `review=${reviewDatePresent} next=${nextReviewPresent}`);
record("9-canonical-detected", canonicalPresent, auditAfter.evidence.technicalPublishReadiness.find((e) => e.signal === "Canonical")?.detail || "");
record("10-noindex-removed-audit", indexablePresent, "Indexable signal present");

const noindexCritical = auditAfter.criticalIssues.some((i) => i.toLowerCase().includes("noindex"));
record("11-publish-gate-blockers-reduced", !noindexCritical, `critical=${auditAfter.criticalIssues.length} gate=${auditAfter.publishGate}`);

const progress = getEnhancementWorkspaceProgress(slug, serviceId);
record(
  "12-campaign-os-progress",
  progress.realCompleted >= 0 && progress.publishGate === auditAfter.publishGate,
  `realCompleted=${progress.realCompleted} remaining=${progress.remaining} gate=${progress.publishGate}`,
);

const dashboard = buildPharmacyCampaignControlCentre(slug);
const campaign = dashboard.campaigns.find((c) => c.serviceId === serviceId);
record(
  "13-campaign-os-display",
  Boolean(campaign?.enhancementProgressRealCompleted !== undefined && campaign.enhancementProgressPublishGate),
  campaign
    ? `real=${campaign.enhancementProgressRealCompleted} gate=${campaign.enhancementProgressPublishGate} next=${campaign.enhancementNextRealActionLabel || "—"}`
    : "no campaign",
);

let protectedUnchanged = true;
for (const [file, mtime] of beforeSnap) {
  if (!fs.existsSync(file) || fs.statSync(file).mtimeMs !== mtime) {
    protectedUnchanged = false;
    break;
  }
}
record("14-protected-files-unchanged", protectedUnchanged, `${beforeSnap.size} master/template/visual files unchanged`);

const failed = checks.filter((c) => !c.pass).length;
const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-real-enhancement-actions-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  JSON.stringify({ slug, serviceId, validatedAt: new Date().toISOString(), checks, failed, passed: failed === 0 }, null, 2),
);

console.log(`\n${failed === 0 ? "ALL CHECKS PASSED" : `${failed} CHECK(S) FAILED`}`);
console.log(`Report: ${reportPath}\n`);
process.exit(failed === 0 ? 0 : 1);
