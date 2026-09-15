import {
  searchNationalGoogleOrganic,
} from "../src/pharmacy/dataForSeoNationalSearchAdapter.ts";

let passed = 0;
let failed = 0;

function check(
  id: string,
  ok: boolean,
  detail: unknown,
) {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${id} — ${String(detail)}`,
  );

  if (ok) passed++;
  else failed++;
}

console.log(
  "\n=== DATAFORSEO NATIONAL SEARCH ADAPTER V1 ===\n",
);

const query =
  "pharmacy website design United Kingdom";

const result = await searchNationalGoogleOrganic({
  query,
  marketCountry: "United Kingdom",
  languageCode: "en",
  depth: 10,
});

check(
  "provider",
  result.provider === "dataforseo-google-organic-live",
  result.provider,
);

check(
  "query",
  result.query === query,
  result.query,
);

check(
  "market-country",
  result.marketCountry === "United Kingdom",
  result.marketCountry,
);

check(
  "live-results",
  result.organicResultCount > 0,
  result.organicResultCount,
);

check(
  "domains-present",
  result.results.every((r) => Boolean(r.domain)),
  result.results.map((r) => r.domain).join(", "),
);

check(
  "no-local-distance-fields",
  result.results.every(
    (r: any) =>
      !("distanceKm" in r) &&
      !("placeId" in r) &&
      !("googleMapsUrl" in r),
  ),
  "National SERP evidence contains no Local Google fields",
);

console.log("\n--- LIVE GOOGLE UK RESULTS ---");

for (const row of result.results.slice(0, 10)) {
  console.log(
    `${row.position}. ${row.domain} — ${row.title}`,
  );
}

console.log(
  "\nDataForSEO request cost:",
  result.cost == null ? "not reported" : result.cost,
);

console.log(
  `\n${failed ? "FAIL" : "PASS"} — ${passed}/${
    passed + failed
  } checks\n`,
);

if (failed) process.exit(1);
