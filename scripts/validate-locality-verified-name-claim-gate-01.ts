/**
 * Glasgow locality failure: a verified place name containing "Walk-In"
 * must not be treated as an unsupported walk-in claim.
 * Renders the six selected localities in memory. Does not write pages or jobs.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import {
  attributableEntities,
  loadLocalEvidencePackForGeneration,
  preflightPharmacyLocalEvidenceForCampaign,
} from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { attachLocalityPageJsonLd } from "../src/pharmacy/contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts";
import {
  evaluateLocalityPatientCopyQualityGate,
  evaluateLocalitySourceCopyQualityGate,
  localityIntroductionsAreDistinct,
} from "../src/pharmacy/contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts";
import { pageConsumesRequiredVerifiedLocalEvidence } from "../src/pharmacy/contentEngine/pharmacyVerifiedLocalEvidenceConsumptionContract.ts";
import { rewriteClusterLinksInHtml, resolveClusterPageSlug } from "../src/pharmacy/pharmacyClusterPageUrlResolver.ts";
import { renderLocalLocationClusterFullPage } from "../src/pharmacy/pharmacyLocalHierarchyFullPageRenderer.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { evaluateLocalityHtmlDuplicationGate } from "../src/pharmacy/pharmacyLocalityPageDuplicationGateV1.ts";
import {
  assessLocalityEvidenceSufficiency,
  buildLocalityIntelligenceV1,
} from "../src/pharmacy/contentEngine/pharmacyLocalityIntelligenceV1.ts";
import {
  evaluateLocalityHtmlContentContract,
  extractVisibleLocalNextStep,
  extractVisibleLocalPatientSections,
  localityPagesAreTokenOnlyCopies,
} from "../src/pharmacy/contentEngine/pharmacyLocalityContentContractGateV1.ts";
import { usesApprovedBankLocalityDirectPath } from "../src/pharmacy/pharmacyApprovedBankLocalityDirectRender.ts";
import { usesPharmacyFirstPatientJourneyLocalTemplate } from "../src/pharmacy/pharmacyLocalPageTypeContracts.ts";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const campaignPath = "data/pharmacy-campaigns/gilbert-pharmacy-health-clinic.json";
const reviewPath =
  "data/pharmacy-master-admin/service-page-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json";
const servicePagePath = "output/pharmacy-visual-experience/gilbert-pharmacy-health-clinic/blood-pressure-checks/index.html";
const jobsPath = "data/pharmacy-master-admin/jobs.json";
const historyPath = "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json";
const evidencePath =
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json";
const intelligencePath = "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json";
const localityDir = "output/pharmacy-content-ecosystem/gilbert-pharmacy-health-clinic/blood-pressure-checks";
const expectedAreas = ["Paisley", "Barrhead", "Elderslie", "Renfrew", "Linwood", "Glasgow"];

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

const protectedFiles = [campaignPath, reviewPath, servicePagePath, jobsPath, historyPath, evidencePath, intelligencePath];
const hashesBefore = Object.fromEntries(protectedFiles.map((path) => [path, fileHash(path)]));
const localityBefore = listFiles(localityDir);
const jobsBefore = JSON.parse(readFileSync(jobsPath, "utf8"));

const clinicName = "GP Walk-In Clinic";
const glasgowHtml = `<main><p>Useful stored local context for this journey includes ${clinicName}, Stewart Memorial Fountain and Lord Roberts Monument.</p></main>`;
const withoutNames = evaluateLocalityPatientCopyQualityGate({
  html: glasgowHtml,
  areaName: "Glasgow",
  pharmacyName: "Gilbert Pharmacy & Health Clinic",
  distanceLabel: "9.7 km",
});
const withName = evaluateLocalityPatientCopyQualityGate({
  html: glasgowHtml,
  areaName: "Glasgow",
  pharmacyName: "Gilbert Pharmacy & Health Clinic",
  distanceLabel: "9.7 km",
  verifiedEvidenceNames: [clinicName, "Stewart Memorial Fountain", "Lord Roberts Monument"],
});
const withClaim = evaluateLocalityPatientCopyQualityGate({
  html: `<main><p>Useful stored local context for this journey includes ${clinicName}. Walk-ins are welcome.</p></main>`,
  areaName: "Glasgow",
  pharmacyName: "Gilbert Pharmacy & Health Clinic",
  verifiedEvidenceNames: [clinicName],
});
const bookingClaim = evaluateLocalityPatientCopyQualityGate({
  html: `<main><p>Patients can book an appointment and visit ${clinicName}.</p></main>`,
  areaName: "Glasgow",
  pharmacyName: "Gilbert Pharmacy & Health Clinic",
  verifiedEvidenceNames: [clinicName],
});

check(
  "verified Walk-In place name reproduces the failed claim without the evidence exception",
  withoutNames.failures.includes("unsupported-claim:walk-in-assumption"),
  withoutNames.failures.join("; "),
);
check(
  "verified Walk-In place name passes when declared as evidence",
  withName.ok,
  withName.failures.join("; "),
);
check(
  "a real walk-in claim still fails beside a verified Walk-In place name",
  withClaim.failures.includes("unsupported-claim:walk-in-assumption"),
  withClaim.failures.join("; "),
);
check(
  "booking language still fails beside a verified place name",
  bookingClaim.failures.includes("unsupported-claim:book-an-appointment"),
  bookingClaim.failures.join("; "),
);

const slug = "gilbert-pharmacy-health-clinic";
const serviceId = "blood-pressure-checks";
const preflight = preflightPharmacyLocalEvidenceForCampaign(slug, serviceId);
check("evidence preflight is ready for the six areas", preflight.ok, preflight.ok ? preflight.readyAreas.join(", ") : preflight.customerError);

const ctx = buildContentGenerationContext(slug, serviceId);
const sourceGate = ctx.variantPack ? evaluateLocalitySourceCopyQualityGate(ctx.variantPack) : { ok: true, failures: [] };
check("locality source copy gate passes", sourceGate.ok, sourceGate.failures.slice(0, 6).join(" | "));

let hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, serviceId, ctx.rawProfile);
if (ctx.selectedAreas?.length) {
  const existingByName = new Map((hierarchy.clusters || []).map((cluster) => [cluster.name.trim().toLowerCase(), cluster]));
  const clusters = ctx.selectedAreas.map((area, idx) => {
    const existing = existingByName.get(area.areaName.trim().toLowerCase());
    if (existing) return { ...existing, order: idx + 1, priority: idx + 1 };
    return {
      areaId: `cluster:${area.areaSlug}`,
      name: area.areaName,
      slug: area.areaSlug,
      type: "district-cluster" as const,
      parentAreaId: hierarchy.hub?.areaId || null,
      source: "campaign-builder:targetAreaNames",
      evidence: ["Campaign Builder saved target area"],
      serviceIds: [serviceId],
      generationEligible: true,
      generationReason: "Campaign Builder selected target area",
      approved: true,
      order: idx + 1,
      priority: idx + 1,
    };
  });
  hierarchy = { ...hierarchy, ok: true, blockedReason: undefined, clusters, generationAreas: clusters };
}
const renderedNames = hierarchy.clusters.map((cluster) => cluster.name);
check("renderer receives the six selected localities", JSON.stringify(renderedNames) === JSON.stringify(expectedAreas), renderedNames.join(", "));

const clusterSlugs = hierarchy.clusters.map((cluster) => resolveClusterPageSlug(cluster.slug));
beginLocalityVariationSessionV1(clusterSlugs);
const pages: Array<{ areaSlug: string; areaName: string; html: string; failures: string[]; entityNames: string[] }> = [];
try {
  check(
    "blood-pressure locality render uses the approved-bank path",
    usesApprovedBankLocalityDirectPath(serviceId) && !usesPharmacyFirstPatientJourneyLocalTemplate(serviceId),
  );
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const siblingNames = hierarchy.clusters.filter((item) => item.slug !== cluster.slug).map((item) => item.name);
    const html = attachLocalityPageJsonLd(
      rewriteClusterLinksInHtml(
        renderLocalLocationClusterFullPage(ctx, hierarchy, { ...cluster, slug: pageSlug }),
        clusterSlugs,
      ),
      {
        areaName: cluster.name,
        pharmacyName: ctx.profile.pharmacyName,
        serviceName: ctx.serviceName,
        nearbyAreaNames: siblingNames,
      },
    );
    const packLoaded = loadLocalEvidencePackForGeneration(slug, cluster.name, pageSlug);
    const facts = packLoaded.ok
      ? attributableEntities(packLoaded.pack).map((entity) => ({ name: entity.name, category: entity.category }))
      : [];
    const gate = evaluateLocalityPatientCopyQualityGate({
      html,
      areaName: cluster.name,
      pharmacyName: ctx.profile.pharmacyName,
      distanceLabel: cluster.distanceLabel || "",
      verifiedEvidenceNames: facts.map((fact) => fact.name),
    });
    const failures = [...gate.failures];
    if (!packLoaded.ok) failures.push(`evidence-pack:${packLoaded.status}`);
    else if (!pageConsumesRequiredVerifiedLocalEvidence(html, facts)) {
      failures.push("verified local evidence was not consumed in the page body");
    }
    const built = buildLocalityIntelligenceV1({
      areaName: cluster.name,
      areaSlug: pageSlug,
      tenantSlug: slug,
      pack: packLoaded.ok ? packLoaded.pack : null,
    });
    const address = built.healthcare[0]?.address || built.community[0]?.address || built.landmarks[0]?.address || "";
    const contract = evaluateLocalityHtmlContentContract({
      html,
      areaName: cluster.name,
      serviceName: ctx.serviceName,
      pharmacyName: ctx.profile.pharmacyName,
      requiredAddresses: address ? [address] : [],
      entityNames: facts.map((fact) => fact.name),
    });
    if (!contract.ok) failures.push(...contract.failures.map((failure) => `locality-content-contract: ${failure}`));
    const visible = extractVisibleLocalPatientSections(html);
    const nextStep = extractVisibleLocalNextStep(html);
    if (!new RegExp(`patients in ${cluster.name} can use`, "i").test(visible)) failures.push("introduction-not-rendered");
    if (!/\bnot at\b/i.test(visible)) failures.push("service-context-not-rendered");
    if (!/does not describe roads|verified transport location/i.test(visible)) failures.push("access-context-not-rendered");
    if (!/verified healthcare location|verified community location|verified local place/i.test(visible)) failures.push("local-context-not-rendered");
    if (!/does not estimate how many people/i.test(visible)) failures.push("why-useful-not-rendered");
    if (!/\bcontact\b/i.test(nextStep) || !nextStep.toLowerCase().includes(cluster.name.toLowerCase())) failures.push("next-step-not-rendered");
    if (cluster.name === "Elderslie") {
      const sufficiency = assessLocalityEvidenceSufficiency(built);
      if (sufficiency.classification !== "limited") failures.push(`elderslie-sufficiency:${sufficiency.classification}`);
      if (/\bGP\b|health centre|medical practice|bus every|train every|parking/i.test(visible)) failures.push("elderslie-invented-fact");
    }
    pages.push({
      areaSlug: pageSlug,
      areaName: cluster.name,
      html,
      failures,
      entityNames: facts.map((fact) => fact.name),
    });
  }
} finally {
  endLocalityVariationSessionV1();
}

check(
  "six rendered localities pass patient-copy and evidence-consumption gates",
  pages.length === 6 && pages.every((page) => page.failures.length === 0),
  pages
    .filter((page) => page.failures.length)
    .map((page) => `${page.areaName}: ${page.failures.slice(0, 6).join("; ")}`)
    .join(" | "),
);
for (const areaName of expectedAreas) {
  const page = pages.find((item) => item.areaName === areaName);
  check(`${areaName} in-memory V1 render passes`, Boolean(page) && page!.failures.length === 0, page?.failures.slice(0, 6).join("; "));
}
const tokenOnly = localityPagesAreTokenOnlyCopies(
  pages.map((page) => ({
    areaName: page.areaName,
    localBody: extractVisibleLocalPatientSections(page.html),
    entityNames: page.entityNames,
  })),
);
check("six rendered locality bodies are not token-only copies", tokenOnly.length === 0, tokenOnly.join(" | "));

const introFailures: string[] = [];
for (let i = 0; i < pages.length; i++) {
  for (let j = i + 1; j < pages.length; j++) {
    const a = pages[i]!;
    const b = pages[j]!;
    if (!localityIntroductionsAreDistinct(a.html, b.html, a.areaName, b.areaName)) {
      introFailures.push(`${a.areaName}/${b.areaName}`);
    }
  }
}
check("locality introductions stay distinct", introFailures.length === 0, introFailures.join(", "));

const duplication = evaluateLocalityHtmlDuplicationGate({
  pages: pages.map((page) => ({ areaSlug: page.areaSlug, areaName: page.areaName, html: page.html })),
  pharmacyName: ctx.profile.pharmacyName,
});
check(
  "locality duplication gate passes",
  duplication.ok,
  duplication.pairs
    .filter((pair) => pair.blocked)
    .map((pair) => pair.reason)
    .slice(0, 2)
    .join(" "),
);

const generationSrc = readFileSync("src/pharmacy/pharmacyLocalLocationGenerationService.ts", "utf8");
check(
  "production gate receives verified evidence names from the pack",
  generationSrc.includes("verifiedEvidenceNames: evidenceFacts.map((fact) => fact.name)"),
);
check(
  "production logic has no Glasgow or Walk-In special case",
  !readFileSync("src/pharmacy/contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts", "utf8").includes("GP Walk-In") &&
    !generationSrc.includes("glasgow"),
);

const jobsAfter = JSON.parse(readFileSync(jobsPath, "utf8"));
const first = (jobsAfter.jobs || []).find((job: { id?: string }) => job.id === "697f0bf4-5708-48a0-80eb-72f4617d529b");
const second = (jobsAfter.jobs || []).find((job: { id?: string }) => job.id === "ee221113-ad02-4c1d-a56d-3d80df866024");
const history = JSON.parse(readFileSync(historyPath, "utf8"));
const review = JSON.parse(readFileSync(reviewPath, "utf8"));
const campaign = JSON.parse(readFileSync(campaignPath, "utf8"));
const selected = (campaign.campaigns || [])
  .find((item: { id?: string }) => item.id === "9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f")
  ?.campaignAreas?.filter((area: { selected?: boolean }) => area.selected)
  .map((area: { areaName?: string }) => area.areaName);
check(
  "historical failed jobs, approval, selections, and workflow stay unchanged",
  jobsBefore.jobs.length === jobsAfter.jobs.length &&
    first?.status === "failed" &&
    second?.status === "failed" &&
    second?.error === "Locality patient-copy quality gate failed: glasgow: unsupported-claim:walk-in-assumption" &&
    review.decision === "approved" &&
    history.currentStage === "generate_ecosystem" &&
    JSON.stringify(selected) === JSON.stringify(expectedAreas) &&
    JSON.stringify(listFiles(localityDir)) === JSON.stringify(localityBefore) &&
    ["paisley", "barrhead", "elderslie", "renfrew", "linwood", "glasgow"].every((area) =>
      localityBefore.includes(`local/${area}/index.html`),
    ),
);
const hashesAfter = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check(
  "in-memory preflight did not change protected Gilbert files",
  hashesAfter === protectedFiles.map((path) => `${hashesBefore[path]}  ${path}`).join("\n") + "\n",
);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
