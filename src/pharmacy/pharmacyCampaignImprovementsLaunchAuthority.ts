/**
 * Campaign Improvements — Required Before Launch uses the existing publication/readiness gate.
 * Score-improving recommendations are not launch blockers when the gate already allows publish.
 * Does not write tenant records.
 */
import type { PublishGate } from "./pharmacyAuthorityReadinessService.ts";

export interface CampaignImprovementsLaunchAuthority {
  publishGate: PublishGate;
  overallScore: number;
  label: string;
  criticalIssues: string[];
  missingSignals: string[];
  livePublishReady: boolean;
}

export interface CampaignImprovementsPublicationTask {
  signalId?: string;
  title?: string;
  reason?: string;
  evidence?: string[];
}

function normalize(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function publicationAllowsLaunch(publishGate: PublishGate): boolean {
  return publishGate !== "FAIL";
}

export function emptyCampaignImprovementsLaunchAuthority(): CampaignImprovementsLaunchAuthority {
  return {
    publishGate: "PASS_WITH_RECOMMENDATIONS",
    overallScore: 0,
    label: "Needs Enhancement",
    criticalIssues: [],
    missingSignals: [],
    livePublishReady: true,
  };
}

/** Distinctive tokens shared by the readiness gate's critical issues and improvement recs. */
function publicationBlockerFamily(text: string): string | null {
  const s = normalize(text);
  if (!s) return null;
  if (/\bnoindex\b|indexable/.test(s)) return "noindex";
  if (/visual (service )?page|build page|visual build pipeline/.test(s)) return "visual-page";
  if (/\bh1\b/.test(s)) return "h1";
  if (/meta description/.test(s)) return "meta-description";
  if (/placeholder|image missing|data image missing/.test(s)) return "image-placeholder";
  if (/\bdemo\b|\bmock\b/.test(s)) return "demo-trust";
  if (/technical publish/.test(s)) return "technical-publish";
  if (/canonical/.test(s)) return "canonical";
  return null;
}

export function taskMatchesPublicationBlocker(
  task: CampaignImprovementsPublicationTask,
  requirement: string,
): boolean {
  const req = normalize(requirement);
  const hay = normalize(
    [task.signalId, task.title, task.reason, ...(task.evidence || [])].join(" "),
  );
  if (!req || !hay) return false;
  if (hay.includes(req) || (normalize(task.title) && req.includes(normalize(task.title)))) return true;
  const family = publicationBlockerFamily(requirement);
  if (family && publicationBlockerFamily(hay) === family) return true;
  if (task.signalId === "build-page" && family === "visual-page") return true;
  return false;
}

/**
 * An improvement is Required Before Launch only when the existing publication gate
 * is FAIL and this item matches an unsatisfied requirement that actually prevents publish.
 * PASS / PASS_WITH_RECOMMENDATIONS never invent launch blockers from score-gain items.
 */
export function improvementIsRequiredBeforeLaunch(
  task: CampaignImprovementsPublicationTask,
  authority: Pick<CampaignImprovementsLaunchAuthority, "publishGate" | "criticalIssues" | "missingSignals">,
): boolean {
  if (publicationAllowsLaunch(authority.publishGate)) return false;
  const blockers =
    authority.criticalIssues.length > 0 ? authority.criticalIssues : authority.missingSignals;
  return blockers.some((blocker) => taskMatchesPublicationBlocker(task, blocker));
}

export function campaignImprovementsWorkflowNext(input: {
  livePublishReady: boolean;
  slug: string;
  serviceId: string | null;
}): { nextStepUrl: string; nextStepLabel: string } {
  const s = String(input.slug || "").trim() || "pharmacy";
  if (input.livePublishReady && input.serviceId) {
    return {
      nextStepUrl: `/api/pharmacy-publishing-settings?slug=${encodeURIComponent(s)}&service=${encodeURIComponent(input.serviceId)}`,
      nextStepLabel: "Continue to Ready To Publish",
    };
  }
  return {
    nextStepUrl: `/api/pharmacy-dashboard?slug=${encodeURIComponent(s)}`,
    nextStepLabel: "Resolve launch blockers",
  };
}
