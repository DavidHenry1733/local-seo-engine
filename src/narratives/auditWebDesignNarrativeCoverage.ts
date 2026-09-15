import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildWebDesignNarrativePackage } from "./buildWebDesignNarrativePackage";

type NarrativeKey = "growth" | "trust" | "competition" | "conversion" | "authority";

interface AreaMapItem {
  area: string;
  city: string;
}

interface AuditRow {
  pageSlug: string;
  area: string;
  city: string;
  profile: string;
  narrativeKey: NarrativeKey;
  cta: string;
}

const OUTPUT_ROOT = path.join("output", "inboxingproweb");
const AREA_MAP_PATH = path.join("config", "area-profiles", "web-design-area-map.json");
const TOTAL_KEYS: NarrativeKey[] = ["growth", "trust", "competition", "conversion", "authority"];

function findProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (currentDir !== path.dirname(currentDir)) {
    if (
      fs.existsSync(path.join(currentDir, OUTPUT_ROOT)) &&
      fs.existsSync(path.join(currentDir, AREA_MAP_PATH))
    ) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return process.cwd();
}

function readJson<T>(relativePath: string): T {
  return JSON.parse(fs.readFileSync(path.join(findProjectRoot(), relativePath), "utf8")) as T;
}

function toTitleCaseFromSlug(slug: string): string {
  return slug
    .replace(/^web-design-/, "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function inferCity(area: string, areaMap: AreaMapItem[]): string {
  const mappedArea = areaMap.find((item) => normalise(item.area) === normalise(area));

  if (mappedArea) {
    return mappedArea.city;
  }

  const knownCity = areaMap.find((item) => normalise(item.city) === normalise(area));
  return knownCity?.city ?? area;
}

function getWebDesignPageSlugs(): string[] {
  const outputPath = path.join(findProjectRoot(), OUTPUT_ROOT);

  return fs
    .readdirSync(outputPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("web-design-"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

export function auditWebDesignNarrativeCoverage(): AuditRow[] {
  const areaMap = readJson<AreaMapItem[]>(AREA_MAP_PATH);

  return getWebDesignPageSlugs().map((pageSlug) => {
    const area = toTitleCaseFromSlug(pageSlug);
    const city = inferCity(area, areaMap);
    const narrativePackage = buildWebDesignNarrativePackage(area, city);

    return {
      pageSlug,
      area,
      city,
      profile: narrativePackage.profile,
      narrativeKey: narrativePackage.narrativeKey,
      cta: narrativePackage.selected.cta,
    };
  });
}

function buildTotals(rows: AuditRow[]): Record<NarrativeKey, number> {
  return rows.reduce<Record<NarrativeKey, number>>(
    (totals, row) => {
      totals[row.narrativeKey] += 1;
      return totals;
    },
    {
      growth: 0,
      trust: 0,
      competition: 0,
      conversion: 0,
      authority: 0,
    },
  );
}

function pad(value: string, length: number): string {
  return value.length >= length ? value : value.padEnd(length, " ");
}

export function formatWebDesignNarrativeAudit(rows: AuditRow[]): string {
  const totals = buildTotals(rows);
  const tableRows = rows.map((row) =>
    [
      pad(row.pageSlug, 34),
      pad(row.area, 24),
      pad(row.city, 12),
      pad(row.profile, 22),
      pad(row.narrativeKey, 12),
      row.cta,
    ].join(" | "),
  );

  return [
    "WEB DESIGN NARRATIVE COVERAGE AUDIT",
    "",
    [
      pad("Page Slug", 34),
      pad("Area", 24),
      pad("City", 12),
      pad("Profile", 22),
      pad("Narrative", 12),
      "CTA",
    ].join(" | "),
    [
      "-".repeat(34),
      "-".repeat(24),
      "-".repeat(12),
      "-".repeat(22),
      "-".repeat(12),
      "-".repeat(40),
    ].join(" | "),
    ...tableRows,
    "",
    "Totals by narrativeKey:",
    ...TOTAL_KEYS.map((key) => `${key}: ${totals[key]}`),
  ].join("\n");
}

function isCliRun(): boolean {
  const invoked = process.argv[1] ? path.basename(process.argv[1]) : "";
  return /^auditWebDesignNarrativeCoverage\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  console.log(formatWebDesignNarrativeAudit(auditWebDesignNarrativeCoverage()));
}
