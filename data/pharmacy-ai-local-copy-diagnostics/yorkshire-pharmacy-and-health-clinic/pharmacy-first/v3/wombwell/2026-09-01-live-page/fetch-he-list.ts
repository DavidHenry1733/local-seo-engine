import fs from "node:fs";
import path from "node:path";

import { fetchSafeHtmlEvidencePage } from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/nationalCompetitorEvidenceEnrichmentService.ts";
import {
  classifyEditorialSource,
  extractEditorialFactDrafts,
  factIdFor,
  hasUsablePageBody,
  hostFromUrl,
  looksLikeRawCopiedPassage,
  unsupportedInferencesIn,
  type EditorialFactV3,
} from "/home/inboxingproweb/pharmaconnect-growth-engine/src/pharmacy/contentEngine/pharmacyLocalEditorialEvidenceContractV3.ts";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const RESEARCH = path.join(
  ROOT,
  "data/pharmacy-local-editorial-research-supplements/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01-live-page-research.json",
);
const LEDGER = path.join(
  ROOT,
  "data/pharmacy-local-editorial-research-supplements/yorkshire-pharmacy-and-health-clinic/pharmacy-first/v3/wombwell/2026-09-01-live-page-cost-ledger.json",
);
const HE_URL = "https://historicengland.org.uk/listing/the-list/results/?search=Wombwell&searchType=NHLE+Simple";

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

async function main() {
  process.chdir(ROOT);
  const research = JSON.parse(fs.readFileSync(RESEARCH, "utf8")) as {
    pageFetches: number;
    retrievedPages: Array<Record<string, unknown>>;
    newFacts: EditorialFactV3[];
    tsyFactsFromSavedBody?: EditorialFactV3[];
  };
  const ledger = JSON.parse(fs.readFileSync(LEDGER, "utf8")) as {
    pageFetches: number;
    events: Array<Record<string, unknown>>;
  };
  if (research.pageFetches >= 4) throw new Error("four retrievals already used");

  const tsy = research.retrievedPages.find((page) => String(page.requestedUrl || "").includes("wombwell-station-artwork"));
  const tsyFacts: EditorialFactV3[] = [];
  if (tsy?.textSample) {
    const drafts = extractEditorialFactDrafts({
      areaName: "Wombwell",
      title: String(tsy.title || "Artwork at Wombwell Station"),
      text: String(tsy.textSample),
      sourceClass: "primary",
      publisher: "Travel South Yorkshire",
      host: "travelsouthyorkshire.com",
    });
    for (const draft of drafts) {
      if (looksLikeRawCopiedPassage(draft.normalizedStatement, String(tsy.textSample))) continue;
      if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
      tsyFacts.push(
        factFromDraft(draft, {
          title: String(tsy.title || "Artwork at Wombwell Station"),
          url: String(tsy.finalUrl || tsy.requestedUrl),
          publisher: "Travel South Yorkshire",
          retrievedAt: String(tsy.retrievedAt),
        }),
      );
    }
  }

  ledger.pageFetches = Number(ledger.pageFetches || 0) + 1;
  ledger.events.push({ at: new Date().toISOString(), kind: "page-fetch", url: HE_URL });
  fs.writeFileSync(LEDGER, `${JSON.stringify(ledger, null, 2)}\n`);

  const fetched = await fetchSafeHtmlEvidencePage(HE_URL);
  const classification = classifyEditorialSource(fetched.url || HE_URL, fetched.title || "", "Wombwell listed buildings");
  const usable = Boolean(
    fetched.textSample &&
      hasUsablePageBody(fetched.title || "Historic England", fetched.textSample) &&
      (!fetched.status || fetched.status < 400),
  );
  const heFacts: EditorialFactV3[] = [];
  if (usable && classification.class === "primary") {
    const drafts = extractEditorialFactDrafts({
      areaName: "Wombwell",
      title: fetched.title || "Historic England list results",
      text: fetched.textSample || "",
      sourceClass: "primary",
      publisher: classification.publisher,
      host: hostFromUrl(fetched.url || HE_URL),
    });
    for (const draft of drafts) {
      if (looksLikeRawCopiedPassage(draft.normalizedStatement, fetched.textSample || "")) continue;
      if (unsupportedInferencesIn(draft.normalizedStatement).length) continue;
      heFacts.push(
        factFromDraft(draft, {
          title: fetched.title || "Historic England list results",
          url: fetched.url || HE_URL,
          publisher: classification.publisher,
          retrievedAt: new Date().toISOString(),
        }),
      );
    }
  }

  research.pageFetches = 4;
  research.retrievedPages.push({
    requestedUrl: HE_URL,
    finalUrl: fetched.url || HE_URL,
    title: fetched.title || "",
    status: fetched.status,
    publisher: classification.publisher,
    sourceClass: classification.class,
    retrievedAt: new Date().toISOString(),
    topic: "historic-england-nhle-wombwell-search",
    bodyChars: fetched.textSample ? fetched.textSample.length : 0,
    usableBody: usable,
    textSample: fetched.textSample || "",
  });
  research.tsyFactsFromSavedBody = tsyFacts;
  research.heFacts = heFacts;
  research.villageFactFromCarParkOmitted = {
    omitted: true,
    reason:
      "The car-park news page refers to Barnsley's towns and villages generally. It does not state that Wombwell is a village. The extracted village identity is not used.",
  };
  fs.writeFileSync(RESEARCH, `${JSON.stringify(research, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        heStatus: fetched.status,
        heUsable: usable,
        heChars: fetched.textSample ? fetched.textSample.length : 0,
        heTitle: fetched.title,
        heSample: String(fetched.textSample || "").slice(0, 400),
        tsyFacts: tsyFacts.map((f) => f.normalizedStatement),
        heFacts: heFacts.map((f) => f.normalizedStatement),
        pageFetches: research.pageFetches,
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
