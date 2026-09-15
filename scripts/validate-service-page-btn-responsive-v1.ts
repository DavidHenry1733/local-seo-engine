#!/usr/bin/env npx tsx
import { buildPharmacyServicePageStyleBlock } from "../src/pharmacy/pharmacyServicePageDesignSystem.ts";
import { buildPharmacyThemeWithBrandDna } from "../src/pharmacy/pharmacyBrandDnaResolver.ts";
import { buildPharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { resolveBrandDnaForRender } from "../src/pharmacy/pharmacyBrandDnaEngine.ts";

const checks: Array<{ id: string; pass: boolean; detail: string }> = [];
function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} — ${detail}`);
}

const profile = buildPharmacyServicePageProfile("yorkshire-pharmacy-and-health-clinic");
const theme = buildPharmacyThemeWithBrandDna(profile, resolveBrandDnaForRender(profile.slug));
const css = buildPharmacyServicePageStyleBlock(theme);

record("btn-max-width", /\.btn\{[^}]*max-width:100%/.test(css), "shared .btn constrains width");
record("btn-wrap", /\.btn\{[^}]*white-space:normal/.test(css), "shared .btn allows wrap");
record("btn-min-width-0", /\.btn\{[^}]*min-width:0/.test(css), "shared .btn can shrink");
record("hero-copy-min-width", /\.hero-copy\{[^}]*min-width:0/.test(css) || /\.hero-grid>\*,\.hero-copy\{[^}]*min-width:0/.test(css), "hero copy can shrink");
record("mobile-full-width", /@media \(max-width: 640px\)[\s\S]*\.btns > \.btn[\s\S]*width: 100%/.test(css), "mobile CTAs full width");
record("btn-white-max-width", /\.btn-white \{[^}]*max-width: 100%/.test(css), "btn-white constrained");

const failed = checks.filter((c) => !c.pass);
console.log(`\n${failed.length ? "FAIL" : "PASS"} — ${checks.length - failed.length}/${checks.length}`);
if (failed.length) process.exit(1);
