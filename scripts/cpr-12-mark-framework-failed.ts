#!/usr/bin/env tsx
/**
 * CPR-12 — Mark existing generated page as FAILED_FRAMEWORK_VALIDATION (preserve output).
 */
import { markServicePageFailedFrameworkValidation } from "../src/pharmacy/pharmacyServicePageTenantContextService.ts";

const SLUG = "cpa01r-clean-journey-pharmacy";

markServicePageFailedFrameworkValidation(SLUG, [
  "incorrect brand/template resolution — site chrome used generic fallback colours (#767676, #015e69) instead of tenant Brand DNA",
  "insufficient tenant evidence usage — master publish did not apply approved evidence token replacement before visual render",
  "incomplete image rendering reported by Product Owner — framework validation required regeneration with tenant-context binding",
]);

console.log(JSON.stringify({ slug: SLUG, marked: "FAILED_FRAMEWORK_VALIDATION" }, null, 2));
