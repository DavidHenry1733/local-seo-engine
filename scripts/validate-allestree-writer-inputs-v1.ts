#!/usr/bin/env npx tsx
/**
 * Allestree writer-input defects: canonical identity, official GPs only,
 * council facts from the saved body, labelled straight-line distance.
 * Reprocesses stored evidence only. Does not generate copy or make paid calls.
 */
import fs from "node:fs";
import path from "node:path";

import { buildPharmacyAiLocalCopyInputV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { buildAiLocalNarrativeUserPromptV3 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import {
  extractEditorialFactDrafts,
  hostFromUrl,
  officialGpPracticeNamesFromFacts,
  officialGpPracticeNamesFromRetrievedPages,
} from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";
import { loadEditorialEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { loadPharmacyLocalEvidencePack } from "../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1 } from "../src/pharmacy/contentEngine/pharmacyAiLocalNarrativePromptContractV1.ts";
import { premisesAddressLooksUnverified } from "../src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts";
import {
  reprocessLocalPageEvidenceRun,
  type LocalPageEvidenceRun,
} from "../src/pharmacy/growthEngineLocalPageEvidenceCollectionService.ts";
import { preflightOneLocalPageCandidate } from "../src/pharmacy/growthEngineLocalPageCandidateService.ts";
import { loadPharmacyProfile } from "../src/pharmacy/pharmacyContentBlueprintService.ts";
import {
  confirmedTenantIdentityCandidates,
  isInvalidPharmacyIdentityValue,
  resolvePublicationPharmacyIdentity,
} from "../src/pharmacy/pharmacyServicePagePublicationQuality.ts";
import { isRequestedTenantIdentity } from "../src/pharmacy/pharmacyTenantIdentityIsolation.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = "brook-pharmacy-demo-derby";
const SERVICE = "pharmacy-first";
const AREA = "allestree";
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const APP = "https://app.pharmaconnect.uk";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function main() {
  console.log("\n=== Allestree writer inputs (no generation, no paid calls) ===\n");

  record(
    "cms-placeholder-names-are-invalid",
    isInvalidPharmacyIdentityValue("My WordPress Blo") &&
      isInvalidPharmacyIdentityValue("My WordPress Blog") &&
      isInvalidPharmacyIdentityValue("Hello world!") &&
      isInvalidPharmacyIdentityValue("My Blog") &&
      !isInvalidPharmacyIdentityValue("Green Cross Pharmacy"),
    "WordPress/CMS titles rejected; a real pharmacy name is not",
  );

  const syntheticIdentity = resolvePublicationPharmacyIdentity({
    pharmacyName: "My WordPress Blo",
    tradingName: "My WordPress Blo",
    websiteImportSnapshot: {
      intelligence: {
        structure: {
          pages: [{ category: "homepage", path: "/", h1: "Homepage Only Pharmacy" }],
        },
        business: { businessName: { selected: "Hello world!", candidates: [] } },
      },
    },
    websiteBranchResolution: {
      parentBrand: { tradingName: "Green Cross Pharmacy" },
    },
  } as Parameters<typeof resolvePublicationPharmacyIdentity>[0]);
  record(
    "canonical-name-prefers-confirmed-tenant-identity-not-h1",
    syntheticIdentity.pharmacyName === "Green Cross Pharmacy",
    `resolved=${syntheticIdentity.pharmacyName}`,
  );

  const loaded = loadPharmacyProfile(SLUG);
  const liveData = loaded?.data || null;
  const liveIdentity = liveData ? resolvePublicationPharmacyIdentity(liveData) : { pharmacyName: "", phone: "" };
  const confirmedName = String(liveData?.websiteBranchResolution?.parentBrand?.tradingName || "");
  const homepageH1 = String(
    (liveData?.websiteImportSnapshot as { intelligence?: { structure?: { pages?: Array<{ category?: string; h1?: string }> } } } | null)
      ?.intelligence?.structure?.pages?.find((page) => page.category === "homepage")?.h1 || "",
  );
  record(
    "live-profile-uses-confirmed-tenant-identity",
    Boolean(liveIdentity.pharmacyName) &&
      !isInvalidPharmacyIdentityValue(liveIdentity.pharmacyName) &&
      liveIdentity.pharmacyName !== "My WordPress Blo" &&
      liveIdentity.pharmacyName === confirmedName &&
      liveIdentity.pharmacyName !== homepageH1,
    `resolved=${liveIdentity.pharmacyName} confirmed=${confirmedName} homepageH1=${homepageH1}`,
  );
  record(
    "live-phone-is-plausible-uk-from-snapshot",
    /^0\d{4} \d{6}$/.test(liveIdentity.phone) && liveIdentity.phone !== "059) 0 0 60",
    `phone=${liveIdentity.phone}`,
  );

  const runFile = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-local-page-evidence-runs",
    SLUG,
    SERVICE,
    "v1",
    "allestree.json",
  );
  const liveRun = readJson<LocalPageEvidenceRun>(runFile);
  record(
    "saved-run-preserved-before-reprocess",
    liveRun.runId === "c7a7c587-22f0-474a-a59a-745a5bbe34a3" &&
      liveRun.spentUsd === 0.068 &&
      liveRun.paidCallsMade === 4,
    `runId=${liveRun.runId} spent=${liveRun.spentUsd} paid=${liveRun.paidCallsMade}`,
  );

  const council = liveRun.pagesByCall["page-body-locality"];
  const councilDrafts = extractEditorialFactDrafts({
    areaName: "Allestree",
    title: council?.title || "",
    text: council?.textSample || "",
    sourceClass: "primary",
    publisher: "derby.gov.uk",
    host: hostFromUrl(council?.url || "https://www.derby.gov.uk/"),
  });
  record(
    "council-body-keeps-ward-identity",
    councilDrafts.some((row) => /Allestree is a neighbourhood ward in Derby/i.test(row.normalizedStatement)),
    councilDrafts.filter((row) => row.category === "area-identity").map((row) => row.normalizedStatement).join(" | "),
  );
  record(
    "council-body-adds-supported-descriptive-facts",
    councilDrafts.some((row) => /Neighbourhood Board of local councillors/i.test(row.normalizedStatement)) &&
      councilDrafts.some((row) => /Allestree Park is named/i.test(row.normalizedStatement)) &&
      councilDrafts.some((row) => /Allestree Carnival is listed/i.test(row.normalizedStatement)) &&
      !councilDrafts.some((row) => /Rachael Clark|anti-social|10,000/i.test(row.normalizedStatement)),
    councilDrafts.filter((row) => row.category === "community").map((row) => row.normalizedStatement).join(" | "),
  );

  const officialFromPages = officialGpPracticeNamesFromRetrievedPages({
    areaName: "Allestree",
    pages: Object.values(liveRun.pagesByCall || {}),
  });
  record(
    "official-gp-names-from-saved-nhs-body",
    officialFromPages.length === 1 && officialFromPages[0] === "Park Lane Surgery",
    officialFromPages.join(" | ") || "none",
  );

  const parkFarmStillInPlaces = (liveRun.placesHitsByCall["places-gp-practices"] || []).some(
    (hit) => hit.name === "Park Farm Medical Centre",
  );
  record("places-hits-still-include-park-farm", parkFarmStillInPlaces, "saved Places hits preserved");

  const reprocessed = reprocessLocalPageEvidenceRun({ slug: SLUG, serviceId: SERVICE, areaSlug: AREA });
  record(
    "live-reprocess-ok-no-new-spend",
    reprocessed.ok === true &&
      reprocessed.ok &&
      reprocessed.run.runId === liveRun.runId &&
      reprocessed.run.spentUsd === 0.068 &&
      reprocessed.run.paidCallsMade === 4 &&
      reprocessed.paidCallsMade === 4,
    reprocessed.ok
      ? `runId=${reprocessed.run.runId} spent=${reprocessed.run.spentUsd} paid=${reprocessed.run.paidCallsMade} gps=${reprocessed.run.verifiedGpPracticeCount}`
      : reprocessed.error,
  );
  if (!reprocessed.ok) {
    process.exitCode = 1;
    return;
  }
  record(
    "verified-gp-count-is-official-only",
    reprocessed.run.verifiedGpPracticeCount === 1,
    `verifiedGpPracticeCount=${reprocessed.run.verifiedGpPracticeCount}`,
  );

  const pack = loadPharmacyLocalEvidencePack(SLUG, AREA);
  const healthcareNames = (pack?.healthcare || []).map((row) => row.name);
  const researchNames = (pack?.researchCandidates || []).map((row) => row.name);
  record(
    "pack-healthcare-is-park-lane-only",
    healthcareNames.length === 1 && healthcareNames[0] === "Park Lane Surgery",
    healthcareNames.join(" | "),
  );
  record(
    "pack-park-farm-listings-are-research-candidates",
    researchNames.includes("Park Farm Medical Centre") &&
      researchNames.includes("Park Farm Surgery") &&
      (pack?.researchCandidates || []).every((row) => row.rejectionReason === "no-retrieved-official-source"),
    researchNames.join(" | "),
  );

  const editorial = loadEditorialEvidencePack(SLUG, SERVICE, AREA);
  record("editorial-sufficiency-ready", editorial?.sufficiency.status === "READY", editorial?.sufficiency.status || "missing");
  const gpFacts = (editorial?.facts || []).filter((fact) => fact.category === "healthcare");
  record(
    "editorial-gp-fact-is-park-lane-with-nhs-url",
    gpFacts.length === 1 &&
      /Park Lane Surgery/.test(gpFacts[0]?.normalizedStatement || "") &&
      /nhs\.uk\/services\/gp-surgery\/park-lane-surgery/i.test(gpFacts[0]?.sourceUrl || ""),
    `${gpFacts[0]?.normalizedStatement || "none"} | ${gpFacts[0]?.sourceUrl || ""}`,
  );
  record(
    "distance-fact-is-approximate-straight-line-with-reference",
    (editorial?.facts || []).some(
      (fact) =>
        fact.category === "pharmacy-relationship" &&
        /approximately 4\.1 km in a straight line from Allestree/i.test(fact.normalizedStatement) &&
        /recorded area reference 52\.95295, -1\.49257/i.test(fact.normalizedStatement) &&
        /places-area-reference/i.test(fact.normalizedStatement) &&
        !/My WordPress Blo/i.test(fact.normalizedStatement) &&
        !/DA5 4NR/i.test(fact.normalizedStatement),
    ),
    (editorial?.facts || [])
      .filter((fact) => fact.category === "pharmacy-relationship")
      .map((fact) => fact.normalizedStatement)
      .join(" | "),
  );
  record(
    "display-address-remains-unverified",
    premisesAddressLooksUnverified(String(liveData?.displayAddress || "")),
    String(liveData?.displayAddress || ""),
  );

  if (!editorial) {
    process.exitCode = 1;
    return;
  }
  const input = buildPharmacyAiLocalCopyInputV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Allestree",
    areaSlug: AREA,
    editorial,
  });
  const prompt = JSON.parse(buildAiLocalNarrativeUserPromptV3(input)) as {
    business: { name: string; address: string; addressVerified: boolean };
    locality: {
      distanceLabel: string;
      distanceKm: number | null;
      distanceMeasurement: string;
      areaReferencePoint: { latitude: number; longitude: number; source: string } | null;
      pharmacyCoordinates: { latitude: number; longitude: number; source?: string } | null;
    };
    verifiedEditorialFacts: Array<{ statement: string }>;
    offer: {
      lockedClinicalFacts?: typeof PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1;
      allowedClinicalSentenceInAiFields?: string;
      clinicalContentOwner?: string;
    };
  };

  record(
    "writer-identity-is-canonical-not-wordpress",
    input.business.name === confirmedName &&
      input.business.name !== "My WordPress Blo" &&
      input.business.name !== homepageH1 &&
      premisesAddressLooksUnverified(input.business.address) &&
      prompt.business.addressVerified === false,
    `name=${input.business.name} addressVerified=${prompt.business.addressVerified} phone=${input.business.telephone}`,
  );
  record(
    "writer-accepted-entities-exclude-park-farm",
    input.locality.acceptedEntities.some((entity) => entity.name === "Park Lane Surgery") &&
      !input.locality.acceptedEntities.some((entity) => /Park Farm/i.test(entity.name)),
    input.locality.acceptedEntities.map((entity) => entity.name).join(" | ") || "none",
  );
  record(
    "writer-gp-sources-are-official-only",
    officialGpPracticeNamesFromFacts(editorial.facts).join(",") === "Park Lane Surgery",
    officialGpPracticeNamesFromFacts(editorial.facts).join(" | "),
  );
  record(
    "writer-distance-label-and-reference",
    input.locality.distanceLabel === "approximately 4.1 km straight-line" &&
      input.distanceBasis?.method === "approximate-straight-line" &&
      input.distanceBasis.areaReferencePoint?.source === "places-area-reference" &&
      Number(input.distanceBasis.areaReferencePoint?.latitude.toFixed(5)) === 52.95295 &&
      input.distanceBasis.pharmacyCoordinates?.source === "profile:coordinates" &&
      /straight-line/.test(prompt.locality.distanceMeasurement),
    `label=${input.locality.distanceLabel} ref=${JSON.stringify(input.distanceBasis?.areaReferencePoint)} coords=${JSON.stringify(input.distanceBasis?.pharmacyCoordinates)}`,
  );
  record(
    "approved-clinical-reference-unchanged",
    JSON.stringify(input.offer.lockedClinicalFacts) === JSON.stringify(PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1) &&
      prompt.offer.clinicalContentOwner === "renderer" &&
      prompt.offer.allowedClinicalSentenceInAiFields === "Pharmacy First can help with eligible common conditions." &&
      prompt.offer.lockedClinicalFacts == null,
    input.offer.lockedClinicalFacts.conditionSet,
  );

  const contractSrc = fs.readFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/contentEngineContract.ts"),
    "utf8",
  );
  const engineSrc = fs.readFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts"),
    "utf8",
  );
  record(
    "no-tenant-specific-bleed-slug-bypass",
    !contractSrc.includes('startsWith("brook-pharmacy-")') &&
      !contractSrc.includes("brook-pharmacy-demo-derby") &&
      contractSrc.includes("isRequestedTenantIdentity"),
    "bleed check uses confirmed-identity isolation, not a Derby slug allowlist",
  );
  record(
    "engine-v3-uses-existing-evidence-readers-not-collection-import",
    !engineSrc.includes("growthEngineLocalPageEvidenceCollectionService") &&
      engineSrc.includes("planUkLocalPageStraightLineDistance") &&
      engineSrc.includes("resolveAreaCentroidFromRecordedReference"),
    "V3 distance uses recorded area reference + straight-line plan",
  );
  const yorkshireProfile = loadPharmacyProfile(YORKSHIRE)?.data;
  const yorkshireConfirmed = yorkshireProfile ? confirmedTenantIdentityCandidates(yorkshireProfile) : [];
  const derbyOwnsBrook = confirmedTenantIdentityCandidates(liveData || {}).some((name) =>
    isRequestedTenantIdentity("Brook Pharmacy", name),
  );
  const yorkshireOwnsBrook = yorkshireConfirmed.some((name) => isRequestedTenantIdentity("Brook Pharmacy", name));
  record(
    "yorkshire-confirmed-identity-does-not-own-brook",
    derbyOwnsBrook && !yorkshireOwnsBrook,
    `derbyOwns=${derbyOwnsBrook} yorkshireOwns=${yorkshireOwnsBrook} yorkshireConfirmed=${yorkshireConfirmed.slice(0, 3).join(" | ")}`,
  );

  const wombwellEditorial = loadEditorialEvidencePack(YORKSHIRE, SERVICE, "wombwell");
  if (wombwellEditorial) {
    const wombwellInput = buildPharmacyAiLocalCopyInputV3({
      slug: YORKSHIRE,
      serviceId: SERVICE,
      areaName: "Wombwell",
      areaSlug: "wombwell",
      editorial: wombwellEditorial,
    });
    const wombwellBlob = JSON.stringify(wombwellInput);
    record(
      "yorkshire-writer-payload-isolated-from-allestree",
      /Yorkshire Pharmacy/i.test(wombwellInput.business.name) &&
        !/Brook Pharmacy/i.test(wombwellInput.business.name) &&
        !/My WordPress Blo/i.test(wombwellBlob) &&
        !/Allestree/i.test(wombwellBlob) &&
        !/Park Lane Surgery/i.test(wombwellBlob) &&
        !/DA5 4NR/i.test(wombwellBlob),
      `name=${wombwellInput.business.name} facts=${wombwellInput.editorialFacts.length} entities=${wombwellInput.locality.acceptedEntities.map((e) => e.name).join(" | ")}`,
    );
  } else {
    record("yorkshire-writer-payload-isolated-from-allestree", false, "missing Wombwell editorial pack");
  }

  const preflight = preflightOneLocalPageCandidate(SLUG, SERVICE, "Allestree");
  const generateUrl = `${APP}/api/growth-engine/campaign-builder?slug=${encodeURIComponent(SLUG)}&step=areas&campaign=${encodeURIComponent(SERVICE)}`;
  record(
    "generate-available-not-clicked",
    preflight.canGenerate === true &&
      preflight.generationAllowance.remainingCalls === 0 &&
      preflight.generationAllowance.additionalAttemptsAuthorised === 1 &&
      preflight.generationAllowance.canAuthoriseAdditionalAttempt === false,
    `${generateUrl} | remaining=${preflight.generationAllowance.remainingCalls} additionalAuthorised=${preflight.generationAllowance.additionalAttemptsAuthorised} canAuthoriseAdditional=${preflight.generationAllowance.canAuthoriseAdditionalAttempt} (this script does not click Generate)`,
  );

  console.log("\n--- Writer payload ---");
  console.log(
    JSON.stringify(
      {
        pharmacyIdentity: {
          name: input.business.name,
          telephone: input.business.telephone,
          address: input.business.address,
          addressVerified: prompt.business.addressVerified,
          coordinates: input.business.coordinates,
          coordinateSource: input.distanceBasis?.pharmacyCoordinates?.source || null,
        },
        localFacts: input.editorialFacts.map((fact) => ({
          category: fact.category,
          statement: fact.normalizedStatement,
          role: fact.permittedCopyRole,
          publisher: fact.publisher,
        })),
        gpSources: gpFacts.map((fact) => ({
          statement: fact.normalizedStatement,
          sourceUrl: fact.sourceUrl,
          publisher: fact.publisher,
        })),
        acceptedEntities: input.locality.acceptedEntities,
        researchCandidates: pack?.researchCandidates || [],
        distanceBasis: input.distanceBasis,
        distanceLabel: input.locality.distanceLabel,
        approvedClinicalReference: input.offer.lockedClinicalFacts,
      },
      null,
      2,
    ),
  );

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
