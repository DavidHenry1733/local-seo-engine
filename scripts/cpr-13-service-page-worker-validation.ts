/**
 * CPR-13 — Synthetic/read-only service-page worker contract validation.
 * Does not generate a real service page.
 */
import { runServicePageWorkerContractValidation } from "../src/pharmacy/masterAdminServicePageJobService.ts";

const result = await runServicePageWorkerContractValidation();
console.log(JSON.stringify({ status: result.passed ? "PASS" : "FAIL", checks: result.checks }, null, 2));
process.exit(result.passed ? 0 : 1);
