/**
 * CPR-PLATFORM-RECOVERY-03 — ESM loader that injects runtime probes into
 * canonical Content Engine entrypoints and quarantined legacy entrypoints.
 * Validation only.
 */

const TRACE_HELPER = `
;globalThis.__CPR_RUNTIME_TRACE__ = globalThis.__CPR_RUNTIME_TRACE__ || [];
globalThis.__CPR_TRACE_PUSH__ = globalThis.__CPR_TRACE_PUSH__ || function(kind, file, fn) {
  globalThis.__CPR_RUNTIME_TRACE__.push({ kind, file, fn, t: Date.now() });
};
`;

/** @type {Record<string, string[]>} */
const PROBES = {
  pharmacyLegacyContentEngineQuarantine.ts: ["assertLegacyContentEngineAllowed"],
  pharmacyContentPackageService.ts: ["generateContentPackage"],
  pharmacyVisualExperience.ts: ["buildVisualExperiencePage"],
  pharmacyVisualExperienceLayoutV3.ts: ["buildPharmacyServicePageMainHtml"],
  pharmacyCommercialNarrativeEngineV1.ts: [
    "servicePageHeroIntro",
    "preferredServicePageCta",
    "servicePageFaqEntries",
  ],
  pharmacyCommercialSectionPlannerV1.ts: ["resolveCommercialSectionPlanV1"],
  pharmacyLocalAreaResolver.ts: ["resolveLocalLocationHierarchy"],
  pharmacyLocalClusterIntelligence.ts: ["applyClusterIntelligence"],
  pharmacyLocalClusterCompositionDedupe.ts: ["finalizeLocalClusterPageContent"],
  pharmacyLocalClusterContentEngine.ts: [
    "composeCommercialClusterNarrativeV1",
    "buildLocalClusterPageContent",
  ],
  pharmacyLocalHubClusterContentEngine.ts: ["buildLocalClusterHubPageContent"],
  pharmacyLocalClusterLocationPageRenderer.ts: ["renderLocalClusterLocationPageHtml"],
  pharmacyLocalLocationGenerationService.ts: ["generateLocalLocationHierarchyPages"],
  pharmacyLocalHierarchyFullPageRenderer.ts: ["renderLocalLocationClusterFullPage"],
  pharmacyFirstLocalNarrative.ts: ["buildPharmacyFirstLocalNarrative"],
  "buildContentGenerationContext.ts": ["buildContentGenerationContext"],
  pharmacyServiceAreaPageGenerator.ts: ["generatePharmacyServiceAreaPages", "buildAreaPage"],
  pharmacyLocalNarrativeEngine.ts: ["generateLocalNarrative", "computePageLocalReferences"],
  pharmacyLocalWeavingV2.ts: ["weaveSections", "weaveFAQOpenings", "measureLocalWeaving"],
  pharmacyLocalEntitySectionEngine.ts: ["injectLocalEntitySectionVariants"],
  pharmacyAreaNarrativeIntelligence.ts: ["injectAreaNarrativeIntelligence"],
  pharmacyFirstPageSections.ts: ["renderPharmacyFirstHero"],
  pharmacyFirstPageRecovery.ts: ["buildPharmacyFirstRecoveryMainHtml"],
  pharmacyFirstLocalPagePolish.ts: ["polishPharmacyFirstLocalPageHtml"],
  rc1ClusterPageOutputCorrectionService.ts: ["correctRc1ClusterPageOutput"],
  pharmacyLocalLocationHubRenderer.ts: ["renderLocalLocationClusterPage"],
  pharmacyAreaRewriteEngine.ts: ["rewriteAreaContent"],
};

const LEGACY_FILES = new Set([
  "pharmacyServiceAreaPageGenerator.ts",
  "pharmacyLocalNarrativeEngine.ts",
  "pharmacyLocalWeavingV2.ts",
  "pharmacyLocalEntitySectionEngine.ts",
  "pharmacyAreaNarrativeIntelligence.ts",
  "pharmacyFirstPageSections.ts",
  "pharmacyFirstPageRecovery.ts",
  "pharmacyFirstLocalPagePolish.ts",
  "rc1ClusterPageOutputCorrectionService.ts",
  "pharmacyLocalLocationHubRenderer.ts",
  "pharmacyAreaRewriteEngine.ts",
]);

function fileKey(url) {
  const path = decodeURIComponent((url.split("?")[0] || "").replace(/\\/g, "/"));
  for (const key of Object.keys(PROBES)) {
    if (path.endsWith("/" + key) || path.endsWith(key)) return key;
  }
  if (path.endsWith("/pharmacyLocalityEngineV1.ts")) return "pharmacyLocalityEngineV1.ts";
  if (path.endsWith("/pharmacyServicePageIntelligence.ts")) return "pharmacyServicePageIntelligence.ts";
  return null;
}

function injectProbes(source, key) {
  let out = TRACE_HELPER + source;
  const kind = LEGACY_FILES.has(key) ? "legacy" : "canonical";
  const fns = PROBES[key] || [];
  for (const fn of fns) {
    const re = new RegExp(
      `(export\\s+(?:async\\s+)?function\\s+${fn}\\s*\\([^)]*\\)\\s*\\{)`,
      "g",
    );
    out = out.replace(
      re,
      `$1\n  globalThis.__CPR_TRACE_PUSH__(${JSON.stringify(kind)}, ${JSON.stringify(key)}, ${JSON.stringify(fn)});\n`,
    );
  }
  if (key === "pharmacyLocalityEngineV1.ts" || key === "pharmacyServicePageIntelligence.ts") {
    out += `\n;globalThis.__CPR_TRACE_PUSH__("canonical", ${JSON.stringify(key)}, "module-evaluated");\n`;
  }
  return out;
}

export async function load(url, context, nextLoad) {
  const key = fileKey(url);
  const result = await nextLoad(url, context);
  if (!key) return result;
  if (result.format !== "module") return result;

  let source = result.source;
  if (source == null && url.startsWith("file:")) {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    try {
      source = readFileSync(fileURLToPath(url.split("?")[0]), "utf8");
    } catch {
      return result;
    }
  }
  if (source == null) return result;

  return {
    format: "module",
    shortCircuit: true,
    source: injectProbes(String(source), key),
  };
}
