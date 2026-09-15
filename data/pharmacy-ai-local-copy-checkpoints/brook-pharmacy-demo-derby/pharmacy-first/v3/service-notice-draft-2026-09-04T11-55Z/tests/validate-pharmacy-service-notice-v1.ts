#!/usr/bin/env npx tsx
/**
 * Service notices — selection, unknown-field handling, service/local consistency,
 * tenant isolation. Does not generate, publish, or edit accepted pages.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defaultProfileServiceDelivery } from "../src/pharmacy/pharmacyProfileV2Fields.ts";
import {
  PHARMACY_FIRST_ENGLAND_NHS_NOTICE_ID,
  SERVICE_NOTICE_COMPONENT_VERSION,
  pharmacyFirstEnglandNhsNotice,
} from "../src/pharmacy/pharmacyServiceNoticeCatalog.ts";
import { selectServiceNoticeFromFacts } from "../src/pharmacy/pharmacyServiceNoticeSelection.ts";
import {
  SERVICE_NOTICE_DRAFT_BANNER,
  SERVICE_NOTICE_HEADING,
  applyServiceNoticeToPageHtml,
} from "../src/pharmacy/pharmacyServiceNoticeComponent.ts";
import {
  SERVICE_NOTICE_DRAFT_PREVIEW_ASSET,
  loadTenantServiceFacts,
  renderServiceNoticeDraftPreview,
} from "../src/pharmacy/pharmacyServiceNoticePreview.ts";
import { renderReviewCentrePreviewAsset } from "../src/pharmacy/growthEngineReviewCentrePreviewService.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function sha(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function matchingFacts() {
  return {
    ...defaultProfileServiceDelivery("pharmacy-first", "Pharmacy First"),
    fundingModel: "nhs" as const,
    ukNation: "england" as const,
    deliveryMode: "in-person" as const,
    prescribingSupplyStatus: "pgd" as const,
    prescribingSupplyConfirmed: true,
    consultationFee: { kind: "unknown" as const, amount: "", notes: "" },
    walkInAvailable: null,
  };
}

function noticeIndex(html: string): number {
  return html.search(/data-component="pharmacy-service-notice"/i);
}

function afterBlock(html: string, block: string, noticeAt: number): boolean {
  const re = new RegExp(`<section\\b[^>]*data-template-block="${block}"`, "i");
  const match = html.match(re);
  if (!match || match.index == null || noticeAt < 0) return false;
  return match.index < noticeAt;
}

function footerContainsNotice(html: string): boolean {
  const footer = html.match(/<footer\b[\s\S]*<\/footer>/i)?.[0] || "";
  return /data-component="pharmacy-service-notice"/i.test(footer);
}

function main() {
  console.log("\n=== Pharmacy service notices ===\n");

  const notice = pharmacyFirstEnglandNhsNotice();
  record("notice-id", notice.id === PHARMACY_FIRST_ENGLAND_NHS_NOTICE_ID, notice.id);
  record("notice-version", notice.version === 1 && notice.componentVersion === SERVICE_NOTICE_COMPONENT_VERSION, `v${notice.version}`);
  record("notice-status-draft", notice.status === "draft" && notice.contentApproval.approved === false, notice.status);
  record("notice-renderer-owned", notice.rendererOwned === true && notice.aiMustNotRewrite === true, "renderer-owned");
  record(
    "notice-exact-draft",
    notice.body ===
      "This NHS service is available to eligible patients for specified common conditions. The pharmacist will assess your symptoms and circumstances against the relevant NHS clinical pathway. A consultation does not guarantee treatment or the supply of a medicine. Where appropriate, you may be advised to seek care from another healthcare professional. NHS prescription charges may apply to medicines supplied unless you are exempt.",
    "catalog wording",
  );
  record("notice-heading", notice.heading === SERVICE_NOTICE_HEADING, notice.heading);
  record(
    "identity-not-content-approval",
    /identity confirmation is not approval/i.test(notice.contentApproval.note),
    notice.contentApproval.note,
  );

  const matched = selectServiceNoticeFromFacts("pharmacy-first", matchingFacts());
  record("select-match-pharmacy-first", matched.mode === "profile-matched" && matched.notice?.id === notice.id, matched.mode);

  const unknown = selectServiceNoticeFromFacts("pharmacy-first", defaultProfileServiceDelivery("pharmacy-first"));
  record("unknown-does-not-select", unknown.mode === "none" && !unknown.notice, unknown.reasons.join(","));
  record("unknown-funding-blocks", unknown.reasons.includes("funding-unknown"), unknown.reasons.join(","));
  record("unknown-nation-blocks", unknown.reasons.includes("uk-nation-unknown"), unknown.reasons.join(","));
  record("unknown-delivery-blocks", unknown.reasons.includes("delivery-unknown"), unknown.reasons.join(","));
  record("unknown-supply-blocks", unknown.reasons.includes("supply-not-confirmed"), unknown.reasons.join(","));

  const privateFunded = selectServiceNoticeFromFacts("pharmacy-first", { ...matchingFacts(), fundingModel: "private" });
  record("private-funding-no-nhs-notice", privateFunded.mode === "none", privateFunded.mode);

  const scotland = selectServiceNoticeFromFacts("pharmacy-first", { ...matchingFacts(), ukNation: "scotland" });
  record("scotland-no-england-notice", scotland.mode === "none", scotland.mode);

  const remote = selectServiceNoticeFromFacts("pharmacy-first", { ...matchingFacts(), deliveryMode: "remote" });
  record("remote-delivery-no-match", remote.mode === "none", remote.mode);

  const unconfirmedSupply = selectServiceNoticeFromFacts("pharmacy-first", {
    ...matchingFacts(),
    prescribingSupplyConfirmed: false,
  });
  record("unconfirmed-supply-no-match", unconfirmedSupply.mode === "none", unconfirmedSupply.mode);

  const otherService = selectServiceNoticeFromFacts("blood-pressure-checks", matchingFacts());
  record("other-service-no-pharmacy-first-notice", otherService.mode === "none", otherService.mode);

  const feeUnknownMatch = selectServiceNoticeFromFacts("pharmacy-first", matchingFacts());
  record(
    "unknown-fee-not-treated-as-free",
    feeUnknownMatch.mode === "profile-matched" &&
      feeUnknownMatch.reasons.includes("fee-unknown-not-free") &&
      !/free/i.test(feeUnknownMatch.notice?.heading || "") &&
      matchingFacts().consultationFee.kind === "unknown",
    feeUnknownMatch.reasons.join(","),
  );
  record(
    "unknown-walkin-not-treated-as-available",
    feeUnknownMatch.reasons.includes("walk-in-unknown-not-available"),
    feeUnknownMatch.reasons.join(","),
  );

  const brookFacts = loadTenantServiceFacts("brook-pharmacy-demo-derby", "pharmacy-first");
  const brookSelect = selectServiceNoticeFromFacts("pharmacy-first", brookFacts);
  record("brook-unknown-facts-not-invented", brookSelect.mode === "none", brookSelect.reasons.join(","));
  record("brook-funding-still-unknown", brookFacts?.fundingModel === "unknown", brookFacts?.fundingModel || "missing");

  const dhm = loadTenantServiceFacts("dhmdigital", "pharmacy-first");
  const pc = loadTenantServiceFacts("pharmaconnect", "pharmacy-first");
  record("tenant-isolation-names", Boolean(dhm) && Boolean(pc), "both tenants load");
  const dhmSel = selectServiceNoticeFromFacts("pharmacy-first", dhm);
  const pcSel = selectServiceNoticeFromFacts("pharmacy-first", pc);
  record("tenant-isolation-unknown-neither-matches", dhmSel.mode === "none" && pcSel.mode === "none", `${dhmSel.mode}/${pcSel.mode}`);

  const allestreeFile = path.join(
    ROOT,
    "output/pharmacy-ai-local-page-pilots/brook-pharmacy-demo-derby/pharmacy-first/v3/local/allestree/index.html",
  );
  const visualFile = path.join(
    ROOT,
    "output/pharmacy-visual-experience/yorkshire-pharmacy-and-health-clinic/pharmacy-first/index.html",
  );
  const allestreeBefore = sha(allestreeFile);
  const visualBefore = sha(visualFile);

  const localPreview = renderServiceNoticeDraftPreview("brook-pharmacy-demo-derby", "pharmacy-first", { areaSlug: "allestree" });
  const servicePreview = renderServiceNoticeDraftPreview("yorkshire-pharmacy-and-health-clinic", "pharmacy-first");
  record("local-preview-route", localPreview.sourceRoute === SERVICE_NOTICE_DRAFT_PREVIEW_ASSET, localPreview.sourceRoute);
  record("service-preview-route", servicePreview.sourceRoute === SERVICE_NOTICE_DRAFT_PREVIEW_ASSET, servicePreview.sourceRoute);

  const localAt = noticeIndex(localPreview.html);
  const serviceAt = noticeIndex(servicePreview.html);
  record("local-has-notice", localAt > 0, String(localAt));
  record("service-has-notice", serviceAt > 0, String(serviceAt));
  record("service-local-same-id", localPreview.html.includes(notice.id) && servicePreview.html.includes(notice.id), notice.id);
  record("service-local-same-body", localPreview.html.includes(notice.body) && servicePreview.html.includes(notice.body), "shared wording");
  record("local-after-overview", afterBlock(localPreview.html, "child-areas", localAt), "after child-areas");
  record("service-after-overview", afterBlock(servicePreview.html, "service-definition", serviceAt), "after service-definition");
  record("local-not-in-footer", !footerContainsNotice(localPreview.html), "local footer clean");
  record("service-not-in-footer", !footerContainsNotice(servicePreview.html), "service footer clean");
  record("not-collapsed", !/<details[^>]*pharmacy-service-notice/i.test(localPreview.html) && !/<details[^>]*pharmacy-service-notice/i.test(servicePreview.html), "not details");
  record("draft-banner-local", localPreview.html.includes(SERVICE_NOTICE_DRAFT_BANNER), "draft demonstration");
  record("draft-banner-service", servicePreview.html.includes(SERVICE_NOTICE_DRAFT_BANNER), "draft demonstration");
  record("heading-visible", localPreview.html.includes(`<h2>${SERVICE_NOTICE_HEADING}</h2>`), SERVICE_NOTICE_HEADING);

  const isolated = renderServiceNoticeDraftPreview("pharmaconnect", "pharmacy-first", { areaSlug: "allestree" });
  record("tenant-isolation-preview", isolated.sourceRoute === "service-notice-draft-v1-unavailable", isolated.sourceRoute);
  record("tenant-isolation-no-brook-html", !isolated.html.includes("Allestree") && !isolated.html.includes(notice.body), "no leak");

  const acceptedLocal = renderReviewCentrePreviewAsset("brook-pharmacy-demo-derby", "pharmacy-first", "ai-local-area-page-pilot-v3", {
    areaSlug: "allestree",
  });
  const acceptedService = renderReviewCentrePreviewAsset(
    "yorkshire-pharmacy-and-health-clinic",
    "pharmacy-first",
    "sales-demo-brook-service-page",
  );
  record("accepted-local-unchanged-in-preview", !acceptedLocal.html.includes('data-component="pharmacy-service-notice"'), acceptedLocal.sourceRoute);
  record("accepted-service-unchanged-in-preview", !acceptedService.html.includes('data-component="pharmacy-service-notice"'), acceptedService.sourceRoute);
  record("accepted-allestree-file-hash", sha(allestreeFile) === allestreeBefore, allestreeBefore.slice(0, 12));
  record("accepted-visual-file-hash", sha(visualFile) === visualBefore, visualBefore.slice(0, 12));

  const routed = renderReviewCentrePreviewAsset("brook-pharmacy-demo-derby", "pharmacy-first", SERVICE_NOTICE_DRAFT_PREVIEW_ASSET, {
    areaSlug: "allestree",
  });
  record("asset-wired", routed.sourceRoute === SERVICE_NOTICE_DRAFT_PREVIEW_ASSET && noticeIndex(routed.html) > 0, routed.sourceRoute);

  const snippet = applyServiceNoticeToPageHtml(
    `<html><head></head><body><section data-template-block="service-definition"><div class="wrap">overview</div></section><section data-template-block="conditions">next</section><footer>foot</footer></body></html>`,
    notice,
    { mode: "profile-matched", pageKind: "service" },
  );
  record("inject-between-overview-and-next", /service-definition[\s\S]*pharmacy-service-notice[\s\S]*conditions/i.test(snippet), "order");
  record("inject-not-in-footer-snippet", !footerContainsNotice(snippet), "snippet footer");

  const failed = checks.filter((row) => !row.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main();
