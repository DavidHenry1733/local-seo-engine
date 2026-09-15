/**
 * Isolated AI local-page candidate paths — not live pages, not Prompt 91/92 candidates.
 */
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export const AI_LOCAL_AREA_PAGE_CANDIDATE_ASSET = "ai-local-area-page-candidate";
export const AI_CANDIDATE_PREVIEW_BANNER = "AI copy candidate — not published";
export const AI_LOCAL_COPY_RECORD_DIRNAME = "data/pharmacy-ai-local-copy-candidates";
export const AI_LOCAL_PAGE_CANDIDATE_DIRNAME = "output/pharmacy-ai-local-page-candidates";

export function getAiLocalCopyRecordRoot(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, AI_LOCAL_COPY_RECORD_DIRNAME, slug, serviceId);
}

export function aiLocalCopyRecordPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(getAiLocalCopyRecordRoot(slug, serviceId), `${areaSlug}.json`);
}

export function getAiLocalPageCandidateRoot(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, AI_LOCAL_PAGE_CANDIDATE_DIRNAME, slug, serviceId);
}

export function aiLocalPageCandidateHtmlPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(getAiLocalPageCandidateRoot(slug, serviceId), "local", areaSlug, "index.html");
}

export function aiLocalCopyInspectionPath(slug: string, serviceId: string): string {
  return path.join(getAiLocalPageCandidateRoot(slug, serviceId), "COPY-INSPECTION.txt");
}

export function renderAiLocalAreaPageCandidateUnavailable(areaSlug = ""): string {
  const label = areaSlug.trim() ? ` for ${areaSlug.trim()}` : "";
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>AI copy candidate unavailable</title>
</head>
<body>
<div class="candidate-preview-toolbar" data-component="candidate-preview-banner">${AI_CANDIDATE_PREVIEW_BANNER}</div>
<main>
<p><strong>This AI copy candidate preview is not available${label}.</strong></p>
<p>The requested area has no isolated AI local-page candidate. No other area is shown.</p>
</main>
</body>
</html>`;
}

export const AI_LOCAL_AREA_PAGE_PILOT_V2_ASSET = "ai-local-area-page-pilot-v2";
export const AI_PILOT_V2_PREVIEW_BANNER = "AI editorial pilot — not published";
export const AI_LOCAL_PILOT_V2_AREAS = ["darfield", "wombwell", "worsbrough"] as const;
export const AI_LOCAL_COPY_PILOT_DIRNAME = "data/pharmacy-ai-local-copy-pilots";
export const AI_LOCAL_PAGE_PILOT_DIRNAME = "output/pharmacy-ai-local-page-pilots";
export const AI_LOCAL_PILOT_CONTRACT_VERSION = "v2";

export function getAiLocalCopyPilotRoot(slug: string, serviceId: string, version = AI_LOCAL_PILOT_CONTRACT_VERSION): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, AI_LOCAL_COPY_PILOT_DIRNAME, slug, serviceId, version);
}

export function aiLocalCopyPilotPath(
  slug: string,
  serviceId: string,
  areaSlug: string,
  version = AI_LOCAL_PILOT_CONTRACT_VERSION,
): string {
  return path.join(getAiLocalCopyPilotRoot(slug, serviceId, version), `${areaSlug}.json`);
}

export function getAiLocalPagePilotRoot(slug: string, serviceId: string, version = AI_LOCAL_PILOT_CONTRACT_VERSION): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, AI_LOCAL_PAGE_PILOT_DIRNAME, slug, serviceId, version);
}

export function aiLocalPagePilotHtmlPath(
  slug: string,
  serviceId: string,
  areaSlug: string,
  version = AI_LOCAL_PILOT_CONTRACT_VERSION,
): string {
  return path.join(getAiLocalPagePilotRoot(slug, serviceId, version), "local", areaSlug, "index.html");
}

export function aiLocalPilotInspectionPath(
  slug: string,
  serviceId: string,
  version = AI_LOCAL_PILOT_CONTRACT_VERSION,
): string {
  return path.join(getAiLocalPagePilotRoot(slug, serviceId, version), "COPY-INSPECTION.txt");
}

export function renderAiLocalAreaPagePilotUnavailable(areaSlug = ""): string {
  const label = areaSlug.trim() ? ` for ${areaSlug.trim()}` : "";
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>AI editorial pilot unavailable</title>
</head>
<body>
<div class="candidate-preview-toolbar" data-component="candidate-preview-banner">${AI_PILOT_V2_PREVIEW_BANNER}</div>
<main>
<p><strong>This AI editorial pilot preview is not available${label}.</strong></p>
<p>Only Darfield, Wombwell and Worsbrough v2 pilots are exposed. No other area is shown.</p>
</main>
</body>
</html>`;
}

export const AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET = "ai-local-area-page-pilot-v3";
export const AI_PILOT_V3_PREVIEW_BANNER = "AI editorial evidence pilot — not published";
export const AI_LOCAL_REVISION_COMPARISON_V3_ASSET = "ai-local-revision-comparison-v3";
export const AI_LOCAL_REVISION_COMPARISON_BANNER = "Revision comparison — not published";
export const AI_LOCAL_STRATEGY_VARIANT_V3_ASSET = "ai-local-strategy-variant-v3";
export const AI_LOCAL_STRATEGY_VARIANT_BANNER = "Strategy variant comparison — not published";
export const AI_LOCAL_PILOT_V3_AREAS = ["darfield", "wombwell", "worsbrough"] as const;
export const AI_LOCAL_PILOT_CONTRACT_VERSION_V3 = "v3";
export const AI_LOCAL_COPY_ATTEMPT_LOG_DIRNAME = "data/pharmacy-ai-local-copy-attempt-logs";

export function getAiLocalCopyAttemptLogRoot(
  slug: string,
  serviceId: string,
  version = AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, AI_LOCAL_COPY_ATTEMPT_LOG_DIRNAME, slug, serviceId, version);
}

export function aiLocalCopyAttemptLogPath(
  slug: string,
  serviceId: string,
  areaSlug: string,
  attemptId: string,
  version = AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
): string {
  return path.join(getAiLocalCopyAttemptLogRoot(slug, serviceId, version), areaSlug, `${attemptId}.json`);
}

export function renderAiLocalAreaPagePilotUnavailableV3(areaSlug = ""): string {
  const label = areaSlug.trim() ? ` for ${areaSlug.trim()}` : "";
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>AI editorial evidence pilot unavailable</title>
</head>
<body>
<div class="candidate-preview-toolbar" data-component="candidate-preview-banner">${AI_PILOT_V3_PREVIEW_BANNER}</div>
<main>
<p><strong>This AI editorial evidence pilot preview is not available${label}.</strong></p>
<p>Only Darfield, Wombwell and Worsbrough v3 pilots are exposed. No other area is shown.</p>
</main>
</body>
</html>`;
}
