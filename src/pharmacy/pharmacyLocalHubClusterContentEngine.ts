/**
 * Hub and cluster page content models — scoped from local cluster engine, not area-page clone.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { LocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import type { LocalAreaEvidenceRecord } from "./pharmacyLocalAreaResolver.ts";
import { scopeContentGenerationContextForArea } from "./contentEngine/contentEngineContextScope.ts";
import { ownerVariablesForArea } from "./contentEngine/contentEngineTokens.ts";
import {
  composeCommercialClusterNarrativeV1,
  type LocalClusterPageContent,
} from "./pharmacyLocalClusterContentEngine.ts";
import { scrubPublicLocalEngineTerms } from "./pharmacyLocalClusterCompositionDedupe.ts";
import { resolveCommercialSectionPlanV1 } from "./contentEngine/pharmacyCommercialSectionPlannerV1.ts";
import { usesApprovedBankLocalityDirectPath } from "./pharmacyApprovedBankLocalityDirectRender.ts";
import { usesPharmacyFirstPatientJourneyLocalTemplate } from "./pharmacyLocalPageTypeContracts.ts";

export interface LocalHubPageContent {
  contractId: "local-hub-v1";
  hubName: string;
  serviceCoverageHeading: string;
  serviceCoverageBody: string;
  areasIntro: string;
  clusterOverviewIntro: string;
  base: LocalClusterPageContent;
}

export interface LocalClusterHubPageContent {
  contractId: "local-cluster-v1";
  clusterName: string;
  clusterContextHeading: string;
  clusterContextIntro: string;
  clusterContextBody: string;
  childAreasIntro: string;
  relevanceHeading: string;
  base: LocalClusterPageContent;
}

function buildClusterContextBody(base: LocalClusterPageContent, _areaName: string, _pharmacyName: string): string {
  const parts = [
    base.whyChecksBody,
    ...base.processSteps.map((step) => [step.title, step.body].filter(Boolean).join(". ")),
    base.clinicalEnvironmentBody,
  ]
    .map((part) => scrubPublicLocalEngineTerms(part))
    .filter((part) => part && part.length > 40);
  // Omit when the service bank did not supply this section — never invent generic pharmacy copy.
  return parts.length ? parts.join("\n\n") : "";
}

export function buildLocalHubPageContent(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
): LocalHubPageContent {
  const hubName = hierarchy.primaryLocality;
  const scopedCtx = scopeContentGenerationContextForArea(ctx, hubName);
  const areaNames = hierarchy.areas.map((a) => a.name);
  const base = composeCommercialClusterNarrativeV1(
    {
      slug: ctx.resolvedSlug,
      serviceId: ctx.serviceId,
      serviceName: ctx.serviceName,
      areaName: hubName,
      areaSlug: hierarchy.hub?.slug ?? "hub",
      nearbyAreaNames: areaNames,
      areaSlugsInCluster: hierarchy.areas.map((a) => a.slug),
    },
    scopedCtx,
  );
  ownerVariablesForArea(scopedCtx, hubName);
  return {
    contractId: "local-hub-v1",
    hubName,
    serviceCoverageHeading: `${ctx.serviceName} coverage across ${hubName}`,
    serviceCoverageBody: scrubPublicLocalEngineTerms(base.whyChecksBody || base.heroIntro),
    areasIntro: scrubPublicLocalEngineTerms(
      `Explore neighbourhoods near ${hubName} where patients use ${ctx.profile.pharmacyName} for ${ctx.serviceName}.`,
    ),
    clusterOverviewIntro: scrubPublicLocalEngineTerms(
      `${ctx.profile.pharmacyName} supports patients across ${hubName} with dedicated local guidance for ${ctx.serviceName}.`,
    ),
    base,
  };
}

export function buildLocalClusterHubPageContent(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  cluster: LocalAreaEvidenceRecord,
): LocalClusterHubPageContent {
  void resolveCommercialSectionPlanV1("cluster");
  const childAreas = hierarchy.areas.filter((a) => a.parentAreaId === cluster.areaId);
  const siblingLocalities = hierarchy.clusters.map((c) => ({
    areaName: c.name,
    areaSlug: c.slug,
    distanceLabel: c.distanceLabel,
    relationship: c.relationship,
    evidence: c.evidence,
    source: c.source,
  }));
  const focusArea = cluster.name;
  const scopedCtx = scopeContentGenerationContextForArea(ctx, focusArea);
  const nearbyNames = siblingLocalities.filter((s) => s.areaSlug !== cluster.slug).map((s) => s.areaName);
  const base = composeCommercialClusterNarrativeV1(
    {
      slug: ctx.resolvedSlug,
      serviceId: ctx.serviceId,
      serviceName: ctx.serviceName,
      areaName: cluster.name,
      areaSlug: cluster.slug,
      nearbyAreaNames: nearbyNames.length ? nearbyNames : childAreas.map((a) => a.name),
      areaSlugsInCluster: siblingLocalities.map((s) => s.areaSlug),
      siblingLocalities,
      localityRecord: {
        distanceLabel: cluster.distanceLabel,
        relationship: cluster.relationship,
        evidence: cluster.evidence,
        source: cluster.source,
      },
    },
    scopedCtx,
  );
  const pharmacyName = ctx.profile.pharmacyName;
  if (usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId)) {
    const authoredParagraphs = /\n\s*\n/.test(String(base.whyChecksBody || ""));
    if (authoredParagraphs) {
      return {
        contractId: "local-cluster-v1",
        clusterName: cluster.name,
        clusterContextHeading: base.whyChecksHeading,
        clusterContextIntro: "",
        clusterContextBody: base.whyChecksBody,
        childAreasIntro: base.processIntro,
        relevanceHeading: base.localRelevanceHeading,
        base,
      };
    }
    const whySentences = String(base.whyChecksBody || "")
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return {
      contractId: "local-cluster-v1",
      clusterName: cluster.name,
      clusterContextHeading: base.whyChecksHeading,
      clusterContextIntro: whySentences[0] || "",
      clusterContextBody: whySentences.slice(1).join(" "),
      childAreasIntro: base.processIntro,
      relevanceHeading: base.localRelevanceHeading,
      base,
    };
  }
  if (
    usesApprovedBankLocalityDirectPath(ctx.serviceId) &&
    !usesPharmacyFirstPatientJourneyLocalTemplate(ctx.serviceId)
  ) {
    return {
      contractId: "local-cluster-v1",
      clusterName: cluster.name,
      clusterContextHeading: base.whyChecksHeading,
      clusterContextIntro: "",
      clusterContextBody: base.whyChecksBody,
      childAreasIntro: base.processIntro,
      relevanceHeading: base.localRelevanceHeading,
      base,
    };
  }
  const whySentences = String(base.whyChecksBody || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const whyIntro = whySentences[0] || "";
  const whyBody =
    whySentences.slice(1).join(" ") ||
    (whySentences.length ? "" : buildClusterContextBody(base, cluster.name, pharmacyName));
  return {
    contractId: "local-cluster-v1",
    clusterName: cluster.name,
    // Headings/bodies come from the service bank only — omit rather than invent generic copy.
    clusterContextHeading: scrubPublicLocalEngineTerms(base.whyChecksHeading || ""),
    clusterContextIntro: scrubPublicLocalEngineTerms(whyIntro),
    clusterContextBody: scrubPublicLocalEngineTerms(whyBody),
    // Process heading intro only — never pack commercial polish markers into visible copy.
    childAreasIntro: scrubPublicLocalEngineTerms(
      String(base.processIntro || "")
        .split(/(?<=[.!?])\s+/)[0] || "",
    ),
    relevanceHeading: scrubPublicLocalEngineTerms(base.localRelevanceHeading || ""),
    base: {
      ...base,
      heroIntro: scrubPublicLocalEngineTerms(base.heroIntro),
      localRelevanceIntro: scrubPublicLocalEngineTerms(base.localRelevanceIntro),
      localRelevanceBody: scrubPublicLocalEngineTerms(base.localRelevanceBody),
      localRelevanceBullets: base.localRelevanceBullets.map(scrubPublicLocalEngineTerms),
      whyChecksHeading: scrubPublicLocalEngineTerms(base.whyChecksHeading),
      whyChecksBody: scrubPublicLocalEngineTerms(base.whyChecksBody),
      processIntro: scrubPublicLocalEngineTerms(base.processIntro),
      processSteps: base.processSteps.map((step) => ({
        title: scrubPublicLocalEngineTerms(step.title),
        body: scrubPublicLocalEngineTerms(step.body),
      })),
      accessHeading: scrubPublicLocalEngineTerms(base.accessHeading || `Travelling from ${cluster.name}`),
      accessBody: scrubPublicLocalEngineTerms(base.accessBody),
      clinicalEnvironmentHeading: scrubPublicLocalEngineTerms(base.clinicalEnvironmentHeading),
      clinicalEnvironmentBody: scrubPublicLocalEngineTerms(base.clinicalEnvironmentBody),
      preparationBullets: (base.preparationBullets || []).map(scrubPublicLocalEngineTerms),
      eligibilityHeading: base.eligibilityHeading
        ? scrubPublicLocalEngineTerms(base.eligibilityHeading)
        : undefined,
      eligibilityBody: base.eligibilityBody ? scrubPublicLocalEngineTerms(base.eligibilityBody) : undefined,
      eligibilityBullets: (base.eligibilityBullets || []).map(scrubPublicLocalEngineTerms),
      trustHeading: scrubPublicLocalEngineTerms(
        base.trustHeading || `When patients in ${cluster.name} should see a GP instead`,
      ),
      trustIntro: base.trustIntro ? scrubPublicLocalEngineTerms(base.trustIntro) : undefined,
      trustBody: scrubPublicLocalEngineTerms(base.trustBody),
      trustClosing: base.trustClosing ? scrubPublicLocalEngineTerms(base.trustClosing) : undefined,
      faqs: base.faqs.map((faq) => ({
        question: scrubPublicLocalEngineTerms(faq.question),
        answer: scrubPublicLocalEngineTerms(faq.answer),
      })),
      ctaPrimary: scrubPublicLocalEngineTerms(base.ctaPrimary),
      ctaSecondary: scrubPublicLocalEngineTerms(base.ctaSecondary),
      ctaPhonePrompt: scrubPublicLocalEngineTerms(base.ctaPhonePrompt),
      seoTitle: base.seoTitle ? scrubPublicLocalEngineTerms(base.seoTitle) : undefined,
      metaDescription: base.metaDescription ? scrubPublicLocalEngineTerms(base.metaDescription) : undefined,
      supportingHeading: base.supportingHeading ? scrubPublicLocalEngineTerms(base.supportingHeading) : undefined,
      supportingIntro: base.supportingIntro ? scrubPublicLocalEngineTerms(base.supportingIntro) : undefined,
      supportingItems: base.supportingItems?.map((item) => ({
        title: scrubPublicLocalEngineTerms(item.title),
        body: scrubPublicLocalEngineTerms(item.body),
        evidence: item.evidence,
      })),
    },
  };
}

export interface LocalAreaHubPageContent {
  contractId: "local-area-v1";
  areaName: string;
  clusterContextHeading: string;
  clusterContextBody: string;
  childAreasIntro: string;
  relevanceHeading: string;
  base: LocalClusterPageContent;
}

export function buildLocalAreaPageContent(
  ctx: ContentGenerationContext,
  hierarchy: LocalLocationHierarchy,
  area: LocalAreaEvidenceRecord,
): LocalAreaHubPageContent {
  const parentCluster = hierarchy.clusters.find((c) => c.areaId === area.parentAreaId);
  const siblings = hierarchy.areas.filter(
    (a) => a.parentAreaId === area.parentAreaId && a.areaId !== area.areaId,
  );
  const scopedCtx = scopeContentGenerationContextForArea(ctx, area.name);
  const base = composeCommercialClusterNarrativeV1(
    {
      slug: ctx.resolvedSlug,
      serviceId: ctx.serviceId,
      serviceName: ctx.serviceName,
      areaName: area.name,
      areaSlug: area.slug,
      nearbyAreaNames: siblings.map((a) => a.name),
      areaSlugsInCluster: siblings.map((a) => a.slug),
    },
    scopedCtx,
  );
  const clusterLabel = parentCluster?.name || hierarchy.primaryLocality;
  if (usesApprovedBankLocalityDirectPath(ctx.serviceId)) {
    return {
      contractId: "local-area-v1",
      areaName: area.name,
      clusterContextHeading: base.whyChecksHeading,
      clusterContextBody: base.whyChecksBody,
      childAreasIntro: base.processIntro,
      relevanceHeading: base.localRelevanceHeading,
      base,
    };
  }
  return {
    contractId: "local-area-v1",
    areaName: area.name,
    clusterContextHeading: scrubPublicLocalEngineTerms(
      base.whyChecksHeading || `Why patients in ${area.name} choose ${ctx.profile.pharmacyName}`,
    ),
    clusterContextBody: scrubPublicLocalEngineTerms(base.whyChecksBody || base.processIntro || base.heroIntro),
    childAreasIntro: scrubPublicLocalEngineTerms(
      `Patients near ${area.name} and ${clusterLabel} also use ${ctx.profile.pharmacyName} for ${ctx.serviceName}.`,
    ),
    relevanceHeading: scrubPublicLocalEngineTerms(base.localRelevanceHeading),
    base,
  };
}
