/**
 * Collects attributable editorial evidence for three Pharmacy First v3 pilots.
 * Reuses DataForSEO national organic search and the existing safe HTML fetch.
 * Does not call Google Places, Maps Routes, or image generation.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { isDataForSeoConfigured, searchNationalGoogleOrganic } from "../dataForSeoNationalSearchAdapter.ts";
import { fetchSafeHtmlEvidencePage } from "../nationalCompetitorEvidenceEnrichmentService.ts";
import {
  loadPharmacyLocalEvidencePack,
  planPharmacyLocalEvidenceRequest,
  validatePharmacyLocalEvidencePack,
  attributableEntities,
} from "./pharmacyLocalEvidencePackContractV1.ts";
import { resolveGeographicEvidenceContext } from "./pharmacyLocalEvidenceGeographicAttributionV1.ts";
import { buildPharmacyAiLocalCopyInputV1 } from "./pharmacyAiLocalNarrativeEngineV1.ts";
import {
  EDITORIAL_EVIDENCE_CONTRACT_ID,
  EDITORIAL_EVIDENCE_VERSION,
  EDITORIAL_PILOT_AREAS,
  MAX_COMBINED_EXTERNAL_COST_USD,
  MAX_PAGE_RETRIEVALS_PER_AREA,
  assessEditorialSufficiency,
  buildEditorialSearchQueries,
  canonicalPharmacyFacts,
  classifyEditorialSource,
  decodeHtmlEntities,
  editorialEvidencePackPath,
  extractEditorialFactDrafts,
  factIdFor,
  hasUsablePageBody,
  hostFromUrl,
  isCustomerAppropriateOrganisationName,
  isQueryGeographicallyDisambiguated,
  looksLikeRawCopiedPassage,
  unsupportedInferencesIn,
  type EditorialEvidencePackV3,
  type EditorialFactV3,
  type EditorialRetrievedPageV3,
  type EditorialSearchRecordV3,
} from "./pharmacyLocalEditorialEvidenceContractV3.ts";
import { isExistingAiLocalPilotV3Area, isOneLocalPageCandidateArea } from "./pharmacyAiLocalPageCandidatePaths.ts";
import { buildUkLocalPageEditorialSearchQueries } from "./pharmacyUkLocalPageContentContractV1.ts";

const YORKSHIRE = "yorkshire-pharmacy-and-health-clinic";
const SERVICE = "pharmacy-first";
const MARKET_COUNTRY = "United Kingdom";

export const EDITORIAL_COLLECTION_LEDGER = {
  searches: 0,
  pages: 0,
  dataForSeoCostUsd: 0,
  areas: [] as string[],
};

export function resetEditorialCollectionLedger(): void {
  EDITORIAL_COLLECTION_LEDGER.searches = 0;
  EDITORIAL_COLLECTION_LEDGER.pages = 0;
  EDITORIAL_COLLECTION_LEDGER.dataForSeoCostUsd = 0;
  EDITORIAL_COLLECTION_LEDGER.areas = [];
}

function applyDataForSeoEnvFromText(raw: string): void {
  const keys = ["DATAFORSEO_LOGIN", "DATAFORSEO_API_LOGIN", "DATAFORSEO_PASSWORD", "DATAFORSEO_API_PASSWORD"];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    const colon = trimmed.indexOf(":");
    let key = "";
    let value = "";
    if (eq > 0 && (colon < 0 || eq < colon)) {
      key = trimmed.slice(0, eq).trim();
      value = trimmed.slice(eq + 1).trim();
    } else if (colon > 0) {
      key = trimmed.slice(0, colon).trim();
      value = trimmed.slice(colon + 1).trim();
    }
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (keys.includes(key) && value && !process.env[key]) process.env[key] = value;
  }
}

export function hydrateDataForSeoEnvIfNeeded(): { ok: boolean; detail: string } {
  if (isDataForSeoConfigured()) return { ok: true, detail: "process-env" };
  const envFile = path.join(process.cwd(), ".env");
  if (fs.existsSync(envFile)) {
    applyDataForSeoEnvFromText(fs.readFileSync(envFile, "utf8"));
    if (isDataForSeoConfigured()) return { ok: true, detail: "dotenv" };
  }
  try {
    applyDataForSeoEnvFromText(execSync("pm2 env 1", { encoding: "utf8" }));
  } catch {
    /* ignore */
  }
  if (isDataForSeoConfigured()) return { ok: true, detail: "pm2-env" };
  return { ok: false, detail: "DATAFORSEO credentials not configured" };
}

export function loadEditorialEvidencePack(
  slug: string,
  serviceId: string,
  areaSlug: string,
): EditorialEvidencePackV3 | null {
  const file = editorialEvidencePackPath(slug, serviceId, areaSlug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as EditorialEvidencePackV3;
  } catch {
    return null;
  }
}

function remainingBudget(spent: number): number {
  return MAX_COMBINED_EXTERNAL_COST_USD - spent;
}

export async function collectEditorialEvidenceForArea(opts: {
  slug: string;
  serviceId: string;
  areaName: string;
  areaSlug: string;
  spentUsd: number;
  writePack?: boolean;
}): Promise<{ pack: EditorialEvidencePackV3; spentUsd: number }> {
  if (!isExistingAiLocalPilotV3Area(opts.areaSlug) && !isOneLocalPageCandidateArea(opts.slug, opts.areaSlug)) {
    throw new Error(`area ${opts.areaSlug} is not authorised for editorial-evidence collection`);
  }
  if (remainingBudget(opts.spentUsd) <= 0) {
    throw new Error("combined external cost limit reached before search");
  }

  const plan = planPharmacyLocalEvidenceRequest(opts.slug, opts.serviceId);
  const rawPack = loadPharmacyLocalEvidencePack(opts.slug, opts.areaSlug);
  const checked = validatePharmacyLocalEvidencePack(rawPack, {
    slug: opts.slug,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
  });
  const placesPack = checked.ok ? checked.pack : null;
  const geo = resolveGeographicEvidenceContext({
    slug: opts.slug,
    areaName: opts.areaName,
    areaSlug: opts.areaSlug,
    siblingAreaNames: plan.areas.map((row) => row.areaName),
    pharmacyCoordinates: placesPack?.pharmacyCoordinates || null,
  });
  const queries = isOneLocalPageCandidateArea(opts.slug, opts.areaSlug)
    ? buildUkLocalPageEditorialSearchQueries(geo).map((row) => ({ topic: row.topic, query: row.query }))
    : buildEditorialSearchQueries({ geo, pack: placesPack });
  for (const row of queries) {
    if (!isQueryGeographicallyDisambiguated(row.query, geo)) {
      throw new Error(`search query is not geographically disambiguated: ${row.query}`);
    }
  }

  const searches: EditorialSearchRecordV3[] = [];
  const rejectedSources: Array<{ url: string; reason: string }> = [];
  const candidates: Array<{
    topic: string;
    url: string;
    title: string;
    snippet: string;
    classification: ReturnType<typeof classifyEditorialSource>;
  }> = [];
  let spent = opts.spentUsd;

  for (const row of queries) {
    if (remainingBudget(spent) < 0.01) break;
    const serp = await searchNationalGoogleOrganic({
      query: row.query,
      marketCountry: MARKET_COUNTRY,
      languageCode: "en",
      depth: 10,
    });
    const cost = Number(serp.cost || 0) || 0;
    spent += cost;
    EDITORIAL_COLLECTION_LEDGER.searches += 1;
    EDITORIAL_COLLECTION_LEDGER.dataForSeoCostUsd += cost;
    searches.push({
      topic: row.topic,
      query: row.query,
      disambiguated: true,
      costUsd: cost,
      resultCount: serp.results.length,
      capturedAt: serp.capturedAt,
      provider: "dataforseo",
    });
    for (const hit of serp.results) {
      const classification = classifyEditorialSource(hit.url, hit.title, hit.description);
      if (classification.class === "rejected") {
        rejectedSources.push({ url: hit.url, reason: classification.reason });
        continue;
      }
      candidates.push({
        topic: row.topic,
        url: hit.url,
        title: hit.title,
        snippet: hit.description,
        classification,
      });
    }
  }

  const retrievedPages: EditorialRetrievedPageV3[] = [];
  const facts: EditorialFactV3[] = [];
  const seenUrls = new Set<string>();
  const byTopic = new Map<string, typeof candidates>();
  for (const candidate of candidates) {
    const list = byTopic.get(candidate.topic) || [];
    list.push(candidate);
    byTopic.set(candidate.topic, list);
  }
  const fetchQueue: typeof candidates = [];
  for (const topic of ["official-community", "official-transport", "official-healthcare"]) {
    const list = (byTopic.get(topic) || []).filter((row) => row.classification.class === "primary");
    const first = list.find((row) => !seenUrls.has(row.url));
    if (first) {
      seenUrls.add(first.url);
      fetchQueue.push(first);
    }
  }
  for (const candidate of candidates) {
    if (fetchQueue.length >= MAX_PAGE_RETRIEVALS_PER_AREA) break;
    if (seenUrls.has(candidate.url)) continue;
    if (candidate.classification.class !== "primary") continue;
    seenUrls.add(candidate.url);
    fetchQueue.push(candidate);
  }

  const retrievedAt = new Date().toISOString();
  for (const page of fetchQueue.slice(0, MAX_PAGE_RETRIEVALS_PER_AREA)) {
    const fetched = await fetchSafeHtmlEvidencePage(page.url);
    EDITORIAL_COLLECTION_LEDGER.pages += 1;
    retrievedPages.push({
      url: fetched.url || page.url,
      title: fetched.title || page.title,
      publisher: page.classification.publisher,
      sourceClass: page.classification.class,
      status: fetched.status,
      retrievedAt,
      textSample: fetched.textSample || undefined,
    });
    if (!fetched.textSample || (fetched.status && fetched.status >= 400)) continue;
    const host = hostFromUrl(fetched.url || page.url);
    const drafts = extractEditorialFactDrafts({
      areaName: opts.areaName,
      title: fetched.title || page.title,
      text: fetched.textSample,
      sourceClass: page.classification.class,
      publisher: page.classification.publisher,
      host,
    });
    for (const draft of drafts) {
      if (looksLikeRawCopiedPassage(draft.normalizedStatement, fetched.textSample)) continue;
      if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
      const fact: EditorialFactV3 = {
        factId: factIdFor(opts.areaSlug, draft.category, draft.normalizedStatement),
        area: opts.areaName,
        areaSlug: opts.areaSlug,
        category: draft.category,
        normalizedStatement: draft.normalizedStatement,
        sourceTitle: fetched.title || page.title,
        sourceUrl: fetched.url || page.url,
        publisher: page.classification.publisher,
        retrievedAt,
        sourceClass: page.classification.class,
        corroboratingSource: null,
        confidence: draft.confidence,
        usefulnessToPharmacyFirstReader: draft.usefulnessToPharmacyFirstReader,
        permittedCopyRole: draft.permittedCopyRole,
        prohibitedInference: draft.prohibitedInference,
        validationStatus: "accepted",
      };
      if (facts.some((row) => row.normalizedStatement === fact.normalizedStatement)) continue;
      facts.push(fact);
    }
  }

  const input = placesPack
    ? buildPharmacyAiLocalCopyInputV1({
        slug: opts.slug,
        serviceId: opts.serviceId,
        areaName: opts.areaName,
        areaSlug: opts.areaSlug,
        pack: placesPack,
      })
    : null;
  if (input) {
    facts.push(
      ...canonicalPharmacyFacts({
        areaName: opts.areaName,
        areaSlug: opts.areaSlug,
        pharmacyName: input.business.name,
        address: input.business.address,
        pharmacyIsInArea: input.locality.pharmacyIsInArea,
        distanceKm: input.locality.distanceKm,
        retrievedAt,
      }),
    );
  }

  const sufficiency = assessEditorialSufficiency({
    facts,
    placesEntityCount: placesPack ? attributableEntities(placesPack).length : 0,
    pharmacyIsInArea: input?.locality.pharmacyIsInArea || false,
    hasVerifiedDistance: input?.locality.distanceKm != null,
  });

  const pack: EditorialEvidencePackV3 = {
    contractId: EDITORIAL_EVIDENCE_CONTRACT_ID,
    version: EDITORIAL_EVIDENCE_VERSION,
    slug: opts.slug,
    area: opts.areaName,
    areaSlug: opts.areaSlug,
    collectedAt: retrievedAt,
    geographicContext: {
      areaName: geo.areaName,
      parentTown: geo.parentTown,
      county: geo.county,
      country: geo.country,
      queryPlaceLabel: geo.queryPlaceLabel,
    },
    searches,
    retrievedPages,
    rejectedSources: uniqueRejected(rejectedSources),
    facts,
    sufficiency,
    costUsd: spent - opts.spentUsd,
  };

  if (opts.writePack !== false) {
    const file = editorialEvidencePackPath(opts.slug, opts.serviceId, opts.areaSlug);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(pack, null, 2), "utf8");
  }
  EDITORIAL_COLLECTION_LEDGER.areas.push(opts.areaSlug);
  return { pack, spentUsd: spent };
}

export function repairEditorialPackFromStoredPages(pack: EditorialEvidencePackV3): EditorialEvidencePackV3 {
  const retrievedPages = pack.retrievedPages.map((page) => ({
    ...page,
    title: decodeHtmlEntities(page.title),
  }));
  const dumpUrls = new Set(
    pack.facts
      .filter((fact) => {
        if (fact.category !== "healthcare") return false;
        const provided = fact.normalizedStatement.match(/provided from\s+(.+?)\.?$/i)?.[1]?.trim() || "";
        return provided && !isCustomerAppropriateOrganisationName(provided);
      })
      .map((fact) => fact.sourceUrl),
  );
  const facts: EditorialFactV3[] = pack.facts.map((fact) => ({ ...fact }));
  for (const page of retrievedPages) {
    if (!page.textSample || page.sourceClass === "rejected") continue;
    const sourceClass = page.sourceClass === "secondary" ? "secondary" : "primary";
    const drafts = extractEditorialFactDrafts({
      areaName: pack.area,
      title: page.title,
      text: page.textSample,
      sourceClass,
      publisher: page.publisher,
      host: hostFromUrl(page.url),
    });
    for (const draft of drafts) {
      if (looksLikeRawCopiedPassage(draft.normalizedStatement, page.textSample)) continue;
      if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
      const existing = facts.find((row) => row.normalizedStatement === draft.normalizedStatement);
      if (existing) {
        if (existing.validationStatus !== "accepted" && !dumpUrls.has(existing.sourceUrl)) {
          existing.validationStatus = "accepted";
        }
        continue;
      }
      facts.push({
        factId: factIdFor(pack.areaSlug, draft.category, draft.normalizedStatement),
        area: pack.area,
        areaSlug: pack.areaSlug,
        category: draft.category,
        normalizedStatement: draft.normalizedStatement,
        sourceTitle: page.title,
        sourceUrl: page.url,
        publisher: page.publisher,
        retrievedAt: page.retrievedAt,
        sourceClass,
        corroboratingSource: null,
        confidence: draft.confidence,
        usefulnessToPharmacyFirstReader: draft.usefulnessToPharmacyFirstReader,
        permittedCopyRole: draft.permittedCopyRole,
        prohibitedInference: draft.prohibitedInference,
        validationStatus: "accepted",
      });
    }
  }
  const nextFacts = facts.map((fact) => {
    if (fact.category !== "healthcare") return fact;
    const provided = fact.normalizedStatement.match(/provided from\s+(.+?)\.?$/i)?.[1]?.trim() || "";
    if (provided && !isCustomerAppropriateOrganisationName(provided)) {
      return { ...fact, validationStatus: "rejected" as const };
    }
    if (/^Home\s*[|\-–]/i.test(fact.sourceTitle)) {
      const page = retrievedPages.find((row) => row.url === fact.sourceUrl);
      const bodySupports =
        Boolean(page?.textSample) &&
        hasUsablePageBody(page?.title || fact.sourceTitle, page?.textSample || "") &&
        extractEditorialFactDrafts({
          areaName: pack.area,
          title: page?.title || fact.sourceTitle,
          text: page?.textSample || "",
          sourceClass: page?.sourceClass === "secondary" ? "secondary" : "primary",
          publisher: page?.publisher || fact.publisher,
          host: hostFromUrl(page?.url || fact.sourceUrl),
        }).some((draft) => draft.normalizedStatement === fact.normalizedStatement);
      if (!bodySupports) return { ...fact, validationStatus: "rejected" as const };
    }
    if (dumpUrls.has(fact.sourceUrl)) {
      return { ...fact, validationStatus: "rejected" as const };
    }
    return fact;
  });
  const pharmacyRel = nextFacts.filter((f) => f.category === "pharmacy-relationship");
  const sufficiency = assessEditorialSufficiency({
    facts: nextFacts,
    placesEntityCount: pack.sufficiency.placesEntityCount,
    pharmacyIsInArea: pharmacyRel.some((f) => / is in /.test(f.normalizedStatement)),
    hasVerifiedDistance: pharmacyRel.some((f) => /\d+(?:\.\d+)? km/.test(f.normalizedStatement)),
  });
  const reasons = [...sufficiency.reasons];
  if (retrievedPages.every((page) => !page.textSample)) {
    if (sufficiency.status !== "READY") {
      reasons.push("retrieved page bodies were not persisted; facts cannot be recovered from titles or hostnames");
    }
  }
  return {
    ...pack,
    retrievedPages,
    facts: nextFacts,
    sufficiency: {
      ...sufficiency,
      reasons: sufficiency.status === "READY" ? sufficiency.reasons : [...new Set(reasons)],
    },
  };
}

let officialBodyRestores = 0;

export async function restoreOneOfficialPageBody(opts: {
  slug: string;
  serviceId: string;
  areaSlug: string;
  url: string;
}): Promise<{ ok: boolean; fetched: boolean; pack: EditorialEvidencePackV3 | null; detail: string }> {
  const pack = loadEditorialEvidencePack(opts.slug, opts.serviceId, opts.areaSlug);
  if (!pack) return { ok: false, fetched: false, pack: null, detail: "missing editorial pack" };
  const page = pack.retrievedPages.find((row) => row.url === opts.url);
  if (!page) return { ok: false, fetched: false, pack, detail: "url was not previously retrieved" };
  if (page.sourceClass !== "primary") {
    return { ok: false, fetched: false, pack, detail: "url is not an accepted primary page" };
  }
  if (page.textSample && hasUsablePageBody(page.title, page.textSample)) {
    const repaired = repairEditorialPackFromStoredPages(pack);
    const file = editorialEvidencePackPath(opts.slug, opts.serviceId, opts.areaSlug);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(repaired, null, 2), "utf8");
    return { ok: true, fetched: false, pack: repaired, detail: "body already stored" };
  }
  if (officialBodyRestores >= 1) {
    return { ok: false, fetched: false, pack, detail: "one official body fetch already used" };
  }
  officialBodyRestores += 1;
  const fetched = await fetchSafeHtmlEvidencePage(opts.url);
  if (!fetched.textSample || (fetched.status && fetched.status >= 400)) {
    return {
      ok: false,
      fetched: true,
      pack,
      detail: `fetch failed status=${fetched.status} body=${fetched.textSample ? "yes" : "no"}`,
    };
  }
  const retrievedPages = pack.retrievedPages.map((row) =>
    row.url === opts.url
      ? {
          ...row,
          title: fetched.title || row.title,
          status: fetched.status,
          retrievedAt: new Date().toISOString(),
          textSample: fetched.textSample,
        }
      : row,
  );
  const repaired = repairEditorialPackFromStoredPages({ ...pack, retrievedPages });
  const file = editorialEvidencePackPath(opts.slug, opts.serviceId, opts.areaSlug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(repaired, null, 2), "utf8");
  return { ok: repaired.sufficiency.status === "READY" || Boolean(repaired.retrievedPages.find((row) => row.url === opts.url)?.textSample), fetched: true, pack: repaired, detail: repaired.sufficiency.status };
}

function uniqueRejected(rows: Array<{ url: string; reason: string }>): Array<{ url: string; reason: string }> {
  const seen = new Set<string>();
  const out: Array<{ url: string; reason: string }> = [];
  for (const row of rows) {
    const key = `${row.url}::${row.reason}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.slice(0, 40);
}

export async function collectEditorialEvidencePilotsV3(opts?: {
  slug?: string;
  serviceId?: string;
  force?: boolean;
  priorSpentUsd?: number;
}): Promise<{
  ok: boolean;
  packs: EditorialEvidencePackV3[];
  spentUsd: number;
  skipped: Array<{ areaSlug: string; detail: string }>;
  hydrateDetail: string;
}> {
  const slug = opts?.slug || YORKSHIRE;
  const serviceId = opts?.serviceId || SERVICE;
  const hydrated = hydrateDataForSeoEnvIfNeeded();
  if (!hydrated.ok) {
    return { ok: false, packs: [], spentUsd: opts?.priorSpentUsd || 0, skipped: [{ areaSlug: "*", detail: hydrated.detail }], hydrateDetail: hydrated.detail };
  }
  resetEditorialCollectionLedger();
  const plan = planPharmacyLocalEvidenceRequest(slug, serviceId);
  const requested = plan.areas.filter((area) => (EDITORIAL_PILOT_AREAS as readonly string[]).includes(area.areaSlug));
  const packs: EditorialEvidencePackV3[] = [];
  const skipped: Array<{ areaSlug: string; detail: string }> = [];
  let spent = opts?.priorSpentUsd || 0;
  for (const area of requested) {
    if (!opts?.force) {
      const existing = loadEditorialEvidencePack(slug, serviceId, area.areaSlug);
      if (existing?.facts?.length) {
        const repaired = repairEditorialPackFromStoredPages(existing);
        const file = editorialEvidencePackPath(slug, serviceId, area.areaSlug);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, JSON.stringify(repaired, null, 2), "utf8");
        packs.push(repaired);
        EDITORIAL_COLLECTION_LEDGER.searches += existing.searches.length;
        EDITORIAL_COLLECTION_LEDGER.pages += existing.retrievedPages.length;
        EDITORIAL_COLLECTION_LEDGER.dataForSeoCostUsd += existing.costUsd || 0;
        EDITORIAL_COLLECTION_LEDGER.areas.push(area.areaSlug);
        spent += existing.costUsd || 0;
        continue;
      }
    }
    try {
      const result = await collectEditorialEvidenceForArea({
        slug,
        serviceId,
        areaName: area.areaName,
        areaSlug: area.areaSlug,
        spentUsd: spent,
      });
      packs.push(result.pack);
      spent = result.spentUsd;
    } catch (error) {
      skipped.push({
        areaSlug: area.areaSlug,
        detail: error instanceof Error ? error.message : "collection-failed",
      });
    }
  }
  return { ok: packs.length > 0, packs, spentUsd: spent, skipped, hydrateDetail: hydrated.detail };
}
