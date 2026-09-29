/**
 * Verified local-evidence consumption contract.
 * Generation and validation share one selector. This script does not generate pages or jobs.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import {
  pageConsumesRequiredVerifiedLocalEvidence,
  selectVerifiedLocalEvidenceForPatientCopy,
  verifiedLocalEvidencePatientCopySentence,
  visibleCopyContainsVerifiedEvidenceName,
} from "../src/pharmacy/contentEngine/pharmacyVerifiedLocalEvidenceConsumptionContract.ts";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const root = resolve(".");
const contractPath = "src/pharmacy/contentEngine/pharmacyVerifiedLocalEvidenceConsumptionContract.ts";
const renderPath = "src/pharmacy/pharmacyApprovedBankLocalityDirectRender.ts";
const generationPath = "src/pharmacy/pharmacyLocalLocationGenerationService.ts";
const campaignPath = "data/pharmacy-campaigns/gilbert-pharmacy-health-clinic.json";
const reviewPath =
  "data/pharmacy-master-admin/service-page-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json";
const servicePagePath = "output/pharmacy-visual-experience/gilbert-pharmacy-health-clinic/blood-pressure-checks/index.html";
const jobsPath = "data/pharmacy-master-admin/jobs.json";
const historyPath = "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json";
const evidencePath =
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json";
const intelligencePath = "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json";
const generationLatestPath =
  "data/pharmacy-master-admin/service-page-generation/gilbert-pharmacy-health-clinic/by-service/blood-pressure-checks/latest.json";
const localityDir = "output/pharmacy-content-ecosystem/gilbert-pharmacy-health-clinic/blood-pressure-checks";

const expectedHashes: Record<string, string> = {
  [campaignPath]: "b1a0872820599061477fc6dbae642e79b6a995b97b68945e70a35e14a0b849ef",
  [reviewPath]: "c4b044432ed1a2f7e39059187b2be2167a4f97b20f1905a2da1146fa7217d45c",
  [servicePagePath]: "cf733520911cbadffc55573bb03c31ea2798c7e2e60dbbe7ff2c4d4db43cf18c",
  [jobsPath]: "6944a181376fef8f3c6019fb09fcc6f9366d4206da6060671c1e760e93f76c47",
  [historyPath]: "f859b72375053fdd26033c93a53faf040713a71fe237deb5c392f9fb936a397f",
  [evidencePath]: "e7abe54aaaad3e15b9c3b002fa1de21e70bf95f7a8c805c52ff228ef11169db2",
  [intelligencePath]: "44ebe9b180c1f44253bc240c0273ba6dd19a2f49a557c03ec4cd4ef9d4154e43",
  [generationLatestPath]: "9be152745cba389057f70e64218ec581f21eb18ac6251e9960daa3cf66d80252",
};

function fileHash(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function listFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of readdirSync(current)) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full);
      else out.push(relative(dir, full));
    }
  };
  walk(resolve(dir));
  return out.sort();
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function visibleParagraph(text: string): string {
  return `<article><p>${esc(text)}</p></article>`;
}

const protectedFiles = Object.keys(expectedHashes);
const localityBefore = listFiles(localityDir);
const hashesBefore = Object.fromEntries(protectedFiles.map((path) => [path, fileHash(path)]));
const jobsBefore = JSON.parse(readFileSync(jobsPath, "utf8"));

const barrheadFacts = [
  { name: "Barrhead War Memorial", category: "landmarks" },
  { name: "Barrhead Foundry", category: "community" },
  { name: "Barrhead Health & Care Centre", category: "healthcare" },
];
const barrhead = selectVerifiedLocalEvidenceForPatientCopy(barrheadFacts);
const barrheadSentence = verifiedLocalEvidencePatientCopySentence(barrhead.selected.map((fact) => fact.name));
const barrheadHtml = visibleParagraph(barrheadSentence);
check(
  "healthcare plus fewer than three other facts is consumed",
  barrhead.required.some((fact) => fact.name === "Barrhead Health & Care Centre") &&
    barrhead.selected.some((fact) => fact.name === "Barrhead Health & Care Centre") &&
    barrheadSentence.includes("Barrhead Health & Care Centre") &&
    pageConsumesRequiredVerifiedLocalEvidence(barrheadHtml, barrheadFacts),
);

const renfrewFacts = [
  { name: "Renfrew Town Hall", category: "landmarks" },
  { name: "Renfrew Clock", category: "landmarks" },
  { name: "Renfrew Cross", category: "landmarks" },
  { name: "Renfrew Library", category: "community" },
  { name: "Clydeview Medical Practice", category: "healthcare" },
];
const renfrew = selectVerifiedLocalEvidenceForPatientCopy(renfrewFacts);
const renfrewSentence = verifiedLocalEvidencePatientCopySentence(renfrew.selected.map((fact) => fact.name));
check(
  "healthcare is still consumed when three or more landmark facts exist",
  renfrew.required[0]?.name === "Clydeview Medical Practice" &&
    renfrew.selected[0]?.name === "Clydeview Medical Practice" &&
    renfrew.selected.length === 3 &&
    pageConsumesRequiredVerifiedLocalEvidence(visibleParagraph(renfrewSentence), renfrewFacts) &&
    !pageConsumesRequiredVerifiedLocalEvidence(visibleParagraph("Renfrew Town Hall, Renfrew Clock and Renfrew Cross."), renfrewFacts),
);

const glasgowFacts = [
  { name: "George Square", category: "landmarks" },
  { name: "Glasgow Cathedral", category: "landmarks" },
  { name: "Kelvingrove Art Gallery", category: "landmarks" },
  { name: "Mitchell Library", category: "community" },
  { name: "People's Palace", category: "community" },
  { name: "Glasgow Royal Infirmary", category: "healthcare" },
];
const glasgow = selectVerifiedLocalEvidenceForPatientCopy(glasgowFacts);
const glasgowSentence = verifiedLocalEvidencePatientCopySentence(glasgow.selected.map((fact) => fact.name));
check(
  "healthcare is still consumed when landmark and community facts fill every remaining slot",
  glasgow.required[0]?.name === "Glasgow Royal Infirmary" &&
    glasgow.selected.some((fact) => fact.name === "Glasgow Royal Infirmary") &&
    glasgow.selected.length === 3 &&
    pageConsumesRequiredVerifiedLocalEvidence(visibleParagraph(glasgowSentence), glasgowFacts),
);

const transportFacts = [
  { name: "Riverside Park", category: "landmarks" },
  { name: "Riverside Library", category: "community" },
  { name: "Harbour Walk", category: "landmarks" },
  { name: "Central Bus Station", category: "transport" },
];
const transport = selectVerifiedLocalEvidenceForPatientCopy(transportFacts);
const transportSentence = verifiedLocalEvidencePatientCopySentence(transport.selected.map((fact) => fact.name));
check(
  "transport evidence is consumed when no healthcare evidence exists",
  transport.required[0]?.name === "Central Bus Station" &&
    transport.required[0]?.category === "transport" &&
    transportSentence.includes("Central Bus Station") &&
    pageConsumesRequiredVerifiedLocalEvidence(visibleParagraph(transportSentence), transportFacts) &&
    !pageConsumesRequiredVerifiedLocalEvidence(visibleParagraph("Riverside Park and Riverside Library."), transportFacts),
);

const landmarkOnly = [
  { name: "Market Cross", category: "landmarks" },
  { name: "Parish Church", category: "landmarks" },
  { name: "Village Hall", category: "community" },
  { name: "Old School", category: "schools" },
];
const noClinical = selectVerifiedLocalEvidenceForPatientCopy(landmarkOnly);
check(
  "no healthcare or transport evidence stays valid without invented evidence",
  noClinical.required.length === 0 &&
    noClinical.selected.every((fact) => landmarkOnly.some((input) => input.name === fact.name)) &&
    !noClinical.selected.some((fact) => fact.category === "healthcare" || fact.category === "transport") &&
    pageConsumesRequiredVerifiedLocalEvidence("<p>Market Cross and Parish Church.</p>", landmarkOnly),
);

const ampersandName = "Barrhead Health & Care Centre";
check(
  "raw ampersand evidence matches escaped HTML",
  visibleCopyContainsVerifiedEvidenceName(`<p>${esc(ampersandName)}</p>`, ampersandName) &&
    visibleCopyContainsVerifiedEvidenceName("<p>Barrhead Health &amp; Care Centre</p>", ampersandName) &&
    pageConsumesRequiredVerifiedLocalEvidence(`<p>${esc(barrheadSentence)}</p>`, barrheadFacts),
);

const apostropheName = "St John's Medical Practice";
const apostropheFacts = [{ name: apostropheName, category: "healthcare" }];
check(
  "apostrophe and HTML entity evidence matches",
  visibleCopyContainsVerifiedEvidenceName("<p>St John&#39;s Medical Practice</p>", apostropheName) &&
    visibleCopyContainsVerifiedEvidenceName("<p>St John&apos;s Medical Practice</p>", apostropheName) &&
    visibleCopyContainsVerifiedEvidenceName("<p>St John&#x27;s Medical Practice</p>", apostropheName) &&
    visibleCopyContainsVerifiedEvidenceName("<p>St John’s Medical Practice</p>", apostropheName) &&
    visibleCopyContainsVerifiedEvidenceName("<p>St   John's\nMedical   Practice</p>", apostropheName) &&
    visibleCopyContainsVerifiedEvidenceName("<p>ST JOHN'S MEDICAL PRACTICE</p>", apostropheName) &&
    pageConsumesRequiredVerifiedLocalEvidence("<p>St John&#39;s Medical Practice</p>", apostropheFacts),
);

check(
  "unrelated visible text cannot satisfy evidence consumption",
  !visibleCopyContainsVerifiedEvidenceName("<p>The library and the war memorial are nearby.</p>", ampersandName) &&
    !visibleCopyContainsVerifiedEvidenceName("<p>Barrhead Health and Care</p>", ampersandName) &&
    !visibleCopyContainsVerifiedEvidenceName("<p>Health &amp; Care Centre</p>", ampersandName) &&
    !visibleCopyContainsVerifiedEvidenceName("<p>St John Medical Practice</p>", apostropheName) &&
    !visibleCopyContainsVerifiedEvidenceName("<p>Royal Hospitality Centre</p>", "Royal Hospital") &&
    !pageConsumesRequiredVerifiedLocalEvidence("<p>Barrhead Foundry and Barrhead War Memorial.</p>", barrheadFacts),
);

check(
  "selected evidence is visible patient-facing copy",
  barrheadHtml.includes("<p>") &&
    !barrheadHtml.includes("hidden") &&
    pageConsumesRequiredVerifiedLocalEvidence(barrheadHtml, barrheadFacts) &&
    !pageConsumesRequiredVerifiedLocalEvidence(
      `<p>The library is nearby.</p><span hidden>${esc(ampersandName)}</span>`,
      barrheadFacts,
    ) &&
    !pageConsumesRequiredVerifiedLocalEvidence(
      `<p>The library is nearby.</p><!-- ${ampersandName} -->`,
      barrheadFacts,
    ) &&
    !pageConsumesRequiredVerifiedLocalEvidence(
      `<p>The library is nearby.</p><script>const name = ${JSON.stringify(ampersandName)};</script>`,
      barrheadFacts,
    ),
);

const contractSrc = readFileSync(contractPath, "utf8");
const renderSrc = readFileSync(renderPath, "utf8");
const generationSrc = readFileSync(generationPath, "utf8");
const selectorBody = contractSrc.slice(
  contractSrc.indexOf("export function pageConsumesRequiredVerifiedLocalEvidence"),
);
check(
  "generator and validator use the same canonical selector",
  renderSrc.includes("selectVerifiedLocalEvidenceForPatientCopy") &&
    renderSrc.includes("verifiedLocalEvidencePatientCopySentence") &&
    generationSrc.includes("pageConsumesRequiredVerifiedLocalEvidence") &&
    selectorBody.includes("selectVerifiedLocalEvidenceForPatientCopy") &&
    !generationSrc.includes('entity.category === "healthcare" || entity.category === "transport"') &&
    !renderSrc.includes("if (out.length >= 3) break"),
);

const north = selectVerifiedLocalEvidenceForPatientCopy([
  { name: "North Medical Practice", category: "healthcare" },
  { name: "North Park", category: "landmarks" },
]);
const south = selectVerifiedLocalEvidenceForPatientCopy([
  { name: "South Station", category: "transport" },
  { name: "South Park", category: "landmarks" },
]);
check(
  "tenant evidence selections stay isolated",
  north.required[0]?.name === "North Medical Practice" &&
    south.required[0]?.name === "South Station" &&
    !north.selected.some((fact) => fact.name.includes("South")) &&
    !south.selected.some((fact) => fact.name.includes("North")),
);

const productionSrc = [contractSrc, renderSrc, generationSrc].join("\n");
check(
  "production logic has no tenant or locality special case",
  !productionSrc.includes("gilbert-pharmacy") &&
    !/Barrhead|Paisley|Elderslie|Renfrew|Linwood|Glasgow/.test(productionSrc) &&
    !contractSrc.includes("writeFile") &&
    !contractSrc.includes("node:fs"),
);

const campaign = JSON.parse(readFileSync(campaignPath, "utf8"));
const selectedAreas = (campaign.campaigns || [])
  .find((item: { id?: string }) => item.id === "9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f")
  ?.campaignAreas?.filter((area: { selected?: boolean }) => area.selected)
  .map((area: { areaName?: string }) => area.areaName);
check(
  "six Gilbert locality selections remain unchanged",
  JSON.stringify(selectedAreas) === JSON.stringify(["Paisley", "Barrhead", "Elderslie", "Renfrew", "Linwood", "Glasgow"]) &&
    fileHash(campaignPath) === expectedHashes[campaignPath],
);

const review = JSON.parse(readFileSync(reviewPath, "utf8"));
check(
  "approved service page remains unchanged",
  review.decision === "approved" &&
    review.serviceId === "blood-pressure-checks" &&
    review.generationRevision === "d7229262217951b2" &&
    fileHash(reviewPath) === expectedHashes[reviewPath] &&
    fileHash(servicePagePath) === expectedHashes[servicePagePath],
);

check(
  "no locality output was generated",
  JSON.stringify(localityBefore) === JSON.stringify(["packs/review-trust.json"]) &&
    JSON.stringify(listFiles(localityDir)) === JSON.stringify(localityBefore),
);

const jobsAfter = JSON.parse(readFileSync(jobsPath, "utf8"));
const failedJob = (jobsAfter.jobs || []).find((job: { id?: string }) => job.id === "697f0bf4-5708-48a0-80eb-72f4617d529b");
check(
  "no generation job was created and the failed job stays failed",
  jobsBefore.jobs.length === jobsAfter.jobs.length &&
    failedJob?.status === "failed" &&
    failedJob?.action === "generate_local_cluster_pages" &&
    fileHash(jobsPath) === expectedHashes[jobsPath],
);

const history = JSON.parse(readFileSync(historyPath, "utf8"));
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const intelligence = JSON.parse(readFileSync(intelligencePath, "utf8"));
check(
  "approvals and workflow were not advanced",
  history.currentStage === "generate_ecosystem" &&
    evidence.decision === "approved" &&
    Boolean(intelligence.commercialIntelligenceApproval?.approvedAt) &&
    fileHash(historyPath) === expectedHashes[historyPath] &&
    fileHash(evidencePath) === expectedHashes[evidencePath] &&
    fileHash(intelligencePath) === expectedHashes[intelligencePath] &&
    fileHash(generationLatestPath) === expectedHashes[generationLatestPath],
);

const hashesAfter = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check(
  "regression did not change protected Gilbert files",
  protectedFiles.every((path) => hashesBefore[path] === expectedHashes[path]) &&
    hashesAfter === protectedFiles.map((path) => `${expectedHashes[path]}  ${path}`).join("\n") + "\n",
);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
