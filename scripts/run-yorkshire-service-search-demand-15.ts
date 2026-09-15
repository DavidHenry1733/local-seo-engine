/**
 * DATAFORSEO-YORKSHIRE-DEMAND-COLLECTION-15
 * Dry-run preflight + controlled live collection for Yorkshire confirmed services.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
process.env.WORKSPACE_ROOT = ROOT;

const SLUG = "yorkshire-pharmacy-and-health-clinic";
const MODE = process.argv[2] || "dry-run";

const EXPECTED_SERVICES = [
  "blood-pressure-checks",
  "discharge-medicines-service",
  "flu-vaccinations",
  "health-checks",
  "independent-prescriber",
  "malaria-prevention",
  "medication-reviews",
  "minor-ailments",
  "new-medicine-service",
  "pharmacy-first",
  "prescription-dispensing",
  "repeat-prescriptions",
  "smoking-cessation",
  "weight-management",
];

function hashFile(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function containsCredentialLeak(text: string): boolean {
  if (/dataforseo_(?:api_)?(?:login|password)\s*[:=]\s*\S+/i.test(text)) return true;
  if (/basic\s+[a-z0-9+/=]{16,}/i.test(text)) return true;
  return false;
}

async function dryRun(): Promise<void> {
  const {
    readConfirmedServiceIds,
  } = await import("../src/pharmacy/serviceSearchDemandService.ts");
  const { buildServiceSearchDemandQuerySpecs } = await import(
    "../src/pharmacy/serviceSearchDemandQueryBuilder.ts"
  );
  const { readSetupProfile } = await import(
    "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts"
  );
  const { resolveTenantLocality } = await import(
    "../src/pharmacy/masterAdminPrimaryLocalityService.ts"
  );
  const { resolveServiceSearchDemandMeta } = await import(
    "../src/pharmacy/serviceSearchDemandMetadata.ts"
  );
  const { buildSearchVolumeLiveRequest } = await import(
    "../src/pharmacy/dataForSeoKeywordsDataSearchVolumeAdapter.ts"
  );

  const confirmed = readConfirmedServiceIds(SLUG);
  console.log("\n=== YORKSHIRE CONFIRMED SERVICES ===");
  console.log(`Count: ${confirmed.length}`);
  console.log(confirmed.join("\n"));

  const match =
    confirmed.length === EXPECTED_SERVICES.length &&
    EXPECTED_SERVICES.every((id) => confirmed.includes(id)) &&
    !confirmed.includes("vaccinations") &&
    !confirmed.includes("travel-vaccinations") &&
    !confirmed.includes("covid-vaccinations");

  console.log(`\nMatches expected 14-service list (no vaccinations): ${match ? "YES" : "NO"}`);

  const profile = readSetupProfile(SLUG);
  const locality = resolveTenantLocality(profile);
  const pharmacyName = String(profile.pharmacyName || profile.tradingName || "").trim();
  const town = String(locality.value || profile.primaryTown || profile.townCity || "").trim();

  const byService: Record<string, string[]> = {};
  let totalKeywords = 0;
  const allKeywords: string[] = [];
  const globalSeen = new Set<string>();

  console.log("\n=== DRY-RUN QUERIES BY SERVICE ===\n");
  for (const serviceId of confirmed) {
    const meta = resolveServiceSearchDemandMeta(serviceId);
    const specs = buildServiceSearchDemandQuerySpecs({ serviceId });
    const queries = specs.map((s) => s.query);
    byService[serviceId] = queries;
    totalKeywords += queries.length;
    console.log(`## ${serviceId} (${meta.serviceName}) — ${queries.length} demand queries [national-service-demand]`);
    for (const s of specs) console.log(`  - [${s.queryType}] ${s.query}`);
    console.log("");

    for (const q of queries) {
      if (/vaccinations/i.test(q) && !/flu-vaccinations|travel-vaccinations|covid-vaccinations/i.test(serviceId)) {
        // flu-vaccinations service is allowed; generic vaccinations service is not selected
      }
      if (serviceId !== "flu-vaccinations" && serviceId !== "travel-vaccinations" && /\bvaccinations\b/i.test(q) && !/flu/i.test(q)) {
        console.warn(`WARNING: unexpected vaccinations query for ${serviceId}: ${q}`);
      }
      const key = q.toLowerCase();
      if (globalSeen.has(key)) {
        console.warn(`WARNING: duplicate query across services: ${q}`);
      }
      globalSeen.add(key);
      allKeywords.push(q);
    }

    if (queries.length > 5) {
      throw new Error(`${serviceId} exceeds five queries`);
    }
    if (serviceId !== "pharmacy-first") {
      for (const q of queries) {
        if (/pharmacy first/i.test(q)) {
          throw new Error(`Pharmacy First query leakage in ${serviceId}: ${q}`);
        }
      }
    }
  }

  const req = buildSearchVolumeLiveRequest(allKeywords);
  console.log("=== BATCH REQUEST PREVIEW ===");
  console.log(`HTTP requests: 1`);
  console.log(`DataForSEO tasks: 1`);
  console.log(`Total keywords: ${totalKeywords}`);
  console.log(`location_code: ${req[0]?.location_code}`);
  console.log(`language_code: ${req[0]?.language_code}`);
  console.log(`Automatic retry: none`);
}

async function liveCollect(): Promise<void> {
  const before = new Map<string, string | null>([
    [
      path.join(ROOT, "data/national-growth-engine", `${SLUG}-competitor-discovery.json`),
      hashFile(path.join(ROOT, "data/national-growth-engine", `${SLUG}-competitor-discovery.json`)),
    ],
    [
      path.join(ROOT, "data/growth-engine", `${SLUG}-competitors.json`),
      hashFile(path.join(ROOT, "data/growth-engine", `${SLUG}-competitors.json`)),
    ],
    [
      path.join(ROOT, "data/growth-engine", `${SLUG}-opportunities.json`),
      hashFile(path.join(ROOT, "data/growth-engine", `${SLUG}-opportunities.json`)),
    ],
    [
      path.join(ROOT, "data/growth-engine", `${SLUG}-campaign-generation-context-blood-pressure-checks.json`),
      hashFile(
        path.join(ROOT, "data/growth-engine", `${SLUG}-campaign-generation-context-blood-pressure-checks.json`),
      ),
    ],
    [
      path.join(ROOT, "data/pharmacy-content-packages", SLUG, "blood-pressure-checks.json"),
      hashFile(path.join(ROOT, "data/pharmacy-content-packages", SLUG, "blood-pressure-checks.json")),
    ],
  ]);

  let httpCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (!url.includes("api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live")) {
      throw new Error(`Unexpected external request blocked: ${url}`);
    }
    httpCalls += 1;
    if (httpCalls > 1) {
      throw new Error("More than one DataForSEO HTTP request attempted");
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const { collectServiceSearchDemand } = await import("../src/pharmacy/serviceSearchDemandService.ts");

  console.log("\n=== LIVE COLLECTION ===\n");
  const result = await collectServiceSearchDemand(SLUG, { force: true });
  globalThis.fetch = originalFetch;

  const artifact = result.artifact;
  const artifactPath = result.artifactPath;
  const artifactText = fs.readFileSync(artifactPath, "utf8");

  console.log(`Artifact: ${artifactPath}`);
  console.log(`HTTP requests: ${result.requestCount}`);
  console.log(`Task IDs: ${artifact.taskIds.join(", ") || "none"}`);
  console.log(`Provider cost (USD): ${artifact.providerCost ?? "not reported"}`);
  console.log(`Collected services: ${result.collectedServiceIds.length}`);
  console.log(`Error: ${result.error || "none"}`);

  if (containsCredentialLeak(artifactText)) {
    throw new Error("Credential leak detected in artifact");
  }

  let totalKeywords = 0;
  console.log("\n=== SERVICE-BY-SERVICE DEMAND ===\n");
  for (const serviceId of artifact.confirmedServiceIds) {
    const entry = artifact.demandByService[serviceId];
    if (!entry) {
      console.log(`## ${serviceId} — MISSING ENTRY`);
      continue;
    }
    totalKeywords += entry.queries.length;
    const volumes = entry.queries
      .map((q) => q.searchVolume)
      .filter((v): v is number => v !== null);
    const dedupedVolume = entry.queries.reduce((sum, q) => {
      if (q.searchVolume === null) return sum;
      return sum + q.searchVolume;
    }, 0);
    const uniqueQueryVolumes = new Map<string, number | null>();
    for (const q of entry.queries) uniqueQueryVolumes.set(q.query.toLowerCase(), q.searchVolume);

    console.log(`## ${serviceId}`);
    console.log(`serviceName: ${entry.serviceName}`);
    console.log(`evidenceStatus: ${entry.evidenceStatus}`);
    console.log(`requestCount: ${entry.requestCount}`);
    console.log(`taskIds: ${entry.taskIds.join(", ") || "none"}`);
    console.log(`capturedAt: ${entry.capturedAt}`);
    console.log(`queries sent: ${entry.queries.length}`);
    console.log(`total volume (sum of query volumes, not deduped across queries): ${dedupedVolume}`);
    for (const q of entry.queries) {
      console.log(`  query: ${q.query}`);
      console.log(`    searchVolume: ${q.searchVolume}`);
      console.log(`    monthlySearches: ${q.monthlySearches.length ? `${q.monthlySearches.length} months` : "none"}`);
      console.log(`    cpc: ${q.cpc}`);
      console.log(`    competition: ${q.competition}`);
      console.log(`    competitionIndex: ${q.competitionIndex}`);
      console.log(`    availability: ${q.availability}`);
      if (q.unavailableReason) console.log(`    unavailableReason: ${q.unavailableReason}`);
    }
    console.log("");
  }

  console.log("=== INTEGRITY ===");
  console.log(`confirmedServiceIds: ${artifact.confirmedServiceIds.length}`);
  console.log(`includes vaccinations service: ${artifact.confirmedServiceIds.includes("vaccinations")}`);
  console.log(`source: ${artifact.source}`);
  console.log(`top-level requestCount: ${artifact.requestCount}`);
  console.log(
    `all fresh services requestCount=1: ${artifact.confirmedServiceIds.every(
      (id) => artifact.demandByService[id]?.requestCount === 1,
    )}`,
  );
  console.log(`total keywords in artifact: ${totalKeywords}`);
  console.log(`external HTTP calls (non-DataForSEO blocked): ${httpCalls}`);

  for (const [file, prior] of before) {
    const after = hashFile(file);
    const ok = prior === after;
    console.log(`${ok ? "UNCHANGED" : "CHANGED"}: ${path.relative(ROOT, file)}`);
    if (!ok) throw new Error(`Protected artifact changed: ${file}`);
  }
}

async function main(): Promise<void> {
  if (MODE === "dry-run") {
    await dryRun();
    return;
  }
  if (MODE === "live") {
    await liveCollect();
    return;
  }
  throw new Error(`Unknown mode: ${MODE}. Use dry-run or live.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
