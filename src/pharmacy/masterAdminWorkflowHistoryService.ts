/**
 * Master Admin Workflow History V2 — transitions + stage execution results.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import type {
  WorkflowHistoryStore,
  WorkflowStageExecution,
  WorkflowStageId,
  WorkflowTransitionRecord,
} from "./masterAdminWorkflowModel.ts";

const HISTORY_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/workflow-history");

function historyPath(slug: string): string {
  return path.join(HISTORY_DIR, `${slug}.json`);
}

function readStore(slug: string): WorkflowHistoryStore {
  const file = historyPath(slug);
  if (!fs.existsSync(file)) {
    return {
      version: 2,
      slug,
      updatedAt: new Date().toISOString(),
      currentStage: "create_customer",
      transitions: [],
      executions: [],
    };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<WorkflowHistoryStore>;
    return {
      version: 2,
      slug,
      updatedAt: raw.updatedAt || new Date().toISOString(),
      currentStage: raw.currentStage || "create_customer",
      transitions: raw.transitions || [],
      executions: raw.executions || [],
    };
  } catch {
    return {
      version: 2,
      slug,
      updatedAt: new Date().toISOString(),
      currentStage: "create_customer",
      transitions: [],
      executions: [],
    };
  }
}

function writeStore(store: WorkflowHistoryStore): void {
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(historyPath(store.slug), JSON.stringify(store, null, 2));
}

export function getWorkflowHistory(slug: string): WorkflowTransitionRecord[] {
  return readStore(slug).transitions;
}

export function getWorkflowExecutions(slug: string): WorkflowStageExecution[] {
  return readStore(slug).executions;
}

export function getLastWorkflowExecution(slug: string): WorkflowStageExecution | null {
  return readStore(slug).executions[0] || null;
}

export function getActiveWorkflowExecution(slug: string): WorkflowStageExecution | null {
  return readStore(slug).executions.find((e) => e.status === "queued" || e.status === "running") || null;
}

export function markWorkflowExecutionRunning(
  slug: string,
  stageId: WorkflowStageId,
  actionId: string,
  jobId: string,
): void {
  const store = readStore(slug);
  const idx = store.executions.findIndex(
    (e) => e.stageId === stageId && e.actionId === actionId && e.jobId === jobId && e.status === "queued",
  );
  if (idx < 0) return;
  store.executions[idx] = {
    ...store.executions[idx]!,
    status: "running",
    evidence: "Background worker claimed job",
  };
  writeStore(store);
}

export function getLastRecordedWorkflowStage(slug: string): WorkflowStageId {
  return readStore(slug).currentStage;
}

export function recordWorkflowTransition(input: {
  slug: string;
  fromStage: WorkflowStageId;
  toStage: WorkflowStageId;
  operator: string;
  durationMs?: number | null;
  reason: string;
  evidence: string;
}): WorkflowTransitionRecord {
  const store = readStore(input.slug);
  const transition: WorkflowTransitionRecord = {
    fromStage: input.fromStage,
    toStage: input.toStage,
    timestamp: new Date().toISOString(),
    operator: input.operator,
    durationMs: input.durationMs ?? null,
    reason: input.reason,
    evidence: input.evidence,
  };

  if (store.currentStage !== input.toStage || store.transitions.length === 0) {
    store.transitions.unshift(transition);
    if (store.transitions.length > 200) store.transitions.length = 200;
  }
  store.currentStage = input.toStage;
  writeStore(store);
  return transition;
}

export function startWorkflowExecution(input: {
  slug: string;
  stageId: WorkflowStageId;
  actionId: string;
  operator: string;
  jobId?: string;
}): WorkflowStageExecution {
  const store = readStore(input.slug);
  const prior = store.executions.filter((e) => e.stageId === input.stageId);
  const execution: WorkflowStageExecution = {
    stageId: input.stageId,
    actionId: input.actionId,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    durationMs: null,
    operator: input.operator,
    evidence: "",
    warnings: [],
    errors: [],
    retryCount: prior.length,
    status: input.jobId ? "queued" : "running",
    jobId: input.jobId,
  };
  store.executions.unshift(execution);
  if (store.executions.length > 200) store.executions.length = 200;
  writeStore(store);
  return execution;
}

export function finishWorkflowExecution(input: {
  slug: string;
  stageId: WorkflowStageId;
  actionId: string;
  operator: string;
  evidence: string;
  warnings?: string[];
  errors?: string[];
  status: "completed" | "failed";
  jobId?: string;
}): WorkflowStageExecution {
  const store = readStore(input.slug);
  const idx = store.executions.findIndex(
    (e) =>
      e.stageId === input.stageId &&
      e.actionId === input.actionId &&
      (input.jobId ? e.jobId === input.jobId : e.status === "running" || e.status === "queued"),
  );
  const finishedAt = new Date().toISOString();
  const existing = idx >= 0 ? store.executions[idx]! : null;
  const startedAt = existing?.startedAt || finishedAt;
  const execution: WorkflowStageExecution = {
    stageId: input.stageId,
    actionId: input.actionId,
    startedAt,
    finishedAt,
    durationMs: Math.max(0, new Date(finishedAt).getTime() - new Date(startedAt).getTime()),
    operator: input.operator,
    evidence: input.evidence,
    warnings: input.warnings || [],
    errors: input.errors || [],
    retryCount: existing?.retryCount ?? 0,
    status: input.status,
    jobId: input.jobId || existing?.jobId,
  };
  if (idx >= 0) store.executions[idx] = execution;
  else store.executions.unshift(execution);
  writeStore(store);
  return execution;
}

export function getStageTransitionMeta(
  slug: string,
  stageId: WorkflowStageId,
): { timestamp: string | null; operator: string | null; durationMs: number | null; evidence: string | null } {
  const execution = readStore(slug).executions.find((e) => e.stageId === stageId && e.status === "completed");
  if (execution) {
    return {
      timestamp: execution.finishedAt,
      operator: execution.operator,
      durationMs: execution.durationMs,
      evidence: execution.evidence,
    };
  }
  const transitions = readStore(slug).transitions;
  const enter = transitions.find((t) => t.toStage === stageId);
  if (!enter) return { timestamp: null, operator: null, durationMs: null, evidence: null };
  return {
    timestamp: enter.timestamp,
    operator: enter.operator,
    durationMs: enter.durationMs,
    evidence: enter.evidence,
  };
}

export function resetWorkflowHistory(slug: string): void {
  const file = historyPath(slug);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}
