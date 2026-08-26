/**
 * Customer-facing FAQ section headings for local page types.
 */
import {
  isInternalLocalSectionHeading,
  resolveLocalSectionHeading,
} from "./pharmacyLocalSectionHeadingResolver.ts";

export type LocalFaqPageType = "location-hub" | "location-cluster" | "location-area";

export function isInternalLocalFaqHeading(text: string): boolean {
  return isInternalLocalSectionHeading(text);
}

export function resolveLocalFaqSectionHeading(input: {
  pageType: LocalFaqPageType;
  serviceName: string;
  localityLabel: string;
  existingHeading?: string;
}): string {
  const existing = String(input.existingHeading || "").trim();
  if (input.pageType === "location-area" && existing && !isInternalLocalFaqHeading(existing)) {
    return existing;
  }
  return resolveLocalSectionHeading({
    kind: "faq",
    pageType: input.pageType,
    serviceName: input.serviceName,
    localityLabel: input.localityLabel,
  });
}
