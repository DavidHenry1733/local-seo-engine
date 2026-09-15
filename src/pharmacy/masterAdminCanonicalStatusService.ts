/**
 * Master Admin Canonical Status V1 — real stored evidence only.
 */
import fs from "node:fs";
import path from "node:path";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { contentPackageGenerated, loadContentPackage } from "./pharmacyContentPackageService.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { getPharmacyPublishOutputStatus } from "./pharmacyPublishOutputService.ts";
import { getPharmacyIndexingBridgeStatus } from "./pharmacyIndexingBridgeService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";

export interface CanonicalStatusRecord {
  key: string;
  label: string;
  state: string;
  source: string;
  lastUpdated: string | null;
  freshness: "current" | "stale" | "unknown";
  latestError: string | null;
}

function fileMtime(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  try {
    return fs.statSync(file).mtime.toISOString();
  } catch {
    return null;
  }
}

function freshnessFrom(iso: string | null, staleDays = 14): CanonicalStatusRecord["freshness"] {
  if (!iso) return "unknown";
  const ageMs = Date.now() - new Date(iso).getTime();
  return ageMs <= staleDays * 86400000 ? "current" : "stale";
}

function readJsonMtime(file: string): { updatedAt: string | null; mtime: string | null } {
  if (!fs.existsSync(file)) return { updatedAt: null, mtime: fileMtime(file) };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { updatedAt?: string; generatedAt?: string };
    return { updatedAt: raw.updatedAt || raw.generatedAt || null, mtime: fileMtime(file) };
  } catch {
    return { updatedAt: null, mtime: fileMtime(file) };
  }
}

export function buildCustomerCanonicalStatuses(slug: string, serviceId = "pharmacy-first"): CanonicalStatusRecord[] {
  const ctx = loadMasterAdminCustomerContext(slug);
  const records: CanonicalStatusRecord[] = [];
  if (!ctx) return records;

  const data = ctx.data;
  const profileFile = profilePath(slug);
  const profileMeta = readJsonMtime(profileFile);

  if (data.websiteImportSnapshot) {
    const snap = data.websiteImportSnapshot as { importedAt?: string };
    records.push({
      key: "website_import",
      label: "Website Import",
      state: "IMPORTED",
      source: "pharmacy-profiles.websiteImportSnapshot",
      lastUpdated: snap.importedAt || profileMeta.updatedAt || profileMeta.mtime,
      freshness: freshnessFrom(snap.importedAt || profileMeta.updatedAt || profileMeta.mtime),
      latestError: data.lastWebsiteImportDebug ? String(data.lastWebsiteImportDebug).slice(0, 200) : null,
    });
  } else {
    records.push({
      key: "website_import",
      label: "Website Import",
      state: "NOT CONFIGURED",
      source: "pharmacy-profiles.websiteImportSnapshot",
      lastUpdated: profileMeta.updatedAt,
      freshness: "unknown",
      latestError: data.lastWebsiteImportDebug ? String(data.lastWebsiteImportDebug).slice(0, 200) : null,
    });
  }

  if (data.googleImportSnapshot || data.customerSetupGoogleMatchStatus === "confirmed") {
    const snap = (data.googleImportSnapshot || {}) as { importedAt?: string };
    records.push({
      key: "google_import",
      label: "Google Import",
      state: data.customerSetupGoogleMatchStatus === "confirmed" ? "CONFIRMED" : "IMPORTED",
      source: "pharmacy-profiles.googleImportSnapshot",
      lastUpdated: snap.importedAt || profileMeta.updatedAt || profileMeta.mtime,
      freshness: freshnessFrom(snap.importedAt || profileMeta.updatedAt || profileMeta.mtime),
      latestError: data.lastGoogleImportDebug ? String(data.lastGoogleImportDebug).slice(0, 200) : null,
    });
  } else {
    records.push({
      key: "google_import",
      label: "Google Import",
      state: "NOT CONFIGURED",
      source: "pharmacy-profiles.googleImportSnapshot",
      lastUpdated: profileMeta.updatedAt,
      freshness: "unknown",
      latestError: null,
    });
  }

  records.push({
    key: "business_profile",
    label: "Business Profile",
    state: ctx.profileApproved ? "APPROVED" : data.platformClientStatus?.toUpperCase() || "SETUP_REQUIRED",
    source: "pharmacy-profiles.platformClientStatus",
    lastUpdated: profileMeta.updatedAt || profileMeta.mtime,
    freshness: freshnessFrom(profileMeta.updatedAt || profileMeta.mtime),
    latestError: null,
  });

  const brandFile = path.join(WORKSPACE_ROOT, "config", "projects", slug, "brand", "brand-profile.json");
  records.push({
    key: "brand_dna",
    label: "Brand DNA",
    state: fs.existsSync(brandFile) ? "PRESENT" : "NOT CONFIGURED",
    source: "config/projects/{slug}/brand/brand-profile.json",
    lastUpdated: fileMtime(brandFile),
    freshness: freshnessFrom(fileMtime(brandFile)),
    latestError: null,
  });

  const componentFile = path.join(WORKSPACE_ROOT, "data", "pharmacy-component-dna", `${slug}.json`);
  records.push({
    key: "component_dna",
    label: "Component DNA",
    state: fs.existsSync(componentFile) ? "PRESENT" : "NOT CONFIGURED",
    source: "data/pharmacy-component-dna/{slug}.json",
    lastUpdated: fileMtime(componentFile),
    freshness: freshnessFrom(fileMtime(componentFile)),
    latestError: null,
  });

  const sid = ctx.serviceId || serviceId;
  const pkg = loadContentPackage(slug, sid);
  const generated = contentPackageGenerated(slug, sid);
  records.push({
    key: "generation",
    label: "Generation",
    state: generated
      ? ctx.session.generationStartedAt && !ctx.session.generationCompletedAt
        ? "IN PROGRESS"
        : "GENERATED"
      : ctx.session.generationStartedAt
        ? "IN PROGRESS"
        : "NOT CONFIGURED",
    source: "data/pharmacy-content-packages",
    lastUpdated: pkg?.generatedAt || ctx.session.generationCompletedAt || ctx.session.generationStartedAt,
    freshness: freshnessFrom(pkg?.generatedAt || ctx.session.generationCompletedAt),
    latestError: pkg?.status === "error" ? "Content package error" : null,
  });

  records.push({
    key: "quality_review",
    label: "Quality Review",
    state: ctx.contentApproved ? "APPROVED" : ctx.contentReviewed ? "REVIEWED" : generated ? "PENDING REVIEW" : "NOT CONFIGURED",
    source: "data/pharmacy-content-packages.reviewedAt",
    lastUpdated: pkg?.reviewedAt || null,
    freshness: freshnessFrom(pkg?.reviewedAt || null),
    latestError: null,
  });

  const live = getPharmacyLivePublishStatus(slug);
  const output = getPharmacyPublishOutputStatus(slug);
  records.push({
    key: "publishing",
    label: "Publishing",
    state: live.lastPublishedAt ? "PUBLISHED" : output.staticOutputReady ? "OUTPUT READY" : "NOT CONFIGURED",
    source: "data/pharmacy-publish-status",
    lastUpdated: live.lastPublishedAt || fileMtime(path.join(WORKSPACE_ROOT, "data/pharmacy-publish-status", `${slug}.json`)),
    freshness: freshnessFrom(live.lastPublishedAt),
    latestError: null,
  });

  const indexing = getPharmacyIndexingBridgeStatus(slug);
  const summary = indexing.summary || { submitted: 0, indexed: 0, totalRegistered: 0, excluded: 0 };
  records.push({
    key: "indexing",
    label: "Indexing",
    state:
      summary.indexed > 0
        ? "INDEXED"
        : summary.submitted > 0
          ? "SUBMITTED"
          : summary.totalRegistered > 0
            ? "REGISTERED"
            : "NOT CONFIGURED",
    source: "data/pharmacy-indexing",
    lastUpdated: fileMtime(path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${slug}.json`)),
    freshness: freshnessFrom(fileMtime(path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${slug}.json`))),
    latestError: null,
  });

  const rankFile = path.join(WORKSPACE_ROOT, "output", slug, "rank-tracking.json");
  records.push({
    key: "rank_tracking",
    label: "Rank Tracking",
    state: ctx.rank.keywords > 0 ? "ACTIVE" : fs.existsSync(rankFile) ? "LIMITED DATA" : "NOT CONFIGURED",
    source: "output/{slug}/rank-tracking.json",
    lastUpdated: fileMtime(rankFile),
    freshness: freshnessFrom(fileMtime(rankFile)),
    latestError: null,
  });

  const sitemapFile = path.join(WORKSPACE_ROOT, "output", resolveTenantProfileSlug(slug) || slug, "sitemap.xml");
  records.push({
    key: "sitemap",
    label: "Sitemap",
    state: fs.existsSync(sitemapFile) ? "PRESENT" : "NOT CONFIGURED",
    source: "output/{slug}/sitemap.xml",
    lastUpdated: fileMtime(sitemapFile),
    freshness: freshnessFrom(fileMtime(sitemapFile)),
    latestError: null,
  });

  return records;
}

export function canonicalStatusLabel(records: CanonicalStatusRecord[], key: string): string {
  return records.find((r) => r.key === key)?.state || "NOT CONFIGURED";
}
