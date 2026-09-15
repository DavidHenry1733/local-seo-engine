/**
 * Read-only revision-comparison Preview for saved Wombwell drafts.
 * Does not write candidates, call OpenAI, research, approve, or publish.
 * Exact revision IDs only. Preview must never generate copy.
 */
import fs from "node:fs";
import path from "node:path";

import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { AI_LOCAL_REVISION_COMPARISON_BANNER } from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { renderAiLocalPagePilotHtmlInMemoryV3 } from "./pharmacyAiLocalPagePilotAssemblerV3.ts";
import type { AiLocalCopyOverlayV1 } from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";

export type WombwellRevisionComparisonKind = "structured-draft" | "accepted-html-reference";

export type WombwellRevisionComparisonDef = {
  revisionId: string;
  label: string;
  timestamp: string;
  sourceRecord: string;
  kind: WombwellRevisionComparisonKind;
  areaSlug: "wombwell" | "headingley";
};

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";

export const WOMBWELL_REVISION_COMPARISON_CATALOG: readonly WombwellRevisionComparisonDef[] = [
  {
    revisionId: "2026-09-01T14-21Z",
    label: "Current live 14:21 Wombwell candidate",
    timestamp: "2026-09-01T14:21:19.136Z",
    sourceRecord:
      "data/pharmacy-ai-local-copy-pilots/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell.json",
    kind: "structured-draft",
    areaSlug: "wombwell",
  },
  {
    revisionId: "2026-09-01T12-33-31-060Z",
    label: "12:33 attempt 1",
    timestamp: "2026-09-01T12:33:31.060Z",
    sourceRecord:
      "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T12-33-31-060Z-attempt-1.json",
    kind: "structured-draft",
    areaSlug: "wombwell",
  },
  {
    revisionId: "2026-09-01T12-35-43-358Z",
    label: "12:35 attempt 2",
    timestamp: "2026-09-01T12:35:43.358Z",
    sourceRecord:
      "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T12-35-43-358Z-attempt-2.json",
    kind: "structured-draft",
    areaSlug: "wombwell",
  },
  {
    revisionId: "2026-09-01T14-52-41-715Z",
    label: "14:52 service-to-local draft 1",
    timestamp: "2026-09-01T14:52:41.715Z",
    sourceRecord:
      "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T14-52-41-715Z-attempt-1.json",
    kind: "structured-draft",
    areaSlug: "wombwell",
  },
  {
    revisionId: "2026-09-01T14-52-50-988Z",
    label: "14:52 service-to-local draft 2",
    timestamp: "2026-09-01T14:52:50.988Z",
    sourceRecord:
      "data/pharmacy-ai-local-copy-attempt-logs/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01T14-52-50-988Z-attempt-2.json",
    kind: "structured-draft",
    areaSlug: "wombwell",
  },
  {
    revisionId: "leeds-headingley-reference",
    label: "Accepted Leeds Headingley reference",
    timestamp: "2026-08-05T18:26:10.109Z",
    sourceRecord: "output/pharmacy-content-ecosystem/leeds-pharmacy/pharmacy-first/local/headingley/index.html",
    kind: "accepted-html-reference",
    areaSlug: "headingley",
  },
] as const;

export const WOMBWELL_REVISION_COMPARISON_IDS = WOMBWELL_REVISION_COMPARISON_CATALOG.map((row) => row.revisionId);

function esc(value: string): string {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[ch] || ch));
}

function overlayFromSavedCopy(copy: Record<string, unknown>): AiLocalCopyOverlayV1 {
  const paragraphs = copy.localContextParagraphs;
  return {
    heroIntroduction: String(copy.heroIntroduction || ""),
    localContextHeading: String(copy.localContextHeading || ""),
    localIntroduction: String(copy.localIntroduction || ""),
    localContextParagraphs: Array.isArray(paragraphs)
      ? paragraphs.map((part) => String(part || ""))
      : String(paragraphs || "").trim()
        ? [String(paragraphs)]
        : [],
    relationshipToPharmacy: String(copy.relationshipToPharmacy || ""),
    localAccessIntroduction: String(copy.localAccessIntroduction || ""),
    localFaqs: Array.isArray(copy.localFaqs)
      ? (copy.localFaqs as Array<{ question?: unknown; answer?: unknown }>).map((faq) => ({
          question: String(faq?.question || ""),
          answer: String(faq?.answer || ""),
        }))
      : [],
    localCtaBridge: String(copy.localCtaBridge || ""),
  };
}

function compactSavedFailure(row: string): string {
  const rule = row.match(/\brule=([a-z0-9-]+)/i)?.[1];
  const field = row.match(/\bfield=([^\s|]+)/i)?.[1];
  if (rule && field) return `FAIL — ${rule} (${field})`;
  return `FAIL — ${row.slice(0, 140)}`;
}

function savedValidationStatus(payload: Record<string, unknown>): string {
  const vr = (payload.validationResult || {}) as {
    ok?: boolean;
    failures?: string[];
    automatedReviews?: string[];
  };
  const failures = Array.isArray(vr.failures) ? vr.failures : [];
  const reviews = Array.isArray(vr.automatedReviews) ? vr.automatedReviews : [];
  const blocking = failures.filter((row) => !/^REVIEW REQUIRED\b/i.test(row));
  if (vr.ok === true && reviews.length) {
    return "candidate — validation ok; REVIEW REQUIRED leftover tokens recorded";
  }
  if (vr.ok === true) return "candidate — validation ok";
  if (blocking.length) return compactSavedFailure(blocking[0]!);
  if (reviews.length || failures.some((row) => /^REVIEW REQUIRED\b/i.test(row))) {
    return `REVIEW REQUIRED — ${(reviews[0] || failures.find((row) => /^REVIEW REQUIRED\b/i.test(row)) || "").slice(0, 140)}`;
  }
  return "FAIL — saved validation did not pass";
}

function comparisonBanner(timestamp: string, validationStatus: string): string {
  return `${AI_LOCAL_REVISION_COMPARISON_BANNER} · ${timestamp} · ${validationStatus}`;
}

function wrapComparisonHtml(html: string, banner: string): string {
  let out = String(html || "");
  if (!/name="robots"\s+content="noindex,\s*nofollow"/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="robots" content="noindex, nofollow"/>`);
  }
  out = out.replace(/<style data-candidate-preview="ai-local-area-page-pilot-v3">[\s\S]*?<\/style>\s*/i, "");
  out = out.replace(/<div class="candidate-preview-toolbar"[^>]*>[\s\S]*?<\/div>\s*/i, "");
  const style = `<style data-revision-comparison="v3">.revision-comparison-toolbar{position:sticky;top:0;z-index:10001;background:#fef9c3;border-bottom:1px solid #ca8a04;color:#854d0e;font:800 13px/1.45 Inter,system-ui,sans-serif;text-align:center;padding:10px 16px}</style>`;
  const bar = `<div class="revision-comparison-toolbar" data-component="revision-comparison-banner">${esc(banner)}</div>`;
  if (/data-component="revision-comparison-banner"/i.test(out)) return out;
  if (!/<body/i.test(out)) {
    return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="utf-8"/><meta name="robots" content="noindex, nofollow"/><title>Revision comparison</title></head><body>${style}\n${bar}<main><p>Revision comparison is unavailable.</p></main></body></html>`;
  }
  return out.replace(/<body([^>]*)>/i, `<body$1>\n${style}\n${bar}`);
}

function unavailableHtml(revisionId = ""): string {
  const label = revisionId.trim() ? ` for revision ${esc(revisionId.trim())}` : "";
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex, nofollow"/>
<title>Revision comparison unavailable</title>
</head>
<body>
<div class="revision-comparison-toolbar" data-component="revision-comparison-banner">${esc(AI_LOCAL_REVISION_COMPARISON_BANNER)}</div>
<main>
<p><strong>This revision comparison preview is not available${label}.</strong></p>
<p>Only exact saved revision IDs are exposed. This route cannot approve or publish.</p>
</main>
</body>
</html>`;
}

function readJson(relPath: string): Record<string, unknown> | null {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, relPath);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function copyFromSourceRecord(payload: Record<string, unknown>): Record<string, unknown> | null {
  if (payload.parsedCopy && typeof payload.parsedCopy === "object") return payload.parsedCopy as Record<string, unknown>;
  if (payload.outputCopy && typeof payload.outputCopy === "object") return payload.outputCopy as Record<string, unknown>;
  return null;
}

function timestampFromPayload(payload: Record<string, unknown>, fallback: string): string {
  const generated = String(payload.generatedAt || "").trim();
  const saved = String(payload.savedAt || "").trim();
  return generated || saved || fallback;
}

function timestampFromHtml(html: string, fallback: string): string {
  const match = html.match(/name="commercial-narrative-revision"\s+content="[^"]*?(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/i);
  return match?.[1] || fallback;
}

export function wombwellRevisionComparisonPreviewUrl(revisionId: string): string {
  return `/api/growth-engine/${YORKSHIRE}/review-preview?campaign=${SERVICE}&asset=ai-local-revision-comparison-v3&revision=${encodeURIComponent(revisionId)}`;
}

export function renderWombwellRevisionComparisonPreview(revisionId: string): {
  html: string;
  sourcePath: string | null;
  sourceRoute: string;
  validationStatus: string;
  timestamp: string;
  catalog: WombwellRevisionComparisonDef | null;
} {
  const id = String(revisionId || "").trim();
  const def = WOMBWELL_REVISION_COMPARISON_CATALOG.find((row) => row.revisionId === id) || null;
  if (!def) {
    return {
      html: unavailableHtml(id),
      sourcePath: null,
      sourceRoute: "review-preview-revision-comparison-unavailable",
      validationStatus: "unavailable",
      timestamp: "",
      catalog: null,
    };
  }
  const abs = path.join(PHARMACY_WORKSPACE_ROOT, def.sourceRecord);
  if (!fs.existsSync(abs)) {
    return {
      html: unavailableHtml(def.revisionId),
      sourcePath: null,
      sourceRoute: "review-preview-revision-comparison-unavailable",
      validationStatus: "missing-source",
      timestamp: def.timestamp,
      catalog: def,
    };
  }
  if (def.kind === "accepted-html-reference") {
    const raw = fs.readFileSync(abs, "utf8");
    const timestamp = timestampFromHtml(raw, def.timestamp);
    const html = wrapComparisonHtml(raw, comparisonBanner(timestamp, "accepted reference"));
    return {
      html,
      sourcePath: abs,
      sourceRoute: "ai-local-revision-comparison-v3",
      validationStatus: "accepted reference",
      timestamp,
      catalog: def,
    };
  }
  const payload = readJson(def.sourceRecord);
  const copy = payload ? copyFromSourceRecord(payload) : null;
  if (!payload || !copy) {
    return {
      html: unavailableHtml(def.revisionId),
      sourcePath: abs,
      sourceRoute: "review-preview-revision-comparison-unavailable",
      validationStatus: "unreadable-copy",
      timestamp: def.timestamp,
      catalog: def,
    };
  }
  const status = savedValidationStatus(payload);
  const timestamp = timestampFromPayload(payload, def.timestamp);
  const rendered = renderAiLocalPagePilotHtmlInMemoryV3({
    slug: YORKSHIRE,
    serviceId: SERVICE,
    areaSlug: "wombwell",
    overlay: overlayFromSavedCopy(copy),
    wrapPreviewBanner: false,
  });
  if (!rendered.ok) {
    return {
      html: unavailableHtml(def.revisionId),
      sourcePath: abs,
      sourceRoute: "review-preview-revision-comparison-unavailable",
      validationStatus: status,
      timestamp,
      catalog: def,
    };
  }
  return {
    html: wrapComparisonHtml(rendered.html, comparisonBanner(timestamp, status)),
    sourcePath: abs,
    sourceRoute: "ai-local-revision-comparison-v3",
    validationStatus: status,
    timestamp,
    catalog: def,
  };
}
