/**
 * Conditional service-fact fields for the existing Services form.
 * Storage lives on serviceDeliveryProfiles. Not used by generation.
 */
import type { ProfileServiceDeliveryProfile, ProfileServiceFee } from "./pharmacyProfileV2Fields.ts";
import {
  CLINICAL_REVIEWER_STATUS_OPTIONS,
  DEPOSIT_STATUS_OPTIONS,
  PHYSICAL_BRANCH_OPTIONS,
  PRESCRIBING_SUPPLY_OPTIONS,
  SERVICE_DELIVERY_MODE_OPTIONS,
  SERVICE_FEE_KIND_OPTIONS,
  UK_NATION_OPTIONS,
} from "./pharmacyProfileWizardPresets.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function options(
  list: readonly { value: string; label: string }[],
  selected: string,
): string {
  return list
    .map((o) => `<option value="${esc(o.value)}" ${selected === o.value ? "selected" : ""}>${esc(o.label)}</option>`)
    .join("");
}

function feeRow(label: string, prefix: string, fee: ProfileServiceFee): string {
  const showAmount = fee.kind === "fixed" || fee.kind === "from";
  return `<div class="wizard-svc-fee" data-fee-prefix="${esc(prefix)}">
<div class="field"><label>${esc(label)}</label><select data-svc-field="${esc(prefix)}.kind" class="wizard-svc-fee-kind">${options(SERVICE_FEE_KIND_OPTIONS, fee.kind)}</select></div>
<div class="field wizard-svc-when wizard-svc-when-amount" ${showAmount ? "" : "hidden"}><label>Amount</label><input type="text" data-svc-field="${esc(prefix)}.amount" value="${esc(fee.amount)}" placeholder="e.g. £25" autocomplete="off"/></div>
</div>`;
}

export interface ServiceFactsFormContext {
  pharmacyName?: string;
  reviewerName?: string;
  reviewerRole?: string;
}

export function renderServiceFactsFields(
  profile: ProfileServiceDeliveryProfile,
  ctx: ServiceFactsFormContext = {},
): string {
  const fundingPrivate = profile.fundingModel === "private" || profile.fundingModel === "mixed";
  const showBranch = profile.physicalBranchOffered === true;
  const showRemote = profile.deliveryMode === "remote" || profile.deliveryMode === "both";
  const showPrescribing =
    profile.prescribingSupplyStatus !== "unknown" && profile.prescribingSupplyStatus !== "none";
  const showDeposit = profile.depositStatus === "required" || fundingPrivate;
  const showCancel = showDeposit || fundingPrivate;
  const branchPlaceholder = ctx.pharmacyName || "";
  const reviewerHint = ctx.reviewerName
    ? `Profile reviewer “${ctx.reviewerName}” is a suggestion until confirmed for this service. Confirmation is not a regulatory approval.`
    : "Named reviewer for this service only. Confirmation is not a regulatory approval.";
  const physicalValue =
    profile.physicalBranchOffered === true ? "true" : profile.physicalBranchOffered === false ? "false" : "";

  return `<div class="wizard-svc-facts">
<p class="hint">Service facts stay unknown until you set them. Imported names are suggestions until confirmed. Unknown is never treated as free or available.</p>
<div class="grid-2">
<div class="field"><label>UK nation</label><select data-svc-field="ukNation">${options(UK_NATION_OPTIONS, profile.ukNation)}</select></div>
<div class="field"><label>Physical branch</label><select data-svc-field="physicalBranchOffered" class="wizard-svc-branch-offered">${options(PHYSICAL_BRANCH_OPTIONS, physicalValue)}</select></div>
</div>
<div class="field wizard-svc-when wizard-svc-when-branch" ${showBranch ? "" : "hidden"}>
<label>Branch name</label>
<input type="text" data-svc-field="physicalBranchName" value="${esc(profile.physicalBranchName)}" placeholder="${esc(branchPlaceholder)}" autocomplete="off"/>
<label class="wizard-chip-check"><input type="checkbox" data-svc-field="physicalBranchConfirmed" ${profile.physicalBranchConfirmed ? "checked" : ""}/> Confirm this service is offered at this branch</label>
${branchPlaceholder && !profile.physicalBranchConfirmed ? `<span class="hint">Suggested from the pharmacy name until confirmed.</span>` : ""}
</div>
<div class="grid-2">
<div class="field"><label>How the service is delivered</label><select data-svc-field="deliveryMode" class="wizard-svc-delivery">${options(SERVICE_DELIVERY_MODE_OPTIONS, profile.deliveryMode)}</select></div>
<div class="field"><label>Prescribing / supply</label><select data-svc-field="prescribingSupplyStatus" class="wizard-svc-prescribing">${options(PRESCRIBING_SUPPLY_OPTIONS, profile.prescribingSupplyStatus)}</select></div>
</div>
<p class="hint wizard-svc-when wizard-svc-when-remote" ${showRemote ? "" : "hidden"}>Remote delivery is recorded only when you select remote or both. It is not assumed.</p>
<label class="wizard-chip-check wizard-svc-when wizard-svc-when-prescribing" ${showPrescribing ? "" : "hidden"}><input type="checkbox" data-svc-field="prescribingSupplyConfirmed" ${profile.prescribingSupplyConfirmed ? "checked" : ""}/> Confirm this prescribing or supply arrangement for this service</label>
<h4 class="wizard-svc-facts-head">Fees</h4>
${feeRow("Consultation fee", "consultationFee", profile.consultationFee)}
${feeRow("Treatment fee", "treatmentFee", profile.treatmentFee)}
${feeRow("Follow-up fee", "followUpFee", profile.followUpFee)}
<div class="grid-2 wizard-svc-when wizard-svc-when-deposit" ${showDeposit ? "" : "hidden"}>
<div class="field"><label>Deposit</label><select data-svc-field="depositStatus" class="wizard-svc-deposit">${options(DEPOSIT_STATUS_OPTIONS, profile.depositStatus)}</select></div>
<div class="field wizard-svc-when wizard-svc-when-deposit-amount" ${profile.depositStatus === "required" ? "" : "hidden"}><label>Deposit amount</label><input type="text" data-svc-field="depositAmount" value="${esc(profile.depositAmount)}" placeholder="e.g. £20" autocomplete="off"/></div>
</div>
<div class="field wizard-svc-when wizard-svc-when-deposit-terms" ${profile.depositStatus === "required" ? "" : "hidden"}><label>Deposit terms</label><input type="text" data-svc-field="depositTerms" value="${esc(profile.depositTerms)}" autocomplete="off"/></div>
<div class="field wizard-svc-when wizard-svc-when-cancel" ${showCancel ? "" : "hidden"}><label>Cancellation terms</label><input type="text" data-svc-field="cancellationTerms" value="${esc(profile.cancellationTerms)}" autocomplete="off"/></div>
<h4 class="wizard-svc-facts-head">Clinical reviewer</h4>
<div class="grid-2">
<div class="field"><label>Named clinical reviewer</label><input type="text" data-svc-field="clinicalReviewerName" value="${esc(profile.clinicalReviewerName)}" placeholder="${esc(ctx.reviewerName || "")}" autocomplete="off"/>${ctx.reviewerName && !profile.clinicalReviewerName ? `<button type="button" class="wizard-chip-btn" data-use-profile-reviewer>Use suggested reviewer</button>` : ""}</div>
<div class="field"><label>Reviewer role</label><input type="text" data-svc-field="clinicalReviewerRole" value="${esc(profile.clinicalReviewerRole)}" placeholder="${esc(ctx.reviewerRole || "")}" autocomplete="off"/></div>
</div>
<div class="field"><label>Reviewer confirmation</label><select data-svc-field="clinicalReviewerStatus">${options(CLINICAL_REVIEWER_STATUS_OPTIONS, profile.clinicalReviewerStatus)}</select><span class="hint">${esc(reviewerHint)}</span></div>
</div>`;
}

export function serviceFactsFormCss(): string {
  return `.wizard-svc-facts{margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0}
.wizard-svc-facts-head{margin:14px 0 8px;font-size:13px;font-weight:800;color:#334155}
.wizard-svc-fee{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:12px;margin-bottom:8px}
.wizard-svc-when[hidden]{display:none !important}
@media (max-width:639px){
  .wizard-svc-fee{grid-template-columns:1fr}
  .wizard-svc-facts .grid-2{grid-template-columns:1fr}
}`;
}
