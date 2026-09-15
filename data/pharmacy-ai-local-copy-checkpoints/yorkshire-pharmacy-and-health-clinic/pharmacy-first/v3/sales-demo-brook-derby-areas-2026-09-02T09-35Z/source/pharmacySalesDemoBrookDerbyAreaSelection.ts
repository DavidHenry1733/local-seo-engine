/**
 * Isolated Brook sales-demo Derby area selection.
 * Reads the saved ranking; does not write pharmacy profiles or generate local pages.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const SALES_DEMO_BROOK_DERBY_AREA_SELECTION_PATH = path.join(
  PHARMACY_WORKSPACE_ROOT,
  "data/growth-engine/sales-demo-brook-derby-area-selection.json",
);

export const YORKSHIRE_SALES_DEMO_EXCLUDED_AREAS = [
  "Darfield",
  "Wombwell",
  "Worsbrough",
  "Thurnscoe",
  "Grimethorpe",
  "Goldthorpe",
  "Hoyland",
  "Cudworth",
  "Royston",
  "Chapeltown",
] as const;

export type SalesDemoBrookDerbyAreaRow = {
  areaName: string;
  order: number;
  engineRank: number;
  score: number;
  tier: string;
  selected: boolean;
  source: string;
  catalog: string;
  selectionBasis: string;
};

export type SalesDemoBrookDerbyAreaSelection = {
  kind: string;
  demoLocation: {
    label: string;
    mapAddress: string;
    latitude: number;
    longitude: number;
  };
  discovery: {
    source: string;
    catalog: string;
    paidCalls: number;
    estimatedCostUsd: number;
  };
  areas: SalesDemoBrookDerbyAreaRow[];
};

export function loadSalesDemoBrookDerbyAreaSelection(): SalesDemoBrookDerbyAreaSelection {
  const raw = JSON.parse(fs.readFileSync(SALES_DEMO_BROOK_DERBY_AREA_SELECTION_PATH, "utf8")) as SalesDemoBrookDerbyAreaSelection;
  const excluded = new Set(YORKSHIRE_SALES_DEMO_EXCLUDED_AREAS.map((name) => name.toLowerCase()));
  const areas = (raw.areas || []).filter((row) => row.selected !== false && !excluded.has(String(row.areaName || "").toLowerCase()));
  if (areas.length !== 10) {
    throw new Error(`Brook sales-demo Derby selection must contain 10 non-Yorkshire areas, found ${areas.length}`);
  }
  return { ...raw, areas };
}

export function salesDemoBrookDerbyAreaNames(): string[] {
  return loadSalesDemoBrookDerbyAreaSelection().areas.map((row) => row.areaName);
}
