#!/usr/bin/env npx tsx
/**
 * NI-03B — Explicit National Search Intelligence collection.
 * Does not run on page render. Bounded DataForSEO Labs + SERP only.
 */
import * as serviceMod from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";
import type { NationalSearchIntelligenceProgressEvent } from "../src/pharmacy/nationalSearchIntelligenceV1Service.ts";

function exported<T extends object>(mod: T | { default: T }): T {
  const maybe = mod as { default?: T };
  return maybe.default ?? (mod as T);
}

const { collectNationalSearchIntelligence, nationalSearchIntelligencePath } = exported(serviceMod);

const slug = String(process.argv[2] || "").trim();
const force = process.argv.includes("--force");

if (!slug) {
  console.error("Usage: pnpm exec tsx scripts/collect-national-search-intelligence-v1.ts <tenantSlug> [--force]");
  process.exit(1);
}

function money(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? `$${value}` : "$0";
}

function printProgress(event: NationalSearchIntelligenceProgressEvent): void {
  switch (event.type) {
    case "ranked_start":
      console.log("COLLECTING ranked_keywords...");
      return;
    case "ranked_complete":
      console.log(`RANKED_KEYWORDS COMPLETE — rows=${event.rows} cost=${money(event.cost)}`);
      return;
    case "ranked_failed":
      console.log(`RANKED_KEYWORDS FAILED — ${event.timedOut ? "TIMEOUT" : event.message}`);
      return;
    case "serp_start":
      console.log(`COLLECTING SERP ${event.index}/${event.total} — ${event.query}`);
      return;
    case "serp_retry":
      console.log(`SERP ${event.index} FAILED — ${event.statusCode ?? "unknown"} — retrying once`);
      return;
    case "serp_complete":
      console.log(
        event.retried
          ? `SERP ${event.index} RETRY COMPLETE — results=${event.results} cost=${money(event.cost)}`
          : `SERP ${event.index} COMPLETE — results=${event.results} cost=${money(event.cost)}`,
      );
      return;
    case "serp_failed":
      if (event.retried) {
        console.log(`SERP ${event.index} RETRY FAILED — ${event.timedOut ? "TIMEOUT" : event.statusCode ?? "unknown"}`);
        return;
      }
      console.log(`SERP ${event.index} FAILED — ${event.timedOut ? "TIMEOUT" : event.statusCode ?? "unknown"}`);
      return;
  }
}

const snapshot = await collectNationalSearchIntelligence(slug, { force, onProgress: printProgress });
console.log(`PERSISTED snapshot=${nationalSearchIntelligencePath(snapshot.tenantSlug)}`);
console.log(`STATUS=${String(snapshot.status).toUpperCase()}`);
console.log(`TOTAL_COST=${money(snapshot.costs.totalCost)}`);
console.log(JSON.stringify({
  ok: snapshot.status === "collected" || snapshot.status === "empty" || snapshot.status === "partial",
  tenantSlug: snapshot.tenantSlug,
  subjectDomain: snapshot.subjectDomain,
  status: snapshot.status,
  lastError: snapshot.lastError,
  reusedExistingSnapshot: snapshot.reusedExistingSnapshot,
  liveExecution: snapshot.liveExecution,
  authority: snapshot.authority,
  evidenceSource: snapshot.provenance.evidenceSource,
  keywordCount: snapshot.customerKeywords.length,
  competitorCount: snapshot.organicCompetitors.length,
  requests: snapshot.costs.requests,
  tasks: snapshot.costs.tasks,
  totalCost: snapshot.costs.totalCost,
  capturedAt: snapshot.capturedAt,
}, null, 2));
