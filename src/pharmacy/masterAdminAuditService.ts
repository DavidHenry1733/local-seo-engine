/**
 * Master Admin Audit Log V1 — records every operational action with evidence.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";

export type MasterAdminAuditStatus = "success" | "warning" | "error" | "running";

export interface MasterAdminAuditEntry {
  id: string;
  timestamp: string;
  user: string;
  slug: string;
  action: string;
  status: MasterAdminAuditStatus;
  evidence: string;
  errors: string[];
  retries: number;
  meta?: Record<string, unknown>;
}

export interface MasterAdminAuditStore {
  version: 1;
  updatedAt: string;
  entries: MasterAdminAuditEntry[];
}

const AUDIT_PATH = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "audit-log.json");
const MAX_ENTRIES = 2000;

function readStore(): MasterAdminAuditStore {
  if (!fs.existsSync(AUDIT_PATH)) {
    return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(AUDIT_PATH, "utf8")) as MasterAdminAuditStore;
    return {
      version: 1,
      updatedAt: raw.updatedAt || new Date().toISOString(),
      entries: Array.isArray(raw.entries) ? raw.entries : [],
    };
  } catch {
    return { version: 1, updatedAt: new Date().toISOString(), entries: [] };
  }
}

function writeStore(store: MasterAdminAuditStore): void {
  fs.mkdirSync(path.dirname(AUDIT_PATH), { recursive: true });
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(AUDIT_PATH, JSON.stringify(store, null, 2));
}

export function recordMasterAdminAudit(input: {
  user: string;
  slug: string;
  action: string;
  status: MasterAdminAuditStatus;
  evidence?: string;
  errors?: string[];
  retries?: number;
  meta?: Record<string, unknown>;
}): MasterAdminAuditEntry {
  const entry: MasterAdminAuditEntry = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    user: input.user || "system",
    slug: input.slug || "",
    action: input.action,
    status: input.status,
    evidence: input.evidence || "",
    errors: input.errors || [],
    retries: input.retries || 0,
    meta: input.meta,
  };
  const store = readStore();
  store.entries.unshift(entry);
  if (store.entries.length > MAX_ENTRIES) store.entries.length = MAX_ENTRIES;
  writeStore(store);
  return entry;
}

export function listMasterAdminAudit(options?: {
  slug?: string;
  limit?: number;
  action?: string;
}): MasterAdminAuditEntry[] {
  const store = readStore();
  let entries = store.entries;
  if (options?.slug) entries = entries.filter((e) => e.slug === options.slug);
  if (options?.action) entries = entries.filter((e) => e.action === options.action);
  const limit = Math.min(Math.max(options?.limit || 100, 1), 500);
  return entries.slice(0, limit);
}

export function getLastSuccessfulAuditForAction(action: string): MasterAdminAuditEntry | null {
  return listMasterAdminAudit({ action, limit: 50 }).find((e) => e.status === "success") || null;
}
