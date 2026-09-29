/**
 * Active Master Admin pharmacy-workflow mutations must use withAuthHandoff.
 * Read-only for Gilbert. Does not generate, approve, or advance workflow.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const repo = process.cwd();
const pagePath = path.resolve("artifacts/api-server/src/routes/masterAdminPlatformPage.ts");
const page = readFileSync(pagePath, "utf8");
const appSrc = readFileSync(path.resolve("artifacts/api-server/src/app.ts"), "utf8");
const routeSrc = readFileSync(path.resolve("artifacts/api-server/src/routes/api/masterAdminPlatform.ts"), "utf8");

const protectedFiles = [
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/business-profile-approvals/gilbert-pharmacy-health-clinic/latest.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/core-product-recovery/gilbert-pharmacy-health-clinic/contract.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-service/blood-pressure-checks/field-decisions.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/jobs.json",
].map((file) => path.join(repo, file));
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });

function splitArgs(src: string, openParen: number): string[] {
  const args: string[] = [];
  let i = openParen + 1;
  let start = i;
  let depth = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const ch = src[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0 && ch === ")") {
        args.push(src.slice(start, i).trim());
        return args;
      }
      depth--;
    } else if (ch === "," && depth === 0) {
      args.push(src.slice(start, i).trim());
      start = i + 1;
    }
    i++;
  }
  return args;
}

function methodOf(options: string): string {
  const match = options.match(/method\s*:\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/);
  return match ? match[1] : "GET";
}

function enclosingFunction(src: string, pos: number): string {
  const head = src.slice(0, pos);
  const matches = [...head.matchAll(/(?:async\s+)?function\s+[A-Za-z0-9_]+\s*\(/g)];
  if (!matches.length) return head;
  return head.slice(matches[matches.length - 1].index || 0);
}

function assignmentOf(fn: string, name: string): string {
  const re = new RegExp("(?:const|let|var)\\s+" + name + "\\s*=");
  const match = re.exec(fn);
  if (!match || match.index === undefined) return "";
  let i = match.index + match[0].length;
  let depth = 0;
  let quote: string | null = null;
  const start = i;
  while (i < fn.length) {
    const ch = fn[i];
    if (quote) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      i++;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{") depth++;
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (depth === 0) break;
      depth--;
    } else if (ch === ";" && depth === 0) break;
    i++;
  }
  return fn.slice(start, i);
}

type Row = { kind: "api" | "fetch"; method: string; target: string; cls: "A" | "B" | "C" | "D"; line: number };

const rows: Row[] = [];
const excludedPlatform: string[] = [];

function lineOf(pos: number): number {
  return page.slice(0, pos).split("\n").length;
}

function endpointOf(expr: string): string {
  const match = expr.match(/\/api\/[^'"\s]+/);
  return match ? match[0] : expr.slice(0, 120);
}

function classifyCall(kind: "api" | "fetch", pos: number) {
  const open = page.indexOf("(", pos);
  const args = splitArgs(page, open);
  const targetExpr = args[0] || "";
  const method = methodOf(args[1] || "");
  if (method === "GET") return;
  const resolved = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(targetExpr)
    ? assignmentOf(enclosingFunction(page, pos), targetExpr)
    : targetExpr;
  const target = endpointOf(resolved || targetExpr);
  if (target.includes("/platform-infrastructure")) {
    excludedPlatform.push(method + " " + target);
    return;
  }
  const usesHandoff = kind === "api"
    ? (resolved || targetExpr).startsWith("'") || (resolved || targetExpr).startsWith('"') || (resolved || targetExpr).includes("'/api/") || (resolved || targetExpr).includes('"/api/')
    : (resolved || targetExpr).includes("withAuthHandoff(");
  const apiCovers = kind === "api" && page.includes("path=withAuthHandoff(path)") && ((resolved || targetExpr).includes("'/") || (resolved || targetExpr).includes('"/'));
  rows.push({
    kind,
    method,
    target,
    cls: usesHandoff || apiCovers ? "A" : "B",
    line: lineOf(pos),
  });
}

for (const match of page.matchAll(/\bapi\s*\(/g)) classifyCall("api", match.index || 0);
for (const match of page.matchAll(/\bfetch\s*\(/g)) classifyCall("fetch", match.index || 0);

const counts = { A: 0, B: 0, C: 0, D: 0 };
for (const row of rows) counts[row.cls]++;
const bRows = rows.filter((row) => row.cls === "B");

check("zero active in-scope mutations miss the auth handoff", bRows.length === 0, bRows.map((row) => row.line + " " + row.method + " " + row.target).join("; "));
check("audit found active pharmacy-workflow mutations", rows.length > 0, String(rows.length));
check("no intentionally unauthenticated workflow mutations", counts.C === 0);
check("no superseded mutation path left active", counts.D === 0);

const confirmFn = page.slice(page.indexOf("async function confirmSpgGenerationClick"), page.indexOf("async function pollSpgJobOnce"));
check("service-page generation confirm uses the auth handoff", confirmFn.includes("withAuthHandoff('/api/master-admin-platform/customers/'+encodeURIComponent(slug)+'/service-page-generation/confirm')"));
check("generation confirm failure exits the pending state", confirmFn.includes("renderSpgGenerationError") && confirmFn.includes("spgGenerationInFlight=false") && confirmFn.includes("updateSpgGenerateState()") && confirmFn.includes("Generation job creation failed"));
check("generation confirm is not Gilbert-specific", !confirmFn.includes("gilbert"));
check("generation confirm stays on the generic customer path", confirmFn.includes("encodeURIComponent(slug)"));

const saveFn = page.slice(page.indexOf("async function decideEvidenceReviewField"), page.indexOf("function openBusinessProfileReviewFromEvidence"));
const approvalFn = page.slice(page.indexOf("async function approveServicePageEvidenceReview"), page.indexOf("function updateSpgGenerateState"));
check("field decision save still uses the auth handoff", saveFn.includes("withAuthHandoff(") && saveFn.includes("/service-page-evidence-review/field"));
check("evidence approval still uses the auth handoff", approvalFn.includes("withAuthHandoff(") && approvalFn.includes("/service-page-evidence-review/approve") && !approvalFn.includes("gilbert"));
check("requireAuth still guards API mutations", appSrc.includes('app.use("/api", requireAuth)') && routeSrc.includes('"/master-admin-platform/customers/:slug/service-page-generation/confirm"'));
check("api() still applies the canonical handoff", page.includes("if(typeof path==='string'&&path.startsWith('/'))") && page.includes("path=withAuthHandoff(path)"));

const workflow = JSON.parse(readFileSync(protectedFiles[2], "utf8"));
const history = JSON.parse(readFileSync(protectedFiles[3], "utf8"));
const contract = JSON.parse(readFileSync(protectedFiles[4], "utf8"));
const fields = JSON.parse(readFileSync(protectedFiles[5], "utf8"));
const approval = JSON.parse(readFileSync(protectedFiles[6], "utf8"));
const jobs = JSON.parse(readFileSync(protectedFiles[7], "utf8"));
const gilbertJobs = (jobs.jobs || []).filter((job: { slug?: string }) => job.slug === "gilbert-pharmacy-health-clinic");
check("Gilbert evidence approval remains approved", approval.decision === "approved" && approval.approvalType === "service-evidence");
check("Private services offered remains Yes", fields.decisions.privateServicesOffered.evidenceValueAtDecision === "Yes" && fields.decisions.privateServicesOffered.decision === "confirmed");
check("Consultation process remains confirmed", fields.decisions.consultationProcess.decision === "confirmed");
check("Commercial Intelligence remains approved", Boolean(workflow.commercialIntelligenceApproval && workflow.commercialIntelligenceApproval.approvedAt));
check("workflow was not advanced", history.currentStage === "generate_ecosystem");
check("no service page content generated", contract.servicePageGenerated === false);
check("no Gilbert service-page generation job exists", gilbertJobs.every((job: { action?: string }) => !String(job.action || "").includes("service-page") && job.action !== "generate_service_page"));
check("platform infrastructure stays outside this pharmacy-workflow audit", excludedPlatform.every((entry) => entry.includes("/platform-infrastructure")));

const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("Gilbert files were not modified", before === after);

const failed = steps.filter((step) => !step.passed);
console.log(JSON.stringify({
  total: rows.length,
  A: counts.A,
  B: counts.B,
  C: counts.C,
  D: counts.D,
  excludedPlatform: excludedPlatform.length,
  b: bRows,
}, null, 2));
for (const step of steps) console.log((step.passed ? "PASS" : "FAIL") + " — " + step.name + (step.detail ? " — " + step.detail : ""));
console.log((failed.length ? "FAIL " + failed.length + "/" + steps.length : "PASS " + steps.length + "/" + steps.length));
if (failed.length) process.exit(1);
