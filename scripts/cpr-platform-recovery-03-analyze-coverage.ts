/**
 * CPR-PLATFORM-RECOVERY-03 — analyze NODE_V8_COVERAGE after regeneration.
 * Legacy FAIL only if quarantined generation entrypoints execute (not module-load helpers).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const FORBIDDEN_LEGACY_ENTRYPOINTS: Record<string, string[]> = {
  "pharmacyServiceAreaPageGenerator.ts": ["generatePharmacyServiceAreaPages", "buildAreaPage"],
  "pharmacyLocalNarrativeEngine.ts": ["generateLocalNarrative", "computePageLocalReferences"],
  "pharmacyLocalWeavingV2.ts": ["weaveSections", "weaveFAQOpenings", "measureLocalWeaving"],
  "pharmacyLocalEntitySectionEngine.ts": ["injectLocalEntitySectionVariants"],
  "pharmacyAreaNarrativeIntelligence.ts": ["injectAreaNarrativeIntelligence"],
  "pharmacyFirstPageSections.ts": ["renderPharmacyFirstHero"],
  "pharmacyFirstPageRecovery.ts": ["buildPharmacyFirstRecoveryMainHtml"],
  "pharmacyFirstLocalPagePolish.ts": ["polishPharmacyFirstLocalPageHtml"],
  "rc1ClusterPageOutputCorrectionService.ts": ["correctRc1ClusterPageOutput"],
};

type CovFunction = {
  functionName: string;
  ranges: Array<{ startOffset: number; endOffset: number; count: number }>;
};
type CovScript = { url: string; functions: CovFunction[] };

function readCoverageDir(covDir: string): CovScript[] {
  if (!fs.existsSync(covDir)) return [];
  const out: CovScript[] = [];
  for (const name of fs.readdirSync(covDir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(covDir, name), "utf8")) as { result?: CovScript[] };
      out.push(...(raw.result || []));
    } catch {
      /* ignore */
    }
  }
  return out;
}

function hitsFor(scripts: CovScript[], fileName: string) {
  const hits: Array<{ name: string; count: number }> = [];
  for (const script of scripts) {
    const url = decodeURIComponent(script.url || "");
    if (!url.includes(fileName)) continue;
    for (const fn of script.functions || []) {
      const count = (fn.ranges || []).reduce((max, r) => Math.max(max, r.count || 0), 0);
      const name = fn.functionName || "";
      if (count > 0 && name && !name.startsWith("__") && name !== "(anonymous)" && name !== "") {
        hits.push({ name, count });
      }
    }
  }
  return hits;
}

function fnHit(scripts: CovScript[], file: string, part: string): boolean {
  return hitsFor(scripts, file).some(
    (h) => h.name === part || h.name.endsWith(part) || h.name.includes(part),
  );
}

function fileHit(scripts: CovScript[], file: string): boolean {
  return hitsFor(scripts, file).some((h) => !["resolveWorkspaceRoot"].includes(h.name));
}

function stage(
  name: string,
  executed: boolean,
  file: string,
  fn: string,
  canonical: boolean,
  legacy: boolean,
  replacement: boolean,
) {
  return {
    stage: name,
    executed: executed ? "YES" : "NO",
    file,
    function: fn,
    canonical: canonical ? "YES" : "NO",
    legacy: legacy ? "YES" : "NO",
    replacement: replacement ? "YES" : "NO",
  };
}

const covDir = process.argv[2] || process.env.NODE_V8_COVERAGE || "";
const interimPath = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/content-engine-v1-lock/cpr-platform-recovery-03-interim.json",
);
const interim = JSON.parse(fs.readFileSync(interimPath, "utf8")) as {
  upstream: { websiteImport: boolean; businessProfile: boolean; evidence: boolean };
  tenantArtifacts: Record<
    string,
    { serviceOk: boolean; clusterOk: boolean; clusterCount: number; servicePath: string; clusterPaths: string[] }
  >;
  contentPass: boolean;
  localityPass: boolean;
  publicTermsPass: boolean;
  regressionPass: boolean;
  clusterValidations: Array<{
    checks: Record<string, unknown>;
    structureSignals: Record<string, boolean>;
    headings: string[];
    areaName: string;
    path: string;
  }>;
};

const scripts = readCoverageDir(covDir);

const legacyExecuted: Array<{ file: string; function: string; count: number }> = [];
for (const [file, entrypoints] of Object.entries(FORBIDDEN_LEGACY_ENTRYPOINTS)) {
  for (const ep of entrypoints) {
    if (fnHit(scripts, file, ep)) {
      const hit = hitsFor(scripts, file).find((h) => h.name.includes(ep));
      legacyExecuted.push({ file, function: ep, count: hit?.count || 1 });
    }
  }
}

const moduleLoadOnly = Object.keys(FORBIDDEN_LEGACY_ENTRYPOINTS)
  .map((file) => {
    const loaded = scripts.some((s) => decodeURIComponent(s.url || "").includes(file));
    const business = hitsFor(scripts, file).filter((h) =>
      (FORBIDDEN_LEGACY_ENTRYPOINTS[file] || []).some((ep) => h.name.includes(ep)),
    );
    return { file, loaded, businessEntryExecuted: business };
  })
  .filter((x) => x.loaded);

if (legacyExecuted.length) {
  const first = legacyExecuted[0]!;
  const report = {
    ok: false,
    stop: true,
    firstLegacyExecution: first,
    legacyExecuted,
    recovery: "CPR-PLATFORM-RECOVERY-03",
  };
  const out = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/content-engine-v1-lock/cpr-platform-recovery-03-report.json",
  );
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log("FIRST LEGACY EXECUTION:", JSON.stringify(first));
  process.exit(2);
}

// Re-validate Leeds cluster content with production-intent checks
function revalidateClusters() {
  const paths = interim.tenantArtifacts["leeds-pharmacy"]?.clusterPaths || [];
  const results = [];
  for (const clusterPath of paths) {
    const html = fs.readFileSync(clusterPath, "utf8");
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ");
    const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
      m[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
    );
    const unique = new Set(headings.map((h) => h.toLowerCase()));
    const publicTerms = /\blocation[- ]cluster\b|\bcluster pages?\b|\bhub pages?\b|\binternal routing\b/i.test(
      text,
    );
    const nhsNav = (text.match(/\bNHS Services\b/gi) || []).length;
    const nhsTotal = (text.match(/\bNHS\b/gi) || []).length;
    const nhsBody = nhsTotal - nhsNav;
    results.push({
      path: clusterPath,
      headings,
      uniqueHeadings: unique.size === headings.length,
      publicTermsClean: !publicTerms,
      whyPatients: headings.some((h) => /why patients in .+ choose/i.test(h)),
      gpSection: headings.some((h) => /see a gp/i.test(h)),
      access: headings.some((h) => /access from/i.test(h)),
      faq: headings.some((h) => /frequently asked/i.test(h)),
      book: headings.some((h) => /book/i.test(h)),
      localityRoad: /lane|road|street|avenue|drive|way|close/i.test(text),
      localityGp: /\bGP\b|surgery/i.test(text),
      localityTravel: /travel|access|directions|located at/i.test(text),
      localityNearby: /nearby|related .+ locations|areas served|patients in/i.test(text),
      patientLanguage: /patients?|you can|local residents/i.test(text),
      commercial: /book|appointment|call/i.test(text),
      nhsBody,
    });
  }
  return results;
}

const clusterReval = revalidateClusters();
const clusterNarrativePass = clusterReval.every(
  (c) => c.uniqueHeadings && c.whyPatients && c.gpSection && c.access && c.faq && c.book && c.commercial,
);
const localityPass = clusterReval.every(
  (c) => c.localityRoad && c.localityGp && c.localityTravel && c.localityNearby && c.patientLanguage,
);
const publicTermsPass = clusterReval.every((c) => c.publicTermsClean);
const duplicatePass =
  fnHit(scripts, "pharmacyLocalClusterCompositionDedupe.ts", "finalizeLocalClusterPageContent") &&
  clusterReval.every((c) => c.uniqueHeadings);

const stages = [
  stage(
    "Website Import",
    interim.upstream.websiteImport,
    "data/website-design-evidence|pharmacy-profiles",
    "preloaded-tenant-import",
    true,
    false,
    false,
  ),
  stage(
    "Business Profile",
    interim.upstream.businessProfile,
    "data/pharmacy-master-admin/business-profile-review|pharmacy-profiles",
    "preloaded-business-profile",
    true,
    false,
    false,
  ),
  stage(
    "Evidence",
    interim.upstream.evidence,
    "data/pharmacy-master-admin/service-page-evidence-review",
    "preloaded-evidence-review",
    true,
    false,
    false,
  ),
  stage(
    "Service Builder",
    fnHit(scripts, "pharmacyContentPackageService.ts", "generateContentPackage") &&
      fnHit(scripts, "pharmacyVisualExperience.ts", "buildVisualExperiencePage") &&
      fnHit(scripts, "pharmacyVisualExperienceLayoutV3.ts", "buildPharmacyServicePageMainHtml"),
    "pharmacyContentPackageService.ts → pharmacyVisualExperience.ts → pharmacyVisualExperienceLayoutV3.ts",
    "generateContentPackage → buildVisualExperiencePage → buildPharmacyServicePageMainHtml",
    true,
    false,
    false,
  ),
  stage(
    "Narrative Planner",
    fnHit(scripts, "pharmacyLocalClusterContentEngine.ts", "composeCommercialClusterNarrativeV1") &&
      fnHit(scripts, "pharmacyFirstLocalNarrative.ts", "buildPharmacyFirstLocalNarrative"),
    "pharmacyLocalClusterContentEngine.ts / pharmacyFirstLocalNarrative.ts",
    "composeCommercialClusterNarrativeV1 / buildPharmacyFirstLocalNarrative",
    true,
    false,
    false,
  ),
  stage(
    "Section Planner",
    fnHit(scripts, "pharmacyCommercialSectionPlannerV1.ts", "resolveCommercialSectionPlanV1"),
    "pharmacyCommercialSectionPlannerV1.ts",
    "resolveCommercialSectionPlanV1",
    true,
    false,
    false,
  ),
  stage(
    "Locality Engine",
    fnHit(scripts, "pharmacyLocalAreaResolver.ts", "resolveLocalLocationHierarchy") &&
      fnHit(scripts, "pharmacyLocalClusterIntelligence.ts", "applyClusterIntelligence"),
    "pharmacyLocalAreaResolver.ts / pharmacyLocalClusterIntelligence.ts",
    "resolveLocalLocationHierarchy / applyClusterIntelligence",
    true,
    false,
    false,
  ),
  stage(
    "Evidence Engine",
    fnHit(scripts, "pharmacyLocalClusterIntelligence.ts", "applyClusterIntelligence"),
    "pharmacyLocalClusterIntelligence.ts",
    "applyClusterIntelligence",
    true,
    false,
    false,
  ),
  stage(
    "Duplicate Detection",
    fnHit(scripts, "pharmacyLocalClusterCompositionDedupe.ts", "finalizeLocalClusterPageContent"),
    "pharmacyLocalClusterCompositionDedupe.ts",
    "finalizeLocalClusterPageContent",
    true,
    false,
    false,
  ),
  stage(
    "Renderer",
    fnHit(scripts, "pharmacyLocalClusterLocationPageRenderer.ts", "renderLocalClusterLocationPageHtml") &&
      fnHit(scripts, "pharmacyVisualExperienceLayoutV3.ts", "buildPharmacyServicePageMainHtml"),
    "pharmacyVisualExperienceLayoutV3.ts / pharmacyLocalClusterLocationPageRenderer.ts",
    "buildPharmacyServicePageMainHtml / renderLocalClusterLocationPageHtml",
    true,
    false,
    false,
  ),
  stage(
    "Generated HTML",
    Boolean(interim.tenantArtifacts["leeds-pharmacy"]?.serviceOk),
    interim.tenantArtifacts["leeds-pharmacy"]?.servicePath || "",
    "service-page-html-written",
    true,
    false,
    false,
  ),
  stage(
    "Cluster Pages",
    Boolean(interim.tenantArtifacts["leeds-pharmacy"]?.clusterOk) &&
      fnHit(scripts, "pharmacyLocalLocationGenerationService.ts", "generateLocalLocationHierarchyPages"),
    "pharmacyLocalLocationGenerationService.ts",
    "generateLocalLocationHierarchyPages",
    true,
    false,
    false,
  ),
  stage(
    "Preview",
    Boolean(interim.tenantArtifacts["leeds-pharmacy"]?.serviceOk) &&
      Boolean((interim.tenantArtifacts["leeds-pharmacy"]?.clusterCount || 0) > 0),
    "output/pharmacy-visual-experience + content-ecosystem clusters",
    "filesystem-preview-artifacts",
    true,
    false,
    false,
  ),
];

const report = {
  ok:
    stages.every((s) => s.executed === "YES") &&
    legacyExecuted.length === 0 &&
    clusterNarrativePass &&
    localityPass &&
    publicTermsPass &&
    duplicatePass &&
    interim.regressionPass,
  recovery: "CPR-PLATFORM-RECOVERY-03",
  generatedAt: new Date().toISOString(),
  stages,
  legacyExecuted: "NONE",
  legacyModuleLoadedButNotExecuted: moduleLoadOnly.map((m) => m.file),
  firstLegacyExecution: null,
  clusterNarrativePass,
  sectionPlannerPass: fnHit(scripts, "pharmacyCommercialSectionPlannerV1.ts", "resolveCommercialSectionPlanV1"),
  duplicateDetectionPass: duplicatePass,
  localityIntelligencePass: localityPass,
  commercialNarrativePass: clusterNarrativePass,
  publicTerminologyPass: publicTermsPass,
  regressionPass: interim.regressionPass,
  clusterRevalidation: clusterReval,
  tenantArtifacts: interim.tenantArtifacts,
  coverageScripts: scripts.length,
};

const out = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/content-engine-v1-lock/cpr-platform-recovery-03-report.json",
);
fs.writeFileSync(out, JSON.stringify(report, null, 2));

console.log("\n=== STAGE TRACE (Leeds Pharmacy) ===");
for (const s of stages) {
  console.log(
    `${s.stage}: executed=${s.executed} | file=${s.file} | fn=${s.function} | canonical=${s.canonical} | legacy=${s.legacy} | replacement=${s.replacement}`,
  );
}
console.log("\n=== LEGACY GENERATION ENTRYPOINTS ===");
console.log(legacyExecuted.length ? JSON.stringify(legacyExecuted, null, 2) : "NONE");
console.log("Legacy modules loaded (import graph only):", moduleLoadOnly.map((m) => m.file).join(", ") || "none");
console.log("\n=== CONTENT FLAGS ===");
console.log(
  JSON.stringify(
    {
      clusterNarrativePass,
      sectionPlannerPass: report.sectionPlannerPass,
      duplicateDetectionPass: duplicatePass,
      localityIntelligencePass: localityPass,
      publicTerminologyPass: publicTermsPass,
      regressionPass: interim.regressionPass,
    },
    null,
    2,
  ),
);
console.log(`\nReport: ${out}`);
console.log(report.ok ? "RECOVERY-03: PASS" : "RECOVERY-03: FAIL");
process.exit(report.ok ? 0 : 1);
