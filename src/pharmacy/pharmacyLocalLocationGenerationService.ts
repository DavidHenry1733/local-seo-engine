/**
 * RC1 local location generation — cluster pages only (one per approved area).
 */
import fs from "node:fs";
import path from "node:path";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { EcosystemAsset, GenerationStamp, LocalClusterLinkEntry } from "./benchmarkServiceEcosystemBuilder.ts";
import { getEcosystemRoot } from "./contentEngine/contentEnginePaths.ts";
import {
  hierarchyToContentGenerationAreas,
  resolveLocalLocationHierarchy,
  type LocalLocationHierarchy,
} from "./pharmacyLocalAreaResolver.ts";
import {
  resolveClusterPageSlug,
  resolveClusterPageUrlPath,
  resolveClusterPageFilesystemRelativePath,
  rewriteClusterLinksInHtml,
} from "./pharmacyClusterPageUrlResolver.ts";
import {
  renderLocalLocationClusterFullPage,
  renderLocalLocationHubFullPage,
} from "./pharmacyLocalHierarchyFullPageRenderer.ts";
import { scrubPublicLocalEngineHtml } from "./pharmacyLocalClusterCompositionDedupe.ts";
import { polishCommercialClusterPublicHtml, attachLocalityPageJsonLd } from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import { composeCommercialClusterNarrativeV1 } from "./pharmacyLocalClusterContentEngine.ts";
import { canonicalClusterNarrativeRequest } from "./pharmacyLocalHubClusterContentEngine.ts";
import { usesApprovedBankLocalityDirectPath } from "./pharmacyApprovedBankLocalityDirectRender.ts";
import {
  attributableEntities,
  loadLocalEvidencePackForGeneration,
  preflightPharmacyLocalEvidenceForCampaign,
} from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
import { pageConsumesRequiredVerifiedLocalEvidence } from "./contentEngine/pharmacyVerifiedLocalEvidenceConsumptionContract.ts";
import {
  evaluateLocalityHtmlContentContract,
  localityPagesAreTokenOnlyCopies,
} from "./contentEngine/pharmacyLocalityContentContractGateV1.ts";
import { replaceKeywordStuffedPharmacyListingNames, scrubUnconfirmedServiceClaims } from "./pharmacyServicePagePublicationQuality.ts";
import { usesPharmacyFirstPatientJourneyLocalTemplate } from "./pharmacyLocalPageTypeContracts.ts";
import {
  applyLockedPharmacyFirstLocalPageStructure,
} from "./pharmacyPharmacyFirstLocalPagePreviewOverlay.ts";
import {
  ensureProfessionalReviewPanelHtml,
  renderProfessionalReviewPanelHtml,
} from "./pharmacyProfessionalReviewPanel.ts";
import {
  beginLocalityVariationSessionV1,
  endLocalityVariationSessionV1,
} from "./contentEngine/pharmacyLocalityVariationSessionV1.ts";
import { evaluateLocalityHtmlDuplicationGate } from "./pharmacyLocalityPageDuplicationGateV1.ts";
import {
  evaluateLocalityPatientCopyQualityGate,
  evaluateLocalitySourceCopyQualityGate,
  localityIntroductionsAreDistinct,
  scrubUnsafeLocalityPatientCopyHtml,
} from "./contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts";
import {
  applyCampaignRunStampToHtml,
  createCampaignRunStamp,
  existingOutputsMustNotSkipFreshGeneration,
  isHistoricalOutputPath,
  type CampaignRunStamp,
} from "./pharmacyCurrentRunCampaignHandoff.ts";
import { bindCurrentRegisteredApprovedBank } from "./pharmacyApprovedBankRunProvenance.ts";

export interface LocalLocationGenerationResult {
  ok: boolean;
  blockedReason?: string;
  hierarchy: LocalLocationHierarchy;
  assets: EcosystemAsset[];
  localClusterEntries: LocalClusterLinkEntry[];
  hubPath?: string;
  clusterPaths: string[];
  areaPaths: string[];
  skippedExistingPaths?: string[];
  createdPaths?: string[];
  duplicationGate?: {
    ok: boolean;
    message: string;
  };
}

function countWords(html: string): number {
  return html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
}

/** Always apply the current-run stamp. Existing stamped HTML must not skip a fresh run. */
function stampLocalHtmlOutput(html: string, stamp: CampaignRunStamp): string {
  return applyCampaignRunStampToHtml(html, stamp);
}

export async function generateLocalLocationHierarchyPages(
  ctxInput: ContentGenerationContext,
  options?: {
    generationStamp?: GenerationStamp;
    skipExistingOutputs?: boolean;
    clusterPagesOnly?: boolean;
    onlyClusterSlugs?: string[];
  },
): LocalLocationGenerationResult {
  const ctx = bindCurrentRegisteredApprovedBank(ctxInput);
  const evidencePreflight = preflightPharmacyLocalEvidenceForCampaign(ctx.resolvedSlug, ctx.serviceId);
  if (!evidencePreflight.ok) {
    return {
      ok: false,
      blockedReason: evidencePreflight.customerError || "Local pages cannot be generated yet because verified area evidence is missing or insufficient.",
      hierarchy: {
        ok: false,
        blockedReason: evidencePreflight.customerError || undefined,
        primaryLocality: "",
        primaryLocalitySlug: "",
        hub: null,
        clusters: [],
        areas: [],
        generationAreas: [],
        trace: {
          profilePath: "",
          tenantSlug: ctx.resolvedSlug,
          primaryLocation: "",
          postcode: "",
          townCity: "",
          storedServiceAreas: [],
          storedNeighbourhoods: [],
        },
      } as LocalLocationHierarchy,
      assets: [],
      localClusterEntries: [],
      clusterPaths: [],
      areaPaths: [],
    };
  }

  let hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (ctx.selectedAreas?.length) {
    const existingByName = new Map(
      (hierarchy.clusters || []).map((cluster) => [cluster.name.trim().toLowerCase(), cluster]),
    );
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
        serviceIds: [ctx.serviceId],
        generationEligible: true,
        generationReason: "Campaign Builder selected target area",
        approved: true,
        order: idx + 1,
        priority: idx + 1,
      };
    });
    hierarchy = {
      ...hierarchy,
      ok: true,
      blockedReason: undefined,
      clusters,
      generationAreas: clusters,
    };
  }
  if (!hierarchy.ok) {
    return {
      ok: false,
      blockedReason: hierarchy.blockedReason,
      hierarchy,
      assets: [],
      localClusterEntries: [],
      clusterPaths: [],
      areaPaths: [],
    };
  }

  const allowedClusterSlugs = options?.onlyClusterSlugs?.length
    ? new Set(options.onlyClusterSlugs.map((slug) => slug.trim().toLowerCase()))
    : null;
  if (allowedClusterSlugs) {
    hierarchy = {
      ...hierarchy,
      clusters: hierarchy.clusters.filter((cluster) =>
        allowedClusterSlugs.has(resolveClusterPageSlug(cluster.slug).toLowerCase()),
      ),
    };
    if (!hierarchy.clusters.length) {
      return {
        ok: false,
        blockedReason: "No matching selected local-area pages to rerender.",
        hierarchy,
        assets: [],
        localClusterEntries: [],
        clusterPaths: [],
        areaPaths: [],
      };
    }
  }

  const sourcePack = ctx.variantPack;
  if (sourcePack) {
    const sourceGate = evaluateLocalitySourceCopyQualityGate(sourcePack);
    if (!sourceGate.ok) {
      return {
        ok: false,
        blockedReason: `Locality source copy quality gate failed: ${sourceGate.failures.slice(0, 8).join(" | ")}`,
        hierarchy,
        assets: [],
        localClusterEntries: [],
        clusterPaths: [],
        areaPaths: [],
      };
    }
  }

  const ecosystemRoot = ctx.links.ecosystemRoot;
  const generatedAt = options?.generationStamp?.generatedAt || new Date().toISOString();
  const generationStamp: CampaignRunStamp = options?.generationStamp?.runId
    ? {
        tenantSlug: options.generationStamp.tenantSlug,
        campaignId: options.generationStamp.campaignId,
        generatedAt: options.generationStamp.generatedAt,
        sourceContext: "customer-imported-profile",
        runId: options.generationStamp.runId,
        approvedBankHash:
          options.generationStamp.approvedBankHash || ctx.approvedBankHash || undefined,
      }
    : createCampaignRunStamp(
        ctx.resolvedSlug,
        ctx.serviceId,
        generatedAt,
        undefined,
        ctx.approvedBankHash,
      );

  const assets: EcosystemAsset[] = [];
  const localClusterEntries: LocalClusterLinkEntry[] = [];
  const clusterPaths: string[] = [];
  const areaPaths: string[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    if (options?.skipExistingOutputs && fs.existsSync(outPath) && !isHistoricalOutputPath(outPath)) {
      throw new Error(`Refusing to overwrite an existing local page for ${path.basename(path.dirname(outPath))}.`);
    }
    if (!options?.skipExistingOutputs) {
      existingOutputsMustNotSkipFreshGeneration(fs.existsSync(outPath) ? [outPath] : []);
    }
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, stampLocalHtmlOutput(html, generationStamp), "utf8");
    return outPath;
  };

  const clusterSlugs = hierarchy.clusters.map((c) => resolveClusterPageSlug(c.slug));
  const generationRevision = `cpr-content-hotfix-04-${generatedAt}`;
  const session = beginLocalityVariationSessionV1(clusterSlugs);
  const pharmacyName = ctx.profile.pharmacyName;

  const renderClusterHtml = (cluster: (typeof hierarchy.clusters)[number]): string => {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const siblingNames = hierarchy.clusters
      .filter((c) => c.slug !== cluster.slug)
      .map((c) => c.name);
    const rendered = rewriteClusterLinksInHtml(
      renderLocalLocationClusterFullPage(ctx, hierarchy, { ...cluster, slug: pageSlug }),
      clusterSlugs,
    );
    if (
      usesApprovedBankLocalityDirectPath(ctx.serviceId) &&
      !usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId)
    ) {
      return attachLocalityPageJsonLd(rendered, {
        areaName: cluster.name,
        pharmacyName,
        serviceName: ctx.serviceName,
        nearbyAreaNames: siblingNames,
      });
    }
    const delivery = (
      ctx.rawProfile as {
        serviceDeliveryProfiles?: Record<
          string,
          { fundingModel?: string | null; walkInAvailable?: boolean | null; appointmentRequired?: boolean | null }
        >;
      }
    )?.serviceDeliveryProfiles?.[ctx.serviceId];
    const polished = polishCommercialClusterPublicHtml(
      scrubPublicLocalEngineHtml(rendered),
      {
        areaName: cluster.name,
        pharmacyName,
        serviceName: ctx.serviceName,
        nearbyAreaNames: siblingNames,
        generationRevision,
      },
    );
    const claimed = scrubUnconfirmedServiceClaims(polished, {
      fundingModel: delivery?.fundingModel ?? "unknown",
      walkInAvailable: delivery?.walkInAvailable ?? null,
      appointmentRequired: delivery?.appointmentRequired ?? null,
      abpmConfirmed: false,
      gphcConfirmed: Boolean(ctx.profile.gphcNumber?.trim()),
      serviceId: ctx.serviceId,
    });
    if (usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId)) {
      let html = replaceKeywordStuffedPharmacyListingNames(claimed, ctx.rawProfile);
      html = applyLockedPharmacyFirstLocalPageStructure(html);
      html = ensureProfessionalReviewPanelHtml(html, renderProfessionalReviewPanelHtml(ctx.profile));
      html = scrubUnsafeLocalityPatientCopyHtml(html);
      return html;
    }
    return claimed
      .replace(/Welcome to\s+/gi, "")
      .replace(/\bProfessional Insight\b/gi, "Pharmacy guidance")
      .replace(/reduced unnecessary A&amp;E visits/gi, "timely pharmacy advice")
      .replace(/reduced unnecessary A&E visits/gi, "timely pharmacy advice")
      .replace(/\bservice experience\b/gi, "pharmacy support")
      .replace(/<span class="tag">pharmacy support<\/span>/gi, "")
      .replace(/>pharmacy support</gi, "><")
      .replace(/>Book or call about [^<]*</gi, ">Contact the pharmacy<")
      .replace(/>Book, call or get directions</gi, ">Contact the pharmacy<")
      .replace(/call ahead if you want parking or opening-hour guidance[^.]*\./gi, "Contact the pharmacy to ask how this service is arranged.")
      .replace(/Ask about parking, opening hours and consultation availability[^.]*\./gi, `Contact the pharmacy to ask how ${ctx.serviceName.toLowerCase()} are arranged.`)
      .replace(/call [^.]*before leaving [^.]*to confirm availability\./gi, `Contact the pharmacy to ask how ${ctx.serviceName.toLowerCase()} are arranged.`)
      .replace(/Private checks may incur a fee — confirm at booking\./gi, "Private checks may be available for a fee — ask what applies locally.")
      .replace(/confirm at booking\./gi, "ask what applies locally.")
      .replace(/\bavailable in ([A-Z][A-Za-z' -]+)\b/gi, "for patients travelling from $1")
      .replace(/\bOther approved ([A-Za-z][\w' -]{1,60}) locality pages?\b/gi, "Guidance for patients travelling from $1")
      .replace(/\blocal guides under service hub for [^.]+/gi, "")
      .replace(/\blocal guidance for patients around [A-Za-z][\w' -]{0,40}\.?/gi, "")
      .replace(/\bunder service hub for [A-Za-z][\w' -]{0,40}/gi, "")
      .replace(/\bservice hub for [A-Za-z][\w' -]{0,40}/gi, "")
      .replace(/Call (\d[\d\s]+) to check availability\./gi, `Call $1 to ask how ${ctx.serviceName.toLowerCase()} are arranged.`)
      .replace(/\bprofile\.(?:source|areaType|confidence|tier):[a-z0-9._:-]+/gi, "")
      .replace(/\bprofile\.[a-z0-9._:-]+/gi, "")
      .replace(/<li>Call to ask how [^<]*<\/li>/gi, "")
      .replace(/Call to ask how [^.]+\./gi, "")
      .replace(/\s{2,}/g, " ")
      .replace(/\.\s*\./g, ".");
  };

  const htmlBySlug = new Map<string, string>();
  const existingHtmlBySlug = new Map<string, string>();
  const skippedExistingPaths: string[] = [];
  const createdPaths: string[] = [];
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const rel = resolveClusterPageFilesystemRelativePath(pageSlug);
    const outPath = path.join(ecosystemRoot, rel);
    const exists = Boolean(outPath && fs.existsSync(outPath) && !isHistoricalOutputPath(outPath));
    if (options?.skipExistingOutputs && exists) {
      const existingHtml = fs.readFileSync(outPath, "utf8");
      existingHtmlBySlug.set(pageSlug, existingHtml);
      skippedExistingPaths.push(outPath);
      htmlBySlug.set(pageSlug, existingHtml);
    } else {
      const request = canonicalClusterNarrativeRequest(ctx, hierarchy, { ...cluster, slug: pageSlug });
      await composeCommercialClusterNarrativeV1(request.input, request.ctx);
      htmlBySlug.set(pageSlug, renderClusterHtml({ ...cluster, slug: pageSlug }));
    }
  }
  const newSlugs = new Set(
    hierarchy.clusters
      .map((cluster) => resolveClusterPageSlug(cluster.slug))
      .filter((pageSlug) => !existingHtmlBySlug.has(pageSlug)),
  );

  const patientCopyFailures: string[] = [];
  const entityNamesBySlug = new Map<string, string[]>();
  const approvedBankLocality =
    usesApprovedBankLocalityDirectPath(ctx.serviceId) &&
    !usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId);
  const localContractPages: Array<{ areaName: string; localBody: string; entityNames: string[] }> = [];
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const packLoaded = loadLocalEvidencePackForGeneration(ctx.resolvedSlug, cluster.name, pageSlug);
    const evidenceFacts = packLoaded.ok
      ? attributableEntities(packLoaded.pack).map((entity) => ({
          name: entity.name,
          category: entity.category,
          address: entity.address,
        }))
      : [];
    entityNamesBySlug.set(
      pageSlug,
      evidenceFacts.map((fact) => fact.name),
    );
    if (options?.skipExistingOutputs && !newSlugs.has(pageSlug)) continue;
    const html = htmlBySlug.get(pageSlug) || "";
    const gate = evaluateLocalityPatientCopyQualityGate({
      html,
      areaName: cluster.name,
      pharmacyName,
      distanceLabel: cluster.distanceLabel || "",
      verifiedEvidenceNames: evidenceFacts.map((fact) => fact.name),
    });
    if (!gate.ok) {
      patientCopyFailures.push(`${pageSlug}: ${gate.failures.join("; ")}`);
    }
    if (!packLoaded.ok) {
      patientCopyFailures.push(`${pageSlug}: evidence-pack:${packLoaded.status}`);
    } else {
      const consumed = pageConsumesRequiredVerifiedLocalEvidence(html, evidenceFacts);
      if (!consumed) {
        patientCopyFailures.push(`${pageSlug}: verified local evidence was not consumed in the page body`);
      }
      if (approvedBankLocality) {
        const contractGate = evaluateLocalityHtmlContentContract({
          html,
          areaName: cluster.name,
          serviceName: ctx.serviceName,
          pharmacyName,
          entityNames: evidenceFacts.map((fact) => fact.name),
        });
        if (!contractGate.ok) {
          patientCopyFailures.push(`${pageSlug}: locality-content-contract: ${contractGate.failures.join("; ")}`);
        }
        localContractPages.push({
          areaName: cluster.name,
          localBody: html,
          entityNames: evidenceFacts.map((fact) => fact.name),
        });
      }
    }
  }
  if (approvedBankLocality) {
    for (const failure of localityPagesAreTokenOnlyCopies(localContractPages)) {
      patientCopyFailures.push(failure);
    }
  }
  for (let i = 0; i < hierarchy.clusters.length; i++) {
    for (let j = i + 1; j < hierarchy.clusters.length; j++) {
      const a = hierarchy.clusters[i]!;
      const b = hierarchy.clusters[j]!;
      const aSlug = resolveClusterPageSlug(a.slug);
      const bSlug = resolveClusterPageSlug(b.slug);
      if (options?.skipExistingOutputs && !newSlugs.has(aSlug) && !newSlugs.has(bSlug)) continue;
      if (
        !localityIntroductionsAreDistinct(
          htmlBySlug.get(aSlug) || "",
          htmlBySlug.get(bSlug) || "",
          a.name,
          b.name,
          {
            pharmacyName,
            pharmacyAddress: ctx.profile.customerFacingAddress || ctx.profile.fullAddress || "",
            pharmacyPhone: ctx.profile.phone || ctx.profile.displayPhone || "",
            entityNames: [...(entityNamesBySlug.get(aSlug) || []), ...(entityNamesBySlug.get(bSlug) || [])],
          },
        )
      ) {
        patientCopyFailures.push(`${aSlug}/${bSlug}: duplicate locality introduction or access paragraph`);
      }
    }
  }
  if (patientCopyFailures.length) {
    endLocalityVariationSessionV1();
    return {
      ok: false,
      blockedReason: `Locality patient-copy quality gate failed: ${patientCopyFailures.slice(0, 8).join(" | ")}`,
      hierarchy,
      assets: [],
      localClusterEntries: [],
      clusterPaths: [],
      areaPaths: [],
      skippedExistingPaths,
      createdPaths,
    };
  }

  const duplicationGate = evaluateLocalityHtmlDuplicationGate({
        pages: hierarchy.clusters.map((cluster) => {
          const pageSlug = resolveClusterPageSlug(cluster.slug);
          return {
            areaSlug: pageSlug,
            areaName: cluster.name,
            html: htmlBySlug.get(pageSlug) || "",
          };
        }),
        pharmacyName,
      });
  const duplicationFailures = options?.skipExistingOutputs
    ? duplicationGate.pairs.filter((pair) => pair.blocked && (newSlugs.has(pair.a) || newSlugs.has(pair.b)))
    : duplicationGate.pairs.filter((pair) => pair.blocked);
  if (duplicationFailures.length) {
    endLocalityVariationSessionV1();
    return {
      ok: false,
      blockedReason: `Locality duplication gate failed: ${duplicationFailures.map((pair) => pair.reason).join(" ")}`,
      hierarchy,
      assets: [],
      localClusterEntries: [],
      clusterPaths: [],
      areaPaths: [],
      skippedExistingPaths,
      createdPaths,
    };
  }

  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    const rel = resolveClusterPageFilesystemRelativePath(pageSlug);
    const existingPath = path.join(ecosystemRoot, rel);
    const html = htmlBySlug.get(pageSlug) || renderClusterHtml(cluster);
    const out = existingHtmlBySlug.has(pageSlug)
      ? existingPath
      : writeLocal(rel, html);
    if (!existingHtmlBySlug.has(pageSlug)) createdPaths.push(out);
    clusterPaths.push(out);
    const urlPath = resolveClusterPageUrlPath(pageSlug);
    localClusterEntries.push({
      areaName: cluster.name,
      areaSlug: pageSlug,
      urlPath,
      outputPath: path.relative(ecosystemRoot, out),
      nearbyAreas: hierarchy.clusters
        .filter((c) => c.areaId !== cluster.areaId)
        .map((c) => {
          const nearbySlug = resolveClusterPageSlug(c.slug);
          return {
            areaName: c.name,
            areaSlug: nearbySlug,
            urlPath: resolveClusterPageUrlPath(nearbySlug),
          };
        }),
    });
    assets.push({
      id: `local-cluster-${pageSlug}`,
      type: "Cluster page",
      urlPath,
      outputPath: out,
      sourceSections: [
        "local-location-cluster",
        cluster.name,
        "rc1-cluster-page",
        session.strategyBySlug.get(pageSlug) || "strategy",
      ],
      wordCount: countWords(html),
    });
  }

  endLocalityVariationSessionV1();

  if (!options?.clusterPagesOnly) {
    const linkMap = {
      slug: ctx.resolvedSlug,
      serviceId: ctx.serviceId,
      mainServiceUrlPath: ctx.serviceMeta.urlPath,
      serviceHubUrlPath: ctx.serviceMeta.urlPath,
      localClusterPages: localClusterEntries,
      localLocationClusters: hierarchy.clusters.map((c) => {
        const pageSlug = resolveClusterPageSlug(c.slug);
        return {
          areaName: c.name,
          areaSlug: pageSlug,
          urlPath: resolveClusterPageUrlPath(pageSlug),
          outputPath: resolveClusterPageFilesystemRelativePath(pageSlug),
        };
      }),
      localLocationHierarchy: hierarchy,
      architecture: "rc1-cluster-page-v1",
      generatedAt,
      generationStamp,
    };

    fs.mkdirSync(ecosystemRoot, { recursive: true });
    fs.writeFileSync(path.join(ecosystemRoot, "_internal-link-map.json"), JSON.stringify(linkMap, null, 2), "utf8");
  }

  return {
    ok: true,
    hierarchy,
    assets,
    localClusterEntries,
    clusterPaths,
    areaPaths,
    skippedExistingPaths,
    createdPaths,
    duplicationGate: {
      ok: duplicationFailures.length === 0,
      message: duplicationGate.message,
    },
  };
}

/** Regenerate location hub + cluster HTML only — does not rewrite area pages. */
export function regenerateLocalHubAndClusterPagesOnly(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
): Pick<
  LocalLocationGenerationResult,
  "ok" | "hierarchy" | "assets" | "hubPath" | "clusterPaths"
> {
  const ecosystemRoot = ctx.links.ecosystemRoot;
  const assets: EcosystemAsset[] = [];
  const clusterPaths: string[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    return outPath;
  };

  const hubHtml = scrubPublicLocalEngineHtml(renderLocalLocationHubFullPage(ctx, hierarchy));
  const hubOut = writeLocal("local/locations/index.html", hubHtml);
  assets.push({
    id: "local-location-hub",
    type: "Location overview",
    urlPath: "/locations/",
    outputPath: hubOut,
    sourceSections: ["local-location-hub", "local-hub-v1"],
    wordCount: countWords(hubHtml),
  });

  for (const cluster of hierarchy.clusters) {
    const html = renderLocalLocationClusterFullPage(ctx, hierarchy, cluster);
    const rel = `local/${cluster.slug}/index.html`;
    const out = writeLocal(rel, html);
    clusterPaths.push(out);
    assets.push({
      id: `local-cluster-${cluster.slug}`,
      type: "Location cluster",
      urlPath: `/local/${cluster.slug}/`,
      outputPath: out,
      sourceSections: ["local-location-cluster", cluster.name, "local-cluster-v1"],
      wordCount: countWords(html),
    });
  }

  return { ok: true, hierarchy, assets, hubPath: hubOut, clusterPaths };
}

/** Regenerate location area HTML only — preserves hub/cluster ecosystem files. */
export function regenerateLocalAreaPagesOnly(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  options?: { onlyAreaSlugs?: string[] },
): Pick<LocalLocationGenerationResult, "ok" | "hierarchy" | "assets" | "areaPaths"> {
  const ecosystemRoot = ctx.links.ecosystemRoot;
  const assets: EcosystemAsset[] = [];
  const areaPaths: string[] = [];
  const localClusterEntries: LocalClusterLinkEntry[] = [];

  const writeLocal = (relPath: string, html: string): string => {
    const outPath = path.join(ecosystemRoot, relPath);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, html, "utf8");
    return outPath;
  };

  for (const area of hierarchy.areas) {
    if (options?.onlyAreaSlugs?.length && !options.onlyAreaSlugs.includes(area.slug)) {
      continue;
    }
    const scopedCtx = scopeContentGenerationContextForArea(ctx, area.name);
    const nearby = hierarchy.areas
      .filter((a) => a.areaId !== area.areaId)
      .map((a) => ({
        areaName: a.name,
        areaSlug: a.slug,
        urlPath: `/local/${a.slug}/`,
      }));
    const html = renderLocalLocationAreaFullPage(scopedCtx, hierarchy, area);
    const rel = `local/${area.slug}/index.html`;
    const out = writeLocal(rel, html);
    areaPaths.push(out);
    localClusterEntries.push({
      areaName: area.name,
      areaSlug: area.slug,
      urlPath: `/local/${area.slug}/`,
      outputPath: path.relative(ecosystemRoot, out),
      nearbyAreas: nearby,
    });
    assets.push({
      id: `local-area-${area.slug}`,
      type: "Location area page",
      urlPath: `/local/${area.slug}/`,
      outputPath: out,
      sourceSections: ["local-location-area", area.name, "local-area-v1"],
      wordCount: countWords(html),
    });
  }

  const linkMapPath = path.join(ecosystemRoot, "_internal-link-map.json");
  if (fs.existsSync(linkMapPath)) {
    try {
      const linkMap = JSON.parse(fs.readFileSync(linkMapPath, "utf8")) as Record<string, unknown>;
      fs.writeFileSync(
        linkMapPath,
        JSON.stringify({ ...linkMap, localClusterPages: localClusterEntries }, null, 2),
        "utf8",
      );
    } catch {
      /* preserve map if malformed */
    }
  }

  return { ok: true, hierarchy, assets, areaPaths };
}

export function mergeLocalHubClusterAssetsIntoEcosystemIndex(
  slug: string,
  serviceId: string,
  hubClusterAssets: EcosystemAsset[],
  hierarchy: LocalLocationHierarchy,
): void {
  const ecosystemRoot = getEcosystemRoot(serviceId, slug);
  const indexPath = path.join(ecosystemRoot, "_ecosystem-index.json");
  const existing = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as Record<string, unknown>)
    : { version: 1, serviceId, slug, assets: [] as EcosystemAsset[] };

  const assets = (existing.assets as EcosystemAsset[]) || [];
  const kept = assets.filter(
    (a) =>
      a.id !== "local-location-hub" &&
      !a.id.startsWith("local-cluster-") &&
      a.type !== "Location cluster" &&
      a.type !== "Location hub",
  );
  const merged = [...kept, ...hubClusterAssets];

  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        ...existing,
        localLocationHubGenerated: true,
        localLocationClustersGenerated: hierarchy.clusters.length,
        localLocationHierarchy: hierarchy,
        generatedAt: new Date().toISOString(),
        assets: merged,
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function mergeLocalAssetsIntoEcosystemIndex(
  slug: string,
  serviceId: string,
  localResult: LocalLocationGenerationResult,
): void {
  if (!localResult.ok) return;
  const ecosystemRoot = getEcosystemRoot(serviceId, slug);
  const indexPath = path.join(ecosystemRoot, "_ecosystem-index.json");
  const existing = fs.existsSync(indexPath)
    ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as Record<string, unknown>)
    : { version: 1, serviceId, slug, assets: [] as EcosystemAsset[] };

  const assets = (existing.assets as EcosystemAsset[]) || [];
  const withoutLocal = assets.filter(
    (a) =>
      !a.id.startsWith("local-cluster-") &&
      !a.id.startsWith("local-area-") &&
      a.id !== "local-location-hub" &&
      a.type !== "Local cluster page",
  );
  const merged = [...withoutLocal, ...localResult.assets];
  const selectedAreas = hierarchyToContentGenerationAreas(localResult.hierarchy).map((a) => a.areaName);

  fs.writeFileSync(
    indexPath,
    JSON.stringify(
      {
        ...existing,
        selectedAreas,
        localClusterPagesGenerated: localResult.localClusterEntries.length,
        localLocationHubGenerated: true,
        localLocationClustersGenerated: localResult.hierarchy.clusters.length,
        localLocationAreasGenerated: localResult.hierarchy.areas.length,
        localLocationHierarchy: localResult.hierarchy,
        generatedAt: new Date().toISOString(),
        assets: merged,
        internalLinkMap: JSON.parse(fs.readFileSync(path.join(ecosystemRoot, "_internal-link-map.json"), "utf8")),
      },
      null,
      2,
    ),
    "utf8",
  );
}

export function canonicalPageSlugForLocalUrlPath(urlPath: string): string {
  const cleaned = urlPath.replace(/^\/+|\/+$/g, "");
  if (cleaned === "local/hub" || cleaned === "local/locations" || cleaned === "locations") {
    return "locations";
  }
  const parts = cleaned.split("/").filter(Boolean);
  if (parts[0] === "local" && parts[1]) {
    const segment = resolveClusterPageSlug(parts[1]);
    return `local-${segment || parts[1]}`;
  }
  return cleaned.replace(/\//g, "-");
}
