/**
 * Content Review UX V2 — actionable tasks from authority audit data (UI layer only).
 */
import type { ServiceAuthorityAudit, PublishGate } from "./pharmacyAuthorityReadinessService.ts";

export type ContentReviewTier = "required" | "recommended" | "ready";

export interface ContentReviewTask {
  id: string;
  title: string;
  why: string;
  buttonLabel: string;
  url: string;
  tier: ContentReviewTier;
  status: "open" | "done";
}

export interface ContentReviewPanels {
  overallReviewStatus: string;
  publishReady: boolean;
  hasRecommended: boolean;
  readyForPublishing: ContentReviewTask[];
  requiredBeforePublishing: ContentReviewTask[];
  recommendedImprovements: ContentReviewTask[];
}

function taskFromSignal(
  signal: string,
  slug: string,
  serviceId: string,
  tier: ContentReviewTier,
): ContentReviewTask {
  const s = slug;
  const lower = signal.toLowerCase();
  let title = signal;
  let why = "This helps your page perform better for patients and search engines.";
  let buttonLabel = "Review Content";
  let url = `/api/pharmacy-authority-readiness?slug=${s}&service=${serviceId}`;

  if (/breadcrumb|structured data|schema|json-ld|webpage|organization|localbusiness/i.test(lower)) {
    title = lower.includes("breadcrumb") ? "Add breadcrumb navigation" : "Help search engines understand your page";
    why = "Structured data helps Google understand your page hierarchy and service details.";
    buttonLabel = "Review Structured Data";
    url = `/api/pharmacy-structured-data-review?slug=${s}&service=${serviceId}`;
  } else if (/ai citation|ai readiness|citation|chatgpt|generative/i.test(lower)) {
    title = "Improve AI answers about your pharmacy";
    why = "Clear, trustworthy content helps AI assistants cite your pharmacy accurately.";
    buttonLabel = "Review Content";
    url = `/api/pharmacy-enhancement-workspace?slug=${s}&service=${serviceId}`;
  } else if (/demo|mock|placeholder/i.test(lower)) {
    title = "Remove demo wording from your page";
    why = "Live pages should use real pharmacy credentials, not placeholder text.";
    buttonLabel = "Update Profile";
    url = `/api/pharmacy-profile-dashboard?slug=${s}#section-trust`;
  } else if (/reviewer|superintendent|gphc|expertise|eeat|trust|clinical review/i.test(lower)) {
    title = "Add professional review details";
    why = "Healthcare pages perform better when a qualified pharmacist is clearly identified.";
    buttonLabel = "Open Profile Dashboard";
    url = `/api/pharmacy-profile-dashboard?slug=${s}#section-professional-review`;
  } else if (/image|photo|placeholder|visual/i.test(lower)) {
    title = "Add missing images";
    why = "Professional photos build trust and help patients recognise your pharmacy.";
    buttonLabel = "Open Image Library";
    url = `/api/pharmacy-image-library?slug=${s}&service=${serviceId}`;
  } else if (/canonical|noindex|indexable|publish|meta description|h1/i.test(lower)) {
    title = lower.includes("noindex") ? "Allow your page to appear in search" : "Fix publishing settings";
    why = "Correct publishing settings ensure your page can go live and be found online.";
    buttonLabel = "Ready To Publish";
    url = `/api/pharmacy-publishing-settings?slug=${s}&service=${serviceId}`;
  } else if (/local|area|town|coverage|neighbourhood/i.test(lower)) {
    title = "Make your location clearer";
    why = "Local patients need to know which areas your pharmacy serves.";
    buttonLabel = "Update Target Areas";
    url = `/api/pharmacy-profile-dashboard?slug=${s}#section-coverage`;
  } else if (/ecosystem|faq|guide|content ecosystem/i.test(lower)) {
    title = "Add supporting content";
    why = "Supporting pages answer patient questions and strengthen your campaign.";
    buttonLabel = "Open Campaign OS";
    url = `/api/pharmacy-campaigns?slug=${s}`;
  } else {
    title = signal.replace(/^(missing|no)\s+/i, "Add ").replace(/\s+signal$/i, "");
    why = "Completing this improves your page readiness before publishing.";
    buttonLabel = "Campaign Improvements";
    url = `/api/pharmacy-enhancement-workspace?slug=${s}&service=${serviceId}`;
  }

  return {
    id: `task-${tier}-${signal.slice(0, 40).replace(/\W+/g, "-")}`,
    title,
    why,
    buttonLabel,
    url,
    tier,
    status: "open",
  };
}

export function buildContentReviewPanels(
  audit: ServiceAuthorityAudit,
  slug: string,
): ContentReviewPanels {
  const requiredBeforePublishing: ContentReviewTask[] = [];
  const recommendedImprovements: ContentReviewTask[] = [];
  const seen = new Set<string>();

  const add = (signal: string, tier: ContentReviewTier) => {
    const key = signal.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const t = taskFromSignal(signal, slug, audit.serviceId, tier);
    if (tier === "required") requiredBeforePublishing.push(t);
    else recommendedImprovements.push(t);
  };

  for (const issue of audit.criticalIssues) add(issue, "required");
  for (const signal of audit.missingSignals) {
    add(signal, audit.publishGate === "FAIL" ? "required" : "recommended");
  }
  for (const rec of audit.recommendedEnhancements) add(rec, "recommended");

  const publishReady = audit.publishGate === "PASS" || audit.publishGate === "PASS_WITH_RECOMMENDATIONS";
  const hasRecommended = recommendedImprovements.length > 0;

  const readyForPublishing: ContentReviewTask[] = publishReady
    ? [
        {
          id: "ready-publish",
          title: "Ready for publishing",
          why:
            hasRecommended && audit.label === "Excellent"
              ? "Your review passed. Recommended improvements are optional before launch."
              : "Your page meets the minimum requirements to publish.",
          buttonLabel: "Ready To Publish",
          url: `/api/pharmacy-publishing-settings?slug=${slug}&service=${audit.serviceId}`,
          tier: "ready",
          status: "done",
        },
      ]
    : [];

  let overallReviewStatus = audit.label;
  if (audit.label === "Excellent" && hasRecommended) {
    overallReviewStatus = "Excellent — recommended improvements available";
  } else if (audit.publishGate === "FAIL") {
    overallReviewStatus = "Needs attention before publishing";
  } else if (audit.publishGate === "PASS_WITH_RECOMMENDATIONS") {
    overallReviewStatus = "Ready with recommended improvements";
  }

  return {
    overallReviewStatus,
    publishReady,
    hasRecommended,
    readyForPublishing,
    requiredBeforePublishing,
    recommendedImprovements,
  };
}

export function reviewStatusLabel(gate: PublishGate): string {
  if (gate === "PASS") return "Ready for publishing";
  if (gate === "PASS_WITH_RECOMMENDATIONS") return "Ready — improvements available";
  return "Required items need attention";
}
