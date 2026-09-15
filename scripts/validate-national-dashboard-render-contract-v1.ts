import {
  buildNationalGrowthPlatformDashboard,
} from "../src/pharmacy/nationalGrowthPlatformDashboardService.ts";

let passed = 0;
let failed = 0;

function check(id: string, ok: boolean, detail: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${id} — ${String(detail)}`);
  if (ok) passed++;
  else failed++;
}

console.log("\n=== NATIONAL DASHBOARD RENDER CONTRACT V1 ===\n");

const d = buildNationalGrowthPlatformDashboard("pharmaconnect");

check(
  "steps-present",
  Array.isArray(d.steps) && d.steps.length >= 6,
  d.steps.length,
);

check(
  "every-step-id",
  d.steps.every((s) => Boolean(s.id)),
  d.steps.map((s) => s.id).join(", "),
);

check(
  "every-step-label",
  d.steps.every((s) => Boolean(s.label)),
  d.steps.map((s) => s.label).join(" | "),
);

check(
  "every-step-status",
  d.steps.every((s) => Boolean(s.status)),
  d.steps.map((s) => s.status).join(", "),
);

check(
  "every-step-status-label",
  d.steps.every((s) => Boolean(s.statusLabel)),
  d.steps.map((s) => s.statusLabel).join(", "),
);

check(
  "next-action-object",
  typeof d.nextAction === "object" && d.nextAction !== null,
  typeof d.nextAction,
);

check(
  "next-action-id",
  d.nextAction.id === "run_national_competitor_discovery",
  d.nextAction.id,
);

check(
  "next-action-label",
  Boolean(d.nextAction.label),
  d.nextAction.label,
);

check(
  "next-action-detail",
  Boolean(d.nextAction.detail),
  d.nextAction.detail,
);

check(
  "next-action-workflow",
  d.nextAction.actionType === "workflow",
  d.nextAction.actionType,
);

check(
  "next-action-state",
  ["ready", "blocked", "complete"].includes(d.nextAction.actionState),
  d.nextAction.actionState,
);

console.log(
  `\n${failed ? "FAIL" : "PASS"} — ${passed}/${passed + failed} checks\n`,
);

if (failed) process.exit(1);
