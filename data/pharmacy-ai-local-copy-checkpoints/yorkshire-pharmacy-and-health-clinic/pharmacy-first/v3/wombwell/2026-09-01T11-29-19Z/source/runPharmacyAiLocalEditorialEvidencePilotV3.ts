#!/usr/bin/env npx tsx
/**
 * Prompt 95 — collect editorial evidence then generate three isolated v3 AI pilots.
 * Combined additional estimated cost below USD $2.
 * Does not call Google Places, image generation, or Maps Routes.
 * Does not overwrite v1/v2 candidates.
 *
 * Run: npx tsx src/pharmacy/contentEngine/runPharmacyAiLocalEditorialEvidencePilotV3.ts
 */
import fs from "node:fs";
import path from "node:path";

import {
  collectEditorialEvidencePilotsV3,
  EDITORIAL_COLLECTION_LEDGER,
  loadEditorialEvidencePack,
  restoreOneOfficialPageBody,
} from "./pharmacyLocalEditorialEvidenceCollectorV3.ts";
import {
  EDITORIAL_PILOT_AREAS,
  MAX_COMBINED_EXTERNAL_COST_USD,
} from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import {
  buildPharmacyAiLocalCopyInputV3,
  generateAiLocalCopyPilotV3,
  getAiPilotLedgerV3,
  hydrateOpenAiEnvIfNeeded,
  loadAiLocalCopyPilotV3,
  resetAiPilotLedgerV3,
  validateAiLocalCopyPilotV3,
  type AiLocalCopyPilotRecordV3,
} from "./pharmacyAiLocalNarrativeEngineV3.ts";
import { planPharmacyLocalEvidenceRequest } from "./pharmacyLocalEvidencePackContractV1.ts";
import { assemblePharmacyAiLocalPagePilotsV3 } from "../pharmacyAiLocalPagePilotAssemblerV3.ts";
import { inspectAiLocalCopyForPublicationV3 } from "./pharmacyAiLocalCopyQualityV1.ts";
import {
  AI_LOCAL_PILOT_CONTRACT_VERSION_V3,
  aiLocalCopyPilotPath,
  aiLocalPagePilotHtmlPath,
} from "./pharmacyAiLocalPageCandidatePaths.ts";

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
/** Prior OpenAI spend on this prompt, including failed retries. Do not reset the $2 cap. */
export const PROMPT_95_PRIOR_OPENAI_COST_USD = 0.27;
/** Isolated Wombwell v3 OpenAI spend before this generation, including failed attempts. */
export const WOMBWELL_V3_ISOLATED_PRIOR_OPENAI_USD = 0.087956;

function writePilotInspection(
  slug: string,
  serviceId: string,
  records: AiLocalCopyPilotRecordV3[],
): string {
  const lines: string[] = ["PROMPT 95 AI EDITORIAL EVIDENCE PILOT INSPECTION", ""];
  for (const record of records) {
    const copy = record.outputCopy;
    lines.push(`===== ${record.areaName.toUpperCase()} =====`);
    lines.push(`promptContractVersion: ${record.promptContractVersion}`);
    lines.push(`model: ${record.model}`);
    lines.push(`editorialFactIdsUsed: ${JSON.stringify(copy.editorialFactIdsUsed)}`);
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
  }
  const inspection = `output/pharmacy-ai-local-page-pilots/${slug}/${serviceId}/v3/COPY-INSPECTION.txt`;
  fs.mkdirSync(path.dirname(inspection), { recursive: true });
  fs.writeFileSync(inspection, lines.join("\n"), "utf8");
  return inspection;
}

export async function runPharmacyAiLocalEditorialEvidencePilotV3(opts?: {
  slug?: string;
  serviceId?: string;
  force?: boolean;
  areaSlugs?: string[];
  skipCollection?: boolean;
  assembleAreaSlugs?: string[];
  restoreOfficialBodyUrl?: string;
  maxAdditionalOpenaiUsd?: number;
  priorOpenaiUsd?: number;
  skipGeneration?: boolean;
  maxAttempts?: number;
}): Promise<{
  ok: boolean;
  collection: Awaited<ReturnType<typeof collectEditorialEvidencePilotsV3>>;
  records: AiLocalCopyPilotRecordV3[];
  files: string[];
  skipped: Array<{ areaSlug: string; detail: string }>;
  ledger: ReturnType<typeof getAiPilotLedgerV3>;
  collectionLedger: typeof EDITORIAL_COLLECTION_LEDGER;
  inspectionPath: string | null;
  attemptLogPaths: string[];
}> {
  const slug = opts?.slug || YORKSHIRE;
  const serviceId = opts?.serviceId || SERVICE;
  const collection = opts?.skipCollection
    ? {
        ok: true,
        packs: (opts.areaSlugs || [...EDITORIAL_PILOT_AREAS])
          .map((areaSlug) => loadEditorialEvidencePack(slug, serviceId, areaSlug))
          .filter((pack): pack is NonNullable<typeof pack> => Boolean(pack)),
        spentUsd: 0,
        skipped: [] as Array<{ areaSlug: string; detail: string }>,
        hydrateDetail: "collection-skipped",
      }
    : await collectEditorialEvidencePilotsV3({
        slug,
        serviceId,
        force: opts?.force,
      });
  if (opts?.restoreOfficialBodyUrl && opts.areaSlugs?.length === 1) {
    const restored = await restoreOneOfficialPageBody({
      slug,
      serviceId,
      areaSlug: opts.areaSlugs[0]!,
      url: opts.restoreOfficialBodyUrl,
    });
    console.error(`official body restore: fetched=${restored.fetched} ${restored.detail}`);
    if (restored.pack) {
      const idx = collection.packs.findIndex((pack) => pack.areaSlug === restored.pack!.areaSlug);
      if (idx >= 0) collection.packs[idx] = restored.pack;
      else collection.packs.push(restored.pack);
    }
  }
  const openai = hydrateOpenAiEnvIfNeeded();
  resetAiPilotLedgerV3(
    opts?.priorOpenaiUsd != null ? opts.priorOpenaiUsd : collection.spentUsd + PROMPT_95_PRIOR_OPENAI_COST_USD,
  );
  const plan = planPharmacyLocalEvidenceRequest(slug, serviceId);
  const requested = plan.areas.filter((area) => {
    if (!(EDITORIAL_PILOT_AREAS as readonly string[]).includes(area.areaSlug)) return false;
    if (opts?.areaSlugs?.length) return opts.areaSlugs.includes(area.areaSlug);
    return true;
  });
  const records: AiLocalCopyPilotRecordV3[] = [];
  const skipped = [...collection.skipped];
  const previousFingerprints: string[] = [];
  const attemptLogPaths: string[] = [];

  if (!openai.ok) {
    return {
      ok: false,
      collection,
      records,
      files: [],
      skipped: [...skipped, { areaSlug: "*", detail: "RUNTIME AI PROVIDER NOT CONFIGURED" }],
      ledger: getAiPilotLedgerV3(),
      collectionLedger: { ...EDITORIAL_COLLECTION_LEDGER },
      inspectionPath: null,
      attemptLogPaths: [],
    };
  }

  for (const area of requested) {
    const editorial = loadEditorialEvidencePack(slug, serviceId, area.areaSlug);
    if (!editorial || editorial.sufficiency.status !== "READY") {
      skipped.push({
        areaSlug: area.areaSlug,
        detail: `EVIDENCE LIMITED: ${(editorial?.sufficiency.reasons || ["missing pack"]).join("; ")}`,
      });
      for (const file of [
        aiLocalCopyPilotPath(slug, serviceId, area.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3),
        aiLocalPagePilotHtmlPath(slug, serviceId, area.areaSlug, AI_LOCAL_PILOT_CONTRACT_VERSION_V3),
      ]) {
        if (file.includes("/v3/") && fs.existsSync(file)) fs.unlinkSync(file);
      }
      continue;
    }
    if (opts?.skipGeneration) {
      const existing = loadAiLocalCopyPilotV3(slug, serviceId, area.areaSlug);
      if (existing) records.push(existing);
      else skipped.push({ areaSlug: area.areaSlug, detail: "skipGeneration: missing copy record" });
      continue;
    }
    if (!opts?.force) {
      const existing = loadAiLocalCopyPilotV3(slug, serviceId, area.areaSlug);
      if (existing?.validationResult?.ok && existing.promptContractVersion === "v3") {
        const input = buildPharmacyAiLocalCopyInputV3({
          slug,
          serviceId,
          areaName: area.areaName,
          areaSlug: area.areaSlug,
          editorial,
        });
        const recheck = validateAiLocalCopyPilotV3(existing.outputCopy, input, editorial.facts, previousFingerprints);
        if (recheck.ok) {
          records.push(existing);
          previousFingerprints.push(existing.outputCopy.heroIntroduction.slice(0, 80));
          continue;
        }
        console.error(`existing v3 pilot ${area.areaSlug} no longer passes: ${recheck.failures[0]}`);
      }
    }
    if (getAiPilotLedgerV3().estimatedCostUsd >= MAX_COMBINED_EXTERNAL_COST_USD) {
      skipped.push({ areaSlug: area.areaSlug, detail: "cost limit reached" });
      continue;
    }
    const generated = await generateAiLocalCopyPilotV3({
      slug,
      serviceId,
      areaName: area.areaName,
      areaSlug: area.areaSlug,
      previousFingerprints,
      writeRecord: true,
      maxCostUsd: opts?.maxAdditionalOpenaiUsd,
      maxAttempts: opts?.maxAttempts,
    });
    if (generated.ok) {
      records.push(generated.record);
      previousFingerprints.push(generated.fingerprint);
      attemptLogPaths.push(...generated.attemptLogPaths);
    } else {
      skipped.push({ areaSlug: area.areaSlug, detail: generated.detail });
      attemptLogPaths.push(...generated.attemptLogPaths);
    }
  }

  const publishable: AiLocalCopyPilotRecordV3[] = [];
  for (const record of records) {
    const editorial = loadEditorialEvidencePack(slug, serviceId, record.areaSlug);
    if (!editorial) {
      skipped.push({ areaSlug: record.areaSlug, detail: "publication inspect: missing editorial pack" });
      continue;
    }
    const input = buildPharmacyAiLocalCopyInputV3({
      slug,
      serviceId,
      areaName: record.areaName,
      areaSlug: record.areaSlug,
      editorial,
    });
    const inspected = inspectAiLocalCopyForPublicationV3(record.outputCopy, input);
    if (!inspected.ok) {
      skipped.push({
        areaSlug: record.areaSlug,
        detail: `publication inspect rejected: ${inspected.failures.join("; ")}`,
      });
      continue;
    }
    publishable.push(record);
  }

  const assembleSlugs = (opts?.assembleAreaSlugs || publishable.map((row) => row.areaSlug)).filter((areaSlug) =>
    publishable.some((row) => row.areaSlug === areaSlug),
  );
  const assembled = assemblePharmacyAiLocalPagePilotsV3(slug, serviceId, assembleSlugs);
  const inspectionPath = publishable.length ? writePilotInspection(slug, serviceId, publishable) : null;
  return {
    ok: publishable.length > 0,
    collection,
    records: publishable,
    files: assembled.files,
    skipped: [...skipped, ...assembled.skipped],
    ledger: getAiPilotLedgerV3(),
    collectionLedger: { ...EDITORIAL_COLLECTION_LEDGER },
    inspectionPath,
    attemptLogPaths,
  };
}

const isDirect = process.argv[1]?.includes("runPharmacyAiLocalEditorialEvidencePilotV3");
if (isDirect) {
  const wombwellOnly =
    process.env.WOMBWELL_AI_HERO_COPY_FIX === "1" || process.argv.includes("--wombwell-only");
  runPharmacyAiLocalEditorialEvidencePilotV3(
    wombwellOnly
      ? {
          force: true,
          skipCollection: true,
          areaSlugs: ["wombwell"],
          assembleAreaSlugs: ["wombwell"],
          maxAdditionalOpenaiUsd: 0.2,
          priorOpenaiUsd: WOMBWELL_V3_ISOLATED_PRIOR_OPENAI_USD,
          maxAttempts: 2,
        }
      : { force: process.env.FORCE_AI_GENERATION === "1" },
  )
    .then((result) => {
      console.log(
        JSON.stringify(
          {
            ok: result.ok,
            areas: result.records.map((r) => r.areaSlug),
            files: result.files,
            skipped: result.skipped,
            dataForSeoCostUsd: result.collectionLedger.dataForSeoCostUsd,
            searches: result.collectionLedger.searches,
            pages: result.collectionLedger.pages,
            openaiCostUsd: result.ledger.estimatedCostUsd,
            attempted: result.ledger.attempted,
            successful: result.ledger.successful,
            failed: result.ledger.failed,
            retried: result.ledger.retried,
            attemptLogPaths: result.attemptLogPaths,
            sufficiency: result.collection.packs.map((p) => ({
              area: p.areaSlug,
              status: p.sufficiency.status,
            })),
          },
          null,
          2,
        ),
      );
      if (!result.ok) process.exitCode = 1;
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
