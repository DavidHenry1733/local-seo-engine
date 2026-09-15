/**
 * Google Places Live Connection Fix V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GOOGLE_PLACES_ENV_VAR, hasGooglePlacesApiKey } from "../src/pharmacy/googlePlacesConnection.ts";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyCompetitorDiscovery.ts";
import {
  competitorSnapshotPath,
  formatLocalMarketPlacesError,
  loadCompetitorSnapshot,
} from "../src/pharmacy/growthEngineLocalMarketService.ts";
import { renderLocalMarketIntelligencePage } from "../src/pharmacy/growthEngineLocalMarketPage.ts";

const SLUG = "dhmdigital";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function loadRootEnv(): void {
  const envFile = path.join(projectRoot, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
  if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = projectRoot;
}

loadRootEnv();

const checks: Array<{ id: string; pass: boolean; detail?: string }> = [];

function record(id: string, pass: boolean, detail?: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}${detail ? ` — ${detail}` : ""}`);
}

record("workspace-root", WORKSPACE_ROOT === projectRoot, WORKSPACE_ROOT);
record("env-var-name", GOOGLE_PLACES_ENV_VAR === "GOOGLE_PLACES_API_KEY");
record("api-key-detected", hasGooglePlacesApiKey());

const ecosystem = fs.readFileSync(path.join(projectRoot, "ecosystem.config.cjs"), "utf8");
record("ecosystem-places-key", ecosystem.includes("GOOGLE_PLACES_API_KEY"));

const snapshot = loadCompetitorSnapshot(SLUG);
record("snapshot-exists", Boolean(snapshot));
record("snapshot-live-source", snapshot?.source === "google-places-live", snapshot?.source);
record("snapshot-competitors", (snapshot?.competitors.length ?? 0) >= 5, String(snapshot?.competitors.length ?? 0));
record(
  "snapshot-healthcare",
  (snapshot?.healthcare?.providers.length ?? 0) > 0,
  String(snapshot?.healthcare?.providers.length ?? 0),
);
record("snapshot-canonical-path", competitorSnapshotPath(SLUG).includes("/data/growth-engine/"));
record("no-places-error", !formatLocalMarketPlacesError(snapshot));

const html = renderLocalMarketIntelligencePage(SLUG, snapshot, {});
record("page-shows-competitors", html.includes("FastMeds") || html.includes("Pharmacy"));
record("page-error-helper", html.includes("Google Places connection failed") || !formatLocalMarketPlacesError(snapshot));

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length ? "❌" : "✅"} ${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
