/**
 * Generated service pages project an imported website shell and balance card grids.
 * Does not generate a page, create a job, or write tenant files.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveApprovedImportedWebsiteShell } from "../src/pharmacy/pharmacyImportedWebsiteShell.ts";
import {
  renderPharmaconnectDesignSystemV1Header,
  servicePageBalancedCardGridCss,
} from "../src/pharmacy/pharmacyDesignSystemV1.ts";
import { renderBalancedCardGrid } from "../src/pharmacy/pharmacyServicePageBalance.ts";
import { loadLockedApprovedBankServicePageContract } from "../src/pharmacy/pharmacyApprovedBankCorePageContract.ts";
import type { PharmacyServicePageProfile } from "../src/pharmacy/pharmacyServicePageProfileContext.ts";

type Step = { name: string; passed: boolean; detail?: string };
const steps: Step[] = [];
function check(name: string, passed: boolean, detail?: string) {
  steps.push({ name, passed, detail });
}

const protectedFiles = [
  "data/pharmacy-profiles/gilbert-pharmacy-health-clinic.json",
  "data/growth-engine/gilbert-pharmacy-health-clinic-workflow.json",
  "data/pharmacy-master-admin/workflow-history/gilbert-pharmacy-health-clinic.json",
  "data/pharmacy-master-admin/jobs.json",
  "data/pharmacy-master-admin/service-page-evidence-review/gilbert-pharmacy-health-clinic/by-campaign/9b07b90d-bd7d-4826-a1e4-1edb5ca5ab0f/decision.json",
  "data/pharmacy-master-admin/service-page-generation/gilbert-pharmacy-health-clinic/by-service/blood-pressure-checks/latest.json",
  "data/pharmacy-approved-service-banks/banks/blood-pressure-checks/service-page-contract-v1.json",
];
const before = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
const pagePath = "output/pharmacy-visual-experience/gilbert-pharmacy-health-clinic/blood-pressure-checks/index.html";
const page = readFileSync(pagePath, "utf8");
const header = page.match(/<header\b[\s\S]*?<\/header>/i)?.[0] || "";
const footer = page.match(/<footer\b[\s\S]*?<\/footer>/i)?.[0] || "";

const shell = resolveApprovedImportedWebsiteShell("gilbert-pharmacy-health-clinic");
const absent = resolveApprovedImportedWebsiteShell("presentation-shell-absent-tenant");
check("imported shell is present for Gilbert", Boolean(shell && shell.navigation.length >= 5 && shell.footerLinks.length >= 5), String(shell?.navigation.length));
check("imported shell includes captured navigation and CTA", Boolean(shell?.navigation.some((link) => link.label === "NHS Prescriptions" && link.href.includes("/nhs-prescriptions/")) && shell?.cta?.label === "Book An Appointment"));
check("missing shell uses no invented links", absent === null);
check("shell resolver does not cross tenants", shell?.source === "design-intelligence-v1");

const fallback = renderPharmaconnectDesignSystemV1Header({
  slug: "presentation-shell-absent-tenant",
  pharmacyName: "Example Pharmacy",
  phone: "01234567890",
  website: "https://example.test",
  headerCtaText: "Contact the pharmacy",
  nhsServicesAvailable: false,
  privateServicesAvailable: false,
} as PharmacyServicePageProfile);
check("generic header fallback remains when no shell exists", fallback.includes('data-imported-website-shell="generic-fallback"') && fallback.includes('href="#service-definition">Services</a>'));
check("imported header is used on the generated page", header.includes('data-imported-website-shell="design-intelligence-v1"') && header.includes("NHS Prescriptions") && header.includes("Book An Appointment"));
check("imported header does not use the generic Services anchor", !header.includes('href="#service-definition">Services</a>'));
check("imported footer links are used", footer.includes('data-imported-website-shell="design-intelligence-v1"') && footer.includes("Smoking Cessation") && footer.includes("https://gilbertpharmacy.co.uk/service/uti/"));
check("generic reconstructed footer service column is not used", !footer.includes(">Blood Pressure Checks</a>"));

const css = servicePageBalancedCardGridCss();
check("two-card rule uses the full row", css.includes('.card-grid-equal[data-card-count="2"]{grid-template-columns:repeat(2,minmax(0,1fr))}'));
check("five-card rule centres the second row", css.includes('.card-grid-equal[data-card-count="5"]>.card:nth-child(4){grid-column:2 / span 2}') && css.includes('.card-grid-equal[data-card-count="5"]>.card:nth-child(5){grid-column:4 / span 2}'));
check("card grids collapse on small screens", css.includes("@media(max-width:960px)") && css.includes("grid-template-columns:1fr"));
for (const count of [1, 2, 3, 4, 5, 6]) {
  const cards = Array.from({ length: count }, (_, index) => ({ title: `Card ${index + 1}`, body: `Body ${index + 1}.` }));
  const grid = renderBalancedCardGrid(cards, { cols: count === 4 ? 4 : 3 });
  check(
    `${count}-card grid keeps count and copy`,
    grid.includes(`data-card-count="${count}"`) && cards.every((card) => grid.includes(card.title) && grid.includes(card.body)),
  );
}

check("generated page two-card section is marked", page.includes('data-card-count="2"') && page.includes("Local Paisley Pharmacy") && page.includes("Pharmacist-led assessment"));
check(
  "generated page five-card section is marked",
  page.includes('data-card-count="5"') &&
    ["Why Blood Pressure Matters", "Understanding Hypertension Risk", "When Screening Helps", "Cardiovascular Health Basics", "Why Regular Checks Matter"].every((title) => page.includes(title)),
);
check("balanced card CSS is on the generated page", page.includes("service-page-card-grid-balance"));

const contract = loadLockedApprovedBankServicePageContract("blood-pressure-checks");
check("approved FAQs remain on the page", contract.faqs.every((faq) => page.includes(faq.question)));
check("approved process steps remain on the page", contract.processSteps.every((step) => page.includes(step.title)));
check("approved contract counts stay 7/4/8", contract.sections.length === 7 && contract.processSteps.length === 4 && contract.faqs.length === 8);

const shellSource = readFileSync(resolve("src/pharmacy/pharmacyImportedWebsiteShell.ts"), "utf8");
const headerSource = readFileSync(resolve("src/pharmacy/pharmacyDesignSystemV1.ts"), "utf8");
check("no Gilbert-specific production shell code", !shellSource.includes("gilbert-pharmacy") && !headerSource.includes("gilbert-pharmacy") && !headerSource.includes("Paisley"));
const headerFn = headerSource.slice(headerSource.indexOf("export function renderPharmaconnectDesignSystemV1Header"), headerSource.indexOf("function footerLinkList"));
check("header renderer consults the imported shell before the generic nav", headerFn.indexOf("resolveApprovedImportedWebsiteShell") !== -1 && headerFn.indexOf("resolveApprovedImportedWebsiteShell") < headerFn.indexOf("platformNavLinks(profile)"));

const decision = JSON.parse(readFileSync(protectedFiles[4], "utf8")) as { decision?: string };
const workflow = JSON.parse(readFileSync(protectedFiles[1], "utf8")) as { commercialIntelligenceApproval?: { approvedAt?: string } };
const history = JSON.parse(readFileSync(protectedFiles[2], "utf8")) as { currentStage?: string };
const generation = JSON.parse(readFileSync(protectedFiles[5], "utf8")) as { status?: string; jobId?: string };
check("evidence approval remains approved", decision.decision === "approved");
check("commercial intelligence remains approved", Boolean(workflow.commercialIntelligenceApproval?.approvedAt));
check("service-page generation success remains completed", generation.status === "completed" && generation.jobId === "26bbebdc-00d5-44ff-8ba1-f440c18e6f4c", generation.status);
check("workflow stage was not advanced", history.currentStage === "generate_ecosystem", history.currentStage);
const after = execFileSync("sha256sum", protectedFiles, { encoding: "utf8" });
check("tenant records and generation job were not rewritten", before === after);

const failed = steps.filter((step) => !step.passed);
console.log(`service-page-presentation-01 ${steps.length - failed.length}/${steps.length}`);
for (const step of failed) console.log(`FAIL ${step.name}${step.detail ? ` — ${step.detail}` : ""}`);
if (failed.length) process.exit(1);
