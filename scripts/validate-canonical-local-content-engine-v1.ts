/**
 * Canonical Local Content Engine lock.
 * Static architecture checks do not call a model.
 * The Gilbert preflight calls the existing Gemini writer in memory and does not write locality pages.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { beginLocalityVariationSessionV1, endLocalityVariationSessionV1 } from "../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts";
import { bindCurrentRegisteredApprovedBank } from "../src/pharmacy/pharmacyApprovedBankRunProvenance.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { resolveClusterPageSlug } from "../src/pharmacy/pharmacyClusterPageUrlResolver.ts";
import {
  composeCommercialClusterNarrativeV1,
} from "../src/pharmacy/pharmacyLocalClusterContentEngine.ts";
import { canonicalClusterNarrativeRequest } from "../src/pharmacy/pharmacyLocalHubClusterContentEngine.ts";
import { renderLocalLocationClusterFullPage } from "../src/pharmacy/pharmacyLocalHierarchyFullPageRenderer.ts";

const root = resolve(".");
const slug = "gilbert-pharmacy-health-clinic";
const serviceId = "blood-pressure-checks";
const areas = ["paisley", "barrhead", "elderslie", "renfrew", "linwood", "glasgow"];

const steps: Array<{ name: string; passed: boolean; detail?: string }> = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function functionBody(file: string, name: string): string {
  const text = source(file);
  const start = text.indexOf(`function ${name}`);
  const asyncStart = text.indexOf(`async function ${name}`);
  const at = start === -1 ? asyncStart : asyncStart === -1 ? start : Math.min(start, asyncStart);
  if (at < 0) return "";
  const brace = text.indexOf("{", at);
  let depth = 0;
  for (let i = brace; i < text.length; i++) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(at, i + 1);
    }
  }
  return "";
}

const composer = functionBody("src/pharmacy/pharmacyLocalClusterContentEngine.ts", "composeCommercialClusterNarrativeV1");
const generation = functionBody("src/pharmacy/pharmacyLocalLocationGenerationService.ts", "generateLocalLocationHierarchyPages");
const job = source("src/pharmacy/masterAdminLocalClusterJobService.ts");
const approvedBank = source("src/pharmacy/pharmacyApprovedBankLocalityDirectRender.ts");
const renderer = source("src/pharmacy/pharmacyLocalClusterLocationPageRenderer.ts");
const patientCopy = source("src/pharmacy/contentEngine/pharmacyLocalPatientCopyV1.ts");
const synthesis = source("src/pharmacy/contentEngine/pharmacyCanonicalLocalSynthesisV1.ts");
const gate = source("src/pharmacy/contentEngine/pharmacyLocalityContentContractGateV1.ts");

check("composer exists", composer.includes("synthesiseCanonicalGroundedLocalCopyV1"));
check("composer has no approved-bank early return", !composer.includes("composeApprovedBankLocalityDirectDraft") && !composer.includes("isApprovedBankRegisteredService"));
check("composer has no Pharmacy First bypass", !composer.includes("buildPharmacyFirstLocalNarrative"));
check("composer has no slot writer", !composer.includes("buildUniqueLocalityNarrative"));
check("composer has no Local Patient Copy writer", !composer.includes("synthesiseLocalPatientCopyV1"));
check("registered and unregistered services share the composer", composer.includes("serviceSectionsForCanonicalNarrative") && composer.includes("synthesiseCanonicalGroundedLocalCopyV1"));
check("generation calls the canonical composer", source("src/pharmacy/pharmacyLocalLocationGenerationService.ts").includes("await composeCommercialClusterNarrativeV1"));
check("generation has no second locality writer", !generation.includes("synthesiseLocalPatientCopyV1") && !generation.includes("buildUniqueLocalityNarrative") && !generation.includes("generateClusterContent"));
check("job calls the canonical generation path", job.includes("composeCommercialClusterNarrativeV1") && job.includes("generateLocalLocationHierarchyPages"));
check("job cannot call the legacy OpenAI generator", !job.includes("generateClusterContent") && !job.includes("getOpenAiIntegrationClient"));
check("approved-bank draft refuses to write locality prose", approvedBank.includes("cannot write locality prose") && !approvedBank.includes("synthesiseLocalPatientCopyV1"));
check("renderer does not import a locality writer", !renderer.includes("synthesiseLocalPatientCopyV1") && !renderer.includes("buildUniqueLocalityNarrative") && !renderer.includes("requestUkLocalIntroductionProseV1") && !renderer.includes("buildPharmacyFirstLocalNarrative"));
check("gate does not synthesise patient prose", !gate.includes("synthesiseLocalPatientCopyV1") && !gate.includes("requestUkLocalIntroductionProseV1"));
check("Local Patient Copy V1 is classified superseded", patientCopy.includes("SUPERSEDED"));
check("Gemini synthesis is the existing writer", synthesis.includes("requestUkLocalIntroductionProseV1") && synthesis.includes("validateAiLocalCopyPilotV3"));
check("synthesis adapter is not a new model client", !synthesis.includes("generativelanguage.googleapis.com"));

function sha(path: string): string {
  return createHash("sha256").update(readFileSync(resolve(root, path))).digest("hex");
}

const protectedPaths = [
  ...areas.map((area) => `output/pharmacy-content-ecosystem/${slug}/${serviceId}/local/${area}/index.html`),
  "data/pharmacy-master-admin/jobs.json",
];
const before = protectedPaths.map((path) => `${path}:${sha(path)}`).join("\n");

const ctx = bindCurrentRegisteredApprovedBank(buildContentGenerationContext(slug, serviceId));
let hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
if (ctx.selectedAreas?.length) {
  const existingByName = new Map((hierarchy.clusters || []).map((cluster) => [cluster.name.trim().toLowerCase(), cluster]));
  const clusters = ctx.selectedAreas.map((area, index) => {
    const existing = existingByName.get(area.areaName.trim().toLowerCase());
    if (existing) return { ...existing, order: index + 1, priority: index + 1 };
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
      order: index + 1,
      priority: index + 1,
    };
  });
  hierarchy = { ...hierarchy, ok: true, clusters, generationAreas: clusters };
}

const wanted = new Set(areas);
const results: Array<Record<string, string>> = [];
beginLocalityVariationSessionV1(areas);
try {
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    if (!wanted.has(pageSlug)) continue;
    const request = canonicalClusterNarrativeRequest(ctx, hierarchy, { ...cluster, slug: pageSlug });
    try {
      const content = await composeCommercialClusterNarrativeV1(request.input, request.ctx);
      let rendered = "";
      try {
        rendered = renderLocalLocationClusterFullPage(ctx, hierarchy, { ...cluster, slug: pageSlug });
      } catch (error) {
        rendered = `RENDER-ERROR ${error instanceof Error ? error.message : String(error)}`;
      }
      const local = `${content.heroIntro}\n${content.localRelevanceBody}`;
      results.push({
        area: cluster.name,
        slug: pageSlug,
        narrativeType: content.narrativeType,
        limited: String(Boolean(content.evidenceLimited)),
        provenance: (content.sectionEvidence?.["local-introduction"] || []).join(" || "),
        excerpt: content.heroIntro.slice(0, 280),
        localExcerpt: content.localRelevanceBody.slice(0, 360),
        evidenceLanguage: /\b(verified healthcare location|verified community location|verified local place|verified evidence|this page does not estimate|provided at the pharmacy, not at)\b/i.test(local) ? "yes" : "no",
        distance: /\b\d+(?:\.\d+)?\s*km\b|kilometres|journey time/i.test(local) ? "yes" : "no",
        fingerprint: content.contentFingerprint,
        renderHasNext: rendered.includes("data-locality-cta") ? "yes" : "no",
      });
      check(`${cluster.name} canonical synthesis`, content.narrativeType.includes("requestUkLocalIntroductionProseV1"));
      check(`${cluster.name} no evidence-system language`, results.at(-1)?.evidenceLanguage === "no");
      check(`${cluster.name} no unsupported distance`, results.at(-1)?.distance === "no");
      check(`${cluster.name} provenance retained`, (content.sectionEvidence?.["local-introduction"] || []).length > 0 || Boolean(content.evidenceLimited));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ area: cluster.name, slug: pageSlug, error: message });
      check(`${cluster.name} canonical synthesis`, false, message);
    }
  }
} finally {
  endLocalityVariationSessionV1();
}

const fingerprints = results.map((row) => row.fingerprint).filter(Boolean);
check("six localities were exercised", results.length === 6, results.map((row) => row.slug || row.area).join(", "));
check(
  "material differentiation",
  new Set(fingerprints).size === fingerprints.length && fingerprints.length === 6,
  `${new Set(fingerprints).size} distinct fingerprints`,
);
const after = protectedPaths.map((path) => `${path}:${sha(path)}`).join("\n");
check("Gilbert locality pages and jobs were not written", before === after);

console.log(JSON.stringify(results, null, 2));
const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
if (failed.length) process.exit(1);
