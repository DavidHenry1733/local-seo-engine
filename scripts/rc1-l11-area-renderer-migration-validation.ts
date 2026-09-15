#!/usr/bin/env npx tsx
/**
 * RC1-L11 — legacy area renderer removed; single local content engine pipeline for areas.
 */
import fs from "node:fs";
import path from "node:path";
import * as cheerio from "cheerio";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { resolveLocalLocationHierarchy } from "../src/pharmacy/pharmacyLocalAreaResolver.ts";
import { regenerateLocalAreaPagesOnly } from "../src/pharmacy/pharmacyLocalLocationGenerationService.ts";
import { rebuildCanonicalLocalPagesOnly, resolveCanonicalFinalRenderPagePath } from "../src/pharmacy/pharmacyCanonicalFinalRenderService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import {
  LOCAL_AREA_V1_CONTRACT,
  LOCAL_CLUSTER_V1_CONTRACT,
  LOCAL_AREA_CONTRACT_ID,
} from "../src/pharmacy/pharmacyLocalPageTypeContracts.ts";
import { validateLocalPageTypeContractHtml } from "../src/pharmacy/pharmacyLocalPageContractValidation.ts";

const SERVICE = "pharmacy-first";
const BANNER = "banner-cross-pharmacy";
const LEGACY_RENDERER = path.join(PHARMACY_WORKSPACE_ROOT, "src/pharmacy/pharmacyLocalClusterPageRenderer.ts");
const EVIDENCE = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/pharmacy-master-admin/commercial-publish",
  BANNER,
  "rc1-l11-area-renderer-migration",
);

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function extractTemplateBlockOrder(html: string): string[] {
  const $ = cheerio.load(html);
  const main = $("main").first();
  if (!main.length) return [];
  const blocks: string[] = [];
  main.find("[data-template-block]").each((_, el) => {
    const b = $(el).attr("data-template-block");
    if (b) blocks.push(b);
  });
  return blocks;
}

function extractMainSectionIds(html: string): string[] {
  const $ = cheerio.load(html);
  return $("main section[id]")
    .map((_, el) => $(el).attr("id") || "")
    .get()
    .filter(Boolean);
}

function bodyAttr(html: string, name: string): string {
  const $ = cheerio.load(html);
  return ($("body").attr(name) || "").trim();
}

function readAreaCanonical(slug: string): string | null {
  const p = resolveCanonicalFinalRenderPagePath(BANNER, slug);
  if (!p || !fs.existsSync(p)) return null;
  return fs.readFileSync(p, "utf8");
}

async function main() {
  fs.mkdirSync(EVIDENCE, { recursive: true });

  record("legacy-file-deleted", !fs.existsSync(LEGACY_RENDERER), LEGACY_RENDERER);

  const ctx = buildContentGenerationContext(BANNER, SERVICE);
  const hierarchy = resolveLocalLocationHierarchy(ctx.resolvedSlug, ctx.serviceId, ctx.rawProfile);
  if (!hierarchy.ok) throw new Error(hierarchy.blockedReason || "hierarchy blocked");

  regenerateLocalAreaPagesOnly(ctx, hierarchy);
  await rebuildCanonicalLocalPagesOnly(BANNER, SERVICE);

  record("area-count", hierarchy.areas.length > 0, `${hierarchy.areas.length} areas`);

  const clusterHtml = readAreaCanonical("local-cluster-ecclesall");
  record("cluster-reference", Boolean(clusterHtml), "ecclesall cluster canonical");
  const clusterBlocks = clusterHtml ? extractTemplateBlockOrder(clusterHtml) : [];
  const clusterContract = clusterHtml
    ? validateLocalPageTypeContractHtml(clusterHtml, LOCAL_CLUSTER_V1_CONTRACT)
    : null;

  const blockSignatures = new Set<string>();
  const sectionSignatures = new Set<string>();
  let allAreasOk = true;
  const areaReport: Record<string, unknown>[] = [];

  for (const area of hierarchy.areas) {
    const canonKey = `local-${area.slug}`;
    const html = readAreaCanonical(canonKey);
    const exists = Boolean(html);
    if (!exists) {
      allAreasOk = false;
      areaReport.push({ slug: area.slug, ok: false, reason: "missing canonical" });
      continue;
    }
    const body = html!;
    const publishSource = bodyAttr(body, "data-publish-source");
    const contractAttr = bodyAttr(body, "data-local-page-contract");
    const legacyDesign = body.includes("data-publish-source=\"local-cluster-design-system\"");
    const v1 = publishSource === "local-area-v1";
    const contractVal = validateLocalPageTypeContractHtml(body, LOCAL_AREA_V1_CONTRACT);
    const blocks = extractTemplateBlockOrder(body);
    const sectionIds = extractMainSectionIds(body);
    blockSignatures.add(blocks.join("|"));
    sectionSignatures.add(sectionIds.join("|"));

    const parityBlocks =
      clusterBlocks.length > 0 && blocks.length > 0 && blocks.join("|") === clusterBlocks.join("|");
    const ok =
      v1 &&
      !legacyDesign &&
      contractAttr === LOCAL_AREA_CONTRACT_ID &&
      contractVal.ok &&
      parityBlocks;
    if (!ok) allAreasOk = false;
    areaReport.push({
      slug: area.slug,
      ok,
      publishSource,
      contractAttr,
      legacyDesign,
      contract: contractVal,
      templateBlocks: blocks,
      sectionIds,
      parityBlocks,
    });
  }

  record("areas-regenerated", allAreasOk, `${hierarchy.areas.length} area pages`);
  record("area-renderer-parity", blockSignatures.size === 1, `unique block trees: ${blockSignatures.size}`);
  record("area-section-parity", sectionSignatures.size === 1, `unique section id trees: ${sectionSignatures.size}`);
  record(
    "cluster-area-block-parity",
    clusterHtml ? blockSignatures.size === 1 && [...blockSignatures][0] === clusterBlocks.join("|") : false,
    "area template blocks match cluster v1",
  );
  record(
    "image-parity",
    areaReport.every((r) => (r as { contract?: { ok?: boolean } }).contract?.ok !== false),
    "hero/supporting/trust/conversion slots",
  );
  record(
    "typography-parity",
    areaReport.every((r) => typeof (r as { publishSource?: string }).publishSource === "string" && (r as { publishSource: string }).publishSource === "local-area-v1"),
    "local-area-v1 publish source + shared page CSS",
  );
  record(
    "component-parity",
    !fs.existsSync(LEGACY_RENDERER) &&
      areaReport.every((r) => !(r as { legacyDesign?: boolean }).legacyDesign),
    "no legacy design-system marker",
  );
  record(
    "cluster-contract-reference",
    clusterContract?.ok === true,
    clusterContract?.blockedReason || "cluster v1 contract ok",
  );

  const report = {
    sprint: "RC1-L11",
    tenant: BANNER,
    service: SERVICE,
    legacyRendererRemoved: !fs.existsSync(LEGACY_RENDERER),
    checks,
    areaReport,
    clusterTemplateBlocks: clusterBlocks,
    uniqueAreaBlockSignatures: [...blockSignatures],
  };
  fs.writeFileSync(path.join(EVIDENCE, "rc1-l11-report.json"), JSON.stringify(report, null, 2));

  const failed = checks.filter((c) => !c.pass);
  if (failed.length) {
    console.error("\nRC1-L11 FAILED:", failed.map((f) => f.id).join(", "));
    process.exit(1);
  }
  console.log("\nRC1-L11 PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
