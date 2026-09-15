import fs from "node:fs";
import path from "node:path";

import {
  buildPharmacyAiLocalCopyInputV3,
  generateAiLocalCopyPilotV3,
  getAiPilotLedgerV3,
  hydrateOpenAiEnvIfNeeded,
  loadAiLocalCopyPilotV3,
  loadAuthorizedTaskBudgetV3,
  authorizedTaskBudgetPathV3,
  validateAiLocalCopyPilotV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { formatCustomerFacingLocalCopyV3, localNarrativeFingerprint } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalCopyQualityV1.ts";
import { stripIdentityTokens } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalPageCandidateUniquenessV1.ts";
import { loadEditorialEvidencePack } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { hashFileSha256 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts";
import type { EditorialEvidencePackV3, EditorialFactV3 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const TASK_ID = "wombwell-v3-live-page-2026-09-01";
const COMBINED_BUDGET_USD = 1;
const ORIGINAL_PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/wombwell.json");
const RESEARCH = path.join(
  ROOT,
  "data/pharmacy-local-editorial-research-supplements",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-live-page-research.json",
);
const LEDGER = path.join(
  ROOT,
  "data/pharmacy-local-editorial-research-supplements",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-live-page-cost-ledger.json",
);
const OUT = path.join(
  ROOT,
  "data/pharmacy-ai-local-copy-diagnostics",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-live-page/generate-result.json",
);

async function main() {
  process.chdir(ROOT);
  const openai = hydrateOpenAiEnvIfNeeded();
  if (!openai.ok) throw new Error(openai.detail);
  const original = loadEditorialEvidencePack(SLUG, SERVICE, "wombwell");
  if (!original) throw new Error("missing original pack");
  const originalPackHash = hashFileSha256(ORIGINAL_PACK);
  const research = JSON.parse(fs.readFileSync(RESEARCH, "utf8")) as {
    savedLibraryReuse: { facts: EditorialFactV3[] };
    tsyFactsFromSavedBody?: EditorialFactV3[];
  };
  const costLedger = JSON.parse(fs.readFileSync(LEDGER, "utf8")) as {
    dataForSeoCostUsd: number;
    openaiCostUsd: number;
    events: Array<Record<string, unknown>>;
  };
  const remainingUsd = Number((COMBINED_BUDGET_USD - Number(costLedger.dataForSeoCostUsd || 0)).toFixed(4));
  const extraFacts = [...(research.savedLibraryReuse.facts || []), ...(research.tsyFactsFromSavedBody || [])].filter((fact) => {
    if (fact.validationStatus !== "accepted") return false;
    if (/south area council/i.test(fact.normalizedStatement)) return false;
    if (/is a village/i.test(fact.normalizedStatement)) return false;
    if (/11,477|19\.8%|13\.2%|semi-detached/i.test(fact.normalizedStatement)) return false;
    return true;
  });
  const seen = new Set(original.facts.map((f) => f.normalizedStatement));
  const mergedFacts: EditorialFactV3[] = [...original.facts];
  for (const fact of extraFacts) {
    if (seen.has(fact.normalizedStatement)) continue;
    seen.add(fact.normalizedStatement);
    mergedFacts.push(fact);
  }
  const editorial: EditorialEvidencePackV3 = { ...original, facts: mergedFacts };

  const darfield = loadAiLocalCopyPilotV3(SLUG, SERVICE, "darfield");
  const previousFingerprints: string[] = [];
  if (darfield) {
    const input = buildPharmacyAiLocalCopyInputV3({
      slug: SLUG,
      serviceId: SERVICE,
      areaName: "Darfield",
      areaSlug: "darfield",
      editorial: loadEditorialEvidencePack(SLUG, SERVICE, "darfield")!,
    });
    previousFingerprints.push(
      stripIdentityTokens(localNarrativeFingerprint(darfield.outputCopy), {
        pharmacyName: input.business.name,
        areaName: input.locality.areaName,
        telephone: input.business.telephone,
        address: input.business.address,
        distanceLabel: input.locality.distanceLabel,
        siblingAreaNames: input.locality.neighbouringSelectedAreas,
      }),
    );
  }

  const generated = await generateAiLocalCopyPilotV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Wombwell",
    areaSlug: "wombwell",
    previousFingerprints,
    writeRecord: false,
    persistAttemptLogs: true,
    maxAttempts: 2,
    maxProviderCalls: 2,
    maxCostUsd: remainingUsd,
    authorizedTaskId: TASK_ID,
    editorial,
    varietyHints: [
      "Write a recognisable Wombwell community account, not a landmark list and not South Area Council padding. Prefer the library's local history sessions run by Wombwell Heritage Group, or the station artwork that refers to Wombwell Park. Do not catalogue the library, park, station, emblem and Medical Centre together.",
      "Do not invent coal mining or present-day jobs. Do not say residents attend sessions, visit the park, or use Citizens Advice. Do not copy promotional wording such as inspiring, rich history or community spirit. Omit undated ward statistics. Name Darfield once in relationshipToPharmacy. Keep the hero service-led. Leave optional fields empty when they add nothing.",
    ],
  });

  const input = buildPharmacyAiLocalCopyInputV3({
    slug: SLUG,
    serviceId: SERVICE,
    areaName: "Wombwell",
    areaSlug: "wombwell",
    editorial,
  });
  const copy = generated.ok ? generated.record.outputCopy : generated.copy;
  const validated = copy ? validateAiLocalCopyPilotV3(copy, input, editorial.facts, previousFingerprints) : null;
  const openaiLedger = getAiPilotLedgerV3();
  const durable = loadAuthorizedTaskBudgetV3(
    authorizedTaskBudgetPathV3({ slug: SLUG, serviceId: SERVICE, taskId: TASK_ID }),
  );
  costLedger.openaiCostUsd = Number(durable?.estimatedCostUsd || openaiLedger.estimatedCostUsd || 0);
  costLedger.events.push({
    at: new Date().toISOString(),
    kind: "openai-generation",
    authorizedTaskId: TASK_ID,
    estimatedCostUsd: costLedger.openaiCostUsd,
    ok: generated.ok,
  });
  fs.writeFileSync(LEDGER, `${JSON.stringify(costLedger, null, 2)}\n`);

  const payload = {
    ok: generated.ok,
    originalPackHash,
    originalPackUnchanged: hashFileSha256(ORIGINAL_PACK) === originalPackHash,
    mergedFactStatements: mergedFacts.map((f) => f.normalizedStatement),
    remainingUsdBeforeOpenAi: remainingUsd,
    openaiLedger,
    durableBudget: durable,
    combinedCostUsd: Number(costLedger.dataForSeoCostUsd || 0) + Number(costLedger.openaiCostUsd || 0),
    attemptLogPaths: generated.attemptLogPaths,
    detail: generated.ok ? undefined : generated.detail,
    failures: generated.ok ? [] : generated.failures,
    validator: validated
      ? { ok: validated.ok, failures: validated.failures, reviews: validated.reviews, claims: validated.claims }
      : null,
    formatted: copy ? formatCustomerFacingLocalCopyV3(copy) : "",
    copy,
    generatedAt: generated.ok ? generated.record.generatedAt : null,
    tokenUsage: generated.ok ? generated.record.tokenUsage : null,
    estimatedCostUsd: generated.ok ? generated.record.estimatedCostUsd : costLedger.openaiCostUsd,
    raw: generated.ok ? generated.record.rawOpenAiResponse : generated.raw,
    raws: generated.ok ? generated.record.rawOpenAiResponses : undefined,
    record: generated.ok ? generated.record : null,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        ok: generated.ok,
        originalPackUnchanged: payload.originalPackUnchanged,
        mergedFactStatements: payload.mergedFactStatements,
        durable,
        combinedCostUsd: payload.combinedCostUsd,
        attemptLogPaths: generated.attemptLogPaths,
        failures: payload.failures,
        reviews: validated?.reviews || [],
        formatted: payload.formatted,
      },
      null,
      2,
    ),
  );
  if (!generated.ok) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
