#!/usr/bin/env npx tsx
/**
 * Sprint 5H.3 — enrich website import snapshot with regulatory evidence (GPhC candidates).
 */
import fs from "node:fs";
import path from "node:path";
import { fetchWebsiteHtml } from "../src/pharmacy/growthEngineWebsiteCrawler.ts";
import { extractWebsiteRegulatoryEvidence, resolveGphcRegulatoryCandidate } from "../src/pharmacy/pharmacyWebsiteRegulatoryEvidence.ts";
import { readSetupProfile, writeSetupProfile } from "../src/pharmacy/growthEngineCustomerSetupImportSplitService.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";

const slug = resolveTenantProfileSlug(process.argv[2] || "broom-lane-pharmacy") || process.argv[2] || "broom-lane-pharmacy";

async function main() {
  const profile = readSetupProfile(slug);
  const snap = profile.websiteImportSnapshot;
  const websiteUrl = snap?.websiteUrl || profile.website;
  if (!websiteUrl) {
    console.log(JSON.stringify({ ok: false, slug, error: "No website URL" }, null, 2));
    process.exit(1);
  }

  const homepageHtml = await fetchWebsiteHtml(websiteUrl);
  const regulatoryEvidence = extractWebsiteRegulatoryEvidence(homepageHtml, websiteUrl, snap?.importedAt || new Date().toISOString());
  const resolution = resolveGphcRegulatoryCandidate(
    regulatoryEvidence,
    profile.gphcNumber || "",
    [profile.superintendentGphcNumber, profile.reviewerGphcNumber].filter(Boolean) as string[],
  );

  writeSetupProfile(slug, {
    ...profile,
    websiteImportSnapshot: snap
      ? { ...snap, regulatoryEvidence }
      : null,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug,
        websiteUrl,
        gphcCandidateDetected: resolution.candidate?.detectedValue || null,
        confirmationRequired: resolution.confirmationRequired,
        verificationStatus: resolution.verificationStatus,
        canonicalBusinessProfileUpdated: resolution.canonicalUpdated,
        canonicalGphcNumber: profile.gphcNumber || "",
        regulatoryEvidenceCount: regulatoryEvidence.length,
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
