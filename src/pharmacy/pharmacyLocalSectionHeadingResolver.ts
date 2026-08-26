/**
 * Customer-facing section headings for local hub, cluster, and area pages.
 */
import type { LocalFaqPageType } from "./pharmacyLocalFaqHeadingResolver.ts";

export type LocalSectionHeadingKind =
  | "faq"
  | "areas-we-support"
  | "nearby-areas"
  | "related-locations"
  | "child-area-cards"
  | "continue-reading";

/** Internal / engine labels that must never appear as visible H2 section titles. */
export const INTERNAL_LOCAL_SECTION_HEADING =
  /location hub questions|cluster questions|hub questions|local page questions|area questions|child area pages|parent links|nearby and parent links|common patient questions/i;

export function isInternalLocalSectionHeading(text: string): boolean {
  return INTERNAL_LOCAL_SECTION_HEADING.test(String(text || "").trim());
}

function cleanServiceName(serviceName: string): string {
  return serviceName.trim() || "Pharmacy First";
}

function cleanPlace(place: string): string {
  return place.trim() || "your area";
}

export function resolveLocalSectionHeading(input: {
  kind: LocalSectionHeadingKind;
  pageType: LocalFaqPageType;
  serviceName: string;
  localityLabel: string;
  primaryLocality?: string;
}): string {
  const service = cleanServiceName(input.serviceName);
  const place = cleanPlace(input.localityLabel);
  const hubPlace = cleanPlace(input.primaryLocality || input.localityLabel);

  switch (input.kind) {
    case "faq":
      return "Frequently asked questions";
    case "areas-we-support":
      return hubPlace && hubPlace !== "your area"
        ? `Areas We Support Around ${hubPlace}`
        : "Areas We Support";
    case "nearby-areas":
      return "Nearby Areas We Cover";
    case "related-locations":
      return "Nearby areas we also help";
    case "child-area-cards":
      return `How ${service} can help`;
    case "continue-reading":
      return "Continue reading";
    default:
      return "Areas We Support";
  }
}
