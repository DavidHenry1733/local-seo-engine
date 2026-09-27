/**
 * CP03 current content revision for a publishable campaign page.
 * The revision is the SHA-256 of the current publishable HTML bytes.
 * Approval metadata, dashboard state, indexing, rankings, and workflow status are not inputs.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const CANONICAL_PAGE_REVISION_ALGORITHM = "sha256" as const;

/** Exact inputs of the revision. Same bytes always produce the same revision. */
export const CANONICAL_PAGE_REVISION_INPUTS = [
  "raw bytes of the current service page HTML at output/pharmacy-visual-experience/{tenantSlug}/{serviceId}/index.html",
  "raw bytes of the current locality page HTML at output/pharmacy-content-ecosystem/{tenantSlug}/{serviceId}/local/{areaSlug}/index.html",
] as const;

export type CanonicalPublishablePageType = "service" | "locality";

export interface CanonicalPageContentRevision {
  pageType: CanonicalPublishablePageType;
  areaSlug: string | null;
  sourcePath: string | null;
  contentRevision: string | null;
  status: "resolved" | "unresolved";
  algorithm: typeof CANONICAL_PAGE_REVISION_ALGORITHM;
  inputs: readonly string[];
}

export function hashPublishablePageBytes(bytes: Buffer): string {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

export function resolveCanonicalPageContentRevision(input: {
  tenantSlug: string;
  serviceId: string;
  pageType: CanonicalPublishablePageType;
  areaSlug?: string | null;
}): CanonicalPageContentRevision {
  const tenantSlug = strictSlug(input.tenantSlug);
  const serviceId = strictSlug(input.serviceId);
  const areaSlug = input.pageType === "locality" ? strictSlug(String(input.areaSlug || "")) : null;
  const sourcePath =
    tenantSlug && serviceId && (input.pageType === "service" || areaSlug)
      ? publishablePagePath(tenantSlug, serviceId, input.pageType, areaSlug)
      : null;
  let contentRevision: string | null = null;
  if (sourcePath && fs.existsSync(sourcePath) && fs.statSync(sourcePath).isFile()) {
    contentRevision = hashPublishablePageBytes(fs.readFileSync(sourcePath));
  }
  return {
    pageType: input.pageType,
    areaSlug,
    sourcePath,
    contentRevision,
    status: contentRevision ? "resolved" : "unresolved",
    algorithm: CANONICAL_PAGE_REVISION_ALGORITHM,
    inputs: CANONICAL_PAGE_REVISION_INPUTS,
  };
}

function publishablePagePath(
  tenantSlug: string,
  serviceId: string,
  pageType: CanonicalPublishablePageType,
  areaSlug: string | null,
): string {
  if (pageType === "service") {
    return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", tenantSlug, serviceId, "index.html");
  }
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    tenantSlug,
    serviceId,
    "local",
    String(areaSlug),
    "index.html",
  );
}

function strictSlug(value: string): string | null {
  const slug = String(value || "").trim().toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}
