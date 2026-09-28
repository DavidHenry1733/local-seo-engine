/**
 * ORGANIC-SEARCH-EVIDENCE-FIX-02 classification validation.
 * Uses stored fixtures only — no live Google Places or DataForSEO calls.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
process.chdir(ROOT);
process.env.WORKSPACE_ROOT = ROOT;

const FIXTURE_DIR = path.join(ROOT, "fixtures/organic-search-evidence-fix-02");
const SNAP_FIXTURE = path.join(ROOT, "fixtures/google-local-competitor-metrics/snapshot-other-tenant.json");
const INTEL_DIR = path.join(ROOT, "data/pharmacy-competitor-intelligence");
const GROWTH_DIR = path.join(ROOT, "data/growth-engine");
const NATIONAL_DIR = path.join(ROOT, "data/national-growth-engine");
const CONTENT_DIRS = [
  INTEL_DIR,
  GROWTH_DIR,
  NATIONAL_DIR,
  path.join(ROOT, "data/pharmacy-content-packages"),
  path.join(ROOT, "data/content-packages"),
];

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
const fetchCalls: string[] = [];
const liveHosts = ["api.dataforseo.com", "places.googleapis.com", "maps.googleapis.com"];

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  fetchCalls.push(url);
  throw new Error(`Unexpected external request: ${url}`);
}) as typeof fetch;

function record(name: string, passed: boolean, detail?: string): void {
  steps.push({ name, passed, detail });
  console.log(`${passed ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function existingGeneratedEvidence(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full);
        continue;
      }
      files.push(full);
    }
  };
  for (const dir of CONTENT_DIRS) walk(dir);
  return files.sort();
}

function writeProfile(slug: string, data: Record<string, unknown>): string {
  const dir = path.join(ROOT, "data/pharmacy-profiles");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${slug}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ slug, updatedAt: "2026-08-20T09:00:00.000Z", version: 5, data }, null, 2),
  );
  return file;
}

function cleanup(files: string[]): void {
  for (const file of files) {
    try {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

async function main() {
  const pageSrc = fs.readFileSync(path.join(ROOT, "artifacts/api-server/src/routes/masterAdminPlatformPage.ts"), "utf8");
  const dashSrc = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"),
    "utf8",
  );
  const metricsSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/googleLocalCompetitorMetricsService.ts"), "utf8");
  const organicSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/competitorAnalysisOrganicSearchService.ts"), "utf8");
  const pipelineSrc = fs.readFileSync(path.join(ROOT, "src/pharmacy/pharmacyCompetitorIntelligenceService.ts"), "utf8");
  const workflowSrc = fs.readFileSync(
    path.join(ROOT, "src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts"),
    "utf8",
  );

  record(
    "Heading is Organic Search Evidence — DataForSEO",
    pageSrc.includes("<h4>Organic Search Evidence — DataForSEO</h4>"),
  );
  record(
    "Required evidence sections are present",
    pageSrc.includes(">Your Pharmacy<") &&
      pageSrc.includes(">Verified Local Competitor Matches<") &&
      pageSrc.includes(">Organic commercial competitors<") &&
      pageSrc.includes(">Authoritative and informational results<") &&
      !pageSrc.includes("widerOrganicRows"),
  );
  record(
    "Old organic-search competitors heading is gone",
    !pageSrc.includes("<h4>DataForSEO organic-search competitors</h4>"),
  );
  record(
    "Google/local competitor table, Google Profile Metrics and Gap Analysis remain",
    pageSrc.includes("<h4>Local competitors</h4>") &&
      pageSrc.includes("<h4>Google Profile Metrics</h4>") &&
      pageSrc.includes("<h4>Gap Analysis</h4>") &&
      pageSrc.includes("<th>Competitor</th><th>Rating</th><th>Reviews</th><th>Distance</th>"),
  );
  record(
    "Provider collection label is unchanged",
    dashSrc.includes('label: "DataForSEO organic-search competitors"') &&
      dashSrc.includes('label: "Google/local competitors"'),
  );
  record(
    "Canonical qualifier is the shared authority for collection, workflow and Google metrics",
    /qualifyCommercialEvidenceCandidate/.test(organicSrc) &&
      /qualifyCommercialEvidenceCandidate/.test(workflowSrc) &&
      /qualifyCommercialEvidenceCandidate/.test(metricsSrc) &&
      !/searchNationalGoogleOrganic/.test(pipelineSrc + workflowSrc),
  );
  record(
    "Classification is presentation-only and does not call DataForSEO",
    !/searchNationalGoogleOrganic|dataForSeoHttp|api\.dataforseo\.com/.test(
      fs.readFileSync(path.join(ROOT, "src/pharmacy/organicSearchEvidenceClassification.ts"), "utf8"),
    ),
  );

  const {
    classifyOrganicSearchEvidence,
    canonicalWebsiteDomain,
    ORGANIC_SEARCH_EVIDENCE_HEADING,
  } = await import("../src/pharmacy/organicSearchEvidenceClassification.ts");

  const cases = readJson<{
    tenantWebsiteUrls: string[];
    verifiedGoogleCompetitorWebsites: Array<{
      name: string;
      website: string;
      placeId: string;
      source: string;
    }>;
    rows: Array<{
      domain: string;
      host: string;
      url: string;
      position: number;
      matchedQuery: string;
      title: string;
      description: string;
      overlapEvidence: string;
      provider: string;
      capturedAt: string;
      taskId: string;
    }>;
  }>(path.join(FIXTURE_DIR, "classification-cases.json"));

  const classified = classifyOrganicSearchEvidence(cases);
  const byDomain = Object.fromEntries(classified.rows.map((row) => [row.domain, row]));

  record("Classification heading is exact", classified.heading === ORGANIC_SEARCH_EVIDENCE_HEADING);
  record("Every stored fixture row is preserved", classified.rows.length === cases.rows.length, String(classified.rows.length));
  record(
    "Stored query, position, URL, title, description, source and capture time are preserved",
    cases.rows.every((raw) => {
      const row = byDomain[canonicalWebsiteDomain(raw.domain)];
      return (
        row &&
        row.url === raw.url &&
        row.position === raw.position &&
        row.matchedQuery === raw.matchedQuery &&
        row.title === raw.title &&
        row.description === raw.description &&
        row.source === raw.provider &&
        row.capturedAt === raw.capturedAt
      );
    }),
  );
  record(
    "Tenant domain is Your Pharmacy and never a competitor",
    byDomain["fixture-town.example"]?.section === "your_pharmacy" &&
      classified.yourPharmacy.length === 1 &&
      classified.verifiedLocalCompetitorMatches.every((row) => row.domain !== "fixture-town.example") &&
      classified.widerOrganicLandscape.every((row) => row.domain !== "fixture-town.example"),
  );
  record(
    "Verified Google competitor domains match by canonical website only",
    byDomain["finder.well.co.uk"]?.section === "verified_local_competitor" &&
      byDomain["finder.well.co.uk"]?.matchedCompetitorName === "Well Pharmacy" &&
      byDomain["barnsleychemist.co.uk"]?.section === "verified_local_competitor" &&
      byDomain["barnsleychemist.co.uk"]?.matchedCompetitorName === "Barnsley Pharmacy & Clinic",
  );
  record(
    "Directory listing of the tenant is Wider Organic Landscape, not the tenant",
    byDomain["allhealthandcare.co.uk"]?.section === "wider_organic_landscape" &&
      byDomain["allhealthandcare.co.uk"]?.landscapeKind === "directory",
  );
  record(
    "Regulator, social, NHS/community and publisher rows are Wider Organic Landscape",
    byDomain["inspections.pharmacyregulation.org"]?.landscapeKind === "regulator" &&
      byDomain["instagram.com"]?.landscapeKind === "social" &&
      byDomain["england.nhs.uk"]?.landscapeKind === "nhs_community" &&
      byDomain["healthwatchfixture.org.uk"]?.landscapeKind === "nhs_community" &&
      byDomain["southyorkshire.communitypharmacy.org.uk"]?.landscapeKind === "nhs_community" &&
      byDomain["pharmaceutical-journal.com"]?.landscapeKind === "publisher",
  );
  record(
    "Pharmacy-looking domains stay in Wider Organic Landscape as other pharmacy",
    byDomain["poolpharmacy.co.uk"]?.section === "wider_organic_landscape" &&
      byDomain["poolpharmacy.co.uk"]?.landscapeKind === "other_pharmacy" &&
      byDomain["poolpharmacy.co.uk"]?.classificationLabel === "Other pharmacy competitor",
  );
  record(
    "Demo Google competitor websites are not treated as verified matches",
    byDomain["demo-should-not-match.example"]?.section === "wider_organic_landscape" &&
      byDomain["demo-should-not-match.example"]?.landscapeKind === "other_pharmacy" &&
      byDomain["demo-should-not-match.example"]?.classificationLabel === "Other pharmacy competitor",
  );
  record(
    "Canonical domain matching strips www and path",
    canonicalWebsiteDomain("https://www.fixture-town.example/pharmacy-first") === "fixture-town.example" &&
      canonicalWebsiteDomain("https://finder.well.co.uk/store/darfield-snape-hill-road") === "finder.well.co.uk",
  );

  const beforeEvidence = existingGeneratedEvidence();
  const beforeHashes = Object.fromEntries(beforeEvidence.map((file) => [file, hashFile(file)]));
  const created: string[] = [];

  try {
    const {
      emptyNationalCompetitorDiscoveryResult,
    } = await import("../src/pharmacy/nationalCompetitorDiscoveryModel.ts");
    const {
      writeNationalCompetitorDiscovery,
      nationalCompetitorDiscoveryPath,
    } = await import("../src/pharmacy/nationalCompetitorDiscoveryStorageService.ts");
    const { COMPETITOR_INTEL_DIR } = await import("../src/pharmacy/pharmacyCompetitorDiscovery.ts");
    const { GROWTH_ENGINE_DIR } = await import("../src/pharmacy/growthEngineLocalMarketService.ts");
    const { buildCommercialIntelligenceDashboard } = await import(
      "../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts"
    );

    const intelSlug = "organic-search-evidence-fix-02";
    const snapSlug = "organic-search-evidence-fix-02b";
    const intel = readJson<Record<string, unknown>>(path.join(FIXTURE_DIR, "intelligence.json"));
    const snap = readJson<Record<string, unknown>>(SNAP_FIXTURE);
    fs.mkdirSync(COMPETITOR_INTEL_DIR, { recursive: true });
    fs.mkdirSync(GROWTH_ENGINE_DIR, { recursive: true });
    const intelPath = path.join(COMPETITOR_INTEL_DIR, `${intelSlug}-intelligence.json`);
    const snapPath = path.join(GROWTH_ENGINE_DIR, `${snapSlug}-competitors.json`);
    fs.writeFileSync(intelPath, JSON.stringify(intel, null, 2));
    fs.writeFileSync(snapPath, JSON.stringify({ ...snap, slug: snapSlug }, null, 2));
    created.push(
      intelPath,
      snapPath,
      writeProfile(intelSlug, {
        pharmacyName: "Fixture Town Pharmacy",
        website: "https://www.fixture-town.example/",
        googlePlaceId: "ChIJ-fixture-own",
        googleBusinessRating: 4.2,
        googleBusinessReviewCount: 41,
        googleProfileOnboardingState: "configured",
        googleImportSnapshot: {
          status: "imported",
          importedAt: "2026-08-20T09:00:00.000Z",
          website: "https://www.fixture-town.example/",
          rating: 4.2,
          reviewCount: 41,
          photoCount: 6,
          placeId: "ChIJ-fixture-own",
        },
      }),
      writeProfile(snapSlug, {
        pharmacyName: "Second Tenant Pharmacy",
        website: "https://second-tenant.example",
        googleProfileOnboardingState: "configured",
      }),
    );

    const dashboardRows = [
      ...cases.rows,
      {
        domain: "asda.com",
        host: "asda.com",
        url: "https://www.asda.com/pharmacy",
        position: 7,
        matchedQuery: "Pharmacy First Fixture Town",
        title: "ASDA Pharmacy",
        description: "ASDA Pharmacy page.",
        overlapEvidence: "Matches the stored Google Places ASDA website domain",
        provider: "dataforseo-google-organic-live",
        capturedAt: "2026-08-21T12:00:13.000Z",
        taskId: "task-asda",
      },
      {
        domain: "example-highstreet.example",
        host: "example-highstreet.example",
        url: "https://example-highstreet.example/services",
        position: 8,
        matchedQuery: "Pharmacy First Fixture Town",
        title: "High Street Pharmacy",
        description: "High Street Pharmacy page.",
        overlapEvidence: "Matches the stored Google Places High Street website domain",
        provider: "dataforseo-google-organic-live",
        capturedAt: "2026-08-21T12:00:14.000Z",
        taskId: "task-highstreet",
      },
    ];

    created.push(
      writeNationalCompetitorDiscovery({
        ...emptyNationalCompetitorDiscoveryResult(intelSlug, "United Kingdom", "organic-search competitors"),
        generatedAt: "2026-08-21T12:00:00.000Z",
        status: "complete",
        organicSearch: {
          provider: "dataforseo-google-organic-live",
          status: "completed",
          configured: true,
          generated: true,
          error: null,
          queryLimitation: null,
          locationName: "United Kingdom",
          languageCode: "en",
          taskIds: ["task-fixture"],
          queries: ["Pharmacy First Fixture Town"],
          competitors: dashboardRows.map((row) => ({
            domain: row.domain,
            host: row.host,
            url: row.url,
            position: row.position,
            matchedQuery: row.matchedQuery,
            title: row.title,
            description: row.description,
            overlapEvidence: row.overlapEvidence,
            capturedAt: row.capturedAt,
            provider: row.provider,
            locationName: "United Kingdom",
            languageCode: "en",
            taskId: row.taskId,
            provenance: row.provider,
            freshness: "Stored",
          })),
          capturedAt: "2026-08-21T12:00:00.000Z",
        },
      }),
      writeNationalCompetitorDiscovery({
        ...emptyNationalCompetitorDiscoveryResult(snapSlug, "United Kingdom", "organic-search competitors"),
        generatedAt: "2026-08-19T08:00:00.000Z",
        status: "complete",
        organicSearch: {
          provider: "dataforseo-google-organic-live",
          status: "completed",
          configured: true,
          generated: true,
          error: null,
          queryLimitation: null,
          locationName: "United Kingdom",
          languageCode: "en",
          taskIds: ["task-second"],
          queries: ["Pharmacy First Other Town"],
          competitors: [
            {
              domain: "second-tenant.example",
              host: "second-tenant.example",
              url: "https://second-tenant.example/pharmacy-first",
              position: 1,
              matchedQuery: "Pharmacy First Other Town",
              title: "Second Tenant Pharmacy",
              description: "Tenant page",
              overlapEvidence: "Tenant evidence",
              capturedAt: "2026-08-19T08:00:01.000Z",
              provider: "dataforseo-google-organic-live",
              locationName: "United Kingdom",
              languageCode: "en",
              taskId: "task-second-tenant",
              provenance: "dataforseo-google-organic-live",
              freshness: "Stored",
            },
            {
              domain: "boots.com",
              host: "boots.com",
              url: "https://www.boots.com/stores/other-town",
              position: 2,
              matchedQuery: "Pharmacy First Other Town",
              title: "Boots Pharmacy",
              description: "Boots store page",
              overlapEvidence: "Verified Google competitor domain",
              capturedAt: "2026-08-19T08:00:02.000Z",
              provider: "dataforseo-google-organic-live",
              locationName: "United Kingdom",
              languageCode: "en",
              taskId: "task-second-boots",
              provenance: "dataforseo-google-organic-live",
              freshness: "Stored",
            },
            {
              domain: "wikipedia.org",
              host: "wikipedia.org",
              url: "https://en.wikipedia.org/wiki/Pharmacy_First",
              position: 9,
              matchedQuery: "Pharmacy First Other Town",
              title: "Pharmacy First",
              description: "Publisher page",
              overlapEvidence: "Publisher evidence",
              capturedAt: "2026-08-19T08:00:03.000Z",
              provider: "dataforseo-google-organic-live",
              locationName: "United Kingdom",
              languageCode: "en",
              taskId: "task-second-wiki",
              provenance: "dataforseo-google-organic-live",
              freshness: "Stored",
            },
          ],
          capturedAt: "2026-08-19T08:00:00.000Z",
        },
      }),
    );
    created.push(nationalCompetitorDiscoveryPath(intelSlug), nationalCompetitorDiscoveryPath(snapSlug));

    const dash = buildCommercialIntelligenceDashboard(intelSlug);
    const asdaRow = dash.competitorAnalysis.competitors.find((c) => c.name === "ASDA Pharmacy");
    const evidence = dash.organicSearchEvidence;
    const evidenceDomains = {
      yours: evidence.yourPharmacy.map((row) => row.domain),
      verified: evidence.verifiedLocalCompetitorMatches.map((row) => row.domain),
      wider: evidence.widerOrganicLandscape.map((row) => row.domain),
    };

    record("Dashboard heading payload is exact", evidence.heading === "Organic Search Evidence — DataForSEO");
    record(
      "Dashboard preserves every stored organic row",
      evidence.rows.length === dashboardRows.length &&
        dash.organicSearchCompetitors.competitors.length === dashboardRows.length,
      String(evidence.rows.length),
    );
    record(
      "Dashboard tenant page is Your Pharmacy, never a competitor",
      evidenceDomains.yours.includes("fixture-town.example") &&
        !evidenceDomains.verified.includes("fixture-town.example") &&
        !evidenceDomains.wider.includes("fixture-town.example"),
    );
    record(
      "Dashboard verified matches use the Google Places website domains only",
      evidenceDomains.verified.includes("asda.com") &&
        evidenceDomains.verified.includes("example-highstreet.example") &&
        !evidenceDomains.verified.includes("finder.well.co.uk") &&
        !evidenceDomains.verified.includes("barnsleychemist.co.uk"),
    );
    record(
      "Dashboard sends unmatched and non-pharmacy domains to Wider Organic Landscape",
      evidenceDomains.wider.includes("finder.well.co.uk") &&
        evidenceDomains.wider.includes("allhealthandcare.co.uk") &&
        evidenceDomains.wider.includes("england.nhs.uk") &&
        evidenceDomains.wider.includes("poolpharmacy.co.uk"),
    );
    record("Dashboard Google competitor table still includes ASDA Pharmacy", Boolean(asdaRow), asdaRow?.name);
    record("Dashboard table preserves ASDA rating 3.1", Boolean(asdaRow?.rating.includes("3.1")), asdaRow?.rating);
    record("Dashboard table preserves ASDA 87 reviews", asdaRow?.reviews === "87", asdaRow?.reviews);
    record(
      "Dashboard Google Profile Metrics still read the Google-local artifact",
      dash.sectionEvidence.googleProfileMetrics.evidenceSource === "google-places-live" &&
        dash.googleProfileMetrics.find((m) => m.id === "rating")?.highestCompetitor === "4.6" &&
        dash.googleProfileMetrics.find((m) => m.id === "rating")?.sampleSize === 2,
    );
    record(
      "Dashboard provider collection is unchanged",
      dash.analysisProviders.some((p) => p.family === "google_local" && p.label === "Google/local competitors") &&
        dash.analysisProviders.some(
          (p) => p.family === "dataforseo_organic" && p.label === "DataForSEO organic-search competitors",
        ),
    );

    const otherDash = buildCommercialIntelligenceDashboard(snapSlug);
    record(
      "Second tenant remains compatible",
      otherDash.competitorAnalysis.competitors.some((c) => c.name === "Boots Pharmacy") &&
        otherDash.organicSearchEvidence.yourPharmacy.some((row) => row.domain === "second-tenant.example") &&
        otherDash.organicSearchEvidence.verifiedLocalCompetitorMatches.some((row) => row.domain === "boots.com") &&
        otherDash.organicSearchEvidence.widerOrganicLandscape.some(
          (row) => row.domain === "wikipedia.org" && row.landscapeKind === "publisher",
        ),
    );
    record(
      "Second tenant metrics ignore empty analysis.comparisons",
      otherDash.googleProfileMetrics.find((m) => m.id === "rating")?.highestCompetitor === "4.2",
    );
  } finally {
    cleanup(created);
  }

  const afterEvidence = existingGeneratedEvidence();
  const afterHashes = Object.fromEntries(afterEvidence.map((file) => [file, hashFile(file)]));
  record(
    "Live generated evidence and content artifacts remain unchanged",
    JSON.stringify(beforeHashes) === JSON.stringify(afterHashes) && beforeEvidence.join("|") === afterEvidence.join("|"),
  );
  record(
    "No external API call occurred",
    fetchCalls.length === 0 && fetchCalls.every((url) => !liveHosts.some((host) => url.includes(host))),
    fetchCalls.join(" | ") || "none",
  );

  globalThis.fetch = originalFetch;
  const failed = steps.filter((step) => !step.passed);
  console.log(failed.length ? `\nORGANIC-SEARCH-EVIDENCE-FIX-02: FAIL (${failed.length})` : "\nORGANIC-SEARCH-EVIDENCE-FIX-02: PASS");
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  globalThis.fetch = originalFetch;
  console.error(err);
  process.exit(1);
});
