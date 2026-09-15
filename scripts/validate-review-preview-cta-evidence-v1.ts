#!/usr/bin/env npx tsx
/**
 * REVIEW-PREVIEW-CTA-EVIDENCE — updated for locked service-page parity preview.
 */
import path from "node:path";
import {
  renderBenchmarkPagePreviewHtml,
  resolveReviewPreviewChromeCta,
} from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

type Check = { id: string; pass: boolean; detail: string };
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

function main(): void {
  const slug = "yorkshire-pharmacy-and-health-clinic";
  const serviceId = "blood-pressure-checks";
  const phone = "01226 210477";
  const tel = "tel:01226210477";

  const unknown = resolveReviewPreviewChromeCta({
    slug,
    serviceId,
    phone,
    evidence: { appointmentRequired: null, bookingUrl: "" },
  });
  record(
    "unknown-evidence-neutral-cta",
    unknown.text === "Contact the pharmacy" && unknown.href === tel && !unknown.bookingConfirmed,
    `${unknown.text} → ${unknown.href}`,
  );

  const confirmedUrl = "https://example.pharmacy/book-appointment";
  const confirmed = resolveReviewPreviewChromeCta({
    slug,
    serviceId,
    phone,
    evidence: { appointmentRequired: true, bookingUrl: confirmedUrl },
  });
  record(
    "confirmed-booking-cta",
    confirmed.text === "Book An Appointment" && confirmed.href === confirmedUrl && confirmed.bookingConfirmed,
    `${confirmed.text} → ${confirmed.href}`,
  );

  const file =
    resolveVisualExperienceHtmlPath(serviceId as never, slug) ||
    path.join(
      PHARMACY_WORKSPACE_ROOT,
      "output/pharmacy-visual-experience/yorkshire-pharmacy-and-health-clinic/blood-pressure-checks/index.html",
    );
  const html = renderBenchmarkPagePreviewHtml(file, serviceId, slug, "service-page");

  record(
    "rendered-zero-book-appointment",
    !/Book An Appointment|Book Appointment|appointment availability|walk-in availability|booking support|book a consultation|Book Blood Pressure Checks/i.test(
      html,
    ),
    "no unsupported appointment/booking claims",
  );
  record(
    "parity-or-chrome-contact-cta",
    /Contact the pharmacy/i.test(html) && /tel:01226210477/.test(html),
    "contact CTA present with tel destination",
  );
  record("get-directions-cta", />Get directions</i.test(html), "directions CTA label");
  record("single-h1", (html.match(/<h1\b/gi) || []).length === 1, `h1 count=${(html.match(/<h1\b/gi) || []).length}`);
  record(
    "hero-image-in-slot",
    /data-image-slot="hero"[^>]*>[\s\S]*?pf-hero-consultation-room\.webp/i.test(html) ||
      /data-image-slot="hero"[\s\S]{0,400}pf-hero-consultation-room\.webp/i.test(html),
    "hero webp in hero slot",
  );
  record("map-uses-coordinates", /maps\?q=53\.531914,-1\.381959/.test(html), "coordinate embed");
  record("no-nhs-pharmacy-services-badge", !/NHS Pharmacy Services/i.test(html), "NHS badge absent");
  record("no-hero-contact-box", !/<div class="hero-contact-box"/i.test(html), "redundant phone chip absent");

  const failed = checks.filter((c) => !c.pass);
  console.log(`\n${failed.length ? "FAIL" : "PASS"} — ${checks.length - failed.length}/${checks.length}`);
  if (failed.length) process.exit(1);
}

main();
