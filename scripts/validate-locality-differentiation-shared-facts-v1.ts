/**
 * Locality differentiation must ignore canonical pharmacy facts and still
 * reject locality pages whose local prose is the same.
 * Generic cases do not call a model. The Gilbert preflight reuses the
 * production compose/render/validation path in memory and does not write pages.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const { buildContentGenerationContext } = require("../src/pharmacy/contentEngine/buildContentGenerationContext.ts");
const { attributableEntities, loadLocalEvidencePackForGeneration } = require("../src/pharmacy/contentEngine/pharmacyLocalEvidencePackContractV1.ts");
const {
  localityIntroductionsAreDistinct,
  evaluateLocalityPatientCopyQualityGate,
} = require("../src/pharmacy/contentEngine/pharmacyLocalityPatientCopyQualityGateV1.ts");
const {
  evaluateLocalityHtmlContentContract,
  localityPagesAreTokenOnlyCopies,
} = require("../src/pharmacy/contentEngine/pharmacyLocalityContentContractGateV1.ts");
const { pageConsumesRequiredVerifiedLocalEvidence } = require("../src/pharmacy/contentEngine/pharmacyVerifiedLocalEvidenceConsumptionContract.ts");
const { beginLocalityVariationSessionV1, endLocalityVariationSessionV1 } = require("../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts");
const { bindCurrentRegisteredApprovedBank } = require("../src/pharmacy/pharmacyApprovedBankRunProvenance.ts");
const { resolveLocalLocationHierarchy } = require("../src/pharmacy/pharmacyLocalAreaResolver.ts");
const { resolveClusterPageSlug } = require("../src/pharmacy/pharmacyClusterPageUrlResolver.ts");
const { canonicalClusterNarrativeRequest } = require("../src/pharmacy/pharmacyLocalHubClusterContentEngine.ts");
const { composeCommercialClusterNarrativeV1 } = require("../src/pharmacy/pharmacyLocalClusterContentEngine.ts");
const { renderLocalLocationClusterFullPage } = require("../src/pharmacy/pharmacyLocalHierarchyFullPageRenderer.ts");
const { evaluateLocalityHtmlDuplicationGate } = require("../src/pharmacy/pharmacyLocalityPageDuplicationGateV1.ts");

type LocalitySharedCanonicalFacts = {
  pharmacyName?: string;
  pharmacyAddress?: string;
  pharmacyPhone?: string;
  entityNames?: string[];
  sharedCopy?: string[];
};

const pharmacyName = "Northbridge Pharmacy";
const address = "12 Market Street, Northbridge, NB1 2CD";
const phone = "0121 496 0180";
const service =
  "The approved check records a blood pressure reading and explains what the patient should bring to the pharmacy.";
const cta = `Contact ${pharmacyName} on ${phone} to ask how the check is arranged.`;
const facts: LocalitySharedCanonicalFacts = {
  pharmacyName,
  pharmacyAddress: address,
  pharmacyPhone: phone,
  entityNames: ["Riverside Hall", "Market Cross Surgery"],
  sharedCopy: [service, cta],
};

const localA =
  "People who use Riverside Hall can arrange a check before they walk up the hill to their usual healthcare setting.";
const localB =
  "People who use Market Cross Surgery often come in after a morning at the weekly market beside the old stone bridge.";
const sameLocal =
  "People who use Riverside Hall can arrange a check before they walk up the hill to their usual healthcare setting.";

function page(area: string, intro: string, accessLead: string, heading = `Checks for patients from ${area}`): string {
  return `<section data-template-block="hero" class="hero"><h1>${heading}</h1><p>${intro}</p></section>
<section id="local-access"><div class="section-head"><h2>The pharmacy address for patients from ${area}</h2><p class="local-intro-lead">${accessLead}</p></div>
<div class="local-safety-note"><p>If this service is not suitable for you, contact the pharmacy for guidance on what to do next.</p></div>
<div class="pharmacy-local-details local-access-details"><h3>${pharmacyName}</h3><ul>
<li><strong>Address:</strong> ${address}</li><li><strong>Phone:</strong> ${phone}</li></ul></div>
<p>${service}</p><p data-locality-cta>${cta}</p></section>`;
}

const access = `${pharmacyName} is at ${address}.`;
const steps: Array<{ name: string; passed: boolean; detail?: string }> = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const alder = page("Alderton", `${localA} ${service}`, access);
const beck = page("Beckford", `${localB} ${service}`, access);
check("1 same pharmacy address", localityIntroductionsAreDistinct(alder, beck, "Alderton", "Beckford", facts));
check("2 same pharmacy telephone", localityIntroductionsAreDistinct(alder, beck, "Alderton", "Beckford", facts));
check("3 same approved service explanation", localityIntroductionsAreDistinct(alder, beck, "Alderton", "Beckford", facts));
check("4 same canonical CTA", localityIntroductionsAreDistinct(alder, beck, "Alderton", "Beckford", facts));
check("5 shared facts plus different locality prose", localityIntroductionsAreDistinct(alder, beck, "Alderton", "Beckford", facts));

const namedA = page("Alderton", sameLocal.replaceAll("Riverside Hall", "Alderton"), access);
const namedB = page("Beckford", sameLocal.replaceAll("Riverside Hall", "Beckford"), access);
check(
  "6 identical prose with locality names changed",
  !localityIntroductionsAreDistinct(namedA, namedB, "Alderton", "Beckford", facts),
);

const entityA = page("Alderton", sameLocal, access);
const entityB = page("Beckford", sameLocal.replaceAll("Riverside Hall", "Market Cross Surgery"), access);
check(
  "7 identical prose with entity names changed",
  !localityIntroductionsAreDistinct(entityA, entityB, "Alderton", "Beckford", facts),
);

const sharedA = page("Alderton", sameLocal, access);
const sharedB = page("Beckford", sameLocal, access);
check(
  "8 identical prose plus shared pharmacy address",
  !localityIntroductionsAreDistinct(sharedA, sharedB, "Alderton", "Beckford", facts),
);

const tokenBase =
  "People who live beside the community hall can arrange a blood pressure check before they visit their usual healthcare setting in the town.";
const tokenEdit = tokenBase.replace("hall", "centre");
check(
  "9 token wording around the same local paragraph",
  !localityIntroductionsAreDistinct(
    page("Alderton", tokenBase, access),
    page("Beckford", tokenEdit, access),
    "Alderton",
    "Beckford",
    facts,
  ),
);

check(
  "10 different headings over identical local body",
  !localityIntroductionsAreDistinct(
    page("Alderton", sameLocal, access, "Morning checks in Alderton"),
    page("Beckford", sameLocal, access, "Afternoon checks in Beckford"),
    "Alderton",
    "Beckford",
    facts,
  ),
);

const onlyFactsA = page("Alderton", service, `${pharmacyName} is at ${address}.`);
const onlyFactsB = page("Beckford", service, `${pharmacyName} is at 80 Other Road, Beckford, BF2 9ZZ.`);
check(
  "11 shared canonical facts do not count as differentiation",
  !localityIntroductionsAreDistinct(onlyFactsA, onlyFactsB, "Alderton", "Beckford", {
    ...facts,
    pharmacyAddress: `${address}\n80 Other Road, Beckford, BF2 9ZZ`,
  }),
);

const buriedA = page("Alderton", `${pharmacyName} is at ${address}. ${sameLocal}`, access);
const buriedB = page("Beckford", `${pharmacyName} is at ${address}. ${sameLocal}`, access);
check(
  "12 identical local copy after canonical facts are removed",
  !localityIntroductionsAreDistinct(buriedA, buriedB, "Alderton", "Beckford", facts),
);

const localAccessA = page("Alderton", localA, `${access} Patients pass the riverside path.`);
const localAccessB = page("Beckford", localA, `${access} Patients pass the market cross.`);
check(
  "locality-specific access still differentiates",
  localityIntroductionsAreDistinct(localAccessA, localAccessB, "Alderton", "Beckford", facts),
);
const sameLocalAccessA = page("Alderton", localA, `${access} Patients pass the riverside path.`);
const sameLocalAccessB = page("Beckford", localB, `${access} Patients pass the riverside path.`);
check(
  "identical locality-specific access does not erase different local prose",
  localityIntroductionsAreDistinct(sameLocalAccessA, sameLocalAccessB, "Alderton", "Beckford", facts),
);

const composer = readFileSync(resolve("src/pharmacy/pharmacyLocalClusterContentEngine.ts"), "utf8");
const synthesis = readFileSync(resolve("src/pharmacy/contentEngine/pharmacyCanonicalLocalSynthesisV1.ts"), "utf8");
const writer = readFileSync(resolve("src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts"), "utf8");
const intelligence = readFileSync(resolve("src/pharmacy/contentEngine/pharmacyLocalityIntelligenceV1.ts"), "utf8");
const renderer = readFileSync(resolve("src/pharmacy/pharmacyLocalClusterLocationPageRenderer.ts"), "utf8");
const routing = readFileSync(resolve("src/pharmacy/masterAdminProductOwnerGenerationControlService.ts"), "utf8");
check(
  "composer access sentence unchanged",
  composer.includes("accessBody: address ? `${pharmacyName} is at ${address}.` : \"\""),
);
check("composer does not classify differentiation", !composer.includes("localitySpecificComparisonText"));
check("gemini synthesis unchanged surface", synthesis.includes("requestUkLocalIntroductionProseV1") && !synthesis.includes("localityIntroductionsAreDistinct"));
check("prose writer has no differentiation gate", !writer.includes("localityIntroductionsAreDistinct"));
check("locality intelligence has no differentiation gate", !intelligence.includes("localityIntroductionsAreDistinct"));
check("renderer has no differentiation gate", !renderer.includes("localityIntroductionsAreDistinct"));
check("product owner routing has no differentiation gate", !routing.includes("localitySpecificComparisonText"));

const genericFailed = steps.filter((step) => !step.passed);
if (genericFailed.length || process.argv.includes("--generic-only")) {
  for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
  console.log(genericFailed.length ? `GENERIC FAIL ${genericFailed.length}/${steps.length}` : `GENERIC PASS ${steps.length}/${steps.length}`);
  process.exit(genericFailed.length ? 1 : 0);
}

const root = resolve(".");
const slug = "gilbert-pharmacy-health-clinic";
const serviceId = "blood-pressure-checks";
const areas = ["paisley", "barrhead", "elderslie", "renfrew", "linwood", "glasgow"];
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

const evidenceLanguage =
  /\b(verified healthcare location|verified community location|verified local place|verified transport location|verified evidence|evidence sufficiency|this page does not estimate|provided at the pharmacy|not at|haversine|provenance|journey time|driving route)\b/i;
const mechanicalNarration =
  /\b(verified healthcare location|verified community location|verified local place|this page does not estimate|provided at the pharmacy, not at|does not estimate)\b/i;

type LocalResult = {
  area: string;
  slug: string;
  grounding: string;
  unsupported: string;
  provenance: string;
  evidenceLanguage: string;
  mechanical: string;
  limited: string;
  detail: string;
  html: string;
  entityNames: string[];
};

const draftCacheDir = "/tmp/pc-locality-diff-preflight";
mkdirSync(draftCacheDir, { recursive: true });
const results: LocalResult[] = [];
beginLocalityVariationSessionV1(areas);
try {
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    if (!areas.includes(pageSlug)) continue;
    const only = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length);
    if (only && pageSlug !== only) continue;
    const request = canonicalClusterNarrativeRequest(ctx, hierarchy, { ...cluster, slug: pageSlug });
    const packLoaded = loadLocalEvidencePackForGeneration(ctx.resolvedSlug, cluster.name, pageSlug);
    const entityNames = packLoaded.ok ? attributableEntities(packLoaded.pack).map((entity) => entity.name) : [];
    const cachePath = `${draftCacheDir}/${pageSlug}.json`;
    if (!process.argv.includes("--fresh") && existsSync(cachePath)) {
      results.push(JSON.parse(readFileSync(cachePath, "utf8")) as LocalResult);
      continue;
    }
    try {
      const content = await composeCommercialClusterNarrativeV1(request.input, request.ctx);
      const html = renderLocalLocationClusterFullPage(ctx, hierarchy, { ...cluster, slug: pageSlug });
      const copyGate = evaluateLocalityPatientCopyQualityGate({
        html,
        areaName: cluster.name,
        pharmacyName: ctx.profile.pharmacyName,
        distanceLabel: cluster.distanceLabel || "",
        verifiedEvidenceNames: entityNames,
      });
      const contract = evaluateLocalityHtmlContentContract({
        html,
        areaName: cluster.name,
        serviceName: ctx.serviceName,
        pharmacyName: ctx.profile.pharmacyName,
        entityNames,
      });
      const evidenceFacts = packLoaded.ok
        ? attributableEntities(packLoaded.pack).map((entity) => ({
            name: entity.name,
            category: entity.category,
            address: entity.address,
          }))
        : [];
      const consumed = pageConsumesRequiredVerifiedLocalEvidence(html, evidenceFacts);
      const local = `${content.heroIntro}\n${content.localRelevanceBody}`;
      const provenance = content.sectionEvidence?.["local-introduction"] || [];
      results.push({
        area: cluster.name,
        slug: pageSlug,
        grounding: "PASS",
        unsupported: copyGate.ok ? "PASS" : `FAIL ${copyGate.failures.join("; ")}`,
        provenance: provenance.length > 0 ? "YES" : "NO",
        evidenceLanguage: evidenceLanguage.test(local) || evidenceLanguage.test(html) ? "PRESENT" : "ABSENT",
        mechanical: mechanicalNarration.test(local) || mechanicalNarration.test(html) ? "PRESENT" : "ABSENT",
        limited: content.evidenceLimited ? "LIMITED" : "SUFFICIENT",
        detail: `contract=${contract.ok ? "PASS" : contract.failures.join("; ")} consumed=${consumed ? "YES" : "NO"} provenance=${provenance.join(" | ")}`,
        html,
        entityNames,
      });
      writeFileSync(cachePath, JSON.stringify(results.at(-1)));
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      results.push({
        area: cluster.name,
        slug: pageSlug,
        grounding: message.toLowerCase().includes("ground") || message.toLowerCase().includes("evidence") ? "FAIL" : "FAIL",
        unsupported: "FAIL",
        provenance: "NO",
        evidenceLanguage: "UNKNOWN",
        mechanical: "UNKNOWN",
        limited: "UNKNOWN",
        detail: message,
        html: "",
        entityNames,
      });
    }
  }
} finally {
  endLocalityVariationSessionV1();
}

const gilbertFacts: LocalitySharedCanonicalFacts = {
  pharmacyName: ctx.profile.pharmacyName,
  pharmacyAddress: ctx.profile.customerFacingAddress || ctx.profile.fullAddress || "",
  pharmacyPhone: ctx.profile.phone || ctx.profile.displayPhone || "",
};
const pairs: string[] = [];
for (let i = 0; i < results.length; i++) {
  for (let j = i + 1; j < results.length; j++) {
    const a = results[i]!;
    const b = results[j]!;
    if (!a.html || !b.html) {
      pairs.push(`FAIL ${a.slug}/${b.slug} missing render`);
      continue;
    }
    const distinct = localityIntroductionsAreDistinct(a.html, b.html, a.area, b.area, {
      ...gilbertFacts,
      entityNames: [...a.entityNames, ...b.entityNames],
    });
    pairs.push(`${distinct ? "PASS" : "FAIL"} ${a.slug}/${b.slug}`);
  }
}
const tokenOnly = localityPagesAreTokenOnlyCopies(
  results.map((row) => ({ areaName: row.area, localBody: row.html, entityNames: row.entityNames })),
);
const duplication = evaluateLocalityHtmlDuplicationGate({
  pages: results.filter((row) => row.html).map((row) => ({ areaSlug: row.slug, areaName: row.area, html: row.html })),
  pharmacyName: ctx.profile.pharmacyName,
});
const after = protectedPaths.map((path) => `${path}:${sha(path)}`).join("\n");
check("Gilbert pages and jobs were not written", before === after);
check("six locality drafts validated in memory", results.length === 6, results.map((row) => row.slug).join(", "));
check("all 15 locality pairs distinct", pairs.every((pair) => pair.startsWith("PASS")), pairs.join(" | "));
check("token-only gate", tokenOnly.length === 0, tokenOnly.join(" | "));
check("duplication gate", duplication.ok, duplication.pairs.filter((pair) => pair.blocked).map((pair) => pair.reason).join(" | "));
for (const row of results) {
  check(`${row.area} grounding`, row.grounding === "PASS", row.detail);
  check(`${row.area} unsupported claims`, row.unsupported === "PASS", row.unsupported);
  check(`${row.area} provenance`, row.provenance === "YES", row.detail);
  check(`${row.area} evidence-system language absent`, row.evidenceLanguage === "ABSENT", row.evidenceLanguage);
  check(`${row.area} mechanical narration absent`, row.mechanical === "ABSENT", row.mechanical);
}
const elderslie = results.find((row) => row.slug === "elderslie");
check("Elderslie limited evidence", elderslie?.limited === "LIMITED", elderslie?.limited);

console.log(JSON.stringify({ pairs, localities: results.map(({ html: _html, ...row }) => row), duplication: duplication.message }, null, 2));
const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
if (failed.length) process.exit(1);
