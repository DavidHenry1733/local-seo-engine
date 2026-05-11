/**
 * buildClusterConfigs.ts
 *
 * Bridge layer: Area Engine output → Cluster page config objects.
 *
 * Converts selected ranked areas into the typed SelectedAreaPageDef
 * objects and the enriched ClusterConfigEnriched JSON that drives
 * deployClusterPage.ts + generateClusterContent.ts.
 *
 * No AI is used. All keyword derivation and path building is deterministic.
 *
 * Spec ref: Area Engine Integration Spec v1 — Sections 3, 6, 7.2
 */

import fs   from "node:fs";
import path from "node:path";

import { slugify }         from "../seo/slugify";
import { clusterPath }     from "../pageSlug";
import type {
  AreaContentSignals,
  AreaEngineOutput,
  AreaTier,
} from "../area/areaTypes";

// ── SelectedAreaPageDef ───────────────────────────────────────────────────────
//
// Internal rich object that holds everything known about a single
// selected area before writing any file. Matches the spec exactly.

export interface SelectedAreaPageDef {
  // ── Identification ────────────────────────────────────────────────────────
  /** Area name exactly as used in page titles and slugs, e.g. "Ecclesall" */
  area:    string;
  /** Parent city name, e.g. "Sheffield" */
  city:    string;
  /** Service name, e.g. "Web Design" */
  service: string;
  /** Opportunity tier from the area engine */
  tier:    AreaTier;

  // ── SEO ───────────────────────────────────────────────────────────────────
  /** "<service> <area>" — never includes the parent city */
  primaryKeyword:     string;
  /** Three deterministic supporting keywords derived from area signals */
  supportingKeywords: string[];

  // ── Internal linking ──────────────────────────────────────────────────────
  /** Hub page URL (project domain root with trailing slash) */
  hubUrl:       string;
  /** Hub page anchor text: "<service> <city>" */
  hubAnchor:    string;
  /** Comma-separated related area page labels for the cluster prompt */
  relatedPages: string;

  // ── Area intelligence ─────────────────────────────────────────────────────
  /** Full content signals for this area — injected into the AI prompt */
  signals: AreaContentSignals;

  // ── File targets ──────────────────────────────────────────────────────────
  /** Root-relative URL path for this page, e.g. "/ecclesall/" */
  remotePath:  string;
  /** Relative path for the generated cluster config JSON file */
  configPath:  string;
}

// ── ClusterConfigEnriched ─────────────────────────────────────────────────────
//
// Superset of the existing ClusterConfig format read by deployClusterPage.ts.
// Fields that deployClusterPage.ts does not yet know about (areaSignals, tier,
// parentCity) are ignored at deploy time until that script is updated in Step 4.

export interface ClusterConfigEnriched {
  // Existing fields (compatible with deployClusterPage.ts)
  service:            string;
  /** Area name — mirrors `location` for explicit clarity */
  location:           string;
  primaryKeyword:     string;
  supportingKeywords: string[];
  hubUrl:             string;
  hubAnchor:          string;
  relatedPages:       string;
  remotePath:         string;
  imageGroup:         string;
  heroImage:          string;

  // Extended fields (spec additions — Section 6.2)
  /** Explicit area field (same value as location) */
  area:        string;
  /** Parent city name */
  parentCity:  string;
  /** Opportunity tier from the area engine */
  tier:        AreaTier;
  /** Full area content signals for prompt injection */
  areaSignals: AreaContentSignals;
}

// ── Deterministic keyword derivation ─────────────────────────────────────────
//
// Spec ref: Section 3.3 — three keywords per area, no AI call.

export function deriveKeywords(
  serviceName: string,
  area:        string,
  signals:     AreaContentSignals
): string[] {
  const svc = serviceName.toLowerCase();

  // Prefer an explicit keywordModifier when present (e.g. "high street").
  // Falls back to extracting the first word of businessType.
  // e.g. "service-led and lifestyle-focused businesses..." → "service-led"
  const modifier = signals.keywordModifier
    ?? (signals.businessType.split(/[\s,;]+/)[0]?.replace(/[^a-z-]/gi, "") ?? "local");

  return [
    `${area} ${svc}`,
    `affordable ${svc} ${area}`,
    `${svc} for ${modifier} businesses in ${area}`,
    `professional ${svc} ${area}`,
  ];
}

// ── Single area def builder ───────────────────────────────────────────────────

/**
 * Converts one selected area name into a fully typed SelectedAreaPageDef.
 *
 * Requires:
 *   engineOutput  — result of runAreaEngine() for the city/service
 *   projectDomain — e.g. "https://local.inboxingproweb.com"
 *   clientSlug    — e.g. "inboxingproweb-local" (used in the config filename)
 */
export function buildSelectedAreaDef(
  areaName:      string,
  engineOutput:  AreaEngineOutput,
  projectDomain: string,
  clientSlug:    string
): SelectedAreaPageDef {
  const { city, serviceName, rankedAreas, contentSignals, relatedAreaMap } =
    engineOutput;

  // ── Validate area exists in engine output ──────────────────────────────────
  const signals = contentSignals[areaName];
  if (!signals) {
    throw new Error(
      `Area "${areaName}" has no content signals in engine output for ${city}. ` +
      `Available areas: ${Object.keys(contentSignals).join(", ")}`
    );
  }

  const ranked = rankedAreas.find((r) => r.area === areaName);
  if (!ranked) {
    throw new Error(
      `Area "${areaName}" not found in ranked output for ${city}.`
    );
  }

  // ── Keywords ───────────────────────────────────────────────────────────────
  // Primary: "<service> <area>" — no parent city appended (spec Section 3.2)
  const primaryKeyword     = `${serviceName} ${areaName}`;
  const supportingKeywords = deriveKeywords(serviceName, areaName, signals);

  // ── Internal linking ───────────────────────────────────────────────────────
  // Hub URL is the campaign hub page: /service-slug-city-slug/
  // e.g. /web-design-barnsley/ — NOT the site root
  const _citySlug = city.toLowerCase().replace(/\s+/g, "-");
  const _svcSlug  = serviceName.toLowerCase().replace(/\s+/g, "-");
  const hubUrl    = `${projectDomain.replace(/\/+$/, "")}/${_svcSlug}-${_citySlug}/`;
  const hubAnchor = `${serviceName} ${city}`;

  // Related pages from the area engine's map (spec Section 3.4)
  // Include each page's URL in parentheses so the AI prompt can use exact paths
  const _svcSlugForRelated = slugify(serviceName);
  const related = (relatedAreaMap[areaName] ?? [])
    .map((name) => {
      const relatedAreaSlug = slugify(name);
      return `${serviceName} ${name} (/${_svcSlugForRelated}-${relatedAreaSlug}/)`;
    })
    .join(", ");

  // ── File paths ─────────────────────────────────────────────────────────────
  const areaSlug    = slugify(areaName);
  const serviceSlug = slugify(serviceName);
  const remotePath  = clusterPath(serviceName, areaName);
  const configPath  = path.join(
    "config", "clusters",
    `${clientSlug}-${serviceSlug}-${areaSlug}.json`
  );

  return {
    area:               areaName,
    city,
    service:            serviceName,
    tier:               ranked.tier,
    primaryKeyword,
    supportingKeywords,
    hubUrl,
    hubAnchor,
    relatedPages:       related,
    signals,
    remotePath,
    configPath,
  };
}

// ── Config object builder ─────────────────────────────────────────────────────

/**
 * Converts a SelectedAreaPageDef into the enriched cluster config object
 * ready to be written to disk and consumed by deployClusterPage.ts.
 */
export function buildClusterConfig(
  def: SelectedAreaPageDef
): ClusterConfigEnriched {
  const service = def.service ?? "web design";
  const serviceSlug = slugify(service);

  return {
    // ── Existing-format fields ───────────────────────────────────────────────
    service:            service,
    location:           def.area,
    primaryKeyword:     def.primaryKeyword,
    supportingKeywords: def.supportingKeywords,
    hubUrl:             def.hubUrl,
    hubAnchor:          def.hubAnchor,
    relatedPages:       def.relatedPages,
    remotePath:         def.remotePath,
    imageGroup:         `assets/${serviceSlug}`,
    heroImage:          "hero-v1.png",

    // ── Extended fields (spec additions) ─────────────────────────────────────
    area:        def.area,
    parentCity:  def.city,
    tier:        def.tier,
    areaSignals: def.signals,
  };
}

// ── File writer ───────────────────────────────────────────────────────────────

/**
 * Writes a ClusterConfigEnriched to disk at the path specified in the def.
 * Creates the directory if it does not exist.
 * Returns the written file path.
 */
export function writeClusterConfig(
  def:    SelectedAreaPageDef,
  config: ClusterConfigEnriched
): string {
  const dir = path.dirname(def.configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    def.configPath,
    JSON.stringify(config, null, 2),
    "utf8"
  );
  return def.configPath;
}

// ── Batch builder ─────────────────────────────────────────────────────────────

/**
 * Converts a list of selected area names into SelectedAreaPageDef objects.
 * Runs against a single pre-computed engine output — call runAreaEngine()
 * once and pass the result here.
 *
 * Areas are returned sorted by tier then by rank (priority → secondary → tertiary).
 */
export function buildAllSelectedAreaDefs(
  selectedAreas: string[],
  engineOutput:  AreaEngineOutput,
  projectDomain: string,
  clientSlug:    string
): SelectedAreaPageDef[] {
  const TIER_ORDER: Record<AreaTier, number> = {
    hub:       -1,
    priority:  0,
    secondary: 1,
    tertiary:  2,
    cluster:   3,
  };

  return selectedAreas
    .map((area) =>
      buildSelectedAreaDef(area, engineOutput, projectDomain, clientSlug)
    )
    .sort(
      (a, b) =>
        TIER_ORDER[a.tier] - TIER_ORDER[b.tier] ||
        a.area.localeCompare(b.area)
    );
}
