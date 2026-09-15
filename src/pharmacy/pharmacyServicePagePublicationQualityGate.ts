/**
 * Customer-facing HTML publication quality gate for generated pharmacy service pages.
 * Fail-closed validator for the locked blueprint path — does not rewrite presentation.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { detectForeignPharmacyIdentities, foreignIdentityDetail } from "./pharmacyTenantIdentityIsolation.ts";

export type PublicationQualityFailure = {
  id: string;
  detail: string;
};

export type PublicationQualityApprovedEvidence = Record<
  string,
  { value?: string | null; status?: string }
>;

export type PublicationQualityGateOptions = {
  canonicalPharmacyName?: string;
  /** True only when Evidence Review has been approved for this service. */
  evidenceReviewApproved?: boolean;
  /** Evidence Review field contract: id → { value, status }. */
  approvedEvidence?: PublicationQualityApprovedEvidence;
};

/** Evidence Review fields that can authorise a generated walk-in availability claim. */
export const WALK_IN_CLAIM_EVIDENCE_FIELD_IDS = [
  "walkInPolicy",
  "bookingRoute",
  "appointmentPolicy",
  "accessMethod",
] as const;

function evidenceStatus(raw: unknown): string {
  return String(raw || "")
    .trim()
    .toLowerCase();
}

function valueSupportsWalkInAvailability(raw: string, fieldId: string): boolean {
  const value = String(raw || "")
    .trim()
    .toLowerCase();
  if (!value) return false;
  if (/\bno walk-?ins?\b/.test(value)) return false;
  if (/walk[\s-]?ins?\s*:\s*(no|false|not available)\b/.test(value)) return false;
  if (/^(no|false|not available|none|appointment only)$/.test(value)) return false;
  if (fieldId === "walkInPolicy" && /^(yes|true|available|offered)$/.test(value)) return true;
  return /\bwalk[\s-]?ins?\b/.test(value);
}

/** True when the approved Evidence Review contract confirms walk-in/access for this pharmacy. */
export function approvedEvidenceSupportsWalkInClaim(
  approvedEvidence?: PublicationQualityApprovedEvidence,
): boolean {
  if (!approvedEvidence) return false;
  for (const fieldId of WALK_IN_CLAIM_EVIDENCE_FIELD_IDS) {
    const field = approvedEvidence[fieldId];
    if (!field || evidenceStatus(field.status) !== "confirmed") continue;
    if (valueSupportsWalkInAvailability(String(field.value || ""), fieldId)) return true;
  }
  return false;
}

function readJsonDecision(filePath: string): { decision?: string; serviceId?: string } | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as { decision?: string; serviceId?: string };
  } catch {
    return null;
  }
}

/** Disk authority: Evidence Review decision.json for this tenant/service. Does not write. */
export function readEvidenceReviewApprovedForPublicationQuality(slug: string, serviceId: string): boolean {
  const safeSlug = String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const sid = String(serviceId || "").trim();
  if (!safeSlug || !sid) return false;
  const base = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-evidence-review", safeSlug);
  const candidates = [
    path.join(base, "by-service", sid, "decision.json"),
  ];
  const campaignRoot = path.join(base, "by-campaign");
  if (fs.existsSync(campaignRoot)) {
    for (const name of fs.readdirSync(campaignRoot)) {
      candidates.push(path.join(campaignRoot, name, "decision.json"));
    }
  }
  if (sid === "pharmacy-first") candidates.push(path.join(base, "decision.json"));
  for (const filePath of candidates) {
    const raw = readJsonDecision(filePath);
    if (!raw) continue;
    if (String(raw.decision || "").toLowerCase() !== "approved") continue;
    if (raw.serviceId && String(raw.serviceId) !== sid) continue;
    return true;
  }
  return false;
}

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function referencedImagePaths(html: string): string[] {
  const paths: string[] = [];
  const re = /<img[^>]+src="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const src = String(m[1] || "").replace(/^\/+/, "");
    if (!src) continue;
    if (src.startsWith("assets/") || src.includes("pharmacy-image") || src.includes("pharmacy-brand-safe")) {
      paths.push(src);
    }
  }
  return paths;
}

export function validateCustomerFacingServicePageHtml(
  html: string,
  options?: PublicationQualityGateOptions,
): {
  ok: boolean;
  failures: PublicationQualityFailure[];
} {
  const failures: PublicationQualityFailure[] = [];
  const push = (id: string, detail: string) => failures.push({ id, detail });
  const visible = visibleText(html);
  const canonicalName = String(options?.canonicalPharmacyName || "").trim();
  const foreignIdentity = detectForeignPharmacyIdentities(html, canonicalName);
  if (foreignIdentity.length) push("demo-tenant-leak", foreignIdentityDetail(foreignIdentity));
  if (/Visual Experience demo asset/i.test(html)) push("demo-asset", "Visual Experience demo asset caption detected");
  if (/PharmaConnect Growth Engine/i.test(visible)) push("system-branding", "PharmaConnect Growth Engine branding detected");
  if (/\/home\/[a-z0-9_-]+\//i.test(visible) || /\\\\home\\\\/i.test(visible)) {
    push("filesystem-path", "Internal filesystem path exposed");
  }
  if (/\b(demo asset|demo tenant|fixture pharmacy|fixture tenant)\b/i.test(visible)) {
    push("demo-terminology", "Demo/fixture terminology detected");
  }
  if (/Welcome to\s+/i.test(visible)) push("welcome-prefix", "Welcome-to identity prefix rendered");
  if (/0250511165738/.test(html) || /tel:0250\d{9,}/.test(html)) {
    push("malformed-phone", "Malformed phone number detected");
  }
  if (/tel:\d{12,}/.test(html) && !/tel:\+?44/.test(html)) {
    const tels = [...html.matchAll(/tel:([0-9+]+)/g)].map((x) => x[1].replace(/\D/g, ""));
    if (tels.some((d) => d.length > 12 && !d.startsWith("44"))) {
      push("malformed-phone", "Concatenated or invalid tel: link detected");
    }
  }
  if (/<p>\|/.test(html) || />\| --- \|/.test(html) || /\n\|[- ]+\|/.test(html)) {
    push("raw-markdown", "Raw Markdown table syntax detected");
  }
  if (/class="icon step-icon">\s*\d+\s*</.test(html) && !/step-number/.test(html)) {
    push("isolated-step-numbers", "Isolated process step numbers without designed markup");
  }
  if (/NHS Hypertension Case-Finding Service/i.test(visible)) {
    push("unconfirmed-nhs-claim", "NHS Hypertension Case-Finding Service wording detected");
  }
  if (/free NHS screening|free screening service/i.test(visible)) {
    push("unconfirmed-nhs-claim", "Unconfirmed free NHS screening claim detected");
  }
  if (/\bNHS case-?finding\b/i.test(visible)) {
    push("unconfirmed-nhs-claim", "Unconfirmed NHS case-finding claim detected");
  }
  if (/\bABPM\b/.test(visible) || /ambulatory blood pressure monitoring/i.test(visible)) {
    push("unconfirmed-abpm-claim", "ABPM wording remains without confirmed availability evidence");
  }
  if (/may offer walk-in|walk-in support is available|walk-in checks/i.test(visible)) {
    const walkInConfirmed =
      options?.evidenceReviewApproved === true && approvedEvidenceSupportsWalkInClaim(options?.approvedEvidence);
    if (!walkInConfirmed) {
      push("unconfirmed-walkin-claim", "Unconfirmed walk-in availability claim detected");
    }
  }
  if (/GPhC Registered Pharmacy/i.test(visible)) {
    push("unconfirmed-gphc-label", "Unverified GPhC label rendered");
  }
  if (/src="[^"]*demo[^"]*"|alt="[^"]*demo asset[^"]*"/i.test(html)) {
    push("placeholder-image", "Demo/placeholder image detected");
  }
  if (/pharmacy-brand-safe/i.test(html)) {
    push("generic-placeholder-image", "Quarantined brand-safe placeholder imagery referenced");
  }
  if (/pharmacy-image-library\/[^"]+\.svg/i.test(html)) {
    push("demo-library-svg", "Legacy pharmacy-image-library SVG referenced in customer HTML");
  }
  if (/data-image-missing="true"/i.test(html)) {
    push("missing-image-slot", "Empty or missing image slot rendered");
  }
  if (/can be added before publishing|registration details can be added/i.test(html)) {
    push("empty-trust-or-missing-data-copy", "Empty trust/reviewer or patient-facing missing-data instruction detected");
  }
  if (
    /data-component="pharmacy-professional-review-panel"/.test(html) &&
    /Professionally reviewed by[\s\S]{0,200}?<\/section>/i.test(html) &&
    !/profile-review-name/.test(html) &&
    !/profile-review-fallback/.test(html)
  ) {
    push("empty-professional-review", "Empty professional-review section rendered without reviewer evidence");
  }
  if (/<img[^>]+alt=""\s/i.test(html)) push("empty-alt", "Image with empty alt text detected");
  if (/class="pharmacy-image"[^>]*>\s*<\/div>/i.test(html) || /<img[^>]+src=""\s/i.test(html)) {
    push("empty-image", "Empty placeholder image block detected");
  }

  const imgs = referencedImagePaths(html);
  if (!imgs.length) push("missing-image", "No customer-facing images found");
  for (const rel of imgs) {
    if (!/pharmacy-image-platform\//.test(rel)) {
      push("non-platform-image", `Image is not on locked Image Platform path: ${rel}`);
    }
    if (/\.svg$/i.test(rel)) {
      push("generic-placeholder-image", `SVG placeholder/generic asset in customer HTML: ${rel}`);
    }
    const candidates = [
      path.join(PHARMACY_WORKSPACE_ROOT, rel),
      path.join(PHARMACY_WORKSPACE_ROOT, rel.replace(/^\/+/, "")),
    ];
    const hit = candidates.find((p) => fs.existsSync(p));
    if (!hit) {
      push("missing-image", `Referenced image missing: ${rel}`);
      continue;
    }
    if (/\.svg$/i.test(hit)) {
      const svg = fs.readFileSync(hit, "utf8");
      if (
        detectForeignPharmacyIdentities(svg, canonicalName).length ||
        /Visual Experience demo asset|<text[\s>]/i.test(svg)
      ) {
        push("image-generated-text", `Generated/demo text inside image asset: ${rel}`);
      }
    }
  }

  return { ok: failures.length === 0, failures };
}
