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
const TASK_ID = "darfield-v3-demo-standard-2026-09-01";
const TASK_BUDGET_USD = 1;
const MAX_NEW_RETRIEVALS = 4;
const ORIGINAL_PACK = path.join(ROOT, "data/pharmacy-local-editorial-evidence-pilots", SLUG, SERVICE, "v3/darfield.json");
const OUT_DIR = path.join(ROOT, "data/pharmacy-local-editorial-research-supplements", SLUG, SERVICE, "v3/darfield");
const OUT = path.join(OUT_DIR, "2026-09-01-demo-standard-research.json");
const LEDGER = path.join(OUT_DIR, "2026-09-01-demo-standard-cost-ledger.json");

const GEO = {
  areaName: "Darfield",
  parentTown: "Barnsley",
  county: "South Yorkshire",
  country: "United Kingdom",
  countryCode: "GB",
  queryPlaceLabel: "Darfield, Barnsley, South Yorkshire, UK",
};

const ALREADY_HAVE = new Set([
  "https://www.travelsouthyorkshire.com/",
  "https://southyorkshire.icb.nhs.uk/about-us/who-we-are-and-what-we-do/place-map/barnsley",
]);

const LIBRARY_URL = "https://www.barnsley.gov.uk/services/libraries/find-a-library/darfield-library/";
const FILLER_OFFICIAL = [
  "https://www.barnsley.gov.uk/services/council-and-democracy/research-data-and-statistics/ward-profiles/",
  "https://www.barnsley.gov.uk/services/community-and-volunteering/your-area-council-and-ward/",
];

function factFromDraft(
  draft: ReturnType<typeof extractEditorialFactDrafts>[number],
  page: { title: string; url: string; publisher: string; retrievedAt: string },
): EditorialFactV3 {
  return {
    factId: factIdFor("darfield", draft.category, draft.normalizedStatement),
    area: "Darfield",
    areaSlug: "darfield",
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

function extractFactsFromBody(opts: {
  url: string;
  title: string;
  text: string;
  publisher: string;
  retrievedAt: string;
}): EditorialFactV3[] {
  const host = hostFromUrl(opts.url);
  const drafts = extractEditorialFactDrafts({
    areaName: "Darfield",
    title: opts.title,
    text: opts.text,
    sourceClass: "primary",
    publisher: opts.publisher,
    host,
  });
  const facts: EditorialFactV3[] = [];
  for (const draft of drafts) {
    if (looksLikeRawCopiedPassage(draft.normalizedStatement, opts.text)) continue;
    if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
    if (/wombwell/i.test(draft.normalizedStatement)) continue;
    facts.push(
      factFromDraft(draft, {
        title: opts.title,
        url: opts.url,
        publisher: opts.publisher,
        retrievedAt: opts.retrievedAt,
      }),
    );
  }
  return facts;
}

async function main() {
  process.chdir(ROOT);
  const originalPackHash = hashFileSha256(ORIGINAL_PACK);
  const hydrated = hydrateDataForSeoEnvIfNeeded();
  const ledger = loadLedger();
  const searches: Array<Record<string, unknown>> = [];
  const retrievedPages: Array<Record<string, unknown>> = [];
  const rejectedSources: Array<{ url: string; reason: string }> = [];
  const newFacts: EditorialFactV3[] = [];
  let pageFetches = Number(ledger.pageFetches || 0);
  let dataForSeoCostUsd = Number(ledger.dataForSeoCostUsd || 0);

  async function fetchOne(item: { url: string; title: string; snippet: string; query: string }) {
    if (pageFetches >= MAX_NEW_RETRIEVALS) return;
    pageFetches += 1;
    ledger.pageFetches = pageFetches;
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
    const retrievedAt = new Date().toISOString();
    retrievedPages.push({
      requestedUrl: item.url,
      finalUrl: fetched.url || item.url,
      title: fetched.title || item.title,
      status: fetched.status,
      publisher: classification.publisher,
      sourceClass: classification.class,
      retrievedAt,
      topic: item.query,
      bodyChars: fetched.textSample ? fetched.textSample.length : 0,
      usableBody: usable,
      textSample: fetched.textSample || "",
    });
    if (!usable || classification.class !== "primary") {
      if (classification.class === "rejected") rejectedSources.push({ url: item.url, reason: classification.reason });
      return;
    }
    const facts = extractFactsFromBody({
      url: fetched.url || item.url,
      title: fetched.title || item.title,
      text: fetched.textSample || "",
      publisher: classification.publisher,
      retrievedAt,
    });
    for (const fact of facts) {
      if (newFacts.some((row) => row.normalizedStatement === fact.normalizedStatement)) continue;
      newFacts.push(fact);
    }
  }

  await fetchOne({
    url: LIBRARY_URL,
    title: "Darfield Library",
    snippet: "Barnsley Council Darfield Library",
    query: "restore-saved-darfield-library-body",
  });

  const fetchQueue: Array<{ url: string; title: string; snippet: string; query: string }> = [];
  const seenUrls = new Set<string>([...ALREADY_HAVE, LIBRARY_URL, `${LIBRARY_URL.replace(/\/$/, "")}`]);

  const queries = [
    "listed building heritage colliery history in Darfield, Barnsley, South Yorkshire, UK",
    "NHS Medical Centre Surgery official in Darfield, Barnsley, South Yorkshire, UK",
  ];

  if (hydrated.ok) {
    for (const query of queries) {
      if (pageFetches >= MAX_NEW_RETRIEVALS && fetchQueue.length >= MAX_NEW_RETRIEVALS) break;
      if (!isQueryGeographicallyDisambiguated(query, GEO)) {
        throw new Error(`query not geographically disambiguated: ${query}`);
      }
      if (dataForSeoCostUsd + 0.01 > TASK_BUDGET_USD) break;
      const serp = await searchNationalGoogleOrganic({
        query,
        marketCountry: "United Kingdom",
        languageCode: "en",
        depth: 10,
      });
      const cost = Number(serp.cost || 0) || 0;
      dataForSeoCostUsd += cost;
      ledger.dataForSeoCostUsd = dataForSeoCostUsd;
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
        topic: query.includes("Medical Centre") ? "official-healthcare" : "official-heritage-history",
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
        const darfieldish = /darfield/i.test(`${hit.title} ${hit.description} ${url}`);
        if (!darfieldish && !/list-entry|listed-building|ward-profiles|find-a-library\/darfield/i.test(url)) continue;
        seenUrls.add(url);
        fetchQueue.push({ url, title: hit.title, snippet: hit.description, query });
      }
    }
  } else {
    searches.push({ skipped: true, reason: hydrated.detail });
  }

  for (const url of FILLER_OFFICIAL) {
    if (fetchQueue.length >= MAX_NEW_RETRIEVALS) break;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    fetchQueue.push({
      url,
      title: url.includes("ward-profiles") ? "Ward profiles" : "Your area council and ward",
      snippet: "Barnsley Council official local geography",
      query: "official-council-geography-filler",
    });
  }

  for (const item of fetchQueue) {
    if (pageFetches >= MAX_NEW_RETRIEVALS) break;
    await fetchOne(item);
  }

  saveLedger(ledger);
  const payload = {
    taskId: TASK_ID,
    originalPackHash,
    originalPackUnchanged: hashFileSha256(ORIGINAL_PACK) === originalPackHash,
    dataForSeoConfigured: hydrated.ok,
    dataForSeoCostUsd,
    pageFetches,
    searches,
    retrievedPages: retrievedPages.map((page) => ({
      ...page,
      textSample: page.textSample,
    })),
    rejectedSources,
    facts: newFacts,
    descriptiveFactStatements: newFacts
      .map((f) => f.normalizedStatement)
      .filter((s) => !/is in the Metropolitan Borough of Barnsley/i.test(s) && !/^Darfield has a public library\.?$/i.test(s)),
  };
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        originalPackUnchanged: payload.originalPackUnchanged,
        dataForSeoCostUsd,
        pageFetches,
        searchCount: searches.length,
        factStatements: newFacts.map((f) => f.normalizedStatement),
        descriptiveFactStatements: payload.descriptiveFactStatements,
        retrieved: retrievedPages.map((p) => ({
          url: p.finalUrl || p.requestedUrl,
          status: p.status,
          usableBody: p.usableBody,
          bodyChars: p.bodyChars,
        })),
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
