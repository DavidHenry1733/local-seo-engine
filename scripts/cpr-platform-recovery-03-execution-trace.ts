/**
 * CPR-PLATFORM-RECOVERY-03 — Canonical Content Engine runtime execution validation.
 * Regenerates tenants via production generators. Pair with NODE_V8_COVERAGE for file execution proof.
 */
import fs from "node:fs";
import path from "node:path";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { generateContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { generateLocalLocationHierarchyPages } from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const TENANTS = [
  "leeds-pharmacy",
  "reliable-direct-pharmacy",
  "brook-pharmacy",
  "welfare-pharmacy",
  "banner-cross-pharmacy",
] as const;

const SERVICE_ID = "pharmacy-first";
const PRIMARY = "leeds-pharmacy";

const FORBIDDEN_LEGACY = [
  "pharmacyServiceAreaPageGenerator.ts",
  "pharmacyLocalNarrativeEngine.ts",
  "pharmacyLocalWeavingV2.ts",
  "pharmacyLocalEntitySectionEngine.ts",
  "pharmacyAreaNarrativeIntelligence.ts",
  "pharmacyFirstPageSections.ts",
  "pharmacyFirstPageRecovery.ts",
  "pharmacyFirstLocalPagePolish.ts",
  "rc1ClusterPageOutputCorrectionService.ts",
] as const;

const CANONICAL_MARKERS = [
  "pharmacyContentPackageService.ts",
  "pharmacyVisualExperience.ts",
  "pharmacyVisualExperienceLayoutV3.ts",
  "pharmacyCommercialNarrativeEngineV1.ts",
  "pharmacyCommercialSectionPlannerV1.ts",
  "pharmacyLocalAreaResolver.ts",
  "pharmacyLocalClusterIntelligence.ts",
  "pharmacyLocalClusterCompositionDedupe.ts",
  "pharmacyLocalClusterContentEngine.ts",
  "pharmacyLocalHubClusterContentEngine.ts",
  "pharmacyLocalClusterLocationPageRenderer.ts",
  "pharmacyLocalLocationGenerationService.ts",
  "pharmacyLocalHierarchyFullPageRenderer.ts",
  "pharmacyFirstLocalNarrative.ts",
  "buildContentGenerationContext.ts",
];

type CovFunction = {
  functionName: string;
  isBlockCoverage?: boolean;
  ranges: Array<{ startOffset: number; endOffset: number; count: number }>;
};
type CovScript = { url: string; functions: CovFunction[] };

function stageReport(
  stage: string,
  executed: boolean,
  file: string,
  fn: string,
  canonical: boolean,
  legacy: boolean,
  replacement: boolean,
) {
  return {
    stage,
    executed: executed ? "YES" : "NO",
    file,
    function: fn,
    canonical: canonical ? "YES" : "NO",
    legacy: legacy ? "YES" : "NO",
    replacement: replacement ? "YES" : "NO",
  };
}

function textFromHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function h2s(html: string): string[] {
  return [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(),
  );
}

function validateClusterHtml(html: string, pharmacyName: string, areaName: string) {
  const text = textFromHtml(html);
  const headings = h2s(html);
  const headingLower = headings.map((h) => h.toLowerCase());
  const uniqueHeadings = new Set(headingLower);
  const forbiddenPublic = [
    /\blocation[- ]cluster\b/i,
    /\bcluster pages?\b/i,
    /\bhub pages?\b/i,
    /\binternal routing\b/i,
    /\binternal section\b/i,
    /\btemplate name\b/i,
  ];
  const nhsHits = (text.match(/\bNHS\b/gi) || []).length;
  const checks = {
    uniqueHeadings: uniqueHeadings.size === headings.length,
    headingCount: headings.length,
    noForbiddenPublic: forbiddenPublic.every((re) => !re.test(text)),
    locality: /GP|surgery|park|school|travel|road|station|nearby|neighbour|landmark|parking|transport|community/i.test(
      text,
    ),
    roads: /road|street|lane|avenue|way|drive|close|crescent/i.test(text),
    landmarks: /park|school|station|centre|center|church|library|market|shopping|landmark/i.test(text),
    gp: /GP|surgery|doctor/i.test(text),
    transport: /bus|train|tram|parking|travel|station|walk|drive/i.test(text),
    neighbouring: /nearby|neighbouring|neighboring|surrounding|adjacent|local communities|patients in/i.test(text),
    patientLanguage: /patient|you can|your pharmacist|local residents|if you/i.test(text),
    commercialCta: /book|call|speak|appointment|contact/i.test(text),
    faq: /faq|frequently asked|application\/ld\+json/i.test(html),
    schema: /application\/ld\+json/i.test(html),
    nhsNotSpam: nhsHits <= 6,
    wordCount: text.split(/\s+/).filter(Boolean).length,
    pharmacyMention: text.toLowerCase().includes(pharmacyName.toLowerCase().slice(0, 8)),
    areaMention: text.toLowerCase().includes(areaName.toLowerCase().split(" ")[0] || areaName),
  };
  const structureSignals = {
    hero: /pharmacy first|same-day|clinical advice|pharmacist/i.test(text.slice(0, 800)),
    whyPatients: headingLower.some((h) => /why|choose|patients|residents/.test(h)),
    howHelps: headingLower.some((h) => /how|helps|works|appointment/.test(h)),
    conditions: headingLower.some((h) => /condition|check|common|when|why checks/.test(h)),
    travel:
      headingLower.some((h) => /travel|access|parking|transport|getting/.test(h)) ||
      /travel|parking|bus|station/i.test(text),
    landmarks: /landmark|park|school|station|nearby/i.test(text),
    gpSection:
      headingLower.some((h) => /gp|doctor|urgent/.test(h)) || /when to see a gp|speak to your gp/i.test(text),
    faq: headingLower.some((h) => /faq|question/.test(h)) || /faq/i.test(html),
    book: /book|appointment|call/i.test(text),
  };
  return { checks, structureSignals, headings };
}

function upstreamExists(slug: string) {
  return {
    websiteImport:
      fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/website-design-evidence", slug)) ||
      fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`)),
    businessProfile:
      fs.existsSync(
        path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/business-profile-review", `${slug}.json`),
      ) || fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`)),
    evidence: fs.existsSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-evidence-review", slug),
    ),
  };
}

function readCoverageDir(covDir: string): CovScript[] {
  if (!fs.existsSync(covDir)) return [];
  const out: CovScript[] = [];
  for (const name of fs.readdirSync(covDir)) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(covDir, name), "utf8")) as {
        result?: CovScript[];
      };
      out.push(...(raw.result || []));
    } catch {
      /* ignore partial coverage files */
    }
  }
  return out;
}

function executedFunctionsForFile(scripts: CovScript[], fileName: string): Array<{ name: string; count: number }> {
  const hits: Array<{ name: string; count: number }> = [];
  for (const script of scripts) {
    const url = decodeURIComponent(script.url || "");
    if (!url.includes(fileName)) continue;
    for (const fn of script.functions || []) {
      const count = (fn.ranges || []).reduce((max, r) => Math.max(max, r.count || 0), 0);
      if (count > 0 && fn.functionName && fn.functionName !== "") {
        hits.push({ name: fn.functionName, count });
      }
    }
  }
  return hits;
}

function fileWasExecuted(scripts: CovScript[], fileName: string): boolean {
  return executedFunctionsForFile(scripts, fileName).length > 0;
}

function fnExecuted(scripts: CovScript[], fileName: string, fnPart: string): boolean {
  return executedFunctionsForFile(scripts, fileName).some(
    (h) => h.name === fnPart || h.name.endsWith(`.${fnPart}`) || h.name.includes(fnPart),
  );
}

async function regenerateTenant(slug: string) {
  const ctx = buildContentGenerationContext(slug, SERVICE_ID);
  const pkg = await generateContentPackage(slug, SERVICE_ID, { scope: "service-page-only" });
  const clusters = generateLocalLocationHierarchyPages(ctx);
  return { ctx, pkg, clusters };
}

async function main() {
  delete process.env.ALLOW_LEGACY_CONTENT_ENGINE;
  const covDir = process.env.NODE_V8_COVERAGE || "";
  if (covDir && fs.existsSync(covDir)) {
    for (const name of fs.readdirSync(covDir)) {
      try {
        fs.unlinkSync(path.join(covDir, name));
      } catch {
        /* ignore */
      }
    }
  }

  const upstream = upstreamExists(PRIMARY);
  const tenantArtifacts: Record<
    string,
    { serviceOk: boolean; clusterOk: boolean; clusterCount: number; servicePath: string; clusterPaths: string[] }
  > = {};

  const leeds = await regenerateTenant(PRIMARY);
  const leedsServicePath =
    leeds.pkg?.manifest?.assets?.find((a: { type?: string; outputPath?: string }) => a.type === "service-page")
      ?.outputPath ||
    path.join(
      PHARMACY_WORKSPACE_ROOT,
      "output/pharmacy-visual-experience/leeds-pharmacy/pharmacy-first/index.html",
    );
  tenantArtifacts[PRIMARY] = {
    serviceOk: Boolean(leedsServicePath && fs.existsSync(String(leedsServicePath))),
    clusterOk: Boolean(leeds.clusters.ok && leeds.clusters.clusterPaths.length > 0),
    clusterCount: leeds.clusters.clusterPaths.length,
    servicePath: String(leedsServicePath || ""),
    clusterPaths: leeds.clusters.clusterPaths,
  };

  for (const slug of TENANTS) {
    if (slug === PRIMARY) continue;
    const result = await regenerateTenant(slug);
    const servicePath =
      result.pkg?.manifest?.assets?.find((a: { type?: string; outputPath?: string }) => a.type === "service-page")
        ?.outputPath ||
      path.join(PHARMACY_WORKSPACE_ROOT, `output/pharmacy-visual-experience/${slug}/pharmacy-first/index.html`);
    tenantArtifacts[slug] = {
      serviceOk: Boolean(servicePath && fs.existsSync(String(servicePath))),
      clusterOk: Boolean(result.clusters.ok && result.clusters.clusterPaths.length > 0),
      clusterCount: result.clusters.clusterPaths.length,
      servicePath: String(servicePath || ""),
      clusterPaths: result.clusters.clusterPaths,
    };
  }

  // Force coverage flush by writing a marker; V8 writes on process exit.
  const markerPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/content-engine-v1-lock/cpr-platform-recovery-03-runtime-marker.json",
  );
  fs.mkdirSync(path.dirname(markerPath), { recursive: true });
  fs.writeFileSync(
    markerPath,
    JSON.stringify(
      {
        recovery: "CPR-PLATFORM-RECOVERY-03",
        generatedAt: new Date().toISOString(),
        tenants: TENANTS,
        tenantArtifacts,
        upstream,
        note: "Coverage JSON is finalized on process exit when NODE_V8_COVERAGE is set.",
      },
      null,
      2,
    ),
  );

  // Soft analyze coverage if already present (usually empty until exit). Content checks now.
  const pharmacyName = String(leeds.ctx.profile.pharmacyName || "Leeds Pharmacy");
  const clusterValidations = (leeds.clusters.clusterPaths || []).map((clusterPath) => {
    const html = fs.readFileSync(clusterPath, "utf8");
    const areaName = path.basename(path.dirname(clusterPath)).replace(/-/g, " ");
    return { path: clusterPath, areaName, ...validateClusterHtml(html, pharmacyName, areaName) };
  });

  const contentPass = clusterValidations.every(
    (v) =>
      v.checks.uniqueHeadings &&
      v.checks.noForbiddenPublic &&
      v.checks.locality &&
      v.checks.commercialCta &&
      v.checks.faq &&
      v.checks.nhsNotSpam &&
      v.structureSignals.hero &&
      v.structureSignals.whyPatients &&
      v.structureSignals.book,
  );
  const localityPass = clusterValidations.every(
    (v) => v.checks.locality && (v.checks.gp || v.checks.transport || v.checks.landmarks) && v.checks.neighbouring,
  );
  const publicTermsPass = clusterValidations.every((v) => v.checks.noForbiddenPublic);
  const regressionPass = TENANTS.every((slug) => tenantArtifacts[slug]?.serviceOk && tenantArtifacts[slug]?.clusterOk);

  const interim = {
    recovery: "CPR-PLATFORM-RECOVERY-03",
    generatedAt: new Date().toISOString(),
    primaryTenant: PRIMARY,
    upstream,
    tenantArtifacts,
    clusterValidations: clusterValidations.map((v) => ({
      path: v.path,
      areaName: v.areaName,
      checks: v.checks,
      structureSignals: v.structureSignals,
      headings: v.headings,
    })),
    contentPass,
    localityPass,
    publicTermsPass,
    regressionPass,
    coverageDir: covDir || null,
  };
  fs.writeFileSync(
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/content-engine-v1-lock/cpr-platform-recovery-03-interim.json"),
    JSON.stringify(interim, null, 2),
  );

  console.log("=== REGENERATION COMPLETE ===");
  for (const slug of TENANTS) {
    const t = tenantArtifacts[slug]!;
    console.log(`${slug}: service=${t.serviceOk} clusters=${t.clusterCount} clusterOk=${t.clusterOk}`);
  }
  console.log(`contentPass=${contentPass} localityPass=${localityPass} publicTermsPass=${publicTermsPass}`);
  for (const v of clusterValidations.slice(0, 4)) {
    console.log(`AREA ${v.areaName}`);
    console.log(`  headings: ${JSON.stringify(v.headings)}`);
    console.log(`  checks: ${JSON.stringify(v.checks)}`);
    console.log(`  structure: ${JSON.stringify(v.structureSignals)}`);
  }
  console.log("Coverage will be analyzed after process exit.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
