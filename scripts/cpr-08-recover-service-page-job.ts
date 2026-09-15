/**
 * CPR-08 — LEGACY manual recovery script (audit only).
 * CPR-13 removed manual requeue/nudge from the production service-page-only path.
 * Do not use for dashboard-initiated service-page jobs.
 */
import { requeueExistingMasterAdminJob, getMasterAdminJob } from "../src/pharmacy/masterAdminJobService.ts";
import { nudgeMasterAdminJobQueue, traceQueuedJob } from "../src/pharmacy/masterAdminJobWorkerService.ts";

const JOB_ID = "42e459c1-70d3-4272-b280-a512aed2d175";

async function main(): Promise<void> {
  const before = getMasterAdminJob(JOB_ID);
  if (!before) {
    console.error("Job not found:", JOB_ID);
    process.exit(1);
  }
  console.log("Before:", JSON.stringify({ id: before.id, status: before.status, error: before.error }, null, 2));

  if (before.status === "failed") {
    requeueExistingMasterAdminJob(JOB_ID);
  } else if (before.status === "queued") {
    console.log("Job already queued — nudging worker only");
  } else {
    console.log("Job status:", before.status, "— not requeueing");
    process.exit(before.status === "completed" ? 0 : 1);
  }

  const deadline = Date.now() + 120_000;
  let last: ReturnType<typeof getMasterAdminJob> = null;
  while (Date.now() < deadline) {
    await nudgeMasterAdminJobQueue();
    last = getMasterAdminJob(JOB_ID);
    if (last && (last.status === "completed" || last.status === "failed")) break;
    await new Promise((r) => setTimeout(r, 2000));
  }

  const trace = traceQueuedJob(JOB_ID);
  console.log("Trace:", JSON.stringify(trace, null, 2));
  console.log("Final:", JSON.stringify(last, null, 2));
  process.exit(last?.status === "completed" ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
