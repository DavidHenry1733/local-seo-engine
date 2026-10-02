/**
 * Campaign Builder UX V2 — presentation copy and display helpers only.
 */
import type { CampaignBuilderListItem } from "./growthEngineCampaignBuilderModel.ts";
import type { CampaignBuilderOverview } from "./growthEngineCampaignBuilderModel.ts";

export const CB_UX_CHOOSE_TITLE = "Choose Your First Growth Campaign";

export const CB_UX_CHOOSE_SUBTITLE =
  "Based on your pharmacy, your website and your local market, we've identified the campaigns most likely to help you attract more patients.";

export const CB_UX_SELECTED_PRIORITY_BANNER = "Selected campaign priority";

export function cbUxSelectedPriorityCopy(serviceName: string): string {
  return `You selected ${serviceName} in your Growth Plan. Review the campaign package below before continuing.`;
}

export const CB_UX_CHOOSE_SELECTED_SUBTITLE =
  "Review the campaign you selected in your Growth Plan, then continue or choose a different enabled service.";

export const CB_UX_BADGE_GROW = "Grow This Service";

export const CB_UX_BADGE_NEW = "New Growth Opportunity";

export const CB_UX_RECOMMENDED_BANNER = "★★★★★ Recommended First Campaign";

export const CB_UX_BUILD_CAMPAIGN = "🚀 Build Campaign";

export const CB_UX_REGENERATE_CAMPAIGN = "Create new campaign version";
export const CB_UX_CONTINUE_V6_REGENERATION = "Continue v6 regeneration";

export const CB_UX_REGENERATE_VERSION_EXPLAIN =
  "A new campaign will be created from this pharmacy’s saved profile using the accepted Gemini local-page generator. Previous campaign runs stay as inactive history. Nothing is published or indexed.";

export const CB_UX_REGENERATE_CONFIRM_CHECKBOX =
  "I confirm a new campaign will be created from the saved pharmacy profile. Previous runs and candidates stay as inactive history. Nothing will be published or indexed.";

export const CB_UX_GENERATE_MY_CAMPAIGN = "Generate My Campaign";

/** @deprecated use CB_UX_GENERATE_MY_CAMPAIGN on approval step only */
export const CB_UX_BUILD_MY_CAMPAIGN = CB_UX_GENERATE_MY_CAMPAIGN;

export const CB_UX_FORBIDDEN_TERMS = [
  "generator",
  "engine",
  "seo",
  "assets package",
  "workflow",
  "generation",
] as const;

export const CB_UX_STEP_LABELS = {
  choose: "Select Campaign",
  areas: "Target Areas",
  settings: "Select Assets",
  images: "Image Strategy",
  overview: "Generation Summary",
  approval: "Generate Campaign",
  review: "Review Centre",
} as const;

export const CB_UX_CAMPAIGN_INCLUDES = [
  "Service Page",
  "Local Area Pages",
  "Patient Guide",
  "FAQs",
  "Blog Articles",
  "Google Business Profile Posts",
  "Social Posts",
  "Email Campaign",
  "AI Images",
] as const;

export function cbUxDisplayBadge(item: CampaignBuilderListItem): string {
  if (item.customerSelected) return CB_UX_SELECTED_PRIORITY_BANNER;
  if (item.serviceContext === "missing") return CB_UX_BADGE_NEW;
  if (item.serviceContext === "existing") return CB_UX_BADGE_GROW;
  return item.recommended ? "Recommended Campaign" : "Growth Campaign";
}

export function cbUxExistingCardCopy(serviceName: string): string {
  return `You already offer ${serviceName}. This campaign is designed to help more local patients discover this service through Google, your website and your digital marketing.`;
}

export function cbUxMissingCardCopy(): string {
  return "This service does not currently appear on your website. Creating this campaign can help you promote another valuable NHS or private service.";
}

export function cbUxRecommendedWhy(item: CampaignBuilderListItem): string {
  if (item.serviceContext === "existing") {
    return "We recommend starting here because this service already exists on your website and has the greatest opportunity to improve local visibility.";
  }
  if (item.serviceContext === "missing") {
    return "We recommend starting here because this service is not yet visible on your website and represents a clear growth opportunity.";
  }
  if (item.isFallback) {
    return "We recommend starting here based on what we found in your pharmacy profile, website and local market.";
  }
  return "We recommend starting here based on your Growth Plan and the evidence we have gathered about your pharmacy.";
}

export function cbUxBuildTimeDisplay(assetCount: number): string {
  if (assetCount >= 35) return "3–4 minutes";
  if (assetCount >= 20) return "2–3 minutes";
  return "About 2 minutes";
}

export function cbUxMarketingAssetCount(item: CampaignBuilderListItem): number {
  return item.expectedAssetCount;
}

export function cbUxOverviewTotals(overview: CampaignBuilderOverview): {
  pages: number;
  blogs: number;
  guides: number;
  gbpPosts: number;
  emails: number;
  images: number;
} {
  const find = (key: string) => overview.assets.find((a) => a.key === key)?.count || 0;
  const social =
    (find("social") || 0) + (find("socialInstagram") || 0) + (find("socialX") || 0);
  return {
    pages:
      find("servicePage") +
      find("landingPages") +
      find("faqs") +
      find("guides"),
    blogs: find("blogs"),
    guides: find("guides"),
    gbpPosts: find("gbp"),
    emails: find("emails"),
    images: find("images"),
  };
}

export function cbUxExtractCustomerFacingCopy(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "")
    .replace(/<[^>]+>/g, " ");
}

export function cbUxCopyIsCommercialSafe(text: string): boolean {
  const lower = cbUxExtractCustomerFacingCopy(text).toLowerCase();
  return !CB_UX_FORBIDDEN_TERMS.some((term) => {
    const pattern = term.includes(" ")
      ? lower.includes(term)
      : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(lower);
    return pattern;
  });
}

export function cbUxPrimaryActionCount(html: string): number {
  const primary = (html.match(/class="[^"]*cb-primary-cta[^"]*"/g) || []).length;
  return primary;
}
