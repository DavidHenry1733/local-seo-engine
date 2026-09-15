#!/usr/bin/env npx tsx
/**
 * NT-E2E-26A — Authenticated Master Admin validation (fetch + JS parse).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = process.argv[2] || "reliable-direct-pharmacy";
const BASE = process.env.MASTER_ADMIN_BASE || "https://app.pharmaconnect.uk";

function loadSessionSecret(): string {
  for (const envFile of [".env.production", ".env"]) {
    const p = path.join(PHARMACY_WORKSPACE_ROOT, envFile);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^SESSION_SECRET=(.+)$/);
      if (m) return m[1].replace(/^["']|["']$/g, "");
    }
  }
  try {
    const requireCjs = createRequire(import.meta.url);
    const eco = requireCjs(path.join(PHARMACY_WORKSPACE_ROOT, "ecosystem.config.cjs")) as {
      apps?: Array<{ env?: { SESSION_SECRET?: string } }>;
    };
    return eco.apps?.[0]?.env?.SESSION_SECRET || "";
  } catch {
    return process.env.SESSION_SECRET || "";
  }
}

async function fetchJson(url: string, secret: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
      ...(init?.headers || {}),
    },
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: res.status, json };
}

async function main() {
  const secret = loadSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET unavailable");

  const masterUrl = `${BASE}/api/admin/master?customer=${encodeURIComponent(SLUG)}`;
  const htmlRes = await fetch(masterUrl, { headers: { Authorization: `Bearer ${secret}` } });
  const html = await htmlRes.text();
  const script = html.match(/<script>([\s\S]*?)<\/script>/);
  const jsParseOk = script
    ? !(ts.createSourceFile("m.js", script[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS).parseDiagnostics || []).length
    : false;

  const dashboard = await fetchJson(`${BASE}/api/master-admin-platform/dashboard`, secret);
  const customer = await fetchJson(`${BASE}/api/master-admin-platform/customers/${encodeURIComponent(SLUG)}`, secret);
  const cge = await fetchJson(`${BASE}/api/master-admin-platform/customers/${encodeURIComponent(SLUG)}/commercial-ecosystem-generation`, secret);

  const confirmBlocked = await fetchJson(
    `${BASE}/api/master-admin-platform/customers/${encodeURIComponent(SLUG)}/commercial-ecosystem-generation/confirm`,
    secret,
    { method: "POST", body: JSON.stringify({}) },
  );

  console.log(
    JSON.stringify(
      {
        masterUrl,
        generateEcosystemUrl: `${masterUrl}&panel=generate-ecosystem`,
        htmlStatus: htmlRes.status,
        jsParseOk,
        loadingWorkflowInHtml: html.includes("Loading workflow"),
        dashboardStatus: dashboard.status,
        customerStatus: customer.status,
        stage: (customer.json as { customer?: { currentStage?: string } })?.customer?.currentStage,
        nextAction: (customer.json as { customer?: { nextAction?: string } })?.customer?.nextAction,
        cgeStatus: cge.status,
        acceptanceRequired: (cge.json as { dashboard?: { productOwnerAcceptance?: { required?: boolean } } })?.dashboard
          ?.productOwnerAcceptance?.required,
        generateAction: (cge.json as { dashboard?: { productOwnerAcceptance?: { generateActionLabel?: string } } })?.dashboard
          ?.productOwnerAcceptance?.generateActionLabel,
        inventoryTotal: (cge.json as { dashboard?: { canonicalInventorySummary?: { totalPages?: number } } })?.dashboard
          ?.canonicalInventorySummary?.totalPages,
        confirmWithoutOperatorStatus: confirmBlocked.status,
        automaticGenerationBlocked: confirmBlocked.status === 409,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
