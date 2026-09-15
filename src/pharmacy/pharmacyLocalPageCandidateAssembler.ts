/**
 * Isolated Pharmacy First local-page candidate assembler.
 * Path: bindVerifiedLocalityEvidenceV1 → composeCommercialClusterNarrativeV1
 * → buildPharmacyFirstLocalNarrative → renderLocalLocationClusterFullPage
 *
 * Writes only under output/pharmacy-local-page-candidates/.
 * Does not overwrite live local pages, mutate Review Centre, or call discovery.
 */
import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import {
  CANDIDATE_PREVIEW_BANNER,
  getLocalPageCandidateRoot,
  localPageCandidateHtmlPath,
} from "./contentEngine/pharmacyLocalPageCandidatePaths.ts";
import {
  attributableEntities,
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
  preflightPharmacyLocalEvidenceForCampaign,
  validatePharmacyLocalEvidencePack,
  type LocalEvidenceEntity,
  type PharmacyLocalEvidencePackV3,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import {
  assignLocalityVariationStrategiesV1,
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
  getLocalityVariationSessionV1,
  setSessionAiLocalCopy,
  setSessionRestoreStrategyVariants,
} from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";
import { resolveLocalityIntelligencePack } from "./contentEngine/pharmacyLocalityIntelligencePackV1.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import {
  resolveLocalLocationHierarchy,
  type LocalLocationHierarchy,
} from "./pharmacyLocalAreaResolver.ts";
import {
  resolveClusterPageSlug,
  rewriteClusterLinksInHtml,
} from "./pharmacyClusterPageUrlResolver.ts";
import { renderLocalLocationClusterFullPage } from "./pharmacyLocalHierarchyFullPageRenderer.ts";
import { scrubPublicLocalEngineHtml } from "./pharmacyLocalClusterCompositionDedupe.ts";
import { polishCommercialClusterPublicHtml } from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import { scrubUnconfirmedServiceClaims } from "./pharmacyServicePagePublicationQuality.ts";
import { bindCurrentRegisteredApprovedBank } from "./pharmacyApprovedBankRunProvenance.ts";
import { looksLikeRawEvidenceList, composeEvidenceLedLocalityPassagesV1 } from "./contentEngine/pharmacyEvidenceLedLocalNarrativeV1.ts";
import { scrubUnsafeLocalityPatientCopyHtml } from "./contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts";
import { bindVerifiedLocalityEvidenceV1 } from "./contentEngine/pharmacyVerifiedLocalityEvidenceV1.ts";
import { composeCommercialClusterNarrativeV1 } from "./pharmacyLocalClusterContentEngine.ts";
import { buildPharmacyFirstLocalNarrative } from "./pharmacyFirstLocalNarrative.ts";
import { writeLocalCandidateCopyInspection } from "./contentEngine/pharmacyLocalCandidateCopyInspectionV1.ts";
import { aiLocalCopyOverlay, hasCurrentGeminiLocalCopyFields } from "./contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import {
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { loadAiLocalCopyPilotV3 } from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";

export const PHARMACY_LOCAL_PAGE_CANDIDATE_ASSEMBLER = "assemblePharmacyFirstLocalPageCandidates";
export const CANDIDATE_ASSEMBLY_CHAIN = [
  bindVerifiedLocalityEvidenceV1.name,
  composeCommercialClusterNarrativeV1.name,
  buildPharmacyFirstLocalNarrative.name,
  renderLocalLocationClusterFullPage.name,
] as const;
export const CANDIDATE_GENERATION_REVISION = "natural-local-narrative-v1";

export type LocalPageCandidateResult = {
  ok: boolean;
  blockedReason?: string;
  slug: string;
  serviceId: string;
  files: string[];
  areas: Array<{
    areaName: string;
    areaSlug: string;
    outputPath: string;
    evidenceNames: string[];
  }>;
};

function wrapCandidatePreviewHtml(html: string): string {
  let out = String(html || "");
  if (!/name="robots"\s+content="noindex,\s*nofollow"/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="robots" content="noindex, nofollow"/>`);
  }
  if (out.includes(CANDIDATE_PREVIEW_BANNER)) return out;
  const style = `<style data-candidate-preview="local-area-page">.candidate-preview-toolbar{position:sticky;top:0;z-index:10000;background:#fef3c7;border-bottom:1px solid #f59e0b;color:#92400e;font:800 13px/1.4 Inter,system-ui,sans-serif;text-align:center;padding:10px 16px}</style>`;
  const banner = `<div class="candidate-preview-toolbar" data-component="candidate-preview-banner" data-candidate="local-area-page">${CANDIDATE_PREVIEW_BANNER}</div>`;
  return out.replace(/<body([^>]*)>/i, `<body$1>\n${style}\n${banner}`);
}

function campaignAreasForHierarchy(
  slug: string,
  serviceId: string,
  hierarchy: LocalLocationHierarchy,
): LocalLocationHierarchy {
  const plan = planPharmacyLocalEvidenceRequest(slug, serviceId);
  if (!plan.areas.length) return hierarchy;
  const existingByName = new Map(
    (hierarchy.clusters || []).map((cluster) => [cluster.name.trim().toLowerCase(), cluster]),
  );
  const clusters = plan.areas.map((area, idx) => {
    const existing = existingByName.get(area.areaName.trim().toLowerCase());
    if (existing) return { ...existing, slug: area.areaSlug, order: idx + 1, priority: idx + 1 };
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
  return {
    ...hierarchy,
    ok: true,
    blockedReason: undefined,
    clusters,
    generationAreas: clusters,
  };
}

function acceptedPack(
  slug: string,
  areaName: string,
  areaSlug: string,
): { ok: true; pack: PharmacyLocalEvidencePackV3; names: string[] } | { ok: false; detail: string } {
  const raw = loadPharmacyLocalEvidencePack(slug, areaSlug);
  const checked = validatePharmacyLocalEvidencePack(raw, { slug, areaName, areaSlug });
  if (!checked.ok) return { ok: false, detail: checked.detail };
  return { ok: true, pack: checked.pack, names: attributableEntities(checked.pack).map((e: LocalEvidenceEntity) => e.name) };
}

/**
 * Assemble isolated candidates. Never writes under output/pharmacy-content-ecosystem.
 * Preview must not call this function.
 */
export function assemblePharmacyFirstLocalPageCandidates(
  slug: string,
  serviceId = "pharmacy-first",
): LocalPageCandidateResult {
  const resolvedSlug = resolveTenantProfileSlug(slug) || slug;
  const liveRoot = path.join("output/pharmacy-content-ecosystem", resolvedSlug, serviceId);
  const preflight = preflightPharmacyLocalEvidenceForCampaign(resolvedSlug, serviceId);
  if (!preflight.ok) {
    return {
      ok: false,
      blockedReason: preflight.customerError,
      slug: resolvedSlug,
      serviceId,
      files: [],
      areas: [],
    };
  }

  const plan = planPharmacyLocalEvidenceRequest(resolvedSlug, serviceId);
  const ctx = bindCurrentRegisteredApprovedBank(
    buildContentGenerationContext(resolvedSlug, serviceId, {
      selectedAreasOverride: plan.areas.map((area, order) => ({
        areaName: area.areaName,
        areaSlug: area.areaSlug,
        selected: true,
        order: order + 1,
        priority: order + 1,
      })),
    }),
  );

  let hierarchy = campaignAreasForHierarchy(
    resolvedSlug,
    serviceId,
    resolveLocalLocationHierarchy(resolvedSlug, serviceId, ctx.rawProfile),
  );
  const clusterSlugs = hierarchy.clusters.map((cluster) => resolveClusterPageSlug(cluster.slug));
  const campaignAreas = hierarchy.clusters.map((cluster) => ({
    areaName: cluster.name,
    areaSlug: resolveClusterPageSlug(cluster.slug),
  }));
  beginLocalityVariationSessionV1(clusterSlugs);
  setSessionRestoreStrategyVariants(true);
  assignLocalityVariationStrategiesV1({
    areas: campaignAreas,
    pharmacyName: ctx.profile.pharmacyName,
    serviceName: ctx.serviceName,
    nearbyAreaNames: hierarchy.clusters.map((cluster) => cluster.name),
    pharmacyAddress: ctx.profile.fullAddress,
    packForArea: (area) => {
      const verified = bindVerifiedLocalityEvidenceV1({
        ctx,
        areaName: area.areaName,
        areaSlug: area.areaSlug,
        siblingLocalities: campaignAreas,
      });
      return resolveLocalityIntelligencePack({
        areaName: area.areaName,
        nearbyAreaNames: campaignAreas
          .filter((row) => row.areaSlug !== area.areaSlug)
          .map((row) => row.areaName),
        pharmacyAddress: ctx.profile.fullAddress,
        verified,
      });
    },
  });

  const pharmacyName = ctx.profile.pharmacyName;
  const files: string[] = [];
  const areas: LocalPageCandidateResult["areas"] = [];
  const inspectionAreas: Parameters<typeof writeLocalCandidateCopyInspection>[2] = [];
  try {
    for (const cluster of hierarchy.clusters) {
      const pageSlug = resolveClusterPageSlug(cluster.slug);
      const pack = acceptedPack(resolvedSlug, cluster.name, pageSlug);
      if (!pack.ok) {
        endLocalityVariationSessionV1();
        return {
          ok: false,
          blockedReason: `${pageSlug}: ${pack.detail}`,
          slug: resolvedSlug,
          serviceId,
          files,
          areas,
        };
      }
      const record = loadAiLocalCopyPilotV3(resolvedSlug, serviceId, pageSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3);
      const overlay =
        record?.validationResult?.ok && record.approved === false && record.reviewStatus === "candidate"
          ? aiLocalCopyOverlay(record.outputCopy)
          : null;
      if (overlay) {
        setSessionAiLocalCopy(pageSlug, overlay);
      }
      const siblingNames = hierarchy.clusters.filter((row) => row.slug !== cluster.slug).map((row) => row.name);
      const rendered = rewriteClusterLinksInHtml(
        renderLocalLocationClusterFullPage(ctx, hierarchy, { ...cluster, slug: pageSlug }),
        clusterSlugs,
      );
      const delivery = (
        ctx.rawProfile as {
          serviceDeliveryProfiles?: Record<
            string,
            { fundingModel?: string | null; walkInAvailable?: boolean | null; appointmentRequired?: boolean | null }
          >;
        }
      )?.serviceDeliveryProfiles?.[serviceId];
      const polished = polishCommercialClusterPublicHtml(scrubPublicLocalEngineHtml(rendered), {
        areaName: cluster.name,
        pharmacyName,
        serviceName: ctx.serviceName,
        nearbyAreaNames: siblingNames,
        generationRevision: CANDIDATE_GENERATION_REVISION,
        preserveAuthoredLocalCopy: hasCurrentGeminiLocalCopyFields(overlay),
      });
      const claimed = scrubUnconfirmedServiceClaims(polished, {
        fundingModel: delivery?.fundingModel ?? "unknown",
        walkInAvailable: delivery?.walkInAvailable ?? null,
        appointmentRequired: delivery?.appointmentRequired ?? null,
        abpmConfirmed: false,
        gphcConfirmed: Boolean(ctx.profile.gphcNumber?.trim()),
        serviceId,
      });
      const gated = scrubUnsafeLocalityPatientCopyHtml(claimed);
      if (gated.includes(liveRoot) || /output\/pharmacy-content-ecosystem/i.test(gated)) {
        endLocalityVariationSessionV1();
        return {
          ok: false,
          blockedReason: `${pageSlug}: candidate HTML referenced the live local-page output path`,
          slug: resolvedSlug,
          serviceId,
          files,
          areas,
        };
      }
      if (looksLikeRawEvidenceList(gated, pack.names)) {
        endLocalityVariationSessionV1();
        return {
          ok: false,
          blockedReason: `${pageSlug}: local evidence was emitted as a raw list`,
          slug: resolvedSlug,
          serviceId,
          files,
          areas,
        };
      }
      const html = wrapCandidatePreviewHtml(gated);
      const outputPath = localPageCandidateHtmlPath(resolvedSlug, serviceId, pageSlug);
      if (outputPath.includes("/pharmacy-content-ecosystem/")) {
        endLocalityVariationSessionV1();
        return {
          ok: false,
          blockedReason: "Refusing to write a candidate into the live local-page directory",
          slug: resolvedSlug,
          serviceId,
          files,
          areas,
        };
      }
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, html, "utf8");
      files.push(outputPath);
      areas.push({
        areaName: cluster.name,
        areaSlug: pageSlug,
        outputPath,
        evidenceNames: pack.names,
      });
      const session = getLocalityVariationSessionV1();
      const areaIndex = session?.areaIndexBySlug.get(pageSlug) ?? files.length - 1;
      const siblingLocalities = hierarchy.clusters.map((row) => ({
        areaName: row.name,
        areaSlug: resolveClusterPageSlug(row.slug),
      }));
      const verified = bindVerifiedLocalityEvidenceV1({
        ctx,
        areaName: cluster.name,
        areaSlug: pageSlug,
        siblingLocalities,
      });
      const passages = composeEvidenceLedLocalityPassagesV1({
        verified,
        pharmacyName,
        serviceName: ctx.serviceName,
        displayPhone: ctx.profile.displayPhone || ctx.profile.phone,
        address: String(ctx.profile.displayAddress || ctx.profile.customerFacingAddress || ctx.profile.fullAddress || "").trim(),
        areaIndex,
      });
      inspectionAreas.push({
        areaName: cluster.name,
        areaSlug: pageSlug,
        html,
        mentionedEntities: passages.mentionedEntities,
        omittedEntities: passages.omittedEntities,
      });
    }
  } finally {
    endLocalityVariationSessionV1();
  }

  writeLocalCandidateCopyInspection(resolvedSlug, serviceId, inspectionAreas);

  return {
    ok: files.length === plan.areas.length && files.length > 0,
    slug: resolvedSlug,
    serviceId,
    files,
    areas,
  };
}

export function candidateRootMustStayIsolated(slug: string, serviceId: string): string {
  return getLocalPageCandidateRoot(slug, serviceId);
}
