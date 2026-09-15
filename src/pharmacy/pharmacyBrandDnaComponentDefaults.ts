import type { BrandDnaComponents } from "./pharmacyBrandDnaComponentTypes.ts";

export function getPharmaConnectBrandDnaComponentDefaults(): BrandDnaComponents {
  return {
    headerVariant: "standard-navigation",
    topBarVariant: "none",
    navigationVariant: "inline",
    heroVariant: "split-text-left-image-right",
    sectionFlowVariant: "card-led",
    mediaTextVariant: "split-balanced",
    serviceCardVariant: "card-grid-three",
    trustPanelVariant: "card-grid",
    processVariant: "numbered-cards",
    faqVariant: "stacked-cards",
    ctaVariant: "centred-band",
    mapContactVariant: "split-map-details",
    footerVariant: "four-column-contact",
    mobileHeaderVariant: "stacked-nav",
    imageTreatmentVariant: "rounded-soft",
  };
}
