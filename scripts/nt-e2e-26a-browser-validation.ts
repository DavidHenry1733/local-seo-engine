#!/usr/bin/env npx tsx
/**
 * NT-E2E-26A — Master Admin workflow + Generate Ecosystem browser validation.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { chromium } from "playwright";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const SLUG = process.argv[2] || "reliable-direct-pharmacy";
const BASE = process.env.MASTER_ADMIN_BASE || "https://app.pharmaconnect.uk";
const MASTER_URL = `${BASE}/api/admin/master?customer=${encodeURIComponent(SLUG)}`;
const CGE_URL = `${MASTER_URL}&panel=generate-ecosystem`;

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

async function main() {
  const secret = loadSessionSecret();
  if (!secret) throw new Error("SESSION_SECRET unavailable");

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    extraHTTPHeaders: { Authorization: `Bearer ${secret}` },
  });
  const page = await context.newPage();
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("requestfailed", (req) => failedRequests.push(`${req.method()} ${req.url()} ${req.failure()?.errorText || ""}`));

  await page.goto(MASTER_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  const html = await page.content();
  const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
  const parseOk = scriptMatch
    ? !(ts.createSourceFile("m.js", scriptMatch[1], ts.ScriptTarget.Latest, true, ts.ScriptKind.JS).parseDiagnostics || []).length
    : false;

  const loadingWorkflowVisible = await page.locator("text=Loading workflow").isVisible().catch(() => false);
  const workflowRendered = await page.locator("#workflowOverview .workflow-row").count();
  const customerModalOpen = await page.locator("#customerModal.open").isVisible().catch(() => false);
  const detailLoading = await page.locator("#detailLoading").isVisible().catch(() => false);

  await page.goto(CGE_URL, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2500);

  const cgeModalOpen = await page.locator("#cgeModal.open").isVisible().catch(() => false);
  const cgeContent = await page.locator("#cgeContent").isVisible().catch(() => false);
  const inventoryVisible = await page.locator("#cgeInventorySection").isVisible().catch(() => false);
  const externalVisible = await page.locator("#cgeExternalPackageSection").isVisible().catch(() => false);
  const generateBtnText = (await page.locator("#cgeGenerateBtn").textContent().catch(() => "")) || "";
  const stageText = (await page.locator("#detailMeta").textContent().catch(() => "")) || "";

  let dialogOpened = false;
  let cancelBlocked = false;
  page.once("dialog", async (dialog) => {
    dialogOpened = true;
    await dialog.dismiss();
    cancelBlocked = true;
  });
  if (cgeContent) {
    const box = page.locator("#cgeConfirmCheckbox");
    if (await box.isVisible().catch(() => false)) await box.check();
    if (await page.locator("#cgeGenerateBtn").isEnabled().catch(() => false)) {
      await page.locator("#cgeGenerateBtn").click();
      await page.waitForTimeout(500);
    }
  }

  await browser.close();

  const result = {
    masterUrl: MASTER_URL,
    generateEcosystemUrl: CGE_URL,
    jsParseOk: parseOk,
    loadingWorkflowVisible,
    workflowRowCount: workflowRendered,
    customerModalOpen,
    detailLoadingVisible: detailLoading,
    cgeModalOpen,
    cgeContentVisible: cgeContent,
    inventoryVisible,
    externalPackageVisible: externalVisible,
    generateBtnText: generateBtnText.trim(),
    stageText: stageText.trim(),
    confirmationDialogOpened: dialogOpened,
    cancelBlockedGeneration: cancelBlocked,
    consoleErrors,
    failedRequests,
  };
  console.log(JSON.stringify(result, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
