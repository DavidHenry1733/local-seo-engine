#!/usr/bin/env npx tsx
/**
 * CPR-CR03-V1 — Commercial Page Contract + Checklist + SEO validation (read-only).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";
import { validateCommercialPageContractV1 } from "../src/pharmacy/masterAdminCommercialPageContractV1Service.ts";
import { evaluateCommercialServicePageChecklist } from "../src/pharmacy/masterAdminCoreProductRecoveryCommercialChecklistService.ts";
import { validateServicePageSeoContract } from "../src/pharmacy/masterAdminCoreProductRecoverySeoService.ts";

const SERVICE = "pharmacy-first";
const TENANTS = ["welfare-pharmacy", "banner-cross-pharmacy", "reliable-direct-pharmacy", "brook-pharmacy"] as const;

function contentQaPass(checklist: ReturnType<typeof evaluateCommercialServicePageChecklist>, contractPass: boolean): boolean {
  const contractItems = checklist.items.filter((i) => i.category === "CONTRACT");
  if (contractItems.length === 0) return contractPass;
  return contractPass && contractItems.every((i) => i.passed);
}

function commercialQaPass(checklist: ReturnType<typeof evaluateCommercialServicePageChecklist>): boolean {
  return checklist.allPassed;
}

function seoQaPass(slug: string, html: string): boolean {
  return validateServicePageSeoContract(slug, SERVICE, html).passed;
}

function run() {
  const results = TENANTS.map((slug) => {
    const visualPath = path.join(
      PHARMACY_WORKSPACE_ROOT,
      "output/pharmacy-visual-experience",
      slug,
      SERVICE,
      "index.html",
    );
    const html = fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
    const contract = validateCommercialPageContractV1(html);
    const checklist = evaluateCommercialServicePageChecklist(slug, SERVICE);
    const contentPass = contentQaPass(checklist, contract.passed);
    const commercialPass = commercialQaPass(checklist);
    const seoPass = seoQaPass(slug, html);
    const overall = contract.passed && commercialPass && contentPass && seoPass;

    return {
      tenant: slug,
      contentQa: contentPass ? "PASS" : "FAIL",
      commercialQa: commercialPass ? "PASS" : "FAIL",
      seoQa: seoPass ? "PASS" : "FAIL",
      contractPass: contract.passed,
      overall: overall ? "PASS" : "FAIL",
      contractErrors: contract.errors.slice(0, 12),
      generationErrors: checklist.generationErrors.slice(0, 12),
      seoErrors: validateServicePageSeoContract(slug, SERVICE, html).errors.slice(0, 8),
    };
  });

  console.log(JSON.stringify({ sprint: "CPR-CR03-V1", results }, null, 2));
}

run();
