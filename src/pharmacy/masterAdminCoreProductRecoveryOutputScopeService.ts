/**
 * CPR-02A / CPR-RB01-V1 — Service-page output scope for Commercial Release V1.
 * Validates the active visual service page only; legacy ecosystem artefacts do not fail scope.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";

export const SERVICE_PAGE_ALLOWED_OUTPUTS = [
  "service-page",
  "image-assignment",
  "metadata",
  "schema",
  "manifest-record",
  "registry-record",
  "sitemap-ready-record",
  "review-workspace-record",
] as const;

export const SERVICE_PAGE_FORBIDDEN_OUTPUTS = [
  "homepage",
  "cluster-page",
  "blog",
  "guide",
  "standalone-faq-page",
  "supporting-page",
  "complete-ecosystem",
  "publishing-package",
  "indexing-request",
  "ranking-job",
] as const;

export type ForbiddenOutputKind = (typeof SERVICE_PAGE_FORBIDDEN_OUTPUTS)[number];

export interface OutputScopeViolation {
  kind: ForbiddenOutputKind | string;
  path: string;
  detail?: string;
}

export interface OutputScopeValidationResult {
  ok: boolean;
  status: "PASS" | "FAILED_SCOPE";
  allowed: string[];
  forbidden: OutputScopeViolation[];
}

export function validateServicePageOutputScope(slug: string, serviceId: string): OutputScopeValidationResult {
  const forbidden: OutputScopeViolation[] = [];
  const safe = slug.replace(/[^a-z0-9-]/gi, "");

  const servicePagePath = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-visual-experience",
    safe,
    serviceId,
    "index.html",
  );
  if (!fs.existsSync(servicePagePath)) {
    forbidden.push({
      kind: "service-page",
      path: servicePagePath,
      detail: "Design System V1 visual service page output is required for Commercial Release V1",
    });
  }

  return {
    ok: forbidden.length === 0,
    status: forbidden.length === 0 ? "PASS" : "FAILED_SCOPE",
    allowed: [...SERVICE_PAGE_ALLOWED_OUTPUTS],
    forbidden,
  };
}

export function assertServicePageOutputScopeOrThrow(slug: string, serviceId: string): OutputScopeValidationResult {
  const result = validateServicePageOutputScope(slug, serviceId);
  if (!result.ok) {
    const msg = result.forbidden.map((f) => `${f.kind}: ${f.path}`).join("; ");
    throw new Error(`FAILED_SCOPE — forbidden outputs detected: ${msg}`);
  }
  return result;
}
