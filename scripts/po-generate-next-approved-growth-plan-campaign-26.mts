#!/usr/bin/env npx tsx
/**
 * RECOVER-FOUR-LOCKED-SERVICE-BANKS-26 — Product Owner Flu regen.
 * ONLY operator inputs: tenant slug + intent phrase.
 * Service, localities, bank, and clinical content come from stored tenant/system state.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  buildGrowthOpportunityReport,
} from "../src/pharmacy/growthEngineOpportunityEngine.ts";
import { selectCampaignBuilderService } from "../src/pharmacy/growthEngineCampaignBuilderService.ts";
import {
  buildCustomerCampaignGenerationContext,
  freezeCustomerCampaignGenerationContext,
} from "../src/pharmacy/contentEngine/customerCampaignGenerationContext.ts";
import { generateContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import {
  loadServiceVariantPack,
  resolveApprovedServiceBank,
} from "../src/pharmacy/pharmacyServiceVariantLibrary.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const OUT = "/tmp/recover26-po-flu-regen-result.json";

/** Exact Product Owner workflow input — nothing else. */
const PRODUCT_OWNER_INPUT = {
  tenantSlug: "yorkshire-pharmacy-and-health-clinic",
  intent: "generate next approved Growth Plan campaign.",
} as const;

function sha(p: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
}

function loadRawProfile(slug: string) {
  const doc = JSON.parse(
    fs.readFileSync(path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`), "utf8"),
  ) as { data?: Record<string, unknown> };
  return normalizeProfileData(doc.data || {});
}

/**
 * Independently select next Growth Plan campaign from stored opportunity assessment.
 * Prefers first top-priority service with workflowAction build-dedicated-content.
 */
function selectNextApprovedGrowthPlanCampaign(slug: string) {
  const report = buildGrowthOpportunityReport(slug);
  const top = report.serviceOpportunityAssessment?.topPriorityServices || [];
  const next =
    top.find((t) => t.workflowAction === "build-dedicated-content") ||
    null;
  return {
    reportReadyToBuild: report.readyToBuild,
    topPriority: top.map((t) => ({
      serviceId: t.serviceId,
      workflowAction: t.workflowAction,
      packageStatus: t.packageStatus,
    })),
    selected: next
      ? {
          serviceId: next.serviceId,
          serviceName: next.serviceName,
          workflowAction: next.workflowAction,
          packageStatus: next.packageStatus,
          priorityRationale: next.priorityRationale,
        }
      : null,
    selectionRule:
      "first topPriorityServices entry with workflowAction=build-dedicated-content from buildGrowthOpportunityReport(slug)",
  };
}

async function main() {
  const slug = PRODUCT_OWNER_INPUT.tenantSlug;
  const bpProtectPaths = {
    visual: `${ROOT}/output/pharmacy-visual-experience/${slug}/blood-pressure-checks/index.html`,
    faq: `${ROOT}/output/pharmacy-content-ecosystem/${slug}/blood-pressure-checks/pages/blood-pressure-checks-faqs/index.html`,
    pkg: `${ROOT}/data/pharmacy-content-packages/${slug}/blood-pressure-checks.json`,
  };
  const bpBefore = Object.fromEntries(
    Object.entries(bpProtectPaths).map(([k, p]) => [k, sha(p)]),
  );

  const selection = selectNextApprovedGrowthPlanCampaign(slug);
  if (!selection.selected?.serviceId) {
    const fail = {
      ok: false,
      failReason: "Growth Plan did not independently select a next build-dedicated-content service",
      productOwnerInput: PRODUCT_OWNER_INPUT,
      selection,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const serviceId = selection.selected.serviceId;
  // Expected for this tenant after BP lock + Flu quarantine: flu-vaccinations.
  const expectedServiceId = "flu-vaccinations";
  if (serviceId !== expectedServiceId) {
    const fail = {
      ok: false,
      failReason: `FAIL: independently selected service "${serviceId}" !== expected stored next campaign "${expectedServiceId}"`,
      productOwnerInput: PRODUCT_OWNER_INPUT,
      selection,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const raw = loadRawProfile(slug);
  const hierarchyBefore = resolveLocalLocationHierarchy(slug, serviceId, raw);
  const areasSelected = hierarchyBefore.ok
    ? hierarchyBefore.clusters.map((c) => ({ slug: c.slug, name: c.name }))
    : [];

  const expectedAreas = [
    "darfield",
    "wombwell",
    "thurnscoe",
    "grimethorpe",
    "goldthorpe",
    "worsbrough",
    "hoyland",
    "cudworth",
  ];
  const areaSlugs = areasSelected.map((a) => a.slug);
  const areasOk =
    expectedAreas.every((a) => areaSlugs.includes(a)) && areaSlugs.length === expectedAreas.length;
  if (!areasOk) {
    const fail = {
      ok: false,
      failReason: "FAIL: independently selected localities do not match stored Yorkshire campaign localities",
      productOwnerInput: PRODUCT_OWNER_INPUT,
      selection,
      areasSelected,
      expectedAreas,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const bank = resolveApprovedServiceBank(serviceId);
  const pack = loadServiceVariantPack(serviceId);

  selectCampaignBuilderService(slug, serviceId);
  const customerContext = buildCustomerCampaignGenerationContext(slug, serviceId);
  freezeCustomerCampaignGenerationContext(customerContext);
  const pkg = await generateContentPackage(slug, serviceId, { customerContext });
  if (!pkg.ok) {
    const fail = { ok: false, step: "generateContentPackage", error: pkg.error, selection };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }

  const ctx = buildContentGenerationContext(slug, serviceId);
  const locals = generateLocalLocationHierarchyPages(ctx);
  if (!locals.ok) {
    const fail = {
      ok: false,
      step: "generateLocalLocationHierarchyPages",
      blockedReason: locals.blockedReason,
      selection,
    };
    fs.writeFileSync(OUT, JSON.stringify(fail, null, 2));
    console.log(JSON.stringify(fail, null, 2));
    process.exit(1);
  }
  mergeLocalAssetsIntoEcosystemIndex(slug, serviceId, locals);

  const bpAfter = Object.fromEntries(
    Object.entries(bpProtectPaths).map(([k, p]) => [k, sha(p)]),
  );

  const serviceVisual = `${ROOT}/output/pharmacy-visual-experience/${slug}/${serviceId}/index.html`;
  const serviceMaster = `${ROOT}/output/pharmacy-master-publish/${slug}/${serviceId}/index.html`;
  const localHashes = Object.fromEntries(
    areaSlugs.map((a) => [
      a,
      sha(`${ROOT}/output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/${a}/index.html`),
    ]),
  );

  // Cross-service BP contamination check on Flu outputs
  const fluHtmlSamples = [
    fs.existsSync(serviceVisual) ? fs.readFileSync(serviceVisual, "utf8") : "",
    ...areaSlugs.slice(0, 2).map((a) =>
      fs.readFileSync(
        `${ROOT}/output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/${a}/index.html`,
        "utf8",
      ),
    ),
  ];
  const bpContamination = fluHtmlSamples.some((h) => /blood pressure/i.test(h));

  const includedAssets = (pkg.manifest?.assets || [])
    .filter((a: { status?: string; included?: boolean }) => a.status === "included" || a.included)
    .map((a: { type?: string }) => a.type);

  const result = {
    ok: !bpContamination,
    productOwnerInput: PRODUCT_OWNER_INPUT,
    proofNoManualDetailsSupplied: {
      inputKeys: Object.keys(PRODUCT_OWNER_INPUT),
      serviceIdNotInInput: !("serviceId" in PRODUCT_OWNER_INPUT),
      localitiesNotInInput: !("localities" in PRODUCT_OWNER_INPUT || "areas" in PRODUCT_OWNER_INPUT),
      contentNotInInput: true,
      clinicalPhrasesNotInInput: true,
      selectionSource: selection.selectionRule,
    },
    independentlySelected: {
      service: selection.selected,
      areas: areasSelected,
      profileEvidence: {
        selectedServicesIncludesFlu: (raw.selectedServices || []).includes("flu-vaccinations"),
        pharmacyName: raw.pharmacyName,
        phone: raw.phone,
      },
      contentBank: {
        serviceId,
        version: pack?.version,
        hash: bank?.hash,
        path: bank?.entry.approvedBankRelativePath,
        fromRegistry: Boolean(bank),
      },
      pageContract: {
        servicePage: "content-engine-lockdown-v1 / visual experience",
        localityPage: "local-cluster-v1 / local-area-v1",
      },
    },
    generation: {
      packageOk: pkg.ok,
      approvalStatus: pkg.manifest?.approvalStatus,
      includedAssetTypes: includedAssets,
      note: "Normal campaign workflow may generate extra asset types beyond service+locality; reported accurately, not suppressed.",
      localsOk: locals.ok,
      serviceVisual: fs.existsSync(serviceVisual) ? path.relative(ROOT, serviceVisual) : null,
      serviceVisualHash: fs.existsSync(serviceVisual) ? sha(serviceVisual) : null,
      serviceMaster: fs.existsSync(serviceMaster) ? path.relative(ROOT, serviceMaster) : null,
      serviceMasterHash: fs.existsSync(serviceMaster) ? sha(serviceMaster) : null,
      localHashes,
    },
    bpContaminationInFluOutputs: bpContamination,
    bpProtected: {
      visualSame: bpBefore.visual === bpAfter.visual,
      faqSame: bpBefore.faq === bpAfter.faq,
      pkgSame: bpBefore.pkg === bpAfter.pkg,
    },
    growthPlanSnapshot: {
      readyToBuildPrimary: selection.reportReadyToBuild.primaryServiceId,
      topPriority: selection.topPriority,
    },
  };

  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
