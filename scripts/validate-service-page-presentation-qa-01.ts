/**
 * Design System V1 presentation QA evaluates the current rendered service page.
 * Does not approve, regenerate, or write tenant files.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const pagePath = "output/pharmacy-visual-experience/gilbert-pharmacy-health-clinic/blood-pressure-checks/index.html";
const html = readFileSync(resolve(pagePath), "utf8");
const qaSrc = readFileSync(resolve("src/pharmacy/pharmacyDesignSystemV1.ts"), "utf8");
const counter = qaSrc.slice(qaSrc.indexOf("export function servicePageInternalLinkCount"), qaSrc.indexOf("export function validatePharmaconnectDesignSystemV1Page"));

const protectedFiles = [
  pagePath,
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/jobs.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/service-page-generation/gilbert-pharmacy-health-clinic/by-service/blood-pressure-checks/latest.json",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });

const { validatePharmaconnectDesignSystemV1Page, servicePageInternalLinkCount } = await import("../src/pharmacy/pharmacyDesignSystemV1.ts");
const { evaluateCommercialServicePageChecklist } = await import("../src/pharmacy/masterAdminCoreProductRecoveryCommercialChecklistService.ts");

const hashOnly = (html.match(/href="#[a-z0-9-]+"/gi) || []).length;
check("stored page has one in-page anchor", hashOnly === 1, String(hashOnly));
check("imported shell is on the rendered page", html.includes('data-imported-website-shell="design-intelligence-v1"'));
check("two-card and five-card layout markers remain", html.includes('data-card-count="2"') && html.includes('data-card-count="5"') && html.includes("service-page-card-grid-balance"));

const qa = validatePharmaconnectDesignSystemV1Page(html);
const internal = qa.checks.find((item) => item.id === "internal-links");
check("current page internal links meet the minimum", Boolean(internal?.passed) && servicePageInternalLinkCount(html) >= 3, internal?.detail);
check("current rendered page passes Design System V1 QA", qa.passed, qa.checks.filter((item) => !item.passed).map((item) => item.detail).join("; "));

const checklist = evaluateCommercialServicePageChecklist("gilbert-pharmacy-health-clinic", "blood-pressure-checks");
const ds = checklist.items.find((item) => item.id === "presentation_ds_qa");
const consoleItem = checklist.items.find((item) => item.id === "tech_console");
check("presentation QA checklist item passes", ds?.passed === true && !ds.detail, ds?.detail);
check("automated review count is clear", checklist.passedCount === 52 && checklist.failedCount === 0 && checklist.allPassed);
check("console check stays a non-blocking manual item", consoleItem?.passed === false && consoleItem?.blocksGeneration === false && consoleItem?.detail === "Browser verification required");

const stripped = html
  .replace(/href="https?:\/\/[^"]*"/gi, 'href="#"')
  .replace(/href="\/[^"]*"/gi, 'href="#"')
  .replace(/href="#[a-z0-9-]+"/gi, 'href="#"');
const strippedQa = validatePharmaconnectDesignSystemV1Page(stripped);
const strippedInternal = strippedQa.checks.find((item) => item.id === "internal-links");
check("malformed presentation still fails internal links", strippedInternal?.passed === false && strippedQa.passed === false, strippedInternal?.detail);

const threeAnchors = `<header data-imported-website-shell="generic-fallback"><a href="#one">One</a><a href="#two">Two</a><a href="#three">Three</a></header>`;
const twoAnchors = `<header data-imported-website-shell="generic-fallback"><a href="#one">One</a><a href="#two">Two</a></header>`;
check("three in-page anchors still pass", servicePageInternalLinkCount(threeAnchors) >= 3);
check("two in-page anchors still fail", servicePageInternalLinkCount(twoAnchors) < 3);

const otherSite = `<header data-imported-website-shell="design-intelligence-v1"><a href="https://example.test/a">A</a><a href="https://example.test/b">B</a><a href="https://example.test/c">C</a></header>`;
const thinSite = `<header data-imported-website-shell="design-intelligence-v1"><a href="https://example.test/a">A</a><a href="https://other.test/b">B</a></header><a href="#faq-section">FAQ</a>`;
check("another imported shell with three site links passes", servicePageInternalLinkCount(otherSite) >= 3);
check("thin imported shell stays below the minimum", servicePageInternalLinkCount(thinSite) < 3);
check("no tenant-specific production logic", !/gilbert-pharmacy|blood-pressure-checks/.test(counter));

const approval = JSON.parse(readFileSync(protectedFiles[5], "utf8"));
const workflow = JSON.parse(readFileSync(protectedFiles[2], "utf8"));
const history = JSON.parse(readFileSync(protectedFiles[3], "utf8"));
const generation = JSON.parse(readFileSync(protectedFiles[6], "utf8"));
check("evidence remains approved", approval.decision === "approved");
check("Commercial Intelligence remains approved", Boolean(workflow.commercialIntelligenceApproval?.approvedAt));
check("workflow stage is unchanged", history.currentStage === "generate_ecosystem");
check("generation remains the existing completed job", generation.status === "completed" && generation.jobId === "26bbebdc-00d5-44ff-8ba1-f440c18e6f4c");

const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("evaluation did not change Gilbert files", before === after);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
