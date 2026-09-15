/**
 * Current-run approved-bank provenance for improvement regeneration.
 * Always binds the registered bank at execution time — never a frozen variant pack.
 */
import path from "node:path";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { ContentPackageManifest } from "./pharmacyContentPackageService.ts";
import {
  isHistoricalOutputPath,
  type CampaignRunStamp,
  type CurrentRunCampaignInventory,
} from "./pharmacyCurrentRunCampaignHandoff.ts";
import {
  isApprovedBankRegisteredService,
  loadServiceVariantPack,
  resolveApprovedServiceBank,
  type ServiceVariantPack,
} from "./pharmacyServiceVariantLibrary.ts";

export type RegisteredBankSelection = {
  serviceId: string;
  hash: string | null;
  pack: ServiceVariantPack | null;
  registered: boolean;
};

export function selectRegisteredApprovedBank(serviceId: string): RegisteredBankSelection {
  const id = String(serviceId || "").trim();
  const registered = isApprovedBankRegisteredService(id);
  if (!registered) {
    return { serviceId: id, hash: null, pack: loadServiceVariantPack(id), registered: false };
  }
  const resolved = resolveApprovedServiceBank(id);
  const pack = loadServiceVariantPack(id);
  return {
    serviceId: id,
    hash: resolved?.hash || null,
    pack,
    registered: true,
  };
}

export function bindCurrentRegisteredApprovedBank(
  ctx: ContentGenerationContext,
): ContentGenerationContext {
  const selected = selectRegisteredApprovedBank(ctx.serviceId);
  return {
    ...ctx,
    variantPack: selected.pack,
    approvedBankHash: selected.hash,
  };
}

export function assertImprovementRunBankAlignment(input: {
  generatedBankHash: string | null | undefined;
  reviewBankHash: string | null | undefined;
  registryBankHash: string | null | undefined;
}): { ok: true } | { ok: false; error: string } {
  const generated = String(input.generatedBankHash || "").trim() || null;
  const review = String(input.reviewBankHash || "").trim() || null;
  const registry = String(input.registryBankHash || "").trim() || null;
  if (!registry && !generated && !review) return { ok: true };
  if (!registry || !generated || !review) {
    return {
      ok: false,
      error: `Improvement bank-hash provenance incomplete (registry=${registry || "missing"} generated=${generated || "missing"} review=${review || "missing"})`,
    };
  }
  if (generated !== registry || review !== registry || generated !== review) {
    return {
      ok: false,
      error: `Generated bank hash and active review bank hash must match the registered bank (registry=${registry} generated=${generated} review=${review})`,
    };
  }
  return { ok: true };
}

export function currentRunPreviewQuery(runId?: string | null, bankHash?: string | null): string {
  const params = new URLSearchParams();
  if (runId) params.set("run", runId);
  if (bankHash) params.set("bank", bankHash);
  const q = params.toString();
  return q ? `&${q}` : "";
}

export function withCurrentRunPreviewParams(
  url: string,
  runId?: string | null,
  bankHash?: string | null,
): string {
  const extra = currentRunPreviewQuery(runId, bankHash);
  if (!extra) return url;
  return url.includes("?") ? `${url}${extra}` : `${url}?${extra.replace(/^&/, "")}`;
}

export function resolveCurrentRunLocalityHtmlPath(
  inventory: CurrentRunCampaignInventory | null | undefined,
  areaSlug?: string,
): string | null {
  const paths = (inventory?.localityPagePaths || []).filter((p) => p && !isHistoricalOutputPath(p));
  if (!paths.length) return null;
  const wanted = String(areaSlug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (wanted) {
    const match = paths.find((p) => {
      const parts = p.replace(/\\/g, "/").split("/");
      const idx = parts.lastIndexOf("index.html");
      const area = idx > 0 ? parts[idx - 1] : "";
      return area.toLowerCase() === wanted;
    });
    return match || null;
  }
  return null;
}

export function resolvePreviewSourceFromPackage(
  pkg: ContentPackageManifest | null | undefined,
  assetKey: string,
  areaSlug?: string,
): { file: string | null; runId: string | null; approvedBankHash: string | null } {
  const runId = pkg?.currentRunInventory?.runId || pkg?.generationStamp?.runId || null;
  const approvedBankHash =
    pkg?.currentRunInventory?.approvedBankHash || pkg?.approvedBankHash || pkg?.generationStamp?.approvedBankHash || null;
  if (assetKey === "local-area-pages") {
    return {
      file: resolveCurrentRunLocalityHtmlPath(pkg?.currentRunInventory, areaSlug),
      runId,
      approvedBankHash,
    };
  }
  const asset = pkg?.assets?.find((a) => a.type === assetKey);
  const outputPath = asset?.outputPath || null;
  if (outputPath && isHistoricalOutputPath(outputPath)) {
    return { file: null, runId, approvedBankHash };
  }
  return { file: outputPath, runId, approvedBankHash };
}

export function stampWithApprovedBankHash(
  stamp: CampaignRunStamp,
  approvedBankHash: string | null | undefined,
): CampaignRunStamp {
  return {
    ...stamp,
    approvedBankHash: approvedBankHash || undefined,
  };
}

export function inventoryWithApprovedBankHash(
  inventory: CurrentRunCampaignInventory,
  approvedBankHash: string | null | undefined,
): CurrentRunCampaignInventory {
  return {
    ...inventory,
    approvedBankHash: approvedBankHash || null,
    generationStamp: stampWithApprovedBankHash(inventory.generationStamp, approvedBankHash),
  };
}

export function previewCacheHeaders(runId?: string | null, bankHash?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
  };
  if (runId) headers["X-Pharmacy-Run-Id"] = runId;
  if (bankHash) headers["X-Approved-Bank-Hash"] = bankHash;
  return headers;
}

export function pathIsCurrentRunLocality(filePath: string, inventory: CurrentRunCampaignInventory | null | undefined): boolean {
  if (!filePath || isHistoricalOutputPath(filePath)) return false;
  const resolved = path.resolve(filePath);
  return (inventory?.localityPagePaths || []).some((p) => path.resolve(p) === resolved);
}
