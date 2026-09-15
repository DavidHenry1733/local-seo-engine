#!/usr/bin/env npx tsx
/**
 * Authorised OpenAI local-narrative generation run (Prompt 93).
 * Maximum ten successful generations. Maximum one retry per area. Cost cap USD $5.
 * Does not call Google Places, DataForSEO, web search, or image generation.
 *
 * Run: npx tsx src/pharmacy/contentEngine/runPharmacyAiLocalNarrativeGenerationV1.ts
 */
import {
  AI_LOCAL_MAX_COST_USD,
  AI_LOCAL_MAX_SUCCESSFUL_GENERATIONS,
  buildPharmacyAiLocalCopyInputV1,
  generateAiLocalCopyForArea,
  getAiGenerationLedger,
  hydrateOpenAiEnvIfNeeded,
  loadAiLocalCopyRecord,
  resetAiGenerationLedger,
  validateAiLocalCopyAgainstInput,
  type AiLocalCopyRecordV1,
} from "./pharmacyAiLocalNarrativeEngineV1.ts";
import {
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { aiLocalCopyRecordPath, aiLocalPageCandidateHtmlPath } from "./pharmacyAiLocalPageCandidatePaths.ts";
import { assemblePharmacyAiLocalPageCandidates } from "../pharmacyAiLocalPageCandidateAssembler.ts";
import { writeAiLocalCopyInspection } from "./pharmacyAiLocalCopyInspectionV1.ts";
import fs from "node:fs";

export const AUTH_CHECK_COST_USD = 1.015164;

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";

export type AiLocalGenerationRunResult = {
  ok: boolean;
  providerConfigured: boolean;
  hydrateDetail: string;
  records: AiLocalCopyRecordV1[];
  files: string[];
  inspectionPath: string | null;
  ledger: ReturnType<typeof getAiGenerationLedger>;
  skipped: Array<{ areaSlug: string; detail: string }>;
};

export async function runPharmacyAiLocalNarrativeGenerationV1(opts?: {
  slug?: string;
  serviceId?: string;
  initialCostUsd?: number;
}): Promise<AiLocalGenerationRunResult> {
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
      ledger: resetAiGenerationLedger(0),
      skipped: [{ areaSlug: "*", detail: "RUNTIME AI PROVIDER NOT CONFIGURED" }],
    };
  }

  resetAiGenerationLedger(opts?.initialCostUsd ?? AUTH_CHECK_COST_USD);
  const plan = planPharmacyLocalEvidenceRequest(slug, serviceId);
  const previousFingerprints: string[] = [];
  const records: AiLocalCopyRecordV1[] = [];
  const skipped: Array<{ areaSlug: string; detail: string }> = [];

  for (const area of plan.areas.slice(0, AI_LOCAL_MAX_SUCCESSFUL_GENERATIONS)) {
    if (records.length >= AI_LOCAL_MAX_SUCCESSFUL_GENERATIONS) break;
    const existing = loadAiLocalCopyRecord(slug, serviceId, area.areaSlug);
    if (existing?.outputCopy) {
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
        const recheck = validateAiLocalCopyAgainstInput(existing.outputCopy, input, previousFingerprints);
        if (recheck.ok) {
          records.push(existing);
          previousFingerprints.push(`${existing.areaSlug}:${existing.outputCopy.heroIntroduction.slice(0, 80)}`);
          continue;
        }
        console.error(`existing ${area.areaSlug} no longer passes gates: ${recheck.failures[0]}`);
      }
      for (const file of [aiLocalCopyRecordPath(slug, serviceId, area.areaSlug), aiLocalPageCandidateHtmlPath(slug, serviceId, area.areaSlug)]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
    const ledger = getAiGenerationLedger();
    if (ledger.successful >= AI_LOCAL_MAX_SUCCESSFUL_GENERATIONS) break;
    if (ledger.estimatedCostUsd >= AI_LOCAL_MAX_COST_USD) {
      skipped.push({ areaSlug: area.areaSlug, detail: "cost limit reached" });
      break;
    }
    const result = await generateAiLocalCopyForArea({
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

  const assembled = (await import("../pharmacyAiLocalPageCandidateAssembler.ts")).assemblePharmacyAiLocalPageCandidates(
    slug,
    serviceId,
    records.map((row) => row.areaSlug),
  );
  const persisted = records
    .map((row) => loadAiLocalCopyRecord(slug, serviceId, row.areaSlug))
    .filter((row): row is AiLocalCopyRecordV1 => Boolean(row));
  const inspectionPath = persisted.length ? writeAiLocalCopyInspection(slug, serviceId, persisted) : null;

  return {
    ok: records.length > 0 && assembled.areas.length === records.length,
    providerConfigured: true,
    hydrateDetail: hydrated.detail,
    records: persisted,
    files: assembled.files,
    inspectionPath,
    ledger: getAiGenerationLedger(),
    skipped: [...skipped, ...assembled.skipped],
  };
}

const isDirect = process.argv[1]?.includes("runPharmacyAiLocalNarrativeGenerationV1");
if (isDirect) {
  runPharmacyAiLocalNarrativeGenerationV1()
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
            records: result.records.map((r) => r.areaSlug),
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
