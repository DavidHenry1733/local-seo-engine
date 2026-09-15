#!/usr/bin/env npx tsx
/**
 * Campaign Explorer Service Count Emergency Debug V1 — rendered HTML parity validation.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type { AddressInfo } from "node:net";
import { renderCustomerSetupConfirmPage } from "../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { renderCampaignBuilderPage } from "../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { readSetupProfile, backfillCustomerVisibleServicesForSlug } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import {
  WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
  bypassCampaignBuilderExistingServicesCache,
  resolveConfirmPageWebsiteImportServices,
} from "../src/pharmacy/growthEngineCampaignExplorerWebsiteServices.ts";
import growthEnginePageRouter from "../artifacts/api-server/src/routes/growthEnginePageRouter.ts";
import growthEngineCampaignBuilderPageRouter from "../artifacts/api-server/src/routes/growthEngineCampaignBuilderPageRouter.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const express = require(path.join(ROOT, "artifacts/api-server/node_modules/express")) as typeof import("express");

if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;

const DEFAULT_SLUG = "pharmacy-delivered-4u-test";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function parseSlug(): string {
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith("--slug=")) return arg.slice("--slug=".length);
  }
  return DEFAULT_SLUG;
}

function parseConfirmServicesDetectedCount(html: string): number | null {
  const m = html.match(
    /Services detected<\/span><span class="css-row-value">([^<]+)<\/span>/i,
  );
  if (!m) return null;
  const value = m[1].trim();
  const n = parseInt(value, 10);
  if (!Number.isNaN(n)) return n;
  const names = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return names.length || null;
}

function parseExplorerExistingCount(html: string): number | null {
  const m = html.match(/Services Already On Your Website \((\d+)\)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseExplorerExistingNames(html: string): string[] {
  const start = html.indexOf("Services Already On Your Website");
  if (start === -1) return [];
  const end = html.indexOf("</details>", start);
  const chunk = end === -1 ? html.slice(start) : html.slice(start, end);
  const names: string[] = [];
  const re = /<h4>([^<]+)<\/h4>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(chunk))) names.push(m[1].trim());
  return names;
}

function parseDebugComment(html: string): { source: string; count: number } | null {
  const m = html.match(/<!-- existing-services-source: ([^ ]+) count: (\d+) -->/);
  if (!m) return null;
  return { source: m[1], count: parseInt(m[2], 10) };
}

async function fetchRouteHtml(base: string, routePath: string): Promise<string> {
  const res = await fetch(`${base}${routePath}`, { headers: { Accept: "text/html" } });
  if (!res.ok) throw new Error(`${routePath} HTTP ${res.status}`);
  return res.text();
}

async function main() {
  console.log("\n=== Campaign Explorer Service Count Emergency Debug V1 ===\n");

  const slug = parseSlug();
  await backfillCustomerVisibleServicesForSlug(slug);
  bypassCampaignBuilderExistingServicesCache(slug);
  const confirm = resolveConfirmPageWebsiteImportServices(slug);

  const confirmHtmlDirect = renderCustomerSetupConfirmPage(slug);
  const builderHtmlDirect = renderCampaignBuilderPage(slug, "choose");

  const confirmCountDirect = parseConfirmServicesDetectedCount(confirmHtmlDirect);
  const explorerCountDirect = parseExplorerExistingCount(builderHtmlDirect);
  const explorerNamesDirect = parseExplorerExistingNames(builderHtmlDirect);
  const debugComment = parseDebugComment(builderHtmlDirect);

  record(
    "direct-confirm-count",
    confirmCountDirect === confirm.confirmPageServiceCount,
    `HTML=${confirmCountDirect} view=${confirm.confirmPageServiceCount}`,
  );
  record(
    "direct-counts-match",
    confirmCountDirect !== null &&
      explorerCountDirect !== null &&
      confirmCountDirect === explorerCountDirect,
    `confirm=${confirmCountDirect} explorer=${explorerCountDirect}`,
  );
  record(
    "direct-names-match",
    explorerNamesDirect.length === confirm.confirmPageServiceList.length &&
      explorerNamesDirect.every(
        (name, i) => name.toLowerCase() === confirm.confirmPageServiceList[i]?.toLowerCase(),
      ),
    explorerNamesDirect.join(", "),
  );
  record(
    "no-extra-explorer-services",
    !explorerNamesDirect.some(
      (name) => !confirm.confirmPageServiceList.some((c) => c.toLowerCase() === name.toLowerCase()),
    ),
    `${explorerNamesDirect.length} explorer vs ${confirm.confirmPageServiceList.length} confirm`,
  );
  record(
    "debug-html-comment",
    Boolean(debugComment && debugComment.source === WEBSITE_IMPORT_SERVICE_SOURCE_FIELD),
    debugComment ? `${debugComment.source} count: ${debugComment.count}` : "missing",
  );
  record(
    "debug-comment-count",
    debugComment?.count === explorerCountDirect,
    String(debugComment?.count),
  );

  if (confirmCountDirect !== null && explorerCountDirect !== null) {
    record(
      "tenant-conditional-parity",
      confirmCountDirect === explorerCountDirect,
      `confirm shows ${confirmCountDirect}; explorer shows ${explorerCountDirect}`,
    );
  }

  const app = express();
  app.use("/api", growthEnginePageRouter);
  app.use("/api", growthEngineCampaignBuilderPageRouter);

  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const addr = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${addr.port}/api`;

  try {
    const confirmRouteHtml = await fetchRouteHtml(
      base,
      `/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(slug)}`,
    );
    const builderRouteHtml = await fetchRouteHtml(
      base,
      `/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=choose`,
    );

    const confirmCountRoute = parseConfirmServicesDetectedCount(confirmRouteHtml);
    const explorerCountRoute = parseExplorerExistingCount(builderRouteHtml);
    const explorerNamesRoute = parseExplorerExistingNames(builderRouteHtml);

    record("route-confirm-200", confirmRouteHtml.includes("Review Imported Details"), "confirm route");
    record("route-builder-200", builderRouteHtml.includes("ce-explorer"), "builder route");
    record(
      "route-counts-match",
      confirmCountRoute !== null &&
        explorerCountRoute !== null &&
        confirmCountRoute === explorerCountRoute,
      `confirm=${confirmCountRoute} explorer=${explorerCountRoute}`,
    );
    record(
      "route-names-match",
      explorerNamesRoute.length === confirm.confirmPageServiceList.length &&
        explorerNamesRoute.every(
          (name, i) => name.toLowerCase() === confirm.confirmPageServiceList[i]?.toLowerCase(),
        ),
      explorerNamesRoute.join(", "),
    );
    record(
      "route-debug-comment",
      Boolean(parseDebugComment(builderRouteHtml)),
      parseDebugComment(builderRouteHtml)?.source || "missing",
    );
  } finally {
    server.close();
  }

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) {
    failed.forEach((c) => console.log(`  FAIL: ${c.id} — ${c.detail}`));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
