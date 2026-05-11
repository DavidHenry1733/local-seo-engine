/**
 * Pre-deploy validation for a generated cluster.
 *
 * Checks:
 *   A. City mismatch — no page in cluster X references a different cluster's primaryCity
 *   B. Map embed — every page uses businessAddress (not page location)
 *   C. Profile injection — every priority area page has its profile text in local-relevance section
 *   D. Hardcoded area cross-contamination — runs a configurable block-list per cluster
 *
 * Usage:
 *   pnpm exec tsx src/validate/validateCluster.ts config/projects/<config>.json
 */

import fs from "node:fs";
import path from "node:path";

// ── Types ─────────────────────────────────────────────────────────────────────

type AreaConfig = {
  primaryCity: string;
  coreAreas: string[];
  priorityAreas: string[];
  areaProfiles?: Record<string, { character: string; knownFor: string; businessType: string }>;
};

type ProjectConfig = {
  clientSlug: string;
  businessAddress: string;
  areaConfig?: string;
  areaConfigs?: string[];
};

type Issue = { slug: string; check: string; detail: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

function readPage(outputDir: string, slug: string): string {
  const p = path.join(outputDir, slug, "index.html");
  if (!fs.existsSync(p)) return "";
  return fs.readFileSync(p, "utf8");
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const configPath = process.argv[2];
  if (!configPath) {
    throw new Error("Usage: pnpm exec tsx src/validate/validateCluster.ts config/projects/<config>.json");
  }

  const project   = loadJson<ProjectConfig>(configPath);
  const outputDir = path.join("output", project.clientSlug);

  const clusterNames = project.areaConfigs ?? (project.areaConfig ? [project.areaConfig] : []);
  if (clusterNames.length === 0) {
    console.log("No area clusters configured — nothing to validate.");
    return;
  }

  // Build cluster map: clusterName → AreaConfig
  const clusters = new Map<string, AreaConfig>();
  for (const name of clusterNames) {
    const cfg = loadJson<AreaConfig>(path.join("config/areas", `${name}.json`));
    clusters.set(name, cfg);
  }

  const issues: Issue[] = [];
  let checks = 0;

  for (const [clusterName, cfg] of clusters) {
    // Build the set of OTHER clusters' primaryCities for cross-contamination check
    const otherCities = [...clusters.entries()]
      .filter(([n]) => n !== clusterName)
      .map(([, c]) => c.primaryCity.toLowerCase());

    // All page slugs for this cluster (hub + areas)
    const service = "web-design"; // single service for now
    const hubSlug  = `${service}-${slugify(cfg.primaryCity)}`;
    const areaSlugs = cfg.coreAreas.map((a) => `${service}-${slugify(a)}`);
    const allSlugs  = [hubSlug, ...areaSlugs];

    for (const slug of allSlugs) {
      const html = readPage(outputDir, slug);
      if (!html) {
        issues.push({ slug, check: "FILE_MISSING", detail: `index.html not found in ${outputDir}/${slug}/` });
        continue;
      }

      const isHub   = slug === hubSlug;
      const area    = isHub ? cfg.primaryCity : cfg.coreAreas.find((a) => slug.endsWith(slugify(a))) ?? slug;

      checks++;

      // ── A. City mismatch ────────────────────────────────────────────────────
      // Exclude the businessAddress from this check — all pages intentionally
      // display it in the map section regardless of cluster.
      // Strip both plain text and URL-encoded variants so neither triggers the check.
      const htmlForCityCheck = html
        .split(project.businessAddress).join("__BUSINESS_ADDR__")
        .split(encodeURIComponent(project.businessAddress)).join("__BUSINESS_ADDR_ENC__");
      for (const otherCity of otherCities) {
        const regex = new RegExp(`\\b${otherCity}\\b`, "i");
        if (regex.test(htmlForCityCheck)) {
          const match = htmlForCityCheck.match(new RegExp(`.{0,40}${otherCity}.{0,40}`, "i"))?.[0] ?? "";
          issues.push({
            slug,
            check: "CITY_MISMATCH",
            detail: `Found "${otherCity}" in ${clusterName} page (outside businessAddress). Context: "...${match.trim()}..."`,
          });
        }
      }

      // ── B. Map embed uses businessAddress ───────────────────────────────────
      const encodedBA   = encodeURIComponent(project.businessAddress);
      const mapUrlMatch = html.includes(`q=${encodedBA}`);
      if (!mapUrlMatch) {
        const actualQuery = html.match(/q=([^&"]+)/)?.[1] ?? "(not found)";
        issues.push({
          slug,
          check: "MAP_WRONG_QUERY",
          detail: `Expected q=${encodedBA}, found q=${actualQuery}`,
        });
      }
      // Map body text must mention businessAddress
      if (!html.includes(project.businessAddress)) {
        issues.push({
          slug,
          check: "MAP_BODY_MISSING_ADDRESS",
          detail: `businessAddress "${project.businessAddress}" not found in map body text`,
        });
      }

      // ── C. Profile injection in local-relevance (priority area pages only) ──
      if (!isHub && cfg.priorityAreas.includes(area) && cfg.areaProfiles?.[area]) {
        const profile      = cfg.areaProfiles[area];
        const profileCheck = `${area} — ${profile.character}`;
        if (!html.includes(profileCheck)) {
          issues.push({
            slug,
            check: "PROFILE_INJECTION_MISSING",
            detail: `Expected profile text "${profileCheck}" in local-relevance section`,
          });
        }
      }

      // ── D. Hub authority section uses cluster areas (not other cluster's areas) ──
      if (isHub) {
        for (const otherCfg of clusters.values()) {
          if (otherCfg.primaryCity === cfg.primaryCity) continue;
          for (const otherArea of otherCfg.coreAreas) {
            const pattern = new RegExp(`\\b${otherArea}\\b`, "i");
            if (pattern.test(html)) {
              issues.push({
                slug,
                check: "AUTHORITY_SECTION_CONTAMINATION",
                detail: `Hub authority section contains "${otherArea}" from a different cluster`,
              });
            }
          }
        }
      }
    }
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`║  CLUSTER VALIDATION REPORT                           ║`);
  console.log(`╠══════════════════════════════════════════════════════╣`);
  console.log(`║  Config      ${configPath.padEnd(38)}║`);
  console.log(`║  Clusters    ${clusterNames.join(", ").padEnd(38)}║`);
  console.log(`║  Pages checked  ${String(checks).padEnd(35)}║`);
  console.log(`║  Issues found   ${String(issues.length).padEnd(35)}║`);
  console.log(`╚══════════════════════════════════════════════════════╝\n`);

  if (issues.length === 0) {
    console.log("  ✅  All checks passed — safe to deploy.\n");
    return;
  }

  for (const iss of issues) {
    console.log(`  ❌  [${iss.check}] ${iss.slug}`);
    console.log(`       ${iss.detail}\n`);
  }

  process.exit(1);
}

main().catch((err) => {
  console.error("Validation failed:", err.message);
  process.exit(1);
});
