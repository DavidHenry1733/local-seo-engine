#!/usr/bin/env npx tsx
/**
 * Walk-in publication quality gate handoff regressions.
 * Does not generate pages, publish, index, or write tenant data.
 */
import {
  approvedEvidenceSupportsWalkInClaim,
  validateCustomerFacingServicePageHtml,
} from "../src/pharmacy/pharmacyServicePagePublicationQualityGate.ts";

const WALK_IN_HTML = `<html><body><p>The pharmacy may offer walk-in checks or booked appointments.</p></body></html>`;

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

const unconfirmed = validateCustomerFacingServicePageHtml(WALK_IN_HTML, {
  canonicalPharmacyName: "Example Pharmacy",
});
record(
  "unconfirmed-walkin-still-fails",
  unconfirmed.failures.some((failure) => failure.id === "unconfirmed-walkin-claim"),
  unconfirmed.failures.map((failure) => failure.id).join(", ") || "no failures",
);

const missingApproval = validateCustomerFacingServicePageHtml(WALK_IN_HTML, {
  canonicalPharmacyName: "Example Pharmacy",
  evidenceReviewApproved: false,
  approvedEvidence: { walkInPolicy: { status: "confirmed", value: "Yes" } },
});
record(
  "walkin-without-evidence-approval-still-fails",
  missingApproval.failures.some((failure) => failure.id === "unconfirmed-walkin-claim"),
  "Evidence Review must be approved before a walk-in claim may pass",
);

const deniedWalkIn = validateCustomerFacingServicePageHtml(WALK_IN_HTML, {
  canonicalPharmacyName: "Example Pharmacy",
  evidenceReviewApproved: true,
  approvedEvidence: { walkInPolicy: { status: "confirmed", value: "No" } },
});
record(
  "confirmed-no-walkin-still-fails",
  deniedWalkIn.failures.some((failure) => failure.id === "unconfirmed-walkin-claim"),
  "Confirmed walk-in policy No must not authorise a walk-in claim",
);

const confirmedYes = validateCustomerFacingServicePageHtml(WALK_IN_HTML, {
  canonicalPharmacyName: "Example Pharmacy",
  evidenceReviewApproved: true,
  approvedEvidence: {
    walkInPolicy: { status: "confirmed", value: "Yes" },
    bookingRoute: { status: "confirmed", value: "Walk-in and telephone enquiries" },
  },
});
record(
  "confirmed-walkin-claim-may-pass",
  !confirmedYes.failures.some((failure) => failure.id === "unconfirmed-walkin-claim"),
  confirmedYes.failures.map((failure) => failure.id).join(", ") || "walk-in claim authorised",
);

record(
  "access-method-walkin-authorises",
  approvedEvidenceSupportsWalkInClaim({
    accessMethod: { status: "confirmed", value: "Walk-in and telephone enquiries" },
  }),
  "Confirmed accessMethod containing walk-in authorises the claim",
);

record(
  "unconfirmed-access-method-does-not-authorise",
  !approvedEvidenceSupportsWalkInClaim({
    accessMethod: { status: "not_confirmed", value: "Walk-in and telephone enquiries" },
  }),
  "Unconfirmed walk-in field values do not authorise the claim",
);

const failed = checks.filter((check) => !check.pass);
console.log(`\n${failed.length ? "FAIL" : "PASS"}  ${checks.length - failed.length}/${checks.length} checks`);
if (failed.length) process.exit(1);
