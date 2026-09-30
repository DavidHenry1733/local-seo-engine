/**
 * Local service introduction contract.
 * Static checks and fixture checks do not call a model.
 * Pass --live to generate six in-memory Gilbert introductions through the
 * existing composer. That mode does not write production pages.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { evaluateAcceptedGeminiLocalCopyV1 } from "../src/pharmacy/contentEngine/pharmacyGroundedGeminiLocalCopyValidationV1.ts";

const root = resolve(".");
const live = process.argv.includes("--live");
const steps: Array<{ name: string; passed: boolean; detail?: string }> = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const writer = readFileSync(resolve(root, "src/pharmacy/contentEngine/pharmacyUkLocalIntroductionProseWriterV1.ts"), "utf8");
const synthesis = readFileSync(resolve(root, "src/pharmacy/contentEngine/pharmacyCanonicalLocalSynthesisV1.ts"), "utf8");
const composer = readFileSync(resolve(root, "src/pharmacy/pharmacyLocalClusterContentEngine.ts"), "utf8");

check("weave-places instruction removed", !writer.includes("Weave verified local healthcare context first"));
check("zero place mentions is valid", writer.includes("Zero place mentions is valid"));
check("writer is still the Gemini prose writer", writer.includes("export async function requestUkLocalIntroductionProseV1"));
check("no second model client in synthesis", !synthesis.includes("generativelanguage.googleapis.com"));
check("synthesis still calls the existing writer", synthesis.includes("requestUkLocalIntroductionProseV1"));
check("composer still owns production synthesis", composer.includes("synthesiseCanonicalGroundedLocalCopyV1"));

check("contract does not require entity consumption", /never required to mention/i.test(writer) && !/Weave verified local healthcare context first/.test(writer));
check("supplied places are labelled optional", writer.includes("Naming none of these is correct"));
check("prompt does not tell the model to weave healthcare places", !/Weave verified local healthcare/.test(writer));

check("introduction is two short paragraphs", /about 80–130 words in two short paragraphs/.test(writer));
check("second paragraph must not restart the opening", /Do not start this paragraph by naming/.test(writer));

function words(count: number, label: string): string {
  return Array.from({ length: count }, (_, index) => `${label}${index}`).join(" ");
}

function fixture(localSentence: string, entityName = "Riverside Monument") {
  const hero =
    "If you live in Alderton and want to keep an eye on your blood pressure, Northbridge Pharmacy provides Blood Pressure Checks with a clear explanation of your reading and what it may mean. High blood pressure often has no obvious symptoms, so a check can show whether further action may be appropriate.";
  const local = `${localSentence} ${words(4, "next")}`.trim();
  return {
    copy: { heroIntroduction: hero, localIntroduction: local, area: "Alderton", editorialFactIdsUsed: [] },
    input: {
      tenantSlug: "northbridge-pharmacy",
      business: { name: "Northbridge Pharmacy", telephone: "", website: "", address: "", coordinates: null, marketTown: "" },
      offer: {
        serviceName: "Blood Pressure Checks",
        serviceId: "blood-pressure-checks",
        lockedClinicalFacts: {
          serviceName: "Blood Pressure Checks",
          serviceId: "blood-pressure-checks",
          conditionSet: "Blood pressure is recorded as systolic over diastolic (mmHg).",
          suitability: "Individual assessment confirms whether a pharmacy check is appropriate.",
          process: "A routine check covers measurement and a plain-language discussion.",
          safety: "One reading does not diagnose hypertension.",
          allowedCta: ["Contact the pharmacy"],
        },
        allowedCta: ["Contact the pharmacy"],
      },
      locality: {
        areaName: "Alderton",
        areaSlug: "alderton",
        distanceLabel: "",
        distanceKm: null,
        cardinalDirection: "",
        pharmacyIsInArea: false,
        neighbouringSelectedAreas: [],
        evidenceLimitations: [],
        acceptedEntities: [
          {
            entityId: "landmark-1",
            name: entityName,
            category: "landmarks",
            address: "1 Chapel Lane",
            coordinates: null,
            attributionRelationship: "name-in-address",
            provider: "fixture",
          },
        ],
      },
    },
  };
}

function grounding(localSentence: string): string[] {
  const built = fixture(localSentence);
  return evaluateAcceptedGeminiLocalCopyV1({
    copy: built.copy,
    input: built.input,
    grounding: null,
    expectedSlug: "northbridge-pharmacy",
    expectedServiceId: "blood-pressure-checks",
    expectedAreaName: "Alderton",
  }).failures;
}

const zeroEntity = grounding(
  "The pharmacy team will take your reading, explain the result in straightforward language and advise you about sensible next steps where necessary.",
);
check("zero entity mentions still passes grounding", zeroEntity.length === 0, zeroEntity.join("; "));
check(
  "a restarted second paragraph fails",
  grounding("Northbridge Pharmacy offers Blood Pressure Checks for people in Alderton with the same opening repeated.").some((row) =>
    row.startsWith("local introduction restarts"),
  ),
);
check(
  "downstream safety padding fails",
  grounding("Chest pain or a severe headache needs urgent care, and a check does not diagnose hypertension on the spot.").some((row) =>
    row === "downstream safety padding",
  ),
);

const approvedClinical = grounding("Blood pressure is recorded as systolic over diastolic (mmHg).");
check("approved clinical wording still passes", !approvedClinical.some((row) => /recorded as|banned legacy|source-listing/i.test(row)), approvedClinical.join("; "));

const listed = grounding("Riverside Monument is recorded as a landmark.");
check("evidence listing still fails", listed.some((row) => /source-listing|banned legacy/i.test(row)), listed.join("; ") || "no failure");

const FORCED_COPY = [
  /many local residents/i,
  /whether you are (?:visiting|running errands)/i,
  /whether residents are/i,
  /fits around everyday commitments/i,
  /it is important to note/i,
  /please note/i,
  /straightforward way/i,
  /accessible screening/i,
  /spending time (?:around|near)/i,
  /taking time out near/i,
  /works alongside/i,
  /alongside (?:local|primary care)/i,
  /evidence pack/i,
  /\bsource record/i,
  /\bprovenance\b/i,
  /reducing (?:the )?long-term risks?/i,
];

function editorialDefects(text: string, entityNames: string[]): string[] {
  const defects: string[] = [];
  for (const pattern of FORCED_COPY) {
    const hit = text.match(pattern);
    if (hit) defects.push(`forced wording: ${hit[0]}`);
  }
  for (const name of entityNames) {
    if (name && new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(text)) {
      defects.push(`entity consumed: ${name}`);
    }
  }
  return defects;
}

check(
  "useful introduction with zero entities has no editorial defect",
  editorialDefects(
    "If you live in Alderton and want to keep an eye on your blood pressure, Northbridge Pharmacy provides blood pressure checks and explains the reading.",
    ["Riverside Monument"],
  ).length === 0,
);
check(
  "relevant supported context may be used when it is not mere consumption",
  editorialDefects(
    "Northbridge Pharmacy provides Blood Pressure Checks for people in Alderton. The pharmacy is on the same street as the service entrance patients already use.",
    ["Riverside Monument"],
  ).length === 0,
);
check(
  "sparse locality may omit the landmark",
  editorialDefects(
    "Gilbert Pharmacy provides Blood Pressure Checks for people in Elderslie and explains the reading in plain language.",
    ["William Wallace Monument"],
  ).length === 0,
);
const failCases: Array<[string, string]> = [
  ["landmark inserted only to prove locality", "Whether you are spending time near Riverside Monument, a check fits around everyday commitments."],
  ["library inserted into a health narrative", "Whether you are running errands near Alderton Library, incorporating a check is useful."],
  ["invented demand", "Many local residents seek a check because it fits around everyday commitments."],
  ["invented healthcare relationship", "This pharmacy works alongside Riverside Medical Centre."],
  ["evidence-list narration", "Riverside Monument is recorded as a verified landmark in the evidence pack."],
  ["provenance language", "The source record for this place is stored as provenance."],
];
for (const [name, text] of failCases) {
  check(`editorial fail: ${name}`, editorialDefects(text, ["Riverside Monument", "Alderton Library", "Riverside Medical Centre"]).length > 0);
}
const swappedA = "People in Alderton use Riverside Monument as the local setting for a blood pressure check.";
const swappedB = "People in Beckford use Market Cross as the local setting for a blood pressure check.";
const normalised = (text: string) =>
  text
    .replace(/Alderton|Beckford/g, "AREA")
    .replace(/Riverside Monument|Market Cross/g, "ENTITY")
    .toLowerCase();
check("mechanical entity substitution is the same page", normalised(swappedA) === normalised(swappedB));

if (!live) {
  const failed = steps.filter((step) => !step.passed);
  for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
  console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
  process.exit(failed.length ? 1 : 0);
}

const protectedPaths = [
  "paisley",
  "barrhead",
  "elderslie",
  "renfrew",
  "linwood",
  "glasgow",
].map((area) => `output/pharmacy-content-ecosystem/gilbert-pharmacy-health-clinic/blood-pressure-checks/local/${area}/index.html`);
protectedPaths.push("data/pharmacy-master-admin/jobs.json");
const before = protectedPaths.map((file) => createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")).join("\n");

const slug = "gilbert-pharmacy-health-clinic";
const serviceId = "blood-pressure-checks";
const wanted = new Set(["paisley", "barrhead", "elderslie", "renfrew", "linwood", "glasgow"]);
const { buildContentGenerationContext } = await import("../src/pharmacy/contentEngine/buildContentGenerationContext.ts");
const { beginLocalityVariationSessionV1, endLocalityVariationSessionV1 } = await import("../src/pharmacy/contentEngine/pharmacyLocalityVariationSessionV1.ts");
const { bindCurrentRegisteredApprovedBank } = await import("../src/pharmacy/pharmacyApprovedBankRunProvenance.ts");
const { resolveLocalLocationHierarchy } = await import("../src/pharmacy/pharmacyLocalAreaResolver.ts");
const { resolveClusterPageSlug } = await import("../src/pharmacy/pharmacyClusterPageUrlResolver.ts");
const { composeCommercialClusterNarrativeV1 } = await import("../src/pharmacy/pharmacyLocalClusterContentEngine.ts");
const { canonicalClusterNarrativeRequest } = await import("../src/pharmacy/pharmacyLocalHubClusterContentEngine.ts");
const ctx = bindCurrentRegisteredApprovedBank(buildContentGenerationContext(slug, serviceId));
let hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
if (ctx.selectedAreas?.length) {
  const existingByName = new Map((hierarchy.clusters || []).map((cluster: { name: string }) => [cluster.name.trim().toLowerCase(), cluster]));
  const clusters = ctx.selectedAreas.map((area: { areaName: string; areaSlug: string }, index: number) => {
    const existing = existingByName.get(area.areaName.trim().toLowerCase());
    if (existing) return { ...existing, order: index + 1, priority: index + 1 };
    return {
      areaId: `cluster:${area.areaSlug}`,
      name: area.areaName,
      slug: area.areaSlug,
      type: "district-cluster",
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

const drafts: Array<Record<string, string>> = [];
beginLocalityVariationSessionV1([...wanted]);
try {
  for (const cluster of hierarchy.clusters) {
    const pageSlug = resolveClusterPageSlug(cluster.slug);
    if (!wanted.has(pageSlug)) continue;
    const request = canonicalClusterNarrativeRequest(ctx, hierarchy, { ...cluster, slug: pageSlug });
    try {
    const content = await composeCommercialClusterNarrativeV1(request.input, request.ctx);
    const introduction = `${content.heroIntro}\n\n${content.localRelevanceBody}`.trim();
    const supplied = (content.sectionEvidence?.["local-introduction"] || [])
      .map((row: string) => String(row).split("|")[0] || "")
      .filter(Boolean);
    const used = supplied.filter((name: string) => introduction.toLowerCase().includes(name.toLowerCase()));
    const defects = editorialDefects(introduction, []);
    const words = introduction.split(/\s+/).filter(Boolean).length;
    drafts.push({
      area: cluster.name,
      slug: pageSlug,
      narrativeType: content.narrativeType,
      limited: String(Boolean(content.evidenceLimited)),
      entities: used.join("; ") || "none",
      words: String(words),
      defects: defects.join(" | "),
      introduction,
    });
    check(`${cluster.name} production synthesis path`, String(content.narrativeType).includes("requestUkLocalIntroductionProseV1"));
    check(`${cluster.name} editorial`, defects.length === 0, defects.join(" | "));
    if (pageSlug === "elderslie") {
      check("Elderslie evidence remains limited", content.evidenceLimited === true);
      check("Elderslie omits William Wallace Monument", !/william wallace/i.test(introduction));
    }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      drafts.push({ area: cluster.name, slug: pageSlug, narrativeType: "", limited: "", entities: "", words: "0", defects: message, introduction: "" });
      check(`${cluster.name} production synthesis path`, false, message);
    }
  }
} finally {
  endLocalityVariationSessionV1();
}

const after = protectedPaths.map((file) => createHash("sha256").update(readFileSync(resolve(root, file))).digest("hex")).join("\n");
check("production files unchanged", before === after);
check("six introductions", drafts.length === 6, String(drafts.length));

for (const draft of drafts) {
  console.log(`\n===== ${draft.area} =====`);
  console.log(draft.introduction);
  console.log(`--- words=${draft.words} limited=${draft.limited} used=${draft.entities} defects=${draft.defects || "none"}`);
}

const failed = steps.filter((step) => !step.passed);
for (const step of steps) console.log(`${step.passed ? "PASS" : "FAIL"} — ${step.name}${step.detail ? ` (${step.detail})` : ""}`);
console.log(failed.length ? `FAIL ${failed.length}/${steps.length}` : `PASS ${steps.length}/${steps.length}`);
process.exit(failed.length ? 1 : 0);
