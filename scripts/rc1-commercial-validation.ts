#!/usr/bin/env npx tsx
/**
 * RC1 end-to-end commercial validation — read-only diagnosis only.
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import { loadMasterAdminCustomerContext } from "../src/pharmacy/masterAdminCustomerContextService.ts";
import { buildCustomerWorkflowState } from "../src/pharmacy/masterAdminWorkflowEngine.ts";
import { verifyStageCompletion, resolveWorkflowStage } from "../src/pharmacy/masterAdminWorkflowStageExecutor.ts";
import { WORKFLOW_STAGE_ORDER, type WorkflowStageId } from "../src/pharmacy/masterAdminWorkflowModel.ts";
import { buildCommercialPublishReview } from "../src/pharmacy/masterAdminCommercialPublishReviewService.ts";
import { buildManagedPublishingReview } from "../src/pharmacy/masterAdminManagedPublishingService.ts";
import { buildPlatformInfrastructureReview } from "../src/pharmacy/masterAdminPlatformPublishingInfrastructureService.ts";
import { readMasterAdminJobWorkerHealth } from "../src/pharmacy/masterAdminJobWorkerService.ts";
import { listMasterAdminJobs, getMasterAdminJobsStorePath } from "../src/pharmacy/masterAdminJobService.ts";
import { buildMasterAdminOperationalReadinessReport } from "../src/pharmacy/masterAdminOperationalReadinessService.ts";
import { listMasterAdminIssueSummaries } from "../src/pharmacy/masterAdminIssueService.ts";
import { getCachedMasterAdminSystemHealth } from "../src/pharmacy/masterAdminHealthCacheService.ts";

const SLUG = "banner-cross-pharmacy";
const BASE = "http://127.0.0.1:3001";
const TOKEN = process.env.SESSION_SECRET || "dev-fallback-secret-change-in-prod";

type Severity = "Critical" | "High" | "Medium" | "Low";
interface Defect {
  id: string;
  severity: Severity;
  phase: string;
  title: string;
  detail: string;
  recommendedFix: string;
}

const defects: Defect[] = [];
let defectSeq = 0;

function add(severity: Severity, phase: string, title: string, detail: string, recommendedFix: string) {
  defects.push({
    id: `RC1-${String(++defectSeq).padStart(3, "0")}`,
    severity,
    phase,
    title,
    detail,
    recommendedFix,
  });
}

function readJson<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

async function apiGet(route: string): Promise<{ status: number; ms: number; ok: boolean; body?: unknown }> {
  const started = performance.now();
  try {
    const res = await fetch(`${BASE}${route}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${TOKEN}` },
    });
    const ms = performance.now() - started;
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      body = null;
    }
    return { status: res.status, ms, ok: res.ok, body };
  } catch (err) {
    return { status: 0, ms: performance.now() - started, ok: false, body: String(err) };
  }
}

async function main() {
  console.log("=== RC1 COMMERCIAL VALIDATION — banner-cross-pharmacy ===\n");

  const ctx = loadMasterAdminCustomerContext(SLUG);
  const wf = buildCustomerWorkflowState(SLUG, "rc1-validation");
  const wfHistory = readJson<{ currentStage: string; transitions: unknown[] }>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/workflow-history", `${SLUG}.json`),
  );
  const publishStatus = readJson<Record<string, unknown>>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-publish-status", `${SLUG}.json`),
  );
  const indexing = readJson<Record<string, unknown>>(path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${SLUG}.json`));
  const publishSnapshot = readJson<Record<string, unknown>>(
    path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "latest.json"),
  );
  const workerHealth = readMasterAdminJobWorkerHealth();
  const jobs = listMasterAdminJobs({ slug: SLUG, limit: 100 });
  const issues = listMasterAdminIssueSummaries().filter((i) => i.tenantSlug === SLUG && !["Closed", "Passed"].includes(i.status));

  // PHASE 1 — Customer lifecycle stage verification
  const stageChecks: Array<{ stage: WorkflowStageId; pass: boolean; detail: string }> = [];
  for (const stage of WORKFLOW_STAGE_ORDER) {
    if (stage === "archived" || stage === "suspended") continue;
    const complete = ctx ? verifyStageCompletion(stage, ctx) : false;
    stageChecks.push({ stage, pass: complete, detail: complete ? "complete" : "incomplete" });
  }

  console.log("PHASE 1 — Customer Lifecycle");
  for (const s of stageChecks) {
    console.log(`  ${s.stage}: ${s.pass ? "PASS" : "FAIL"} (${s.detail})`);
  }
  console.log(`  Recorded stage: ${wfHistory?.currentStage}`);
  console.log(`  Resolved stage: ${wf?.currentStage}`);
  console.log(`  Transition count: ${wfHistory?.transitions?.length ?? 0}`);

  if (wfHistory?.currentStage !== wf?.currentStage) {
    add(
      "High",
      "Phase 1 / Phase 5",
      "Workflow recorded stage diverges from resolved stage",
      `history=${wfHistory?.currentStage} resolved=${wf?.currentStage}`,
      "Reconcile workflow history with customer context signals",
    );
  }
  if (wf?.currentStage === "request_indexing" && (!indexing || Number(indexing.submitted) === 0)) {
    add(
      "High",
      "Phase 1",
      "Request Indexing stage active but no indexing submissions recorded",
      `submitted=${indexing?.submitted ?? 0}, registered=${indexing?.totalRegistered ?? 0}`,
      "Execute Request Indexing workflow action or register pages from publish index",
    );
  }
  if (!publishStatus?.lastPublishedAt) {
    add("Critical", "Phase 1 / Phase 6", "Publish completion signal missing", "lastPublishedAt null", "Re-run publish or repair publish-status file");
  }
  if (issues.filter((i) => i.severity === "Critical").length) {
    add(
      "High",
      "Phase 7",
      "Open Critical Issue Centre tickets for test tenant",
      issues
        .filter((i) => i.severity === "Critical")
        .map((i) => i.issueId)
        .join(", "),
      "Close or resolve stale publish failure diagnostics after successful v1 publish",
    );
  }

  // PHASE 2 — Worker
  console.log("\nPHASE 2 — Background Worker");
  console.log(`  Worker status: ${workerHealth?.status}`);
  console.log(`  Heartbeat: ${workerHealth?.lastHeartbeat}`);
  console.log(`  Queue depth: ${workerHealth?.queueDepth ?? "?"}`);
  console.log(`  Jobs store: ${getMasterAdminJobsStorePath()}`);
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const completedPublish = jobs.filter((j) => j.action === "publish" && j.status === "completed");
  const failedPublish = jobs.filter((j) => j.action === "publish" && j.status === "failed");
  console.log(`  Banner Cross jobs: ${jobs.length} (active ${activeJobs.length}, publish completed ${completedPublish.length}, publish failed ${failedPublish.length})`);

  if (workerHealth?.status !== "active") {
    add("Critical", "Phase 2", "Job worker not active", String(workerHealth?.status), "Restart PM2 and verify worker heartbeat");
  }
  const duplicateRunning = jobs.filter((j) => j.status === "running");
  if (duplicateRunning.length > 1) {
    add("High", "Phase 2", "Multiple running jobs for tenant", duplicateRunning.map((j) => j.id).join(", "), "Investigate stale lease recovery");
  }

  // PHASE 3 — API latency sample
  console.log("\nPHASE 3 — API Validation (authenticated sample)");
  const routes = [
    "/api/master-admin-platform/dashboard",
    `/api/master-admin-platform/customers/${SLUG}`,
    `/api/master-admin-platform/customers/${SLUG}/workflow`,
    `/api/master-admin-platform/customers/${SLUG}/commercial-publish-review`,
    `/api/master-admin-platform/customers/${SLUG}/managed-publishing`,
    "/api/master-admin-platform/platform-infrastructure",
    "/api/master-admin-platform/system-health",
    "/api/master-admin-platform/jobs?limit=20",
    "/api/master-admin-platform/issues/meta",
  ];
  const latencies: number[] = [];
  let apiFail = 0;
  for (const route of routes) {
    const r = await apiGet(route);
    latencies.push(r.ms);
    const slow = r.ms > 2000;
    const bad = !r.ok || r.status >= 400;
    console.log(`  ${route}: HTTP ${r.status} ${r.ms.toFixed(0)}ms ${bad ? "FAIL" : slow ? "SLOW" : "PASS"}`);
    if (bad) {
      apiFail++;
      add("High", "Phase 3", `API endpoint failed: ${route}`, `HTTP ${r.status}`, "Fix endpoint auth or handler error");
    } else if (slow) {
      add("Medium", "Phase 3", `API endpoint slow: ${route}`, `${r.ms.toFixed(0)}ms`, "Profile and optimise handler");
    }
  }
  const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  console.log(`  Average latency: ${avg.toFixed(0)}ms`);
  if (avg > 500) {
    add("Medium", "Phase 10", "Average API latency above 500ms target", `${avg.toFixed(0)}ms`, "Optimise dashboard and customer payload assembly");
  }

  // PHASE 5 — Workflow transitions integrity
  console.log("\nPHASE 5 — Workflow Validation");
  const transitions = (wfHistory?.transitions || []) as Array<{ fromStage: string; toStage: string; timestamp: string }>;
  const dupes = new Map<string, number>();
  for (const t of transitions) {
    const key = `${t.fromStage}->${t.toStage}@${t.timestamp}`;
    dupes.set(key, (dupes.get(key) || 0) + 1);
  }
  const duplicateTransitions = [...dupes.entries()].filter(([, c]) => c > 1);
  if (duplicateTransitions.length) {
    add("Medium", "Phase 5", "Duplicate workflow transition records", duplicateTransitions.map(([k]) => k).join("; "), "Deduplicate workflow history writes");
  }

  // PHASE 6 — Publishing
  console.log("\nPHASE 6 — Publishing Validation");
  const publishReview = buildCommercialPublishReview(SLUG);
  const managed = buildManagedPublishingReview(SLUG);
  const infra = buildPlatformInfrastructureReview();
  console.log(`  Publish readiness: ${publishReview.summary.publishingReadiness}`);
  console.log(`  Current release: ${managed.profile.currentRelease}`);
  console.log(`  Published version: ${managed.profile.publishedVersion}`);
  console.log(`  Platform status: ${infra.summary.platformStatus}`);

  const liveVerification = publishSnapshot?.liveVerification as Record<string, unknown> | undefined;
  const httpReachable = (liveVerification?.https as { httpReachable?: boolean })?.httpReachable;
  const homepageOk = (liveVerification?.homepage as { ok?: boolean })?.ok;
  if (publishSnapshot && !homepageOk && httpReachable === false) {
    add(
      "Critical",
      "Phase 6",
      "Managed hostname not HTTP-accessible after publish",
      "All live URL checks failed; SFTP-only verification used",
      "Configure nginx/vhost for sites.pharmaconnect.uk tenant paths before commercial release",
    );
  }
  if (managed.profile.publishedVersion > 0 && !managed.profile.previousRelease && managed.profile.publishedVersion > 1) {
    add("Medium", "Phase 6", "Previous release not tracked after multi-publish", "previousRelease null", "Ensure recordManagedPublishRelease preserves previousRelease");
  }

  // PHASE 7 — Issue Centre
  console.log("\nPHASE 7 — Issue Centre");
  console.log(`  Open issues: ${issues.length}`);
  for (const issue of issues) {
    console.log(`    ${issue.issueId} [${issue.severity}] ${issue.title} (${issue.status})`);
    if (issue.severity === "Critical" || issue.severity === "high" || issue.severity === "High") {
      if (issue.title.includes("Commercial publish failed") && managed.profile.publishedVersion > 0) {
        add(
          "High",
          "Phase 7",
          `Stale open issue after successful publish: ${issue.issueId}`,
          issue.title,
          "Auto-close Publishing issues when subsequent publish succeeds",
        );
      }
    }
  }

  // PHASE 9 — Data integrity spot checks
  console.log("\nPHASE 9 — Data Integrity");
  const requiredFiles = [
    path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", SLUG, "pharmacy-first.json"),
    path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", SLUG, "pharmacy-first/_ecosystem-index.json"),
    path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-quality-review", SLUG, "latest.json"),
    path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/managed-publishing", `${SLUG}.json`),
    path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/commercial-publish", SLUG, "latest.json"),
  ];
  for (const f of requiredFiles) {
    const ok = fs.existsSync(f);
    console.log(`  ${ok ? "PASS" : "FAIL"} ${path.basename(f)}`);
    if (!ok) add("Critical", "Phase 9", "Missing required data artifact", f, "Restore from backup or re-run stage");
  }

  // PHASE 10 — Performance / readiness report
  console.log("\nPHASE 10 — Performance");
  const readiness = buildMasterAdminOperationalReadinessReport();
  const sysHealth = getCachedMasterAdminSystemHealth();
  console.log(`  Operational readiness score: ${readiness.score}`);
  console.log(`  Dashboard load ms: ${readiness.dashboardLoadMs}`);
  console.log(`  System health cache: ${sysHealth?.overallStatus ?? "unknown"}`);

  if (readiness.dashboardLoadMs > 2000) {
    add("Medium", "Phase 10", "Dashboard load exceeds 2s", `${readiness.dashboardLoadMs}ms`, "Optimise dashboard lite assembly");
  }

  // Summary counts
  const critical = defects.filter((d) => d.severity === "Critical").length;
  const high = defects.filter((d) => d.severity === "High").length;
  const medium = defects.filter((d) => d.severity === "Medium").length;
  const low = defects.filter((d) => d.severity === "Low").length;

  console.log("\n=== DEFECT SUMMARY ===");
  console.log(`Critical: ${critical}`);
  console.log(`High: ${high}`);
  console.log(`Medium: ${medium}`);
  console.log(`Low: ${low}`);
  console.log("\n=== DEFECTS ===");
  for (const d of defects) {
    console.log(`[${d.severity}] ${d.id} (${d.phase}) ${d.title}`);
    console.log(`  ${d.detail}`);
    console.log(`  Fix: ${d.recommendedFix}\n`);
  }

  const reportPath = path.join(WORKSPACE_ROOT, "data/validation-reports/rc1-commercial-validation-banner-cross.json");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        tenant: SLUG,
        workflow: { recorded: wfHistory?.currentStage, resolved: wf?.currentStage },
        stageChecks,
        api: { averageMs: avg, failures: apiFail },
        defects,
        counts: { critical, high, medium, low },
      },
      null,
      2,
    ),
  );
  console.log(`Report written: ${reportPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
