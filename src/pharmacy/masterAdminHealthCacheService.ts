/**
 * Master Admin System Health Cache V2 — canonical health semantics (Sprint 6E).
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { loadLiveIntegrationProof } from "./growthEngineLiveIntegrationProofService.ts";
import { getLastSuccessfulAuditForAction, listMasterAdminAudit } from "./masterAdminAuditService.ts";

export type SystemHealthLevel = "healthy" | "warning" | "not_initialised" | "offline";

export interface MasterAdminSystemHealthItem {
  id: string;
  label: string;
  status: SystemHealthLevel;
  statusLabel: string;
  lastSuccessfulRun: string | null;
  lastAttemptedRun: string | null;
  lastError: string | null;
  evidenceSource: string;
  detail: string;
  retryAction: string | null;
}

const CACHE_PATH = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "system-health-cache.json");
const FRESHNESS_DAYS = 14;

export interface MasterAdminHealthCache {
  version: 2;
  updatedAt: string;
  referenceSlug: string;
  services: MasterAdminSystemHealthItem[];
}

function labelFor(status: SystemHealthLevel): string {
  if (status === "healthy") return "Healthy";
  if (status === "warning") return "Warning";
  if (status === "not_initialised") return "Not initialised";
  return "Offline";
}

function defaultHealth(): MasterAdminSystemHealthItem[] {
  const ni = (id: string, label: string, retry: string | null): MasterAdminSystemHealthItem => ({
    id,
    label,
    status: "not_initialised",
    statusLabel: "Not initialised",
    lastSuccessfulRun: null,
    lastAttemptedRun: null,
    lastError: null,
    evidenceSource: "system-health-cache",
    detail: "Integration not yet configured or run",
    retryAction: retry,
  });
  return [
    ni("website-import", "Website Import", "import_website"),
    ni("google-places", "Google APIs", "import_google"),
    ni("static-publishing", "Publishing", "publish"),
    ni("ftp-publishing", "FTP", "publish"),
    ni("google-search-console", "Search Console", "request_indexing"),
    ni("rank-tracking", "Rank Tracking", "init_rank_tracking"),
    ni("indexing", "Indexing", "request_indexing"),
    ni("email", "Email", "system-health/refresh"),
  ];
}

export function readMasterAdminHealthCache(): MasterAdminHealthCache | null {
  if (!fs.existsSync(CACHE_PATH)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as MasterAdminHealthCache;
    return { ...raw, version: 2, services: raw.services || defaultHealth() };
  } catch {
    return null;
  }
}

export function getCachedMasterAdminSystemHealth(): MasterAdminSystemHealthItem[] {
  const cached = readMasterAdminHealthCache();
  const base = cached?.services?.length ? cached.services : buildHealthFromStoredProof("broom-lane-pharmacy");
  return [...base, buildBackgroundJobWorkerHealthItem()];
}

function buildBackgroundJobWorkerHealthItem(): MasterAdminSystemHealthItem {
  let worker: {
    status?: string;
    lastHeartbeat?: string;
    lastPoll?: string | null;
    queueDepth?: number;
    currentJobId?: string | null;
    jobsProcessed?: number;
    workerId?: string;
  } | null = null;
  const workerPath = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "job-worker-health.json");
  if (fs.existsSync(workerPath)) {
    try {
      worker = JSON.parse(fs.readFileSync(workerPath, "utf8"));
    } catch {
      worker = null;
    }
  }

  const active = worker?.status === "active";
  const heartbeatAge = worker?.lastHeartbeat
    ? Date.now() - new Date(worker.lastHeartbeat).getTime()
    : Number.POSITIVE_INFINITY;
  const stale = heartbeatAge > 30000;

  let status: SystemHealthLevel = "not_initialised";
  if (active && !stale) status = "healthy";
  else if (active && stale) status = "warning";
  else if (worker) status = "offline";

  return {
    id: "background-job-worker",
    label: "Background Job Worker",
    status,
    statusLabel: labelFor(status),
    lastSuccessfulRun: worker?.lastHeartbeat || null,
    lastAttemptedRun: worker?.lastPoll || null,
    lastError: stale && active ? "Worker heartbeat stale" : null,
    evidenceSource: "job-worker-health.json",
    detail: worker
      ? `Worker ${worker.workerId || "unknown"} · queue ${worker.queueDepth ?? 0} · processed ${worker.jobsProcessed ?? 0}${worker.currentJobId ? ` · running ${worker.currentJobId}` : ""}`
      : "Worker not started",
    retryAction: "system-health/refresh",
  };
}

function lastAudit(action: string, status?: string) {
  const entries = listMasterAdminAudit({ limit: 20 }).filter((e) => e.action === action);
  if (status) return entries.find((e) => e.status === status) || null;
  return entries[0] || null;
}

function resolveStatus(
  integrationStatus: string | undefined,
  hasProof: boolean,
  lastSuccess: string | null,
  lastAttempt: string | null,
  lastError: string | null,
): SystemHealthLevel {
  if (!hasProof && !lastAttempt) return "not_initialised";
  if (integrationStatus === "connected" || integrationStatus === "ready") {
    if (lastSuccess) {
      const age = Date.now() - new Date(lastSuccess).getTime();
      if (age > FRESHNESS_DAYS * 86400000) return "warning";
    }
    return "healthy";
  }
  if (integrationStatus === "limited") return "warning";
  if (lastError && hasProof) return "offline";
  if (hasProof) return "warning";
  return "not_initialised";
}

export function buildHealthFromStoredProof(referenceSlug: string): MasterAdminSystemHealthItem[] {
  const proof = loadLiveIntegrationProof(referenceSlug);
  const integrations = proof?.integrations || [];
  const find = (id: string) => integrations.find((i) => i.id === id);

  function item(integrationId: string, auditAction: string, label: string, retry: string): MasterAdminSystemHealthItem {
    const integration = find(integrationId);
    const lastSuccessAudit = getLastSuccessfulAuditForAction(auditAction);
    const lastAttemptAudit = lastAudit(auditAction);
    const lastErrorAudit = lastAudit(auditAction, "error");
    const hasProof = Boolean(integration?.lastCheckedAt || integration?.testResult);
    const status = resolveStatus(
      integration?.status,
      hasProof,
      lastSuccessAudit?.timestamp || integration?.lastCheckedAt || null,
      lastAttemptAudit?.timestamp || null,
      lastErrorAudit?.errors?.[0] || null,
    );
    return {
      id: integrationId,
      label,
      status,
      statusLabel: labelFor(status),
      lastSuccessfulRun: lastSuccessAudit?.timestamp || integration?.lastCheckedAt || proof?.generatedAt || null,
      lastAttemptedRun: lastAttemptAudit?.timestamp || null,
      lastError: lastErrorAudit?.errors?.[0] || (integration?.testResult?.includes("fail") ? integration.testResult : null),
      evidenceSource: proof ? "growth-engine-live-integration-proof" : "audit-log",
      detail: integration?.testResult || (hasProof ? "Stored integration proof" : "No stored proof — not yet run"),
      retryAction: retry,
    };
  }

  const emailConfigured = Boolean(process.env.SMTP_HOST || process.env.EMAIL_FROM);
  const gsc = find("google-search-console");

  return [
    item("website-import", "import_website", "Website Import", "import_website"),
    item("google-places", "import_google", "Google APIs", "import_google"),
    item("static-publishing", "publish", "Publishing", "publish"),
    item("ftp-publishing", "publish", "FTP", "publish"),
    item("google-search-console", "request_indexing", "Search Console", "request_indexing"),
    item("rank-tracking", "init_rank_tracking", "Rank Tracking", "init_rank_tracking"),
    {
      id: "indexing",
      label: "Indexing",
      status: resolveStatus(gsc?.status, Boolean(gsc), getLastSuccessfulAuditForAction("request_indexing")?.timestamp || null, lastAudit("request_indexing")?.timestamp || null, lastAudit("request_indexing", "error")?.errors?.[0] || null),
      statusLabel: labelFor(resolveStatus(gsc?.status, Boolean(gsc), getLastSuccessfulAuditForAction("request_indexing")?.timestamp || null, lastAudit("request_indexing")?.timestamp || null, null)),
      lastSuccessfulRun: getLastSuccessfulAuditForAction("request_indexing")?.timestamp || null,
      lastAttemptedRun: lastAudit("request_indexing")?.timestamp || null,
      lastError: lastAudit("request_indexing", "error")?.errors?.[0] || null,
      evidenceSource: "pharmacy-indexing-bridge",
      detail: "Indexing bridge uses stored registry — GSC linkage informs status",
      retryAction: "request_indexing",
    },
    {
      id: "email",
      label: "Email",
      status: emailConfigured ? "healthy" : "not_initialised",
      statusLabel: emailConfigured ? "Healthy" : "Not initialised",
      lastSuccessfulRun: getLastSuccessfulAuditForAction("send_email")?.timestamp || null,
      lastAttemptedRun: lastAudit("send_email")?.timestamp || null,
      lastError: lastAudit("send_email", "error")?.errors?.[0] || null,
      evidenceSource: "environment.SMTP_*",
      detail: emailConfigured ? "SMTP configured" : "SMTP not configured",
      retryAction: "system-health/refresh",
    },
  ];
}

export function writeMasterAdminHealthCache(referenceSlug: string): MasterAdminHealthCache {
  const cache: MasterAdminHealthCache = {
    version: 2,
    updatedAt: new Date().toISOString(),
    referenceSlug,
    services: buildHealthFromStoredProof(referenceSlug),
  };
  fs.mkdirSync(path.dirname(CACHE_PATH), { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
  return cache;
}

export function ensureMasterAdminHealthCache(referenceSlug = "broom-lane-pharmacy"): MasterAdminHealthCache {
  const existing = readMasterAdminHealthCache();
  if (existing?.services?.length) return existing;
  return writeMasterAdminHealthCache(referenceSlug);
}
