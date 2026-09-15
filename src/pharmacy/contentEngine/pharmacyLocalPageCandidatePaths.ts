/**
 * Isolated local-page candidate paths — not the live content-ecosystem output.
 */
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export const LOCAL_AREA_PAGE_CANDIDATE_ASSET = "local-area-page-candidate";
export const CANDIDATE_PREVIEW_BANNER = "Candidate preview — not published";

export function getLocalPageCandidateRoot(slug: string, serviceId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-local-page-candidates",
    slug,
    serviceId,
  );
}

export function localPageCandidateHtmlPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(getLocalPageCandidateRoot(slug, serviceId), "local", areaSlug, "index.html");
}

export function renderLocalAreaPageCandidateUnavailable(areaSlug = ""): string {
  const label = areaSlug.trim() ? ` for ${areaSlug.trim()}` : "";
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Candidate preview unavailable</title>
</head>
<body>
<div class="candidate-preview-toolbar" data-component="candidate-preview-banner">${CANDIDATE_PREVIEW_BANNER}</div>
<main>
<p><strong>This candidate preview is not available${label}.</strong></p>
<p>The requested area has no isolated local-page candidate. No other area is shown.</p>
</main>
</body>
</html>`;
}
