import fs from "node:fs";
import {
  qualifyNationalCompetitorV2,
} from "../src/pharmacy/nationalCompetitorQualificationV2Service.ts";

const file =
  "data/national-growth-engine/pharmaconnect-competitor-discovery.json";

const snapshot = JSON.parse(fs.readFileSync(file, "utf8"));

const sourceCandidates =
  Array.isArray(snapshot.candidates) && snapshot.candidates.length
    ? snapshot.candidates
    : Array.isArray(snapshot.competitors)
      ? snapshot.competitors
      : [];

const rows = sourceCandidates.map((candidate: any) => {
  const domain =
    candidate.domain ??
    candidate.canonicalDomain ??
    candidate.websiteDomain ??
    "";

  const result = qualifyNationalCompetitorV2({
    domain,
    title:
      candidate.title ??
      candidate.businessName ??
      candidate.name ??
      "",
    snippet:
      candidate.snippet ??
      candidate.description ??
      candidate.evidenceSnippet ??
      "",
    url:
      candidate.url ??
      candidate.website ??
      candidate.sourceUrl ??
      "",
    websiteText:
      candidate.websiteText ??
      candidate.pageText ??
      candidate.evidenceText ??
      "",
    servicesDetected:
      candidate.servicesDetected ??
      candidate.matchedServices ??
      candidate.services ??
      [],
    matchedQueries:
      candidate.matchedQueries ??
      (candidate.matchedQuery ? [candidate.matchedQuery] : []),
  });

  return {
    domain,
    name:
      candidate.businessName ??
      candidate.name ??
      candidate.title ??
      domain,
    ...result,
  };
});

const direct = rows
  .filter((r: any) => r.classification === "direct_competitor")
  .sort((a: any, b: any) => b.score - a.score);

const adjacent = rows
  .filter((r: any) => r.classification === "adjacent_competitor")
  .sort((a: any, b: any) => b.score - a.score);

const insufficient = rows
  .filter((r: any) => r.classification === "insufficient_evidence")
  .sort((a: any, b: any) => b.score - a.score);

const excluded = rows
  .filter((r: any) => r.classification === "excluded")
  .sort((a: any, b: any) => b.score - a.score);

console.log("\n============================================================");
console.log("NC-03D — EXISTING LIVE EVIDENCE REQUALIFICATION");
console.log("============================================================\n");

console.log("Candidates reviewed:", rows.length);
console.log("Direct competitors:", direct.length);
console.log("Adjacent competitors:", adjacent.length);
console.log("Insufficient evidence:", insufficient.length);
console.log("Excluded:", excluded.length);

console.log("\n--- DIRECT COMPETITORS ---");
for (const r of direct) {
  console.log(`\n${r.name}`);
  console.log(`  domain: ${r.domain}`);
  console.log(`  score: ${r.score}`);
  console.log(`  reasons: ${r.reasons.join(" | ")}`);
}

console.log("\n--- ADJACENT COMPETITORS ---");
for (const r of adjacent) {
  console.log(`\n${r.name}`);
  console.log(`  domain: ${r.domain}`);
  console.log(`  score: ${r.score}`);
  console.log(`  reasons: ${r.reasons.join(" | ")}`);
}

console.log("\n--- INSUFFICIENT EVIDENCE ---");
for (const r of insufficient) {
  console.log(`- ${r.domain} | score=${r.score}`);
}

console.log("\n--- EXCLUDED ---");
for (const r of excluded) {
  console.log(
    `- ${r.domain} | ${r.exclusionReasons.join(" | ")}`,
  );
}

const auditFile =
  "data/national-growth-engine/pharmaconnect-competitor-qualification-v2-audit.json";

fs.writeFileSync(
  auditFile,
  JSON.stringify(
    {
      auditedAt: new Date().toISOString(),
      sourceGeneratedAt: snapshot.generatedAt ?? null,
      sourceStatus: snapshot.status ?? null,
      candidatesReviewed: rows.length,
      directCompetitorCount: direct.length,
      adjacentCompetitorCount: adjacent.length,
      insufficientEvidenceCount: insufficient.length,
      excludedCount: excluded.length,
      directCompetitors: direct,
      adjacentCompetitors: adjacent,
      insufficientEvidence: insufficient,
      excluded,
    },
    null,
    2,
  ) + "\n",
);

console.log("\nAUDIT WRITTEN:", auditFile);
console.log("\nIMPORTANT:");
console.log("Original NC-03C discovery snapshot has NOT been overwritten.");
console.log("No new DataForSEO searches were executed.");
console.log("No dashboard data has been promoted yet.");
