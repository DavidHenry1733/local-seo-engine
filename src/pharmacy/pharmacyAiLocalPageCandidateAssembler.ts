/**
 * Isolated AI local-page candidate assembler.
 * Reads validated AI copy records and renders local-cluster-v1 / patient-journey-led HTML.
 * Preview must never call this function. This function must never call generateAiLocalCopyForArea.
 */
import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import {
  AI_CANDIDATE_PREVIEW_BANNER,
  aiLocalPageCandidateHtmlPath,
  getAiLocalPageCandidateRoot,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { aiLocalCopyOverlay } from "./contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import { loadAiLocalCopyRecord } from "./contentEngine/pharmacyAiLocalNarrativeEngineV1.ts";
import {
  attributableEntities,
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
  type LocalEvidenceEntity,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
  setSessionAiLocalCopy,
} from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";
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

export const PHARMACY_AI_LOCAL_PAGE_CANDIDATE_ASSEMBLER = "assemblePharmacyAiLocalPageCandidates";

export type AiLocalPageCandidateResult = {
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
    copyRecordPath: string;
  }>;
  skipped: Array<{ areaSlug: string; detail: string }>;
};

function wrapAiCandidatePreviewHtml(html: string): string {
  let out = String(html || "");
  if (!/name="robots"\s+content="noindex,\s*nofollow"/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>\n<meta name="robots" content="noindex, nofollow"/>`);
  }
  if (out.includes(AI_CANDIDATE_PREVIEW_BANNER)) return out;
  const style = `<style data-candidate-preview="ai-local-area-page">.candidate-preview-toolbar{position:sticky;top:0;z-index:10000;background:#fef3c7;border-bottom:1px solid #f59e0b;color:#92400e;font:800 13px/1.4 Inter,system-ui,sans-serif;text-align:center;padding:10px 16px}</style>`;
  const banner = `<div class="candidate-preview-toolbar" data-component="candidate-preview-banner" data-candidate="ai-local-area-page">${AI_CANDIDATE_PREVIEW_BANNER}</div>`;
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

/**
 * Render isolated AI candidates from already-validated copy records.
 * Never calls OpenAI. Never writes live local pages or Prompt 91/92 candidate directories.
 */
export function assemblePharmacyAiLocalPageCandidates(
  slug: string,
  serviceId = "pharmacy-first",
  areaSlugs?: string[],
): AiLocalPageCandidateResult {
  const resolvedSlug = resolveTenantProfileSlug(slug) || slug;
  const liveRoot = path.join("output/pharmacy-content-ecosystem", resolvedSlug, serviceId);
  const plan = planPharmacyLocalEvidenceRequest(resolvedSlug, serviceId);
  const selected = areaSlugs?.length
    ? plan.areas.filter((area) => areaSlugs.includes(area.areaSlug))
    : plan.areas;
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
  hierarchy = {
    ...hierarchy,
    clusters: hierarchy.clusters.filter((cluster) =>
      selected.some((area) => area.areaSlug === resolveClusterPageSlug(cluster.slug)),
    ),
  };
  const clusterSlugs = hierarchy.clusters.map((cluster) => resolveClusterPageSlug(cluster.slug));
  beginLocalityVariationSessionV1(clusterSlugs);

  const pharmacyName = ctx.profile.pharmacyName;
  const files: string[] = [];
  const areas: AiLocalPageCandidateResult["areas"] = [];
  const skipped: AiLocalPageCandidateResult["skipped"] = [];
  try {
    for (const cluster of hierarchy.clusters) {
      const pageSlug = resolveClusterPageSlug(cluster.slug);
      const record = loadAiLocalCopyRecord(resolvedSlug, serviceId, pageSlug);
      if (!record || !record.validationResult?.ok || record.approved !== false) {
        skipped.push({ areaSlug: pageSlug, detail: record ? "copy-record-not-candidate" : "missing-copy-record" });
        continue;
      }
      if (record.reviewStatus !== "candidate") {
        skipped.push({ areaSlug: pageSlug, detail: "copy-record-not-candidate" });
        continue;
      }
      setSessionAiLocalCopy(pageSlug, aiLocalCopyOverlay(record.outputCopy));
      const pack = loadPharmacyLocalEvidencePack(resolvedSlug, pageSlug) as { healthcare?: LocalEvidenceEntity[] } | null;
      const evidenceNames = pack ? attributableEntities(pack as never).map((e: LocalEvidenceEntity) => e.name) : [];
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
        generationRevision: "ai-local-narrative-v1",
      });
      const claimed = scrubUnconfirmedServiceClaims(polished, {
        fundingModel: delivery?.fundingModel ?? "unknown",
        walkInAvailable: delivery?.walkInAvailable ?? null,
        appointmentRequired: delivery?.appointmentRequired ?? null,
        abpmConfirmed: false,
        gphcConfirmed: Boolean(ctx.profile.gphcNumber?.trim()),
        serviceId,
      });
      if (claimed.includes(liveRoot) || /output\/pharmacy-content-ecosystem/i.test(claimed)) {
        skipped.push({ areaSlug: pageSlug, detail: "candidate HTML referenced the live local-page output path" });
        continue;
      }
      const html = wrapAiCandidatePreviewHtml(claimed);
      const outputPath = aiLocalPageCandidateHtmlPath(resolvedSlug, serviceId, pageSlug);
      if (
        outputPath.includes("/pharmacy-content-ecosystem/") ||
        outputPath.includes("/pharmacy-local-page-candidates/")
      ) {
        skipped.push({ areaSlug: pageSlug, detail: "refusing to write into live or Prompt 91/92 candidate directories" });
        continue;
      }
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, html, "utf8");
      files.push(outputPath);
      areas.push({
        areaName: cluster.name,
        areaSlug: pageSlug,
        outputPath,
        evidenceNames,
        copyRecordPath: path.join(
          "data/pharmacy-ai-local-copy-candidates",
          resolvedSlug,
          serviceId,
          `${pageSlug}.json`,
        ),
      });
    }
  } finally {
    endLocalityVariationSessionV1();
  }

  return {
    ok: files.length > 0,
    slug: resolvedSlug,
    serviceId,
    files,
    areas,
    skipped,
  };
}

export function aiCandidateRootMustStayIsolated(slug: string, serviceId: string): string {
  return getAiLocalPageCandidateRoot(slug, serviceId);
}
