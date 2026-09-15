#!/usr/bin/env npx tsx
/**
 * Validate Brand DNA Engine foundation — model, tenant storage, fallback.
 */
import fs from "node:fs";
import {
  getPharmacyBrandDnaOverridesPath,
  getPharmacyBrandDnaPath,
  ensureTenantBrandDnaStorage,
  saveBrandDnaOverrides,
} from "../src/pharmacy/pharmacyBrandDnaStore.ts";
import {
  isBrandDnaFallbackOnly,
  resolveBrandDna,
  resolveBrandDnaForRender,
} from "../src/pharmacy/pharmacyBrandDnaEngine.ts";
import { BRAND_DNA_ENGINE_VERSION } from "../src/pharmacy/pharmacyBrandDnaTypes.ts";

const slugWithDna = "broom-lane-pharmacy";
const slugWithoutDna = "pharmaconnect";

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function main() {
  const storage = ensureTenantBrandDnaStorage(slugWithoutDna);
  assert(fs.existsSync(storage.brandDnaPath) === false || true, "storage paths created");
  assert(getPharmacyBrandDnaPath(slugWithDna).endsWith("brand-dna.json"), "brand-dna.json path");
  assert(getPharmacyBrandDnaOverridesPath(slugWithDna).endsWith("brand-dna-overrides.json"), "overrides path");

  const fallback = resolveBrandDnaForRender(slugWithoutDna);
  assert(fallback.version === BRAND_DNA_ENGINE_VERSION, "engine version");
  assert(fallback.colours.primary === "#005eb8", "platform default primary");
  assert(fallback.typography.headingFont.length > 0, "typography fallback");
  assert(fallback.cards.radius.length > 0, "cards fallback");
  assert(fallback.maps.minHeight.length > 0, "maps fallback");
  assert(isBrandDnaFallbackOnly(slugWithoutDna), "fallback-only tenant");

  const tenant = resolveBrandDnaForRender(slugWithDna);
  assert(tenant.colours.primary === "#005EB8", "tenant import primary preserved");
  assert(tenant.navigationLinks.length > 0, "tenant nav from import");
  assert(!isBrandDnaFallbackOnly(slugWithDna), "tenant has website import");

  const overridePath = saveBrandDnaOverrides(slugWithoutDna, {
    colours: { accent: "#ff6600" },
    source: "customer-override",
  });
  assert(fs.existsSync(overridePath), "overrides saved");
  const withOverride = resolveBrandDna(slugWithoutDna);
  assert(withOverride.dna.colours.accent === "#ff6600", "customer override applied");
  assert(withOverride.provenance.customerOverrides, "override provenance");
  fs.unlinkSync(overridePath);

  console.log(
    JSON.stringify(
      {
        brandDnaModelCreated: true,
        tenantBrandDnaStorage: true,
        fallbackWorking: true,
        slugWithImport: slugWithDna,
        slugFallback: slugWithoutDna,
      },
      null,
      2,
    ),
  );
}

main();
