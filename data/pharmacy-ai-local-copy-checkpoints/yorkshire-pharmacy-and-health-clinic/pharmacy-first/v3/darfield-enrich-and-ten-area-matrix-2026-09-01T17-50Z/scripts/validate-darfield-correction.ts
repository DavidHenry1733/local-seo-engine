import fs from "node:fs";
import path from "node:path";

import {
  buildPharmacyAiLocalCopyInputV3,
  validateAiLocalCopyPilotV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { inspectAiLocalCopyForPublicationV3, formatCustomerFacingLocalCopyV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { flattenAiLocalCopyText, type AiLocalCopyV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopySchemaV1.ts";
import {
  extractEditorialFactDrafts,
  factIdFor,
  hostFromUrl,
  looksLikeRawCopiedPassage,
  unsupportedInferencesIn,
  type EditorialEvidencePackV3,
  type EditorialFactV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const GEN = path.join(ROOT, "data/pharmacy-ai-local-copy-diagnostics", SLUG, SERVICE, "v3/darfield/2026-09-01-community-enrich/generate-result.json");
const RESEARCH_PREV = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield/2026-09-01-demo-standard-research.json");

function extraFacts(research: { retrievedPages?: Array<{ title?: string; finalUrl?: string; requestedUrl?: string; publisher?: string; retrievedAt?: string; textSample?: string; sourceClass?: string }>; facts?: EditorialFactV3[] }) {
  const out: EditorialFactV3[] = [...(research.facts || [])];
  for (const page of research.retrievedPages || []) {
    if (!page.textSample || page.sourceClass === "rejected") continue;
    const url = page.finalUrl || page.requestedUrl || "";
    const host = hostFromUrl(url);
    for (const draft of extractEditorialFactDrafts({
      areaName: "Darfield",
      title: page.title || "",
      text: page.textSample,
      sourceClass: "primary",
      publisher: page.publisher || host,
      host,
    })) {
      if (looksLikeRawCopiedPassage(draft.normalizedStatement, page.textSample)) continue;
      if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
      if (/wombwell|lundhill/i.test(draft.normalizedStatement)) continue;
      const fact: EditorialFactV3 = {
        factId: factIdFor("darfield", draft.category, draft.normalizedStatement),
        area: "Darfield",
        areaSlug: "darfield",
        category: draft.category,
        normalizedStatement: draft.normalizedStatement,
        sourceTitle: page.title || "",
        sourceUrl: url,
        publisher: page.publisher || host,
        retrievedAt: page.retrievedAt || new Date().toISOString(),
        sourceClass: "primary",
        corroboratingSource: null,
        confidence: draft.confidence,
        usefulnessToPharmacyFirstReader: draft.usefulnessToPharmacyFirstReader,
        permittedCopyRole: draft.permittedCopyRole,
        prohibitedInference: draft.prohibitedInference,
        validationStatus: "accepted",
      };
      if (!out.some((row) => row.normalizedStatement === fact.normalizedStatement)) out.push(fact);
    }
  }
  return out;
}

const original = loadEditorialEvidencePack(SLUG, SERVICE, "darfield")!;
const prev = JSON.parse(fs.readFileSync(RESEARCH_PREV, "utf8"));
const seen = new Set(original.facts.map((f) => f.normalizedStatement));
const mergedFacts = [...original.facts];
for (const fact of extraFacts(prev)) {
  if (seen.has(fact.normalizedStatement)) continue;
  seen.add(fact.normalizedStatement);
  mergedFacts.push(fact);
}
const editorial: EditorialEvidencePackV3 = { ...original, facts: mergedFacts };
const input = buildPharmacyAiLocalCopyInputV3({
  slug: SLUG,
  serviceId: SERVICE,
  areaName: "Darfield",
  areaSlug: "darfield",
  editorial,
});

const copy: AiLocalCopyV3 = {
  area: "Darfield",
  heroHeading: "Pharmacy First in Darfield",
  heroIntroduction:
    "Pharmacy First is available in Darfield, offering NHS consultations for eligible common conditions. Yorkshire Pharmacy & Health Clinic provides this service to people living in Darfield and the surrounding Barnsley area.",
  localIntroduction:
    "Darfield is in the Metropolitan Borough of Barnsley, South Yorkshire. Darfield Library is on Church Street. The library runs regular activities and special events for children and adults, and Darfield History Society runs local history group sessions.",
  localContextHeading: "",
  localContextParagraphs: [
    "NHS general practice services in Darfield are provided from Garland House Surgery.",
  ],
  relationshipToPharmacy:
    "Pharmacy First consultations for Darfield residents are provided at Yorkshire Pharmacy & Health Clinic in Darfield.",
  localAccessIntroduction: "",
  localFaqs: [],
  localCtaBridge: "",
  evidenceClaims: [],
  evidenceEntityIdsUsed: [
    "darfield:area-identity:darfield-is-in-the-metropolitan-borough-of-barns",
    "darfield:community:darfield-library-is-on-church-street",
    "darfield:community:darfield-library-runs-regular-activities-and-spe",
    "darfield:heritage:darfield-history-society-runs-local-history-grou",
    "darfield:healthcare:nhs-general-practice-services-in-darfield-are-pr",
    "darfield:pharmacy-relationship:in-area",
  ],
  editorialFactIdsUsed: [
    "darfield:area-identity:darfield-is-in-the-metropolitan-borough-of-barns",
    "darfield:community:darfield-library-is-on-church-street",
    "darfield:community:darfield-library-runs-regular-activities-and-spe",
    "darfield:heritage:darfield-history-society-runs-local-history-grou",
    "darfield:healthcare:nhs-general-practice-services-in-darfield-are-pr",
    "darfield:pharmacy-relationship:in-area",
  ],
};

const validated = validateAiLocalCopyPilotV3(copy, input, mergedFacts, []);
const publication = inspectAiLocalCopyForPublicationV3(copy, input);
const hay = flattenAiLocalCopyText(copy);
const review = {
  wombwellLeak: /wombwell|roly poly|wishing tree|unicorn|heritage group|citizens advice|lundhill/i.test(hay),
  fromDarfieldTravel: /from Darfield/i.test(hay),
  gpWait: /waiting for a (?:routine )?GP|GP slot/i.test(hay),
  pharmacyInDarfield: /in Darfield/i.test(hay) && /yorkshire pharmacy/i.test(hay),
};
const out = {
  validator: { ok: validated.ok, failures: validated.failures, reviews: validated.reviews },
  publication,
  review,
  formatted: formatCustomerFacingLocalCopyV3(copy),
  copy,
};
const dest = path.join(path.dirname(GEN), "operator-source-correction.json");
fs.writeFileSync(dest, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ ok: validated.ok && publication.ok && !review.wombwellLeak, failures: validated.failures, reviews: validated.reviews, publication: publication.failures, review }, null, 2));
