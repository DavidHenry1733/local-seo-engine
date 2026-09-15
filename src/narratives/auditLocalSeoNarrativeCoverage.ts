import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildLocalSeoNarrativePackage,
  type LocalSeoNarrativeKey,
} from "./buildLocalSeoNarrativePackage";

interface AreaMapItem {
  area: string;
  city: string;
}

interface ClusterConfig {
  location: string;
  remotePath?: string;
  parentCity?: string;
  areaSignals?: {
    city?: string;
  };
}

interface AuditRow {
  pageSlug: string;
  area: string;
  city: string;
  profile: string;
  narrativeKey: LocalSeoNarrativeKey;
  cta: string;
}

const CLUSTER_ROOT = path.join("config", "clusters");
const AREA_MAP_PATH = path.join("config", "area-profiles", "local-seo-area-map.json");
const TOTAL_KEYS: LocalSeoNarrativeKey[] = ["visibility", "competition", "growth", "authority", "conversion"];

function findProjectRoot(): string {
  let currentDir = path.dirname(fileURLToPath(import.meta.url));

  while (currentDir !== path.dirname(currentDir)) {
    if (
      fs.existsSync(path.join(currentDir, CLUSTER_ROOT)) &&
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

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function inferCity(area: string, cluster: ClusterConfig, areaMap: AreaMapItem[]): string {
  const mappedArea = areaMap.find((item) => normalise(item.area) === normalise(area));

  return cluster.parentCity ?? cluster.areaSignals?.city ?? mappedArea?.city ?? area;
}

function getLocalSeoClusterFiles(): string[] {
  const clusterPath = path.join(findProjectRoot(), CLUSTER_ROOT);

  return fs
    .readdirSync(clusterPath, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^inboxingproweb-local-seo-.*\.json$/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function slugFromCluster(fileName: string, cluster: ClusterConfig): string {
  return cluster.remotePath?.replace(/\//g, "").trim() || fileName.replace(/\.json$/, "");
}

export function auditLocalSeoNarrativeCoverage(): AuditRow[] {
  const areaMap = readJson<AreaMapItem[]>(AREA_MAP_PATH);

  return getLocalSeoClusterFiles().map((fileName) => {
    const cluster = readJson<ClusterConfig>(path.join(CLUSTER_ROOT, fileName));
    const area = cluster.location;
    const city = inferCity(area, cluster, areaMap);
    const narrativePackage = buildLocalSeoNarrativePackage(area, city);

    return {
      pageSlug: slugFromCluster(fileName, cluster),
      area,
      city,
      profile: narrativePackage.profile,
      narrativeKey: narrativePackage.narrativeKey,
      cta: narrativePackage.selected.cta,
    };
  });
}

function buildTotals(rows: AuditRow[]): Record<LocalSeoNarrativeKey, number> {
  return rows.reduce<Record<LocalSeoNarrativeKey, number>>(
    (totals, row) => {
      totals[row.narrativeKey] += 1;
      return totals;
    },
    {
      visibility: 0,
      competition: 0,
      growth: 0,
      authority: 0,
      conversion: 0,
    },
  );
}

function pad(value: string, length: number): string {
  return value.length >= length ? value : value.padEnd(length, " ");
}

export function formatLocalSeoNarrativeAudit(rows: AuditRow[]): string {
  const totals = buildTotals(rows);
  const tableRows = rows.map((row) =>
    [
      pad(row.pageSlug, 30),
      pad(row.area, 18),
      pad(row.city, 12),
      pad(row.profile, 14),
      pad(row.narrativeKey, 14),
      row.cta,
    ].join(" | "),
  );

  return [
    "LOCAL SEO NARRATIVE COVERAGE AUDIT",
    "",
    [
      pad("Page Slug", 30),
      pad("Area", 18),
      pad("City", 12),
      pad("Profile", 14),
      pad("Narrative", 14),
      "CTA",
    ].join(" | "),
    [
      "-".repeat(30),
      "-".repeat(18),
      "-".repeat(12),
      "-".repeat(14),
      "-".repeat(14),
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
  return /^auditLocalSeoNarrativeCoverage\.[cm]?[jt]s$/.test(invoked) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
}

if (isCliRun()) {
  console.log(formatLocalSeoNarrativeAudit(auditLocalSeoNarrativeCoverage()));
}
