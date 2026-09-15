/**
 * Master Admin Issue Diagnostics V1 — stored evidence only; no imports or external API calls.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { listMasterAdminAudit } from "./masterAdminAuditService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { deriveCustomerLifecycle } from "./masterAdminPlatformService.ts";
import { getClientMeta } from "./masterAdminPlatformService.ts";
import { readMasterAdminRegistry, safeAdminSlug } from "./pharmacyMasterAdminService.ts";

const SECRET_KEY_PATTERN =
  /password|secret|token|api[_-]?key|authorization|cookie|smtp|ftp|credential|private[_-]?key|session[_-]?secret|client[_-]?secret|access[_-]?token/i;

const REDACTED = "[REDACTED]";

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function fileMeta(file: string): { path: string; exists: boolean; modifiedAt: string | null; size: number } {
  if (!fs.existsSync(file)) return { path: file, exists: false, modifiedAt: null, size: 0 };
  const stat = fs.statSync(file);
  return { path: file, exists: true, modifiedAt: stat.mtime.toISOString(), size: stat.size };
}

export function redactSensitiveValue(key: string, value: unknown): unknown {
  if (SECRET_KEY_PATTERN.test(key)) return REDACTED;
  if (typeof value === "string") {
    if (value.length > 8 && /Bearer\s+/i.test(value)) return REDACTED;
    if (SECRET_KEY_PATTERN.test(value)) return REDACTED;
  }
  return value;
}

export function redactDiagnosticsObject(input: unknown, depth = 0): unknown {
  if (depth > 12) return "[truncated]";
  if (input === null || input === undefined) return input;
  if (typeof input === "string") {
    if (SECRET_KEY_PATTERN.test(input)) return REDACTED;
    return input;
  }
  if (typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map((v) => redactDiagnosticsObject(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = redactDiagnosticsObject(redactSensitiveValue(key, value), depth + 1);
  }
  return out;
}

function resolveServiceId(slug: string, data: ReturnType<typeof normalizeProfileData>, serviceId?: string): string {
  if (serviceId) return serviceId;
  if (data.selectedServices?.length) return String(data.selectedServices[0]);
  const session = readJson<{ selectedServiceId?: string }>(
    path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`),
  );
  return session?.selectedServiceId || "pharmacy-first";
}

function collectPm2Info(): Record<string, unknown> {
  try {
    const raw = execSync("pm2 jlist", { encoding: "utf8", timeout: 3000 });
    const processes = JSON.parse(raw) as Array<{
      name?: string;
      pid?: number;
      pm_id?: number;
      pm2_env?: { status?: string; pm_uptime?: number; restart_time?: number; unstable_restarts?: number };
    }>;
    const app = processes.find((p) => p.name === "pharmaconnect-growth-engine") || processes[0];
    if (!app) return { available: false, detail: "No PM2 processes found" };
    return {
      available: true,
      process: app.name,
      pid: app.pid,
      pmId: app.pm_id,
      status: app.pm2_env?.status,
      startTime: app.pm2_env?.pm_uptime ? new Date(app.pm2_env.pm_uptime).toISOString() : null,
      restartCount: app.pm2_env?.restart_time ?? app.pm2_env?.unstable_restarts ?? 0,
    };
  } catch (err) {
    return { available: false, detail: err instanceof Error ? err.message : String(err) };
  }
}

function collectDeploymentInfo(): Record<string, unknown> {
  const distPath = path.join(WORKSPACE_ROOT, "artifacts/api-server/dist/index.mjs");
  const distMeta = fileMeta(distPath);
  let sourceBuildTimestamp: string | null = null;
  const buildMetaPath = path.join(WORKSPACE_ROOT, "artifacts/api-server/dist/.build-meta.json");
  const buildMeta = readJson<{ builtAt?: string }>(buildMetaPath);
  if (buildMeta?.builtAt) sourceBuildTimestamp = buildMeta.builtAt;
  else if (distMeta.exists && distMeta.modifiedAt) sourceBuildTimestamp = distMeta.modifiedAt;

  return {
    sourceBuildTimestamp,
    apiDist: distMeta,
    port: process.env.PORT || "3001",
    pm2: collectPm2Info(),
    nodeEnv: process.env.NODE_ENV || "unknown",
  };
}

function inferPageType(url: string, module?: string): string {
  if (module) return module;
  if (!url) return "unknown";
  if (url.includes("/local/")) return "local-page";
  if (url.includes("/service/") || url.includes("pharmacy-first")) return "service-page";
  if (url.includes("review-centre")) return "review-centre";
  return "unknown";
}

export function collectMasterAdminIssueDiagnostics(input: {
  tenantSlug: string;
  campaignId?: string;
  serviceId?: string;
  affectedUrl?: string;
  affectedPageOrModule?: string;
  category?: string;
}): Record<string, unknown> {
  const slug = safeAdminSlug(input.tenantSlug) || input.tenantSlug;
  const profileFile = profilePath(slug);
  const profileDoc = readJson<{ updatedAt?: string; version?: number; data?: Record<string, unknown> }>(profileFile);
  const data = normalizeProfileData(profileDoc?.data || {});
  const serviceId = resolveServiceId(slug, data, input.serviceId);
  const campaignId = input.campaignId || serviceId;
  const meta = getClientMeta(slug);
  const registry = readMasterAdminRegistry();
  const entry = registry.clients.find((c) => c.slug === slug);

  const lifecycle = deriveCustomerLifecycle(slug, {
    archived: entry?.archived,
    suspended: meta.suspended,
  });

  const frozenContextPath = path.join(
    WORKSPACE_ROOT,
    "data/growth-engine",
    `${slug}-campaign-generation-context-${serviceId}.json`,
  );
  const packagePath = path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`);
  const brandDnaPath = path.join(WORKSPACE_ROOT, "config/projects", slug, "brand/brand-profile.json");
  const componentDnaPath = path.join(WORKSPACE_ROOT, "data/pharmacy-component-dna", `${slug}.json`);
  const publishStatusPath = path.join(WORKSPACE_ROOT, "data/pharmacy-publish-status", `${slug}.json`);
  const indexingSummaryPath = path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${slug}.json`);
  const rankPath = path.join(WORKSPACE_ROOT, "output", slug, "rank-tracking.json");
  const sessionPath = path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`);

  const session = readJson<{
    generationStartedAt?: string | null;
    generationCompletedAt?: string | null;
    selectedServiceId?: string;
  }>(sessionPath);
  const pkg = readJson<{ generatedAt?: string; status?: string }>(packagePath);
  const publish = readJson<{ lastPublishedAt?: string | null; staticOutputReady?: boolean }>(publishStatusPath);
  const indexing = readJson<{ indexed?: number; submitted?: number; totalRegistered?: number }>(indexingSummaryPath);
  const rank = readJson<{ generatedAt?: string; summary?: { keywordsCount?: number } }>(rankPath);

  let outputFilePath = "";
  if (input.affectedUrl) {
    const localMatch = input.affectedUrl.match(/local\/([^/?]+)/);
    if (localMatch) {
      outputFilePath = path.join(
        WORKSPACE_ROOT,
        "output/pharmacy-content-ecosystem",
        slug,
        serviceId,
        "local",
        localMatch[1]!,
        "index.html",
      );
    }
  }

  const auditEvents = listMasterAdminAudit({ slug, limit: 30 });
  const jobs = listMasterAdminJobs({ slug, limit: 20 });
  const failedJobs = jobs.filter((j) => j.status === "failed");
  const latestJob = jobs[0] || null;

  const recentErrors = [
    ...failedJobs.map((j) => ({
      source: "background_job",
      action: j.action,
      error: j.error,
      timestamp: j.updatedAt,
      retries: 0,
    })),
    ...auditEvents
      .filter((a) => a.status === "error")
      .map((a) => ({
        source: "audit_log",
        action: a.action,
        error: (a.errors || []).join("; "),
        timestamp: a.timestamp,
        retries: a.retries,
      })),
  ].slice(0, 20);

  const snapshot = {
    collectedAt: new Date().toISOString(),
    collectionMode: "stored_evidence_only",
    tenant: {
      slug,
      businessName: data.pharmacyName || entry?.pharmacyName || slug,
      website: data.website || "",
      lifecycleStatus: lifecycle,
      profileVersion: profileDoc?.version ?? null,
      profileModifiedAt: profileDoc?.updatedAt || null,
      platformClientStatus: data.platformClientStatus || "",
    },
    campaign: {
      campaignId,
      serviceId,
      generationStatus: session?.generationCompletedAt
        ? "complete"
        : session?.generationStartedAt
          ? "in_progress"
          : pkg?.generatedAt
            ? "package_exists"
            : "not_started",
      frozenContextPath: fileMeta(frozenContextPath),
      generationTimestamp: session?.generationCompletedAt || session?.generationStartedAt || pkg?.generatedAt || null,
      activePageManifest: fileMeta(packagePath),
    },
    page: {
      requestedUrl: input.affectedUrl || "",
      outputFilePath: outputFilePath ? fileMeta(outputFilePath) : { path: outputFilePath, exists: false, modifiedAt: null, size: 0 },
      rendererMarker: "LOCKED — do not modify renderers",
      brandDnaMarker: fileMeta(brandDnaPath),
      componentDnaMarker: fileMeta(componentDnaPath),
      pageType: inferPageType(input.affectedUrl || "", input.affectedPageOrModule),
      httpStatus: null,
    },
    deployment: collectDeploymentInfo(),
    systemState: {
      websiteImportStatus: data.websiteImportSnapshot ? "snapshot_present" : "none",
      googleImportStatus: data.googleImportSnapshot ? "snapshot_present" : data.customerSetupGoogleMatchStatus || "none",
      businessProfileStatus: data.platformClientStatus || "unknown",
      generationStatus: session?.generationCompletedAt ? "complete" : session?.generationStartedAt ? "running" : "idle",
      publishingStatus: publish?.lastPublishedAt ? "published" : publish?.staticOutputReady ? "ready" : "not_started",
      indexingStatus: indexing
        ? `${indexing.indexed || 0} indexed / ${indexing.submitted || 0} submitted / ${indexing.totalRegistered || 0} registered`
        : "none",
      rankTrackingStatus: rank?.summary?.keywordsCount
        ? `${rank.summary.keywordsCount} keywords`
        : fs.existsSync(rankPath)
          ? "file_present"
          : "none",
      latestRelevantJob: latestJob
        ? { id: latestJob.id, action: latestJob.action, status: latestJob.status, progressLabel: latestJob.progressLabel, updatedAt: latestJob.updatedAt }
        : null,
      latestRelevantAuditEvents: auditEvents.slice(0, 10).map((a) => ({
        id: a.id,
        timestamp: a.timestamp,
        action: a.action,
        status: a.status,
        evidence: a.evidence,
      })),
    },
    errors: recentErrors,
    relatedStoredFiles: [
      profileFile,
      packagePath,
      frozenContextPath,
      brandDnaPath,
      componentDnaPath,
      publishStatusPath,
      indexingSummaryPath,
      rankPath,
      sessionPath,
    ].filter((f) => fs.existsSync(f)),
  };

  return redactDiagnosticsObject(snapshot) as Record<string, unknown>;
}
