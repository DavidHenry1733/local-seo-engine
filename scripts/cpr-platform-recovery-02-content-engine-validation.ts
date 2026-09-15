/**
 * CPR-PLATFORM-RECOVERY-02 — Content Engine recovery regression.
 * Regenerates Pharmacy First clusters for five commercial tenants and validates locks.
 */
import fs from "node:fs";
import path from "node:path";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import {
  CONTENT_ENGINE_V1,
  CONTENT_ENGINE_V1_STATUS,
  NARRATIVE_ENGINE_V1_STATUS,
  RENDERER_V1_STATUS,
} from "../src/pharmacy/contentEngine/pharmacyContentEngineV1.ts";
import { resolveCommercialSectionPlanV1 } from "../src/pharmacy/contentEngine/pharmacyCommercialSectionPlannerV1.ts";
import { generateLocalLocationHierarchyPages } from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { buildVisualExperiencePage } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const TENANTS = [
  "leeds-pharmacy",
  "reliable-direct-pharmacy",
  "brook-pharmacy",
  "welfare-pharmacy",
  "banner-cross-pharmacy",
] as const;

const SERVICE_ID = "pharmacy-first";

const FORBIDDEN_PUBLIC = [
  /\blocation[- ]cluster\b/i,
  /\bcluster pages?\b/i,
  /\bhub pages?\b/i,
  /\binternal routing\b/i,
  /\binternal section IDs?\b/i,
  /\btemplate names?\b/i,
];

type Check = { name: string; pass: boolean; detail: string };

function textFromHtml(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function validateClusterHtml(html: string, areaLabel: string): Check[] {
  const text = textFromHtml(html);
  const checks: Check[] = [];
  checks.push({
    name: `${areaLabel}:has-content`,
    pass: text.split(/\s+/).filter(Boolean).length >= 180,
    detail: `words=${text.split(/\s+/).filter(Boolean).length}`,
  });
  for (const pattern of FORBIDDEN_PUBLIC) {
    const hit = pattern.test(text);
    checks.push({
      name: `${areaLabel}:no-${pattern.source}`,
      pass: !hit,
      detail: hit ? "forbidden term present" : "clean",
    });
  }
  const h2s = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) =>
    m[1]!.replace(/<[^>]+>/g, "").trim().toLowerCase(),
  );
  const uniqueH2 = new Set(h2s);
  checks.push({
    name: `${areaLabel}:unique-headings`,
    pass: uniqueH2.size === h2s.length,
    detail: `h2=${h2s.length} unique=${uniqueH2.size}`,
  });
  checks.push({
    name: `${areaLabel}:local-reference`,
    pass: /GP|surgery|park|school|travel|road|station|nearby|neighbour|community|patients in/i.test(text),
    detail: "locality signals",
  });
  checks.push({
    name: `${areaLabel}:cta-present`,
    pass: /call|book|speak|enquire|contact/i.test(text),
    detail: "commercial CTA",
  });
  checks.push({
    name: `${areaLabel}:schema-or-faq`,
    pass: /application\/ld\+json/i.test(html) || /faq/i.test(html),
    detail: "schema/faq",
  });
  return checks;
}

async function regenerateTenant(slug: string): Promise<Check[]> {
  const checks: Check[] = [];
  let ctx;
  try {
    ctx = buildContentGenerationContext(slug, SERVICE_ID);
  } catch (err) {
    return [{ name: `${slug}:context`, pass: false, detail: String(err) }];
  }

  try {
    const visual = buildVisualExperiencePage(slug, SERVICE_ID);
    const out = String(visual?.outputPath || "");
    const visualOk = Boolean(out && fs.existsSync(out));
    checks.push({
      name: `${slug}:service-page`,
      pass: visualOk,
      detail: visualOk ? out : "visual page missing",
    });
  } catch (err) {
    checks.push({ name: `${slug}:service-page`, pass: false, detail: String(err) });
  }

  try {
    const result = generateLocalLocationHierarchyPages(ctx);
    checks.push({
      name: `${slug}:cluster-generation`,
      pass: result.ok && result.clusterPaths.length > 0,
      detail: result.ok
        ? `clusters=${result.clusterPaths.length}`
        : result.blockedReason || "failed",
    });

    for (const clusterPath of result.clusterPaths.slice(0, 4)) {
      const html = fs.readFileSync(clusterPath, "utf8");
      const label = `${slug}:${path.basename(path.dirname(clusterPath))}`;
      checks.push(...validateClusterHtml(html, label));
    }
  } catch (err) {
    checks.push({ name: `${slug}:cluster-generation`, pass: false, detail: String(err) });
  }
  return checks;
}

function architectureChecks(): Check[] {
  const servicePlan = resolveCommercialSectionPlanV1("service");
  const clusterPlan = resolveCommercialSectionPlanV1("cluster");
  return [
    {
      name: "content-engine-locked",
      pass: CONTENT_ENGINE_V1_STATUS === "LOCKED" && CONTENT_ENGINE_V1.status === "LOCKED",
      detail: CONTENT_ENGINE_V1_STATUS,
    },
    {
      name: "narrative-engine-locked",
      pass: NARRATIVE_ENGINE_V1_STATUS === "LOCKED",
      detail: NARRATIVE_ENGINE_V1_STATUS,
    },
    {
      name: "renderer-locked",
      pass: RENDERER_V1_STATUS === "LOCKED",
      detail: RENDERER_V1_STATUS,
    },
    {
      name: "single-section-planner",
      pass: servicePlan.length > 0 && clusterPlan.length > 0,
      detail: `service=${servicePlan.length} cluster=${clusterPlan.length}`,
    },
    {
      name: "legacy-package-call-removed",
      pass: !/import\s*\{[^}]*generatePharmacyServiceAreaPages|await\s+generatePharmacyServiceAreaPages\s*\(/.test(
        fs.readFileSync(
          path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/pharmacyContentPackageService.ts"),
          "utf8",
        ),
      ),
      detail: "package service",
    },
    {
      name: "lock-docs-present",
      pass: ["CONTENT-ENGINE-V1-LOCK.md", "NARRATIVE-ENGINE-V1-LOCK.md", "RENDERER-V1-LOCK.md"].every((f) =>
        fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, "docs/platform", f)),
      ),
      detail: "docs/platform",
    },
  ];
}

async function main() {
  const all: Check[] = [...architectureChecks()];
  for (const slug of TENANTS) {
    console.log(`\n=== Regenerating ${slug} ===`);
    all.push(...(await regenerateTenant(slug)));
  }

  const failed = all.filter((c) => !c.pass);
  for (const check of all) {
    console.log(`${check.pass ? "PASS" : "FAIL"} | ${check.name} | ${check.detail}`);
  }

  const report = {
    ok: failed.length === 0,
    total: all.length,
    failed: failed.length,
    tenants: TENANTS,
    recovery: "CPR-PLATFORM-RECOVERY-02",
    generatedAt: new Date().toISOString(),
    failures: failed,
  };
  const outDir = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/content-engine-v1-lock");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "cpr-platform-recovery-02-report.json"), JSON.stringify(report, null, 2));
  console.log(`\nReport: ${path.join(outDir, "cpr-platform-recovery-02-report.json")}`);
  console.log(failed.length === 0 ? "REGRESSION SUITE: PASS" : "REGRESSION SUITE: FAIL");
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
