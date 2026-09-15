import * as qualificationMod from "../src/pharmacy/nationalCompetitorQualificationV2Service.ts";

const qualification = (qualificationMod as { default?: typeof qualificationMod }).default ?? qualificationMod;
const { qualifyNationalCompetitorV2 } = qualification;

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, evidence: unknown) {
  if (condition) {
    passed++;
    console.log(`PASS  ${name} — ${String(evidence)}`);
  } else {
    failed++;
    console.log(`FAIL  ${name} — ${String(evidence)}`);
  }
}

console.log("\n=== NC-03D NATIONAL COMPETITOR QUALIFICATION V2 ===\n");

const strong = qualifyNationalCompetitorV2({
  domain: "examplepharmacyagency.co.uk",
  title: "Digital Marketing and Website Design for Independent Pharmacies",
  snippet:
    "We help independent pharmacies grow with pharmacy websites, local SEO, digital marketing and email marketing. Contact us for our pharmacy marketing services.",
  matchedQueries: ["pharmacy marketing agency United Kingdom"],
});

check(
  "strong-direct-qualified",
  strong.qualified === true,
  `${strong.classification} score=${strong.score}`,
);

check(
  "strong-direct-classification",
  strong.classification === "direct_competitor",
  strong.classification,
);

const regulator = qualifyNationalCompetitorV2({
  domain: "pharmacyregulation.org",
  title: "Providing services online",
  snippet:
    "Guidance for registered pharmacies and pharmacy professionals providing services online.",
  matchedQueries: ["pharmacy website design United Kingdom"],
});

check(
  "regulator-rejected",
  regulator.qualified === false,
  regulator.classification,
);

const publisher = qualifyNationalCompetitorV2({
  domain: "pharmaceutical-journal.com",
  title: "How to create a website for your independent pharmacy",
  snippet:
    "An article explaining considerations when creating a pharmacy website.",
  matchedQueries: ["pharmacy website design United Kingdom"],
});

check(
  "publisher-rejected",
  publisher.qualified === false,
  publisher.classification,
);

const reddit = qualifyNationalCompetitorV2({
  domain: "reddit.com",
  title: "Web Design - Pharmacy Site UK",
  snippet: "Discussion about pharmacy website design.",
  matchedQueries: ["pharmacy website design United Kingdom"],
});

check(
  "social-platform-rejected",
  reddit.qualified === false,
  reddit.classification,
);

const emailList = qualifyNationalCompetitorV2({
  domain: "exampledata.co.uk",
  title: "Pharmacist Email Addresses",
  snippet:
    "Buy a UK pharmacist email address list and pharmacy mailing database.",
  matchedQueries: ["Pharmacy Email Marketing for pharmacies United Kingdom"],
});

check(
  "email-list-provider-rejected",
  emailList.qualified === false,
  emailList.classification,
);

const genericAgency = qualifyNationalCompetitorV2({
  domain: "genericagency.co.uk",
  title: "Digital Marketing Agency UK",
  snippet:
    "We provide SEO, websites and marketing for businesses throughout the UK.",
  matchedQueries: ["pharmacy marketing agency United Kingdom"],
});

check(
  "generic-agency-without-pharmacy-evidence-rejected",
  genericAgency.qualified === false,
  genericAgency.classification,
);

const pharmacyArticle = qualifyNationalCompetitorV2({
  domain: "accountants.co.uk",
  title: "Challenges facing UK Pharmacies in 2026",
  snippet:
    "Our accountants discuss business challenges affecting community pharmacy.",
  matchedQueries: ["Pharmacy Growth Audits for pharmacies United Kingdom"],
});

check(
  "pharmacy-article-not-digital-competitor",
  pharmacyArticle.qualified === false,
  pharmacyArticle.classification,
);

const self = qualifyNationalCompetitorV2({
  domain: "pharmaconnect.uk",
  title: "PharmaConnect",
  snippet:
    "Pharmacy website design, SEO, email marketing and digital growth services for UK pharmacies.",
  ownDomains: ["pharmaconnect.uk"],
});

check(
  "self-domain-rejected",
  self.qualified === false,
  self.classification,
);

console.log("");

if (failed) {
  console.log(`FAIL — ${passed}/${passed + failed} checks`);
  process.exit(1);
}

console.log(`PASS — ${passed}/${passed + failed} checks`);
