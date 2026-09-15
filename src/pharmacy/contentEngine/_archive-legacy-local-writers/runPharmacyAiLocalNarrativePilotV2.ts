#!/usr/bin/env npx tsx
/**
 * Authorised OpenAI v2 editorial-pilot run (Prompt 94).
 * Three areas only: Darfield, Wombwell, Worsbrough.
 * Maximum three successful generations. Maximum one retry per area. Additional cost cap USD $1.
 * Does not call Google Places, DataForSEO, web search, or image generation.
 * Does not overwrite Prompt 93 candidates.
 *
 * Run: npx tsx src/pharmacy/contentEngine/runPharmacyAiLocalNarrativePilotV2.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  AI_LOCAL_PILOT_AREAS,
  AI_LOCAL_PILOT_MAX_COST_USD,
  AI_LOCAL_PILOT_MAX_SUCCESS,
  generateAiLocalCopyPilotV2,
  getAiPilotLedger,
  hydrateOpenAiEnvIfNeeded,
  loadAiLocalCopyPilotV2,
  resetAiPilotLedger,
  validateAiLocalCopyPilotV2,
  type AiLocalCopyPilotRecordV2,
  buildPharmacyAiLocalCopyInputV1,
} from "./pharmacyAiLocalNarrativeEngineV2.ts";
import {
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { aiLocalCopyPilotPath, aiLocalPagePilotHtmlPath } from "./pharmacyAiLocalPageCandidatePaths.ts";
import { assemblePharmacyAiLocalPagePilotsV2 } from "../pharmacyAiLocalPagePilotAssemblerV2.ts";

export const PILOT_V2_PRIOR_COST_USD = 0.560872;
const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";

export type AiLocalPilotRunResultV2 = {
  ok: boolean;
  providerConfigured: boolean;
  hydrateDetail: string;
  records: AiLocalCopyPilotRecordV2[];
  files: string[];
  inspectionPath: string | null;
  ledger: ReturnType<typeof getAiPilotLedger>;
  skipped: Array<{ areaSlug: string; detail: string }>;
};

function writePilotInspection(
  slug: string,
  serviceId: string,
  records: AiLocalCopyPilotRecordV2[],
): string {
  const lines: string[] = ["PROMPT 94 AI EDITORIAL PILOT INSPECTION", ""];
  for (const record of records) {
    const copy = record.outputCopy;
    lines.push(`===== ${record.areaName.toUpperCase()} =====`);
    lines.push(`promptContractVersion: ${record.promptContractVersion}`);
    lines.push(`model: ${record.model}`);
    lines.push(`evidenceEntityIdsUsed: ${JSON.stringify(copy.evidenceEntityIdsUsed)}`);
    lines.push("evidenceSelection:");
    for (const row of record.evidenceSelection) {
      lines.push(
        `  - ${row.name} [${row.classification}] useInCopy=${row.useInCopy} ${row.reason}`,
      );
    }
    lines.push("");
    lines.push(`heroHeading: ${copy.heroHeading}`);
    lines.push(`heroIntroduction: ${copy.heroIntroduction}`);
    lines.push(`localIntroduction: ${copy.localIntroduction}`);
    lines.push(`localContextHeading: ${copy.localContextHeading}`);
    copy.localContextParagraphs.forEach((para, i) => lines.push(`localContextParagraphs[${i}]: ${para}`));
    lines.push(`relationshipToPharmacy: ${copy.relationshipToPharmacy}`);
    lines.push(`localAccessIntroduction: ${copy.localAccessIntroduction}`);
    for (const faq of copy.localFaqs) {
      lines.push(`Q: ${faq.question}`);
      lines.push(`A: ${faq.answer}`);
    }
    lines.push(`localCtaBridge: ${copy.localCtaBridge}`);
    lines.push("");
    lines.push("sentence purposes:");
    for (const row of record.sentencePurposes) {
      lines.push(`  [${row.field}] ${row.sentence}`);
      lines.push(`    purpose: ${row.purpose}`);
      lines.push(`    source: ${row.supportingSource}`);
      lines.push(`    why: ${row.readerValue}`);
    }
    lines.push("");
    lines.push(`repetition: ${JSON.stringify(record.repetitionAnalysis)}`);
    lines.push("");
  }
  const out = assemblePharmacyAiLocalPagePilotsV2(slug, serviceId, records.map((r) => r.areaSlug));
  const inspection = out.files[0]
    ? aiLocalPagePilotHtmlPath(slug, serviceId, records[0]!.areaSlug).replace(
        /local\/[^/]+\/index\.html$/,
        "COPY-INSPECTION.txt",
      )
    : `output/pharmacy-ai-local-page-pilots/${slug}/${serviceId}/v2/COPY-INSPECTION.txt`;
  fs.mkdirSync(path.dirname(inspection), { recursive: true });
  fs.writeFileSync(inspection, lines.join("\n"), "utf8");
  return inspection;
}

export async function runPharmacyAiLocalNarrativePilotV2(opts?: {
  slug?: string;
  serviceId?: string;
  initialCostUsd?: number;
  force?: boolean;
}): Promise<AiLocalPilotRunResultV2> {
  const slug = opts?.slug || YORKSHIRE;
  const serviceId = opts?.serviceId || SERVICE;
  const hydrated = hydrateOpenAiEnvIfNeeded();
  if (!hydrated.ok) {
    return {
      ok: false,
      providerConfigured: false,
      hydrateDetail: hydrated.detail,
      records: [],
      files: [],
      inspectionPath: null,
      ledger: resetAiPilotLedger(0),
      skipped: [{ areaSlug: "*", detail: "RUNTIME AI PROVIDER NOT CONFIGURED" }],
    };
  }

  resetAiPilotLedger(opts?.initialCostUsd ?? PILOT_V2_PRIOR_COST_USD);
  const plan = planPharmacyLocalEvidenceRequest(slug, serviceId);
  const requested = plan.areas.filter((area) => AI_LOCAL_PILOT_AREAS.includes(area.areaSlug));
  const previousFingerprints: string[] = [];
  const records: AiLocalCopyPilotRecordV2[] = [];
  const skipped: Array<{ areaSlug: string; detail: string }> = [];

  for (const area of requested.slice(0, AI_LOCAL_PILOT_MAX_SUCCESS)) {
    if (records.length >= AI_LOCAL_PILOT_MAX_SUCCESS) break;
    const existing = loadAiLocalCopyPilotV2(slug, serviceId, area.areaSlug);
    if (existing?.outputCopy && existing.promptContractVersion === "v2" && !opts?.force) {
      const rawPack = loadPharmacyLocalEvidencePack(slug, area.areaSlug);
      const checked = validatePharmacyLocalEvidencePack(rawPack, {
        slug,
        areaName: area.areaName,
        areaSlug: area.areaSlug,
      });
      if (checked.ok) {
        const input = buildPharmacyAiLocalCopyInputV1({
          slug,
          serviceId,
          areaName: area.areaName,
          areaSlug: area.areaSlug,
          pack: checked.pack,
        });
        const recheck = validateAiLocalCopyPilotV2(existing.outputCopy, input, previousFingerprints);
        if (recheck.ok) {
          records.push(existing);
          previousFingerprints.push(existing.outputCopy.heroIntroduction.slice(0, 80));
          continue;
        }
        console.error(`existing v2 pilot ${area.areaSlug} no longer passes: ${recheck.failures[0]}`);
      }
      for (const file of [aiLocalCopyPilotPath(slug, serviceId, area.areaSlug), aiLocalPagePilotHtmlPath(slug, serviceId, area.areaSlug)]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
    const ledgerNow = getAiPilotLedger();
    if (ledgerNow.successful >= AI_LOCAL_PILOT_MAX_SUCCESS) break;
    if (ledgerNow.estimatedCostUsd >= AI_LOCAL_PILOT_MAX_COST_USD) {
      skipped.push({ areaSlug: area.areaSlug, detail: "cost limit reached" });
      break;
    }
    const result = await generateAiLocalCopyPilotV2({
      slug,
      serviceId,
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      previousFingerprints: [...previousFingerprints],
      writeRecord: true,
    });
    if (result.ok) {
      records.push(result.record);
      previousFingerprints.push(result.fingerprint);
    } else {
      skipped.push({ areaSlug: result.areaSlug, detail: result.detail });
    }
  }

  const assembled = assemblePharmacyAiLocalPagePilotsV2(
    slug,
    serviceId,
    records.map((row) => row.areaSlug),
  );
  const persisted = records
    .map((row) => loadAiLocalCopyPilotV2(slug, serviceId, row.areaSlug))
    .filter((row): row is AiLocalCopyPilotRecordV2 => Boolean(row));
  const inspectionPath = persisted.length ? writePilotInspection(slug, serviceId, persisted) : null;

  return {
    ok: records.length === requested.length && assembled.areas.length === records.length,
    providerConfigured: true,
    hydrateDetail: hydrated.detail,
    records: persisted,
    files: assembled.files,
    inspectionPath,
    ledger: getAiPilotLedger(),
    skipped: [...skipped, ...assembled.skipped],
  };
}

const isDirect = process.argv[1]?.includes("runPharmacyAiLocalNarrativePilotV2");
if (isDirect) {
  runPharmacyAiLocalNarrativePilotV2({ force: process.env.FORCE_AI_GENERATION === "1" })
    .then((result) => {
      const { ledger } = result;
      console.log(
        JSON.stringify(
          {
            ok: result.ok,
            providerConfigured: result.providerConfigured,
            hydrateDetail: result.hydrateDetail,
            successful: ledger.successful,
            attempted: ledger.attempted,
            failed: ledger.failed,
            retried: ledger.retried,
            promptTokens: ledger.promptTokens,
            completionTokens: ledger.completionTokens,
            estimatedCostUsd: Number(ledger.estimatedCostUsd.toFixed(6)),
            records: result.records.map((r) => ({
              area: r.areaSlug,
              entitiesUsed: r.outputCopy.evidenceEntityIdsUsed,
              cost: r.estimatedCostUsd,
            })),
            files: result.files,
            skipped: result.skipped,
            inspectionPath: result.inspectionPath,
          },
          null,
          2,
        ),
      );
      if (!result.ok) process.exitCode = 1;
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(msg.replace(/sk-[A-Za-z0-9_\-]+/g, "[redacted]"));
      process.exit(1);
    });
}
