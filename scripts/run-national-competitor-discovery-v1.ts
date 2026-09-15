import {
  runNationalCompetitorDiscovery,
} from "../src/pharmacy/nationalCompetitorDiscoveryExecutionService.ts";

console.log(
  "\n=== NC-03C LIVE NATIONAL COMPETITOR DISCOVERY ===\n",
);

const result =
  await runNationalCompetitorDiscovery({
    slug: "pharmaconnect",

    businessName: "PharmaConnect",

    marketCountry: "United Kingdom",

    targetCustomerMarket:
      "UK community pharmacies",

    services: [
      "Pharmacy Website Design",
      "Pharmacy Local SEO",
      "Pharmacy Email Marketing",
      "Pharmacy Website Hosting",
      "Pharmacy Growth Audits",
    ],

    ownDomains: [
      "pharmaconnect.uk",
      "www.pharmaconnect.uk",
    ],
  });

console.log("\n--- DISCOVERY SUMMARY ---");

console.log("status:", result.status);
console.log("queries:", result.queries.length);
console.log("candidates:", result.candidates.length);

console.log(
  "qualified:",
  result.qualifiedCompetitors.length,
);

console.log(
  "rejected:",
  result.rejectedCandidates.length,
);

console.log(
  "\n--- QUALIFIED COMPETITORS ---",
);

for (
  const competitor
  of result.qualifiedCompetitors
) {
  console.log(
    `${competitor.name} | ${competitor.domain}`,
  );

  console.log(
    `  ${competitor.qualificationReasons.join(" ")}`,
  );
}

if (result.status !== "complete") {

  console.error(
    "\nNC-03C did not reach complete evidence status.",
  );

  process.exit(2);
}

console.log(
  "\nNC-03C LIVE DISCOVERY: PASS\n",
);
