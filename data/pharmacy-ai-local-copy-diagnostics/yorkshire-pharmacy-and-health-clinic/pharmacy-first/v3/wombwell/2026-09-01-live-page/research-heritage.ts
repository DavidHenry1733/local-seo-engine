import fs from "node:fs";
import path from "node:path";

import { searchNationalGoogleOrganic } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/dataForSeoNationalSearchAdapter.ts";
import { fetchSafeHtmlEvidencePage } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/nationalCompetitorEvidenceEnrichmentService.ts";
import { hydrateDataForSeoEnvIfNeeded } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { hashFileSha256 } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyAiLocalNarrativeEngineV1.ts";
import {
  classifyEditorialSource,
  extractEditorialFactDrafts,
  factIdFor,
  hasUsablePageBody,
  hostFromUrl,
  isQueryGeographicallyDisambiguated,
  looksLikeRawCopiedPassage,
  unsupportedInferencesIn,
  type EditorialFactV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const TASK_ID = "wombwell-v3-live-page-2026-09-01";
const TASK_BUDGET_USD = 1;
const MAX_NEW_RETRIEVALS = 4;
const ORIGINAL_PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/wombwell.json");
const COMPLETE_PILOT = path.join(
  ROOT,
  "data/pharmacy-local-editorial-research-supplements",
  SLUG,
  SERVICE,
  "v3/wombwell/2026-09-01-complete-pilot.json",
);
const OUT_DIR = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/wombwell");
const OUT = path.join(OUT_DIR, "2026-09-01-live-page-research.json");
const LEDGER = path.join(OUT_DIR, "2026-09-01-live-page-cost-ledger.json");

const GEO = {
  areaName: "Wombwell",
  parentTown: "Barnsley",
  county: "South Yorkshire",
  country: "United Kingdom",
  countryCode: "GB",
  queryPlaceLabel: "Wombwell, Barnsley, South Yorkshire, UK",
};

const ALREADY_HAVE = new Set([
  "https://www.barnsley.gov.uk/services/libraries/find-a-library/wombwell-library/",
  "https://www.barnsley.gov.uk/services/community-and-volunteering/your-area-council-and-ward/",
  "https://www.barnsley.gov.uk/services/council-and-democracy/research-data-and-statistics/ward-profiles/",
  "https://historicengland.org.uk/local/locations/barnsley/",
  "https://www.nationalrail.co.uk/stations/wombwell/",
  "https://www.wombwellmedicalcentre.nhs.uk/",
  "http://www.wombwellmedicalcentre.nhs.uk/",
  "https://www.chapelfieldmedicalcentre.nhs.uk/",
]);

function factFromDraft(
  draft: ReturnType<typeof extractEditorialFactDrafts>[number],
  page: { title: string; url: string; publisher: string; retrievedAt: string },
): EditorialFactV3 {
  return {
    factId: factIdFor("wombwell", draft.category, draft.normalizedStatement),
    area: "Wombwell",
    areaSlug: "wombwell",
    category: draft.category,
    normalizedStatement: draft.normalizedStatement,
    sourceTitle: page.title,
    sourceUrl: page.url,
    publisher: page.publisher,
    retrievedAt: page.retrievedAt,
    sourceClass: "primary",
    corroboratingSource: null,
    confidence: draft.confidence,
    usefulnessToPharmacyFirstReader: draft.usefulnessToPharmacyFirstReader,
    permittedCopyRole: draft.permittedCopyRole,
    prohibitedInference: draft.prohibitedInference,
    validationStatus: "accepted",
  };
}

function loadLedger(): Record<string, unknown> {
  if (fs.existsSync(LEDGER)) return JSON.parse(fs.readFileSync(LEDGER, "utf8")) as Record<string, unknown>;
  return {
    taskId: TASK_ID,
    createdAt: new Date().toISOString(),
    taskBudgetUsd: TASK_BUDGET_USD,
    dataForSeoCostUsd: 0,
    openaiCostUsd: 0,
    pageRetrievalUsd: 0,
    searches: 0,
    pageFetches: 0,
    events: [],
  };
}

function saveLedger(ledger: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);
}

async function main() {
  process.chdir(ROOT);
  const originalPackHash = hashFileSha256(ORIGINAL_PACK);
  const hydrated = hydrateDataForSeoEnvIfNeeded();
  if (!hydrated.ok) throw new Error(hydrated.detail);
  const completePilot = JSON.parse(fs.readFileSync(COMPLETE_PILOT, "utf8")) as {
    retrievedPages?: Array<{
      requestedUrl?: string;
      finalUrl?: string;
      title?: string;
      publisher?: string;
      retrievedAt?: string;
      textSample?: string;
    }>;
  };
  const libraryPage = (completePilot.retrievedPages || []).find((page) =>
    String(page.requestedUrl || page.finalUrl || "").includes("wombwell-library"),
  );
  if (!libraryPage?.textSample) throw new Error("saved library body missing");

  const savedLibraryDrafts = extractEditorialFactDrafts({
    areaName: "Wombwell",
    title: libraryPage.title || "Wombwell Library",
    text: libraryPage.textSample,
    sourceClass: "primary",
    publisher: libraryPage.publisher || "barnsley.gov.uk",
    host: "barnsley.gov.uk",
  });
  const savedFacts: EditorialFactV3[] = [];
  for (const draft of savedLibraryDrafts) {
    if (looksLikeRawCopiedPassage(draft.normalizedStatement, libraryPage.textSample)) continue;
    if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
    savedFacts.push(
      factFromDraft(draft, {
        title: libraryPage.title || "Wombwell Library",
        url: libraryPage.finalUrl || libraryPage.requestedUrl || "",
        publisher: libraryPage.publisher || "barnsley.gov.uk",
        retrievedAt: libraryPage.retrievedAt || "2026-09-01T11:22:31.612Z",
      }),
    );
  }

  const ledger = loadLedger();
  const searches: Array<Record<string, unknown>> = [];
  const retrievedPages: Array<Record<string, unknown>> = [];
  const rejectedSources: Array<{ url: string; reason: string }> = [];
  const newFacts: EditorialFactV3[] = [];
  let pageFetches = 0;
  let dataForSeoCostUsd = Number(ledger.dataForSeoCostUsd || 0);

  const queries = [
    "listed building heritage colliery history in Wombwell, Barnsley, South Yorkshire, UK",
    "official council Wombwell Park history in Wombwell, Barnsley, South Yorkshire, UK",
  ];

  const fetchQueue: Array<{ url: string; title: string; snippet: string; query: string }> = [];
  const seenUrls = new Set<string>(ALREADY_HAVE);

  for (const query of queries) {
    if (pageFetches >= MAX_NEW_RETRIEVALS && fetchQueue.length >= MAX_NEW_RETRIEVALS) break;
    if (!isQueryGeographicallyDisambiguated(query, GEO)) {
      throw new Error(`query not geographically disambiguated: ${query}`);
    }
    if (Number(ledger.dataForSeoCostUsd || 0) + dataForSeoCostUsd + 0.01 > TASK_BUDGET_USD) break;
    const serp = await searchNationalGoogleOrganic({
      query,
      marketCountry: "United Kingdom",
      languageCode: "en",
      depth: 10,
    });
    const cost = Number(serp.cost || 0) || 0;
    dataForSeoCostUsd += cost;
    ledger.dataForSeoCostUsd = Number(ledger.dataForSeoCostUsd || 0) + cost;
    ledger.searches = Number(ledger.searches || 0) + 1;
    (ledger.events as Array<Record<string, unknown>>).push({
      at: new Date().toISOString(),
      kind: "dataforseo-search",
      query,
      costUsd: cost,
      resultCount: serp.results.length,
    });
    saveLedger(ledger);
    searches.push({
      topic: query.includes("Park") ? "official-park-history" : "official-heritage-history",
      query,
      disambiguated: true,
      costUsd: cost,
      resultCount: serp.results.length,
      capturedAt: serp.capturedAt,
      provider: "dataforseo",
      results: serp.results.map((hit) => ({
        url: hit.url,
        title: hit.title,
        snippet: hit.description,
        domain: hostFromUrl(hit.url),
      })),
    });
    for (const hit of serp.results) {
      const classification = classifyEditorialSource(hit.url, hit.title, hit.description);
      if (classification.class === "rejected") {
        rejectedSources.push({ url: hit.url, reason: classification.reason });
        continue;
      }
      const url = hit.url.split("#")[0];
      if (seenUrls.has(url) || seenUrls.has(url.replace(/\/$/, ""))) continue;
      if (/\/local\/locations\//i.test(url)) continue;
      const wombwellish = /wombwell/i.test(`${hit.title} ${hit.description} ${url}`);
      if (!wombwellish && !/list-entry|listed-building|wombwell-park|find-a-park/i.test(url)) continue;
      seenUrls.add(url);
      fetchQueue.push({ url, title: hit.title, snippet: hit.description, query });
    }
    if (fetchQueue.length >= MAX_NEW_RETRIEVALS) break;
  }

  for (const item of fetchQueue) {
    if (pageFetches >= MAX_NEW_RETRIEVALS) break;
    pageFetches += 1;
    ledger.pageFetches = Number(ledger.pageFetches || 0) + 1;
    (ledger.events as Array<Record<string, unknown>>).push({
      at: new Date().toISOString(),
      kind: "page-fetch",
      url: item.url,
    });
    saveLedger(ledger);
    const fetched = await fetchSafeHtmlEvidencePage(item.url);
    const classification = classifyEditorialSource(fetched.url || item.url, fetched.title || item.title, item.snippet);
    const usable = Boolean(
      fetched.textSample &&
        hasUsablePageBody(fetched.title || item.title, fetched.textSample) &&
        (!fetched.status || fetched.status < 400),
    );
    retrievedPages.push({
      requestedUrl: item.url,
      finalUrl: fetched.url || item.url,
      title: fetched.title || item.title,
      status: fetched.status,
      publisher: classification.publisher,
      sourceClass: classification.class,
      retrievedAt: new Date().toISOString(),
      topic: item.query,
      bodyChars: fetched.textSample ? fetched.textSample.length : 0,
      usableBody: usable,
      textSample: fetched.textSample || "",
    });
    if (!usable || classification.class !== "primary") continue;
    const host = hostFromUrl(fetched.url || item.url);
    const drafts = extractEditorialFactDrafts({
      areaName: "Wombwell",
      title: fetched.title || item.title,
      text: fetched.textSample || "",
      sourceClass: "primary",
      publisher: classification.publisher,
      host,
    });
    for (const draft of drafts) {
      if (looksLikeRawCopiedPassage(draft.normalizedStatement, fetched.textSample || "")) continue;
      if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
      if (/south area council/i.test(draft.normalizedStatement)) continue;
      if (/11,477|19\.8%|13\.2%|semi-detached/i.test(draft.normalizedStatement)) continue;
      const fact = factFromDraft(draft, {
        title: fetched.title || item.title,
        url: fetched.url || item.url,
        publisher: classification.publisher,
        retrievedAt: new Date().toISOString(),
      });
      if (newFacts.some((row) => row.normalizedStatement === fact.normalizedStatement)) continue;
      newFacts.push(fact);
    }
  }

  const payload = {
    kind: "wombwell-v3-live-page-research",
    taskId: TASK_ID,
    collectedAt: new Date().toISOString(),
    originalEditorialPackUnchanged: hashFileSha256(ORIGINAL_PACK) === originalPackHash,
    originalEditorialPackHash: originalPackHash,
    hydrateDetail: hydrated.detail,
    savedLibraryReuse: {
      url: libraryPage.finalUrl || libraryPage.requestedUrl,
      retrievedAt: libraryPage.retrievedAt,
      newRetrieval: false,
      drafts: savedLibraryDrafts.map((d) => d.normalizedStatement),
      facts: savedFacts,
    },
    searches,
    rejectedSources,
    retrievedPages,
    newFacts,
    pageFetches,
    dataForSeoCostUsd,
    taskBudgetUsd: TASK_BUDGET_USD,
    note: "Saved library body reused first. New retrievals only for official Wombwell heritage/history/park pages not already stored. Historic England hub skipped because a previous fetch returned an unusable challenge body.",
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        out: OUT,
        originalPackUnchanged: payload.originalEditorialPackUnchanged,
        savedLibraryFacts: savedFacts.map((f) => f.normalizedStatement),
        searches: searches.map((s) => ({ query: s.query, costUsd: s.costUsd, resultCount: s.resultCount })),
        pageFetches,
        retrieved: retrievedPages.map((p) => ({ url: p.requestedUrl, status: p.status, usable: p.usableBody, chars: p.bodyChars })),
        newFacts: newFacts.map((f) => f.normalizedStatement),
        dataForSeoCostUsd,
        ledger,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
