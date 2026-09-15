/**
 * Master Admin Canonical Website V1 — one website per customer, editable before profile approval.
 */
import fs from "node:fs";
import path from "node:path";
import { readSetupProfile, writeSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { getPharmacyProjectConfigPath } from "./pharmacyWorkspacePaths.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  createMasterAdminJob,
  runMasterAdminJobAsync,
} from "./masterAdminJobService.ts";
import { buildCustomerCanonicalStatuses } from "./masterAdminCanonicalStatusService.ts";

const WEBSITE_IMPORT_HISTORY_DIR = path.join(
  WORKSPACE_ROOT,
  "data",
  "pharmacy-master-admin",
  "website-import-history",
);

export interface WebsiteImportHistoryEntry {
  archivedAt: string;
  reason: string;
  canonicalWebsite: string;
  snapshot: Record<string, unknown>;
}

export interface WebsiteSourceSummary {
  canonicalWebsite: string;
  websiteStatus: string;
  websiteImported: boolean;
  lastImportAt: string | null;
  lastImportMessage: string | null;
  importEvidenceUrl: string | null;
  importHistoryCount: number;
  canEditWebsite: boolean;
  editBlockedReason: string | null;
  importedEvidence: Record<string, unknown> | null;
  importHistory: WebsiteImportHistoryEntry[];
}

function historyFile(slug: string): string {
  return path.join(WEBSITE_IMPORT_HISTORY_DIR, `${safeAdminSlug(slug)}.json`);
}

function readImportHistory(slug: string): WebsiteImportHistoryEntry[] {
  const file = historyFile(slug);
  if (!fs.existsSync(file)) return [];
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { entries?: WebsiteImportHistoryEntry[] };
    return Array.isArray(doc.entries) ? doc.entries : [];
  } catch {
    return [];
  }
}

function writeImportHistory(slug: string, entries: WebsiteImportHistoryEntry[]): void {
  fs.mkdirSync(WEBSITE_IMPORT_HISTORY_DIR, { recursive: true });
  fs.writeFileSync(
    historyFile(slug),
    JSON.stringify(
      {
        slug: safeAdminSlug(slug),
        updatedAt: new Date().toISOString(),
        entries: entries.slice(0, 20),
      },
      null,
      2,
    ),
  );
}

function normalizeWebsite(url: string): string {
  const trimmed = String(url || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("http") ? trimmed.replace(/\/$/, "") : `https://${trimmed.replace(/\/$/, "")}`;
}

export function canEditCanonicalWebsite(slug: string): { allowed: boolean; reason: string | null } {
  const ctx = loadMasterAdminCustomerContext(slug);
  if (!ctx) return { allowed: false, reason: "Customer not found" };
  if (ctx.archived) return { allowed: false, reason: "Customer is archived" };
  if (ctx.suspended) return { allowed: false, reason: "Customer is suspended" };
  if (ctx.profileApproved) return { allowed: false, reason: "Business Profile already approved — website locked" };
  return { allowed: true, reason: null };
}

export function archiveWebsiteImportSnapshot(
  slug: string,
  reason: string,
): WebsiteImportHistoryEntry | null {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const snap = data.websiteImportSnapshot as Record<string, unknown> | null | undefined;
  if (!snap) return null;

  const entry: WebsiteImportHistoryEntry = {
    archivedAt: new Date().toISOString(),
    reason,
    canonicalWebsite: String(data.website || snap.websiteUrl || ""),
    snapshot: snap,
  };
  const history = readImportHistory(safe);
  history.unshift(entry);
  writeImportHistory(safe, history);
  return entry;
}

export function invalidateWebsiteImportEvidence(slug: string, reason: string): void {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  archiveWebsiteImportSnapshot(safe, reason);
  writeSetupProfile(safe, {
    ...data,
    websiteImportSnapshot: null,
    websiteImportedFieldKeys: [],
    lastWebsiteImportDebug: {
      at: new Date().toISOString(),
      invalidated: true,
      reason,
    },
  } as typeof data);
}

export function updateCanonicalWebsite(
  slug: string,
  websiteUrl: string,
  operator: string,
): { canonicalWebsite: string; previousWebsite: string; invalidated: boolean } {
  const safe = safeAdminSlug(slug);
  const gate = canEditCanonicalWebsite(safe);
  if (!gate.allowed) throw new Error(gate.reason || "Cannot edit website");

  const canonicalWebsite = normalizeWebsite(websiteUrl);
  if (!canonicalWebsite) throw new Error("Website URL is required");

  const data = readSetupProfile(safe);
  const previousWebsite = String(data.website || "");
  const hadImport = Boolean(data.websiteImportSnapshot);

  if (hadImport) {
    invalidateWebsiteImportEvidence(safe, `Canonical website changed from ${previousWebsite || "empty"} to ${canonicalWebsite}`);
  }

  const refreshed = readSetupProfile(safe);
  writeSetupProfile(safe, {
    ...refreshed,
    website: canonicalWebsite,
    canonicalWebsite,
  } as typeof refreshed);

  const projectFile = getPharmacyProjectConfigPath(safe);
  if (fs.existsSync(projectFile)) {
    try {
      const project = JSON.parse(fs.readFileSync(projectFile, "utf8")) as Record<string, unknown>;
      project.domain = canonicalWebsite;
      fs.writeFileSync(projectFile, JSON.stringify(project, null, 2));
    } catch {
      /* non-fatal */
    }
  }

  return { canonicalWebsite, previousWebsite, invalidated: hadImport };
}

export function buildWebsiteSourceSummary(slug: string): WebsiteSourceSummary {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const snap = data.websiteImportSnapshot as Record<string, unknown> | null | undefined;
  const history = readImportHistory(safe);
  const gate = canEditCanonicalWebsite(safe);
  const canonical = buildCustomerCanonicalStatuses(safe).find((c) => c.key === "website_import");

  return {
    canonicalWebsite: String(data.website || data.canonicalWebsite || ""),
    websiteStatus: canonical?.state || (snap ? "IMPORTED" : "NOT CONFIGURED"),
    websiteImported: Boolean(snap),
    lastImportAt: snap?.importedAt ? String(snap.importedAt) : null,
    lastImportMessage: snap?.message ? String(snap.message) : null,
    importEvidenceUrl: snap?.websiteUrl ? String(snap.websiteUrl) : null,
    importHistoryCount: history.length,
    canEditWebsite: gate.allowed,
    editBlockedReason: gate.reason,
    importedEvidence: snap ? snap : null,
    importHistory: history.slice(0, 5),
  };
}

export function queueRerunWebsiteImport(
  slug: string,
  operator: string,
): { jobId: string; canonicalWebsite: string } {
  const safe = safeAdminSlug(slug);
  const gate = canEditCanonicalWebsite(safe);
  if (!gate.allowed) throw new Error(gate.reason || "Cannot re-run website import");

  const data = readSetupProfile(safe);
  const canonicalWebsite = normalizeWebsite(String(data.website || ""));
  if (!canonicalWebsite) throw new Error("Canonical website is not set");

  if (data.websiteImportSnapshot) {
    archiveWebsiteImportSnapshot(safe, "Re-run Website Import — previous snapshot archived");
    const refreshed = readSetupProfile(safe);
    writeSetupProfile(safe, {
      ...refreshed,
      websiteImportSnapshot: null,
      websiteImportedFieldKeys: [],
    } as typeof refreshed);
  }

  const job = createMasterAdminJob({
    slug: safe,
    action: "import_website",
    user: operator,
    workflowStage: "website_import",
  });

  runMasterAdminJobAsync(job.id, { websiteUrl: canonicalWebsite }, { workflowStage: "website_import" });

  return { jobId: job.id, canonicalWebsite };
}
