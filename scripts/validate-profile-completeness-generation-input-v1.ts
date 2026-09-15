import fs from "node:fs";
import path from "node:path";

import {
  autoPopulateGenerationProfileFields,
  auditGenerationInputFields,
  generationInputCompletenessPercent,
  type CampaignBuilderLike,
  type ImageAssignmentsLike,
} from "../src/pharmacy/pharmacyProfileGenerationInputCompleteness.ts";
import { computeRequiredProfileCompleteness } from "../src/pharmacy/pharmacyProfileFieldClassification.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import { generateContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "pharmacy-delivered-4u-test";
const SERVICE_ID = "pharmacy-first";
const APPLY = process.argv.includes("--apply");
const REGENERATE = process.argv.includes("--regenerate");

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function hasDemoData(value: unknown): boolean {
  const text = JSON.stringify(value).toLowerCase();
  return /brook pharmacy|demo data|mock data/.test(text);
}

function duplicateIssues(value: unknown, prefix = "profile"): string[] {
  const issues: string[] = [];
  if (!value || typeof value !== "object") return issues;
  if (Array.isArray(value)) {
    const primitiveStrings = value
      .filter((item) => item === null || ["string", "number", "boolean"].includes(typeof item))
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    const unique = new Set(primitiveStrings);
    if (unique.size !== primitiveStrings.length) issues.push(`${prefix} has duplicate array values`);
    if (primitiveStrings.includes("[]")) issues.push(`${prefix} contains literal [] array placeholder`);
    value.forEach((item, index) => {
      if (item && typeof item === "object") issues.push(...duplicateIssues(item, `${prefix}[${index}]`));
    });
    return issues;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(child)) issues.push(...duplicateIssues(child, `${prefix}.${key}`));
  }
  return issues;
}

function actionRequiredFields(groups: ReturnType<typeof auditGenerationInputFields>): string[] {
  return groups.flatMap((group) =>
    group.fields
      .filter((field) => field.status === "action_required")
      .map((field) => `${group.group}: ${field.label}`),
  );
}

function autoMissingFields(groups: ReturnType<typeof auditGenerationInputFields>): string[] {
  return groups.flatMap((group) =>
    group.fields
      .filter((field) => field.status === "missing")
      .map((field) => `${group.group}: ${field.label}`),
  );
}

async function main(): Promise<void> {
  const profilePath = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
  const campaignPath = path.join(ROOT, "data/growth-engine", `${SLUG}-campaign-builder.json`);
  const imagePath = path.join(ROOT, "data/pharmacy-image-assignments", `${SLUG}.json`);

  const profileDoc = readJson<{ slug?: string; updatedAt?: string; version?: number; data?: Record<string, unknown> }>(profilePath, {});
  const campaign = readJson<CampaignBuilderLike>(campaignPath, {});
  const imageAssignments = readJson<ImageAssignmentsLike>(imagePath, {});
  const beforeData = normalizeProfileData(profileDoc.data || {});
  const beforeRequired = computeRequiredProfileCompleteness(beforeData);
  const beforeGroups = auditGenerationInputFields(beforeData, imageAssignments);

  const autoResult = autoPopulateGenerationProfileFields(beforeData, campaign);
  const afterGroups = auditGenerationInputFields(autoResult.data, imageAssignments);
  const afterCompleteness = generationInputCompletenessPercent(afterGroups);

  if (APPLY) {
    writeJson(profilePath, {
      slug: SLUG,
      updatedAt: new Date().toISOString(),
      version: PROFILE_SCHEMA_VERSION,
      data: autoResult.data,
    });
  }

  const context = buildContentGenerationContext(SLUG, SERVICE_ID);
  const contextValidation = validateContentGenerationContext(context);
  const missingAutoFields = autoMissingFields(afterGroups);
  const duplicates = duplicateIssues(autoResult.data);
  const demoData = hasDemoData(autoResult.data) || context.demoMode;
  const generationContextPass = contextValidation.ok && missingAutoFields.length === 0 && duplicates.length === 0 && !demoData;

  let generationResult: { ok: boolean; error?: string } | null = null;
  if (REGENERATE) {
    generationResult = await generateContentPackage(SLUG, SERVICE_ID);
  }

  const output = {
    beforeCompletenessPercent: 57,
    beforeRequiredCompletenessPercent: beforeRequired.score,
    beforeAutoResolvableCompletenessPercent: generationInputCompletenessPercent(beforeGroups),
    afterCompletenessPercent: afterCompleteness,
    fieldsAutoPopulated: autoResult.autoPopulated,
    fieldsStillRequiringManualInput: actionRequiredFields(afterGroups),
    checks: {
      profileCompletenessTargetMet: afterCompleteness >= 95,
      allGenerationFieldsPopulated: missingAutoFields.length === 0,
      noDemoData: !demoData,
      noDuplicateFields: duplicates.length === 0,
      generationContextComplete: contextValidation.ok,
      regeneratedRequestedPackage: generationResult ? generationResult.ok : null,
    },
    missingAutoFields,
    duplicateIssues: duplicates,
    generationContextValidation: contextValidation,
    generationResult,
    customerCampaignGenerationContext: context,
    generationContextPass,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!generationContextPass || (generationResult && !generationResult.ok)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
