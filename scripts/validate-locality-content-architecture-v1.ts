/**
 * Locality pages must synthesise verified local evidence into patient copy.
 * Name swaps, evidence-name lists, and thin service templates fail.
 * Does not regenerate, approve, publish, or write tenant files.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { loadLocalEvidencePackForGeneration } from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import {
  assessLocalityEvidenceSufficiency,
  buildLocalityIntelligenceV1,
  type LocalityIntelligenceV1,
} from "../src/pharmacy/contentEngine/pharmacyLocalityIntelligenceV1.ts";
import {
  localPatientCopyBody,
  synthesiseLocalPatientCopyV1,
  type LocalPatientCopyServiceIntelligenceV1,
} from "../src/pharmacy/contentEngine/pharmacyLocalPatientCopyV1.ts";
import {
  evaluateLocalityHtmlContentContract,
  evaluateLocalPatientCopyContract,
  isTokenOnlyDifferentiation,
  localityPagesAreTokenOnlyCopies,
} from "../src/pharmacy/contentEngine/pharmacyLocalityContentContractGateV1.ts";
import { composeApprovedBankLocalityDirectDraft } from "../src/pharmacy/pharmacyApprovedBankLocalityDirectRender.ts";
import { buildCprClusterReviewDashboard } from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const slug = "gilbert-pharmacy-health-clinic";
const serviceId = "blood-pressure-checks";
const campaignId = "9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f";
const areas = [
  ["Paisley", "paisley"],
  ["Barrhead", "barrhead"],
  ["Elderslie", "elderslie"],
  ["Renfrew", "renfrew"],
  ["Linwood", "linwood"],
  ["Glasgow", "glasgow"],
] as const;
const protectedFiles = [
  ...areas.map(([, area]) => `output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/${area}/index.html`),
  "output/pharmacy-visual-experience/gilbert-pharmacy-health-clinic/blood-pressure-checks/index.html",
  "data/pharmacy-master-admin/jobs.json",
  "data/pharmacy-master-admin/service-page-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const direct = readFileSync(resolve("src/pharmacy/pharmacyApprovedBankLocalityDirectRender.ts"), "utf8");
const generator = readFileSync(resolve("src/pharmacy/pharmacyLocalLocationGenerationService.ts"), "utf8");
const intelligenceSrc = readFileSync(resolve("src/pharmacy/contentEngine/pharmacyLocalityIntelligenceV1.ts"), "utf8");
const copySrc = readFileSync(resolve("src/pharmacy/contentEngine/pharmacyLocalPatientCopyV1.ts"), "utf8");

check("approved-bank path no longer builds slot narratives", !direct.includes("buildUniqueLocalityNarrative(") && !direct.includes("verifiedLocalEvidencePatientCopySentence("));
check("generation blocks thin approved-bank locality HTML", generator.includes("evaluateLocalityHtmlContentContract(") && generator.includes("localityPagesAreTokenOnlyCopies("));
check("production contract has no tenant or locality names", !/gilbert-pharmacy|Paisley|Barrhead|Glasgow/.test(`${intelligenceSrc}\n${copySrc}\n${direct}`));

const service: LocalPatientCopyServiceIntelligenceV1 = {
  serviceName: "Blood Pressure Checks",
  serviceExplanation: "A pharmacy blood pressure check measures a reading and explains it in plain language.",
  pharmacyName: "Example Pharmacy",
  pharmacyAddress: "1 High Street, Example Town EX1 1AA",
  pharmacyPhone: "0141 000 0000",
};

function intel(partial: Partial<LocalityIntelligenceV1> & Pick<LocalityIntelligenceV1, "areaName" | "areaSlug">): LocalityIntelligenceV1 {
  return {
    contractId: "locality-intelligence-v1",
    tenantSlug: "example-pharmacy",
    geographic: {
      distanceLabel: "",
      distanceProvenance: "",
      cardinalDirection: "",
      directionProvenance: "",
      pharmacyAddress: service.pharmacyAddress,
      pharmacyAddressProvenance: "profile:pharmacy-address",
    },
    healthcare: [],
    access: [],
    community: [],
    landmarks: [],
    schools: [],
    retail: [],
    ...partial,
  };
}

const renamed = "Blood Pressure Checks for patients from Northville. A pharmacy blood pressure check measures a reading.";
const renamedGate = evaluateLocalityHtmlContentContract({
  html: `<section data-template-block="hero"><h1>Blood Pressure Checks for patients from Northville</h1><p>${renamed}</p></section><section data-template-block="local-relevance"><p>${renamed}</p></section>`,
  areaName: "Northville",
  serviceName: "Blood Pressure Checks",
  pharmacyName: "Example Pharmacy",
  requiredAddresses: ["12 Station Road, Northville NO1 1AA"],
  entityNames: ["Northville Surgery"],
});
check("service template plus a locality name fails", !renamedGate.ok);

const h1Only = evaluateLocalityHtmlContentContract({
  html: `<section data-template-block="hero"><h1>Blood Pressure Checks for patients from Northville</h1><p>Blood Pressure Checks</p></section>`,
  areaName: "Northville",
  serviceName: "Blood Pressure Checks",
  pharmacyName: "Example Pharmacy",
});
check("changed H1 only fails", !h1Only.ok && h1Only.failures.includes("introduction-is-name-substitution"));

const listOnly = evaluateLocalityHtmlContentContract({
  html: `<section data-template-block="hero"><p>Useful stored local context for this journey includes Northville Surgery and Northville Library.</p></section><p class="local-intro-lead">Useful stored local context for this journey includes Northville Surgery and Northville Library.</p>`,
  areaName: "Northville",
  serviceName: "Blood Pressure Checks",
  pharmacyName: "Example Pharmacy",
  entityNames: ["Northville Surgery", "Northville Library"],
  requiredAddresses: ["12 Station Road, Northville NO1 1AA"],
});
check("evidence-name insertion alone fails", !listOnly.ok && listOnly.failures.includes("evidence-name-list"));

const tokenA = "Patients from Northville can visit Example Pharmacy. Useful context is Northville Surgery.";
const tokenB = "Patients from Southville can visit Example Pharmacy. Useful context is Southville Surgery.";
check(
  "same paragraphs with locality and entity names swapped are token-only",
  isTokenOnlyDifferentiation(tokenA, tokenB, {
    areaNames: ["Northville", "Southville"],
    entityNames: ["Northville Surgery", "Southville Surgery"],
  }),
);

const hidden = evaluateLocalityHtmlContentContract({
  html: `<section data-template-block="hero"><p>Blood Pressure Checks for patients from Northville.</p></section><div hidden><p>Patients in Northville can use Blood Pressure Checks at Example Pharmacy, not at Northville Surgery at 12 Station Road, Northville NO1 1AA.</p></div>`,
  areaName: "Northville",
  serviceName: "Blood Pressure Checks",
  pharmacyName: "Example Pharmacy",
  requiredAddresses: ["12 Station Road, Northville NO1 1AA"],
});
check("hidden local content fails", !hidden.ok);

const empty = synthesiseLocalPatientCopyV1(intel({ areaName: "Northville", areaSlug: "northville" }), service);
check("insufficient evidence blocks generation", !empty.ok && empty.sufficiency === "insufficient");

const sparse = synthesiseLocalPatientCopyV1(
  intel({
    areaName: "Northville",
    areaSlug: "northville",
    landmarks: [{
      name: "Northville Monument",
      category: "landmarks",
      address: "3 Monument Lane, Northville NO2 2BB",
      provenance: "googlePlaces:place-1",
      relationship: "name-in-address",
    }],
  }),
  service,
);
check(
  "sparse evidence stays limited and does not invent healthcare",
  sparse.ok && sparse.copy.sufficiency === "limited" && !/\bGP\b|health centre|medical practice/i.test(localPatientCopyBody(sparse.ok ? sparse.copy : { introduction: "", serviceContext: "", accessContext: "", healthcareCommunityContext: "", whyUseful: "", nextStep: "", contractId: "local-patient-copy-v1", sufficiency: "limited", consumedFactNames: [] })),
);

const north = synthesiseLocalPatientCopyV1(
  intel({
    areaName: "Northville",
    areaSlug: "northville",
    geographic: {
      distanceLabel: "2.2 km",
      distanceProvenance: "profile.selectedAreas:straight-line",
      cardinalDirection: "north",
      directionProvenance: "profile.selectedAreas:bearing",
      pharmacyAddress: service.pharmacyAddress,
      pharmacyAddressProvenance: "profile:pharmacy-address",
    },
    healthcare: [{
      name: "Northville Surgery",
      category: "healthcare",
      address: "12 Station Road, Northville NO1 1AA",
      provenance: "googlePlaces:place-2",
      relationship: "name-in-address",
    }],
  }),
  service,
);
const south = synthesiseLocalPatientCopyV1(
  intel({
    areaName: "Southville",
    areaSlug: "southville",
    healthcare: [{
      name: "Southville Health Centre",
      category: "healthcare",
      address: "8 Harbour Street, Southville SO3 3CC",
      provenance: "googlePlaces:place-3",
      relationship: "name-in-address",
    }],
    community: [{
      name: "Southville Library",
      category: "community",
      address: "1 Market Square, Southville SO3 3DD",
      provenance: "googlePlaces:place-4",
      relationship: "name-in-address",
    }],
  }),
  service,
);
check("evidence-grounded introduction passes", north.ok && evaluateLocalPatientCopyContract({
  copy: north.copy,
  areaName: "Northville",
  serviceName: service.serviceName,
  pharmacyName: service.pharmacyName,
  requiredAddresses: ["12 Station Road, Northville NO1 1AA"],
}).ok);
check(
  "materially different locality bodies pass",
  north.ok && south.ok && localityPagesAreTokenOnlyCopies([
    { areaName: "Northville", localBody: localPatientCopyBody(north.copy), entityNames: north.copy.consumedFactNames },
    { areaName: "Southville", localBody: localPatientCopyBody(south.copy), entityNames: south.copy.consumedFactNames },
  ]).length === 0,
);
const parked = north.ok
  ? evaluateLocalPatientCopyContract({
      copy: { ...north.copy, accessContext: `${north.copy.accessContext} Free parking is available.` },
      areaName: "Northville",
      serviceName: service.serviceName,
      pharmacyName: service.pharmacyName,
    })
  : { ok: true, failures: [] };
check("unsupported parking claim fails", !parked.ok && parked.failures.some((failure) => failure.includes("invented-parking")));

const otherTenant = buildLocalityIntelligenceV1({
  areaName: "Northville",
  areaSlug: "northville",
  tenantSlug: "example-pharmacy",
  pack: {
    version: "v3",
    slug: "other-pharmacy",
    area: "Northville",
    areaSlug: "northville",
    provider: "googlePlaces",
    generatedAt: "2026-01-01T00:00:00.000Z",
    sourceStatus: "google-places-live",
    pharmacyCoordinates: null,
    healthcare: [{
      name: "Other Surgery",
      address: "9 Other Street, Northville NO9 9ZZ",
      category: "healthcare",
      types: [],
      location: null,
      placeId: "other",
      source: "googlePlaces",
      provider: "googlePlaces",
      retrievedAt: "2026-01-01T00:00:00.000Z",
      sourceRef: "other",
      confidence: 1,
      relationship: "name-in-address",
      areaName: "Northville",
    }],
    community: [],
    landmarks: [],
    transport: [],
    schools: [],
    retail: [],
    rejected: [],
    researchCandidates: [],
    evidenceLimited: false,
    qualitySummary: { attributableCount: 1, rejectedCount: 0, categoriesPresent: ["healthcare"], minimumMet: true },
  } as never,
});
check("another tenant's pack is not used", assessLocalityEvidenceSufficiency(otherTenant).classification === "insufficient");

const ctx = buildContentGenerationContext(slug, serviceId);
const preflight: string[] = [];
for (const [areaName, areaSlug] of areas) {
  const loaded = loadLocalEvidencePackForGeneration(slug, areaName, areaSlug);
  const built = buildLocalityIntelligenceV1({
    areaName,
    areaSlug,
    tenantSlug: slug,
    pack: loaded.ok ? loaded.pack : null,
    geographic: {
      pharmacyAddress: ctx.profile.fullAddress || "",
      pharmacyAddressProvenance: ctx.profile.fullAddress ? "profile:pharmacy-address" : "",
    },
  });
  const verdict = assessLocalityEvidenceSufficiency(built);
  const composed = composeApprovedBankLocalityDirectDraft({
    slug,
    serviceId,
    serviceName: ctx.serviceName,
    areaName,
    areaSlug,
    nearbyAreaNames: [],
    areaSlugsInCluster: [],
  }, ctx);
  const body = `${composed.heroIntro}\n${composed.localRelevanceBody}\n${composed.accessBody}\n${composed.ctaPhonePrompt}`;
  const leadAddress = built.healthcare[0]?.address || built.community[0]?.address || built.landmarks[0]?.address || "";
  check(
    `${areaName} inputs can satisfy the locality contract`,
    verdict.classification !== "insufficient" &&
      body.includes("not at") &&
      !/useful stored local context/i.test(body) &&
      (!leadAddress || body.includes(leadAddress)) &&
      (verdict.classification !== "limited" || !/\bhealth centre\b|\bmedical practice\b/i.test(body)),
    `${verdict.classification}; healthcare ${built.healthcare.length}; transport ${built.access.length}; community ${built.community.length}; landmarks ${built.landmarks.length}`,
  );
  preflight.push(`${areaName}=${verdict.classification}`);
}
check("six locality inputs were evaluated", preflight.length === 6, preflight.join(", "));

for (const [areaName, areaSlug] of areas) {
  const html = readFileSync(resolve(`output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/${areaSlug}/index.html`), "utf8");
  const loaded = loadLocalEvidencePackForGeneration(slug, areaName, areaSlug);
  const built = buildLocalityIntelligenceV1({
    areaName,
    areaSlug,
    tenantSlug: slug,
    pack: loaded.ok ? loaded.pack : null,
  });
  const address = built.healthcare[0]?.address || built.community[0]?.address || built.landmarks[0]?.address || "";
  const current = evaluateLocalityHtmlContentContract({
    html,
    areaName,
    serviceName: ctx.serviceName,
    pharmacyName: ctx.profile.pharmacyName,
    requiredAddresses: address ? [address] : [],
    entityNames: [...built.healthcare, ...built.access, ...built.community, ...built.landmarks].map((fact) => fact.name),
  });
  check(`${areaName} current page fails V1`, !current.ok, current.failures.slice(0, 4).join("; "));
}

const review = buildCprClusterReviewDashboard(slug, { campaignId, serviceId });
check("locality approvals remain zero", review?.approvedLocalityCount === 0);
check("service page approval remains", JSON.parse(readFileSync(protectedFiles[8], "utf8")).decision === "approved");
check("workflow stage was not advanced", JSON.parse(readFileSync(protectedFiles[9], "utf8")).currentStage === "generate_ecosystem");
const jobs = JSON.parse(readFileSync(protectedFiles[7], "utf8"));
const success = (jobs.jobs || []).find((job: { id?: string }) => job.id === "3eeeb55a-3fac-4cbb-8249-61220f9d5490");
check("successful generation job was not replaced", success?.status === "completed");
const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("preflight did not change pages, jobs, or the service page", before === after);

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
