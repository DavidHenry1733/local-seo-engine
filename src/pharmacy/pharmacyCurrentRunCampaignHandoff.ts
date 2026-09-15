/**
 * Current-run campaign output handoff.
 * Review and package handoff accept only files returned by the current generation
 * run. Historical revision / quarantine / previous-output trees are never current
 * review assets. Existing old files never skip a fresh generation.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export const HISTORICAL_OUTPUT_DIRECTORY_NAMES = new Set([
  "revisions",
  "quarantine",
  "previous-output",
  "previous-outputs",
]);

export interface CampaignRunStamp {
  tenantSlug: string;
  campaignId: string;
  generatedAt: string;
  sourceContext: "customer-imported-profile";
  runId: string;
  approvedBankHash?: string | null;
}

export interface CurrentRunCampaignInventory {
  runId: string;
  generationStamp: CampaignRunStamp;
  servicePagePath: string | null;
  localityPagePaths: string[];
  reviewRecordPaths: string[];
  approvedBankHash?: string | null;
  imageSelections?: {
    version: string;
    seed: string;
    pages: Array<{
      pageType: string;
      localitySlug: string | null;
      roles: Array<{ role: string; imageId: string; sourceType: string; assetPath: string; fallback: boolean }>;
    }>;
  } | null;
}

export interface CurrentRunHandoffVerification {
  ok: boolean;
  errors: string[];
  acceptedPaths: string[];
  excludedHistoricalPaths: string[];
}

function escAttr(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function createCampaignRunId(): string {
  return randomUUID();
}

export function createCampaignRunStamp(
  tenantSlug: string,
  campaignId: string,
  generatedAt = new Date().toISOString(),
  runId = createCampaignRunId(),
  approvedBankHash?: string | null,
): CampaignRunStamp {
  return {
    tenantSlug,
    campaignId,
    generatedAt,
    sourceContext: "customer-imported-profile",
    runId,
    ...(approvedBankHash ? { approvedBankHash } : {}),
  };
}

export function isHistoricalOutputDirectoryName(name: string): boolean {
  const n = String(name || "").toLowerCase();
  if (HISTORICAL_OUTPUT_DIRECTORY_NAMES.has(n)) return true;
  return n.startsWith("_quarantine") || n.startsWith("previous-output");
}

export function isHistoricalOutputPath(filePath: string): boolean {
  return String(filePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .some((part) => isHistoricalOutputDirectoryName(part));
}

/** Existing historical or current output files must never skip a fresh generation run. */
export function existingOutputsMustNotSkipFreshGeneration(_existingOutputPaths: string[] = []): false {
  return false;
}

export function collectCurrentRunSourceFiles(fileOrDir: string): string[] {
  if (!fileOrDir || !fs.existsSync(fileOrDir)) return [];
  const stat = fs.statSync(fileOrDir);
  if (stat.isFile()) return isHistoricalOutputPath(fileOrDir) ? [] : [fileOrDir];
  if (!stat.isDirectory()) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (isHistoricalOutputDirectoryName(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!/\.(html|json|md)$/i.test(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (!isHistoricalOutputPath(full)) out.push(full);
    }
  };
  walk(fileOrDir);
  return out;
}

export function listCurrentRunInventoryFiles(inventory: CurrentRunCampaignInventory): string[] {
  return [
    inventory.servicePagePath,
    ...inventory.localityPagePaths,
    ...inventory.reviewRecordPaths,
  ].filter((p): p is string => Boolean(p));
}

export function fileHasRequiredGenerationStamp(raw: string, tenantSlug: string, campaignId: string): boolean {
  const tenantNeedles = [
    `"tenantSlug": "${tenantSlug}"`,
    `name="tenantSlug" content="${tenantSlug}"`,
    `tenantSlug: ${tenantSlug}`,
  ];
  const campaignNeedles = [
    `"campaignId": "${campaignId}"`,
    `name="campaignId" content="${campaignId}"`,
    `campaignId: ${campaignId}`,
  ];
  return (
    tenantNeedles.some((needle) => raw.includes(needle)) &&
    campaignNeedles.some((needle) => raw.includes(needle)) &&
    raw.includes("customer-imported-profile")
  );
}

export function fileMatchesCurrentRunStamp(raw: string, stamp: CampaignRunStamp): boolean {
  if (!fileHasRequiredGenerationStamp(raw, stamp.tenantSlug, stamp.campaignId)) return false;
  const runNeedles = [
    `"runId": "${stamp.runId}"`,
    `name="runId" content="${stamp.runId}"`,
    `runId: ${stamp.runId}`,
  ];
  return runNeedles.some((needle) => raw.includes(needle));
}

export function applyCampaignRunStampToHtml(html: string, stamp: CampaignRunStamp): string {
  const stripped = String(html || "")
    .replace(/<meta name="tenantSlug"[^>]*>\s*/gi, "")
    .replace(/<meta name="campaignId"[^>]*>\s*/gi, "")
    .replace(/<meta name="generatedAt"[^>]*>\s*/gi, "")
    .replace(/<meta name="sourceContext"[^>]*>\s*/gi, "")
    .replace(/<meta name="runId"[^>]*>\s*/gi, "")
    .replace(/<meta name="approvedBankHash"[^>]*>\s*/gi, "")
    .replace(/<!-- tenantSlug:[\s\S]*?sourceContext:[\s\S]*?-->\s*/gi, "");
  const meta = [
    `<meta name="tenantSlug" content="${escAttr(stamp.tenantSlug)}"/>`,
    `<meta name="campaignId" content="${escAttr(stamp.campaignId)}"/>`,
    `<meta name="generatedAt" content="${escAttr(stamp.generatedAt)}"/>`,
    `<meta name="sourceContext" content="${escAttr(stamp.sourceContext)}"/>`,
    `<meta name="runId" content="${escAttr(stamp.runId)}"/>`,
    stamp.approvedBankHash
      ? `<meta name="approvedBankHash" content="${escAttr(stamp.approvedBankHash)}"/>`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const comment = `<!-- tenantSlug: ${escAttr(stamp.tenantSlug)}; campaignId: ${escAttr(stamp.campaignId)}; generatedAt: ${escAttr(stamp.generatedAt)}; sourceContext: ${escAttr(stamp.sourceContext)}; runId: ${escAttr(stamp.runId)}${stamp.approvedBankHash ? `; approvedBankHash: ${escAttr(stamp.approvedBankHash)}` : ""} -->`;
  if (/<head>/i.test(stripped)) {
    return stripped.replace(/<head>/i, `<head>\n${meta}\n${comment}`);
  }
  return `${meta}\n${comment}\n${stripped}`;
}

export function applyCampaignRunStampToJson(raw: string, stamp: CampaignRunStamp): string {
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return JSON.stringify({ ...data, generationStamp: stamp }, null, 2);
    }
  } catch {
    /* keep original when not JSON */
  }
  return raw;
}

export function verifyCurrentRunInventory(
  inventory: CurrentRunCampaignInventory,
  options: { expectedLocalityCount?: number } = {},
): CurrentRunHandoffVerification {
  const errors: string[] = [];
  const acceptedPaths: string[] = [];
  const excludedHistoricalPaths: string[] = [];
  const stamp = inventory.generationStamp;

  if (!inventory.runId || inventory.runId !== stamp.runId) {
    errors.push("current-run inventory runId does not match generation stamp");
  }
  if (!stamp.tenantSlug || !stamp.campaignId || stamp.sourceContext !== "customer-imported-profile") {
    errors.push("current-run generation stamp is incomplete");
  }

  const files = listCurrentRunInventoryFiles(inventory);
  if (!inventory.servicePagePath) {
    errors.push("current-run service page missing from inventory");
  }
  if (options.expectedLocalityCount != null && inventory.localityPagePaths.length !== options.expectedLocalityCount) {
    errors.push(
      `current-run locality count ${inventory.localityPagePaths.length} does not match expected ${options.expectedLocalityCount}`,
    );
  }

  for (const file of files) {
    if (isHistoricalOutputPath(file)) {
      excludedHistoricalPaths.push(file);
      errors.push(`historical output treated as current-run inventory: ${file}`);
      continue;
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
      errors.push(`current-run file missing: ${file}`);
      continue;
    }
    const raw = fs.readFileSync(file, "utf8");
    if (!fileMatchesCurrentRunStamp(raw, stamp)) {
      errors.push(`review asset source missing matching generation stamp: ${file}`);
      continue;
    }
    acceptedPaths.push(file);
  }

  return {
    ok: errors.length === 0,
    errors,
    acceptedPaths,
    excludedHistoricalPaths,
  };
}

export function applyCurrentRunHandoffOrKeepCampaignState<T>(args: {
  previousCampaignState: T;
  proposedCampaignState: T;
  inventory: CurrentRunCampaignInventory;
  expectedLocalityCount?: number;
}): { ok: boolean; campaignState: T; errors: string[]; acceptedPaths: string[] } {
  const check = verifyCurrentRunInventory(args.inventory, {
    expectedLocalityCount: args.expectedLocalityCount,
  });
  if (!check.ok) {
    return {
      ok: false,
      campaignState: args.previousCampaignState,
      errors: check.errors,
      acceptedPaths: check.acceptedPaths,
    };
  }
  return {
    ok: true,
    campaignState: args.proposedCampaignState,
    errors: [],
    acceptedPaths: check.acceptedPaths,
  };
}

export function buildCurrentRunInventory(args: {
  stamp: CampaignRunStamp;
  servicePagePath: string | null;
  localityPagePaths: string[];
  reviewRecordPaths: string[];
  imageSelections?: CurrentRunCampaignInventory["imageSelections"];
}): CurrentRunCampaignInventory {
  return {
    runId: args.stamp.runId,
    generationStamp: args.stamp,
    servicePagePath: args.servicePagePath,
    localityPagePaths: args.localityPagePaths.filter((p) => p && !isHistoricalOutputPath(p)),
    reviewRecordPaths: args.reviewRecordPaths.filter((p) => p && !isHistoricalOutputPath(p)),
    ...(args.imageSelections ? { imageSelections: args.imageSelections } : {}),
  };
}
