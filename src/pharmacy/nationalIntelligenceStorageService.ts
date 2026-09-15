/**
 * NI-03A — Canonical national intelligence storage.
 * Tenant-scoped paths on WORKSPACE_ROOT.
 */
import fs from "node:fs";
import path from "node:path";

import { WORKSPACE_ROOT, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";

export const NATIONAL_INTELLIGENCE_DIR = path.join(WORKSPACE_ROOT, "data", "national-growth-engine");
export const NATIONAL_INTELLIGENCE_FIXTURE_DIR = path.join(WORKSPACE_ROOT, "fixtures", "national-growth-engine");

export type NationalIntelligenceArtifact =
  | "competitor-discovery"
  | "verified-national-competitors"
  | "competitor-evidence-enrichment-v1"
  | "competitor-evidence-recovery-v1"
  | "commercial-keyword-qualification-v1"
  | "ranked-keywords-customer"
  | "ranked-keywords-competitors"
  | "intersection-evidence"
  | "market-opportunity-intelligence-v1"
  | "market-opportunity-intelligence-v2"
  | "growth-plan-intelligence-input-v1"
  | "growth-plan-intelligence-v1"
  | "cost-ledger-v1"
  | "refresh-metadata-v1"
  | "search-intelligence-v1"
  | "competitors"
  | "market"
  | "growth";

export function nationalIntelligenceDataDir(): string {
  return NATIONAL_INTELLIGENCE_DIR;
}

export function nationalIntelligenceFixtureDir(): string {
  return NATIONAL_INTELLIGENCE_FIXTURE_DIR;
}

export function nationalIntelligenceArtifactFileName(slug: string, artifact: NationalIntelligenceArtifact): string {
  return `${safePharmacySlug(slug)}-${artifact}.json`;
}

export function nationalIntelligenceDataPath(slug: string, artifact: NationalIntelligenceArtifact): string {
  return path.join(NATIONAL_INTELLIGENCE_DIR, nationalIntelligenceArtifactFileName(slug, artifact));
}

export function nationalIntelligenceFixturePath(slug: string, artifact: NationalIntelligenceArtifact): string {
  return path.join(NATIONAL_INTELLIGENCE_FIXTURE_DIR, nationalIntelligenceArtifactFileName(slug, artifact));
}

export function resolveNationalIntelligenceArtifactPath(
  slug: string,
  artifact: NationalIntelligenceArtifact,
): string | null {
  const data = nationalIntelligenceDataPath(slug, artifact);
  if (fs.existsSync(data)) return data;
  const fixture = nationalIntelligenceFixturePath(slug, artifact);
  if (fs.existsSync(fixture)) return fixture;
  return null;
}

export function isNationalIntelligenceFixturePath(file: string | null): boolean {
  if (!file) return false;
  return path.resolve(file).startsWith(path.resolve(NATIONAL_INTELLIGENCE_FIXTURE_DIR));
}

export function ensureNationalIntelligenceDataDir(): string {
  fs.mkdirSync(NATIONAL_INTELLIGENCE_DIR, { recursive: true });
  return NATIONAL_INTELLIGENCE_DIR;
}

export function ensureNationalIntelligenceFixtureDir(): string {
  fs.mkdirSync(NATIONAL_INTELLIGENCE_FIXTURE_DIR, { recursive: true });
  return NATIONAL_INTELLIGENCE_FIXTURE_DIR;
}

/** @deprecated Use nationalIntelligenceDataPath(slug, "competitors") */
export function nationalCompetitorSnapshotPath(slug: string): string {
  return nationalIntelligenceDataPath(slug, "competitors");
}

/** @deprecated Use nationalIntelligenceDataPath(slug, "market") */
export function nationalMarketSnapshotPath(slug: string): string {
  return nationalIntelligenceDataPath(slug, "market");
}

/** @deprecated Use nationalIntelligenceDataPath(slug, "growth") */
export function nationalGrowthSnapshotPath(slug: string): string {
  return nationalIntelligenceDataPath(slug, "growth");
}
