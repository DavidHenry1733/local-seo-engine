/**
 * testServiceIntent.ts
 *
 * Validation test cases for the Service Intent Lock system.
 * Run with:  npx tsx src/validate/testServiceIntent.ts
 */
import { resolveServiceIntent, buildIntentHash, validateAndCorrectPageIntent } from "../serviceIntent.js";

interface SlugCase {
  slug: string;
  expectedKey: string;
  expectedName: string;
  expectedLocation: string;
  expectedKwFrag: string;
  expectedH1: string;
  expectedHash: string;
}

const SLUG_CASES: SlugCase[] = [
  { slug: "email-marketing-rotherham", expectedKey: "email-marketing", expectedName: "Email Marketing", expectedLocation: "Rotherham", expectedKwFrag: "email marketing", expectedH1: "Email Marketing Rotherham", expectedHash: buildIntentHash("email-marketing", "Rotherham") },
  { slug: "web-design-rotherham", expectedKey: "web-design", expectedName: "Web Design", expectedLocation: "Rotherham", expectedKwFrag: "web design", expectedH1: "Web Design Rotherham", expectedHash: buildIntentHash("web-design", "Rotherham") },
  { slug: "web-hosting-derby", expectedKey: "web-hosting", expectedName: "Web Hosting", expectedLocation: "Derby", expectedKwFrag: "web hosting", expectedH1: "Web Hosting Derby", expectedHash: buildIntentHash("web-hosting", "Derby") },
  { slug: "local-seo-rotherham", expectedKey: "local-seo", expectedName: "Local SEO", expectedLocation: "Rotherham", expectedKwFrag: "local seo", expectedH1: "Local SEO Rotherham", expectedHash: buildIntentHash("local-seo", "Rotherham") },
  { slug: "local-business-visibility-rotherham", expectedKey: "local-business-visibility", expectedName: "Local Business Visibility", expectedLocation: "Rotherham", expectedKwFrag: "local business visibility", expectedH1: "Local Business Visibility Rotherham", expectedHash: buildIntentHash("local-business-visibility", "Rotherham") },
];

interface GuardCase {
  label: string;
  slug: string;
  conflictingKw: string;
  expectedKwContains: string;
  expectConflict: boolean;
}

const GUARD_CASES: GuardCase[] = [
  { label: "LBV keyword rejected on email-marketing page", slug: "email-marketing-rotherham", conflictingKw: "local business visibility Rotherham", expectedKwContains: "email marketing", expectConflict: true },
  { label: "email-marketing keyword rejected on web-design page", slug: "web-design-rotherham", conflictingKw: "email marketing Rotherham", expectedKwContains: "web design", expectConflict: true },
  { label: "correct keyword passes guard on local-seo page", slug: "local-seo-rotherham", conflictingKw: "local seo Rotherham", expectedKwContains: "local seo", expectConflict: false },
  { label: "LBV keyword rejected on web-hosting page", slug: "web-hosting-derby", conflictingKw: "local business visibility Derby", expectedKwContains: "web hosting", expectConflict: true },
];

interface HtmlCase {
  label: string;
  slug: string;
  html: string;
  expectFix: boolean;
  fixContains: string;
}

const HTML_CASES: HtmlCase[] = [
  {
    label: "H1 with wrong service gets corrected",
    slug: "email-marketing-rotherham",
    html: `<html><head><title>Local Business Visibility Rotherham | Test</title></head><body><h1>Local Business Visibility Rotherham</h1></body></html>`,
    expectFix: true,
    fixContains: "Email Marketing Rotherham",
  },
  {
    label: "Correct H1 is left unchanged",
    slug: "email-marketing-rotherham",
    html: `<html><head><title>Email Marketing Rotherham | Test</title></head><body><h1>Email Marketing Rotherham</h1></body></html>`,
    expectFix: false,
    fixContains: "Email Marketing Rotherham",
  },
  {
    label: "H1 missing location gets corrected",
    slug: "web-design-rotherham",
    html: `<html><head><title>Web Design Services</title></head><body><h1>Web Design Services</h1></body></html>`,
    expectFix: true,
    fixContains: "Web Design Rotherham",
  },
];

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

console.log("\n=== Canonical slug tests ===\n");

for (const tc of SLUG_CASES) {
  console.log(`> ${tc.slug}`);
  const i = resolveServiceIntent({ pageSlug: tc.slug });

  assert(`serviceKey = "${tc.expectedKey}"`, i.serviceKey === tc.expectedKey, `got "${i.serviceKey}"`);
  assert(`serviceName = "${tc.expectedName}"`, i.serviceName === tc.expectedName, `got "${i.serviceName}"`);
  assert(`location = "${tc.expectedLocation}"`, i.location === tc.expectedLocation, `got "${i.location}"`);
  assert(`keyword contains "${tc.expectedKwFrag}"`, i.primaryKeyword.toLowerCase().includes(tc.expectedKwFrag), `got "${i.primaryKeyword}"`);
  assert(`expectedH1 = "${tc.expectedH1}"`, i.expectedH1 === tc.expectedH1, `got "${i.expectedH1}"`);
  assert(`intentHash = "${tc.expectedHash}"`, i.intentHash === tc.expectedHash, `got "${i.intentHash}"`);
  console.log();
}

console.log("=== Safety-guard tests ===\n");

for (const gc of GUARD_CASES) {
  console.log(`> ${gc.label}`);
  const i = resolveServiceIntent({
    pageSlug: gc.slug,
    pageData: { targetKeyword: gc.conflictingKw },
  });

  assert(`keyword contains "${gc.expectedKwContains}"`, i.primaryKeyword.toLowerCase().includes(gc.expectedKwContains), `got "${i.primaryKeyword}"`);

  if (gc.expectConflict) {
    assert("conflictsResolved >= 1", i.conflictsResolved.length >= 1, `got ${i.conflictsResolved.length}`);
    if (i.conflictsResolved[0]) console.log(`     conflict: "${i.conflictsResolved[0]}"`);
  } else {
    assert("no conflicts", i.conflictsResolved.length === 0, `got ${i.conflictsResolved.length}`);
  }

  console.log();
}

console.log("=== HTML auto-correction tests ===\n");

for (const hc of HTML_CASES) {
  console.log(`> ${hc.label}`);
  const intent = resolveServiceIntent({ pageSlug: hc.slug });
  const result = validateAndCorrectPageIntent(hc.html, intent);

  assert(`corrected === ${hc.expectFix}`, result.corrected === hc.expectFix, `got ${result.corrected}`);
  assert(`output contains "${hc.fixContains}"`, result.html.includes(hc.fixContains), `output: ${result.html.slice(0, 120)}`);

  if (result.corrections.length > 0) {
    console.log(`     corrections: ${result.corrections.join(" | ")}`);
  }

  console.log();
}

console.log("==================================================");
console.log(`Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) process.exit(1);
