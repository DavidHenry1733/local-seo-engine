#!/usr/bin/env npx tsx
/**
 * Google Profile Import CLI test — live diagnostics for share links and search.
 *
 * Usage:
 *   npx tsx scripts/test-google-profile-import-v1.ts \
 *     --slug=pharmacy-delivered-4u-test \
 *     --google-url="https://share.google/..."
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  diagnoseGoogleProfileImport,
  formatCandidateLine,
} from "../src/pharmacy/growthEngineGoogleProfileImportDiagnostics.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

function loadEnv(): void {
  const envFile = path.join(ROOT, ".env");
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (!process.env[key]) process.env[key] = trimmed.slice(eq + 1).trim();
  }
  if (!process.env.WORKSPACE_ROOT) process.env.WORKSPACE_ROOT = ROOT;
}

function parseArgs(argv: string[]): { slug: string; googleUrl: string } {
  let slug = "";
  let googleUrl = "";
  for (const arg of argv) {
    if (arg.startsWith("--slug=")) slug = arg.slice("--slug=".length).trim();
    else if (arg.startsWith("--google-url=")) googleUrl = arg.slice("--google-url=".length).trim();
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: npx tsx scripts/test-google-profile-import-v1.ts --slug=SLUG --google-url="URL"`);
      process.exit(0);
    }
  }
  return { slug, googleUrl };
}

async function main() {
  loadEnv();
  const { slug, googleUrl } = parseArgs(process.argv.slice(2));

  if (!slug) {
    console.error("Missing --slug= (e.g. --slug=pharmacy-delivered-4u-test)");
    process.exit(1);
  }

  const profilePath = path.join(ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(profilePath)) {
    console.error(`Profile not found: ${profilePath}`);
    process.exit(1);
  }

  console.log("\n=== Google Profile Import Test ===\n");
  console.log(`Slug: ${slug}`);
  console.log(`Input URL: ${googleUrl || "(none — name/town/postcode search only)"}`);

  const d = await diagnoseGoogleProfileImport(slug, googleUrl);

  console.log(`Resolved URL: ${d.resolvedUrl}${d.urlRedirected ? " (redirected)" : ""}`);
  console.log(`Place ID from URL: ${d.placeIdFromUrl || "(not found in URL)"}`);
  console.log(`kgmid detected: ${d.kgMidDetected || "(none)"}`);
  console.log(`q parameter detected: ${d.searchQueryFromUrl || "(none)"}`);
  console.log(`Entity hint used: ${d.entityHintUsed ? "yes" : "no"}`);
  if (d.kgMidSearchQuery) console.log(`kgmid search query: ${d.kgMidSearchQuery}`);
  console.log(`Fallback search queries:`);
  for (const q of d.fallbackSearchQueries) {
    console.log(`  - ${q || "(empty)"}`);
  }
  console.log(`API key detected: ${d.apiKeyDetected ? "yes" : "no"}`);
  console.log(`Place Details API: ${d.placeDetailsStatus}`);
  console.log(`Text Search API: ${d.textSearchStatus}`);
  console.log(`Raw kgmid Text Search results (before filter): ${d.rawKgMidCandidateCount}`);
  if (d.rawKgMidCandidates.length) {
    d.rawKgMidCandidates.forEach((c, i) => console.log(`  raw ${formatCandidateLine(c, i)}`));
  }
  if (d.filteredOut.length) {
    console.log("Filtered out:");
    d.filteredOut.forEach((f) => console.log(`  ${f.businessName || f.placeId}: ${f.reason}`));
  }
  console.log(`Candidate count: ${d.candidateCount}`);

  if (d.candidates.length) {
    console.log("\nTop candidates:");
    d.candidates.forEach((c, i) => console.log(`  ${formatCandidateLine(c, i)}`));
  } else {
    console.log("\nTop candidates: (none)");
  }

  console.log("");
  if (d.selectedCandidate) {
    console.log("Selected candidate (auto-confirm eligible):");
    console.log(`  ${formatCandidateLine(d.selectedCandidate, 0)}`);
  } else if (d.possibleMatch && d.candidates.length) {
    console.log("Possible Match — review required (not auto-confirmed):");
    d.candidates.forEach((c, i) => console.log(`  ${formatCandidateLine(c, i)}`));
  } else {
    console.log(`Failure: ${d.failureReason || "Unknown failure"}`);
  }

  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
