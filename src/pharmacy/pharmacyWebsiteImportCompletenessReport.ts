/**
 * Website Import completeness report — never claim complete when confirmation is pending.
 */
import {
  buildBusinessDetailConflicts,
  detectAddressMaterialConflict,
  isDisplayAddressConfirmed,
  resolveImportedDisplayAddress,
} from "./pharmacyBusinessDisplayResolver.ts";
import type { PharmacyProfileData, WebsiteImportSnapshot } from "./pharmacyProfileSchema.ts";

export type ImportCompletenessStatus =
  | "confirmed"
  | "extracted-unconfirmed"
  | "conflict"
  | "missing"
  | "default-used";

export interface ImportCompletenessCategory {
  category: string;
  status: ImportCompletenessStatus;
  notes?: string;
}

export interface ImportantFieldStatus {
  field: string;
  status: ImportCompletenessStatus;
  notes?: string;
}

export interface WebsiteImportCompletenessReport {
  overallScore: number;
  categories: ImportCompletenessCategory[];
  confirmationGaps: string[];
  importantFields: ImportantFieldStatus[];
  commercialReady: boolean;
  unresolvedImportantFields: string[];
}

function statusScore(status: ImportCompletenessStatus): number {
  switch (status) {
    case "confirmed":
      return 100;
    case "extracted-unconfirmed":
      return 55;
    case "conflict":
      return 30;
    case "default-used":
      return 25;
    default:
      return 0;
  }
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function hasLegalLinks(snap: WebsiteImportSnapshot): boolean {
  return (snap.footerLinks || []).some((l) => /privacy|terms|cookie/i.test(l.label || l.url || ""));
}

function hasSocialLinks(snap: WebsiteImportSnapshot): boolean {
  return (snap.socialLinks || []).length > 0;
}

function hasNhsAsset(snap: WebsiteImportSnapshot): boolean {
  return (snap.regulatoryEvidence || []).some((item) => /nhs|ods/i.test(item.type || ""));
}

export function buildWebsiteImportCompletenessReport(
  snap: WebsiteImportSnapshot | null | undefined,
  data?: Partial<PharmacyProfileData>,
): WebsiteImportCompletenessReport {
  if (!snap?.importedAt || snap.status === "not_found") {
    return {
      overallScore: 0,
      categories: [{ category: "Website import", status: "missing", notes: "No website import snapshot" }],
      confirmationGaps: ["Website import not completed"],
      importantFields: [],
      commercialReady: false,
      unresolvedImportantFields: ["Website import"],
    };
  }

  const intel = snap.intelligence;
  const regulatory = snap.regulatoryEvidence || [];
  const gphcPending = regulatory.some(
    (item) => item.type === "gphc-premises" && item.verificationStatus === "customer-confirmation-required",
  );
  const gphcConfirmed = Boolean(str(data?.gphcNumber) && data?.profileFieldConfirmations?.gphcNumber);
  const importedAddress = resolveImportedDisplayAddress(snap);
  const canonicalAddress = [data?.addressLine1, data?.addressLine2, data?.townCity, data?.county, data?.postcode, data?.country]
    .filter(Boolean)
    .join(", ");
  const addressConflict =
    importedAddress && data && !isDisplayAddressConfirmed(data)
      ? detectAddressMaterialConflict(canonicalAddress || str(data.addressLine1), importedAddress).material
      : false;
  const addressConfirmed = isDisplayAddressConfirmed(data || {});

  const categories: ImportCompletenessCategory[] = [
    { category: "Identity", status: snap.logoUrl ? "confirmed" : "missing" },
    {
      category: "Header/navigation",
      status: intel?.structure?.pages?.length ? "extracted-unconfirmed" : "missing",
    },
    {
      category: "CTAs",
      status: (snap.customerVisibleServices || []).length ? "extracted-unconfirmed" : "missing",
    },
    {
      category: "Typography",
      status: intel?.brandSignals?.typographyDetected ? "confirmed" : "default-used",
    },
    {
      category: "Semantic colours",
      status: snap.brandPrimaryColor ? "confirmed" : "default-used",
    },
    {
      category: "Layout",
      status: intel?.structure?.totalPages ? "extracted-unconfirmed" : "missing",
    },
    {
      category: "Images",
      status: snap.logoUrl ? "extracted-unconfirmed" : "missing",
    },
    {
      category: "Trust assets",
      status: regulatory.length ? "extracted-unconfirmed" : "missing",
    },
    {
      category: "Footer",
      status: (snap.footerLinks || []).length ? "confirmed" : "extracted-unconfirmed",
    },
    {
      category: "Regulatory evidence",
      status: gphcPending ? "extracted-unconfirmed" : gphcConfirmed ? "confirmed" : regulatory.length ? "extracted-unconfirmed" : "missing",
      notes: gphcPending ? "GPhC candidate requires customer confirmation" : undefined,
    },
    {
      category: "Contact information",
      status:
        addressConflict
          ? "conflict"
          : addressConfirmed
            ? "confirmed"
            : snap.phone && importedAddress
              ? "extracted-unconfirmed"
              : snap.phone || importedAddress
                ? "extracted-unconfirmed"
                : "missing",
    },
    {
      category: "Legal links",
      status: hasLegalLinks(snap) ? "confirmed" : "extracted-unconfirmed",
    },
    {
      category: "Responsive evidence",
      status: intel?.structure?.pages?.length ? "extracted-unconfirmed" : "default-used",
    },
  ];

  const importantFields: ImportantFieldStatus[] = [
    { field: "logo", status: snap.logoUrl ? "confirmed" : "missing" },
    {
      field: "header navigation",
      status: intel?.structure?.pages?.length ? "extracted-unconfirmed" : "missing",
    },
    {
      field: "header CTAs",
      status: (snap.customerVisibleServices || []).length ? "extracted-unconfirmed" : "missing",
    },
    {
      field: "footer navigation",
      status: (snap.footerLinks || []).length ? "confirmed" : "missing",
    },
    { field: "NHS asset", status: hasNhsAsset(snap) ? "confirmed" : "missing" },
    {
      field: "address",
      status: addressConflict ? "conflict" : addressConfirmed ? "confirmed" : importedAddress ? "extracted-unconfirmed" : "missing",
    },
    { field: "phone", status: snap.phone ? "confirmed" : "missing" },
    { field: "email", status: snap.email ? "confirmed" : "missing" },
    {
      field: "opening hours",
      status: snap.openingHours ? "extracted-unconfirmed" : "missing",
    },
    {
      field: "GPhC number",
      status: gphcConfirmed ? "confirmed" : gphcPending ? "extracted-unconfirmed" : "missing",
    },
    { field: "legal links", status: hasLegalLinks(snap) ? "confirmed" : "missing" },
    { field: "social links", status: hasSocialLinks(snap) ? "confirmed" : "missing" },
    {
      field: "footer structure",
      status: (snap.footerLinks || []).length ? "confirmed" : "extracted-unconfirmed",
    },
    {
      field: "semantic colours",
      status: snap.brandPrimaryColor ? "confirmed" : "default-used",
    },
    {
      field: "typography",
      status: intel?.brandSignals?.typographyDetected ? "confirmed" : "default-used",
    },
    {
      field: "component variants",
      status: intel?.structure?.pages?.length ? "extracted-unconfirmed" : "default-used",
    },
  ];

  const confirmationGaps: string[] = [];
  if (gphcPending) {
    confirmationGaps.push("GPhC premises number requires confirmation before canonical profile update");
  }
  if (addressConflict) {
    confirmationGaps.push("Imported display address differs from canonical address presentation");
  }
  if (!snap.phone) confirmationGaps.push("Phone number not extracted from website");
  if (!importedAddress) confirmationGaps.push("Address not extracted from website");

  const overallScore = Math.round(
    categories.reduce((sum, c) => sum + statusScore(c.status), 0) / categories.length,
  );
  const cappedScore =
    gphcPending || addressConflict ? Math.min(overallScore, 88) : overallScore;

  const unresolvedImportantFields = importantFields
    .filter((item) => item.status !== "confirmed")
    .map((item) => `${item.field} (${item.status})`);

  const commercialReady =
    !gphcPending &&
    !addressConflict &&
    importantFields.every((item) => item.status === "confirmed" || item.status === "default-used");

  if (data) {
    const detailConflicts = buildBusinessDetailConflicts(data as PharmacyProfileData, snap);
    if (detailConflicts.some((item) => item.material)) {
      confirmationGaps.push(...detailConflicts.filter((item) => item.material).map((item) => `${item.label} conflict unresolved`));
    }
  }

  return {
    overallScore: cappedScore,
    categories,
    confirmationGaps,
    importantFields,
    commercialReady,
    unresolvedImportantFields,
  };
}
