/**
 * customerProfile.ts
 *
 * Customer / service-provider profile for non-digital campaigns.
 *
 * When a project (e.g. DHM Digital) runs trade-service campaigns on behalf of
 * clients (emergency plumber, roofer, electrician, etc.) the generated pages
 * must use the *actual* service provider's business identity in schema and
 * content — not the digital agency's identity.
 *
 * This module contains only types and pure helper functions (no file I/O).
 * Loading and saving profiles is handled by the API layer
 * (artifacts/api-server/src/routes/api/providerProfiles.ts) so this module
 * stays side-effect-free and can be imported by validators and renderers alike.
 */

// ── Schema.org @type arrays by industry ──────────────────────────────────────
// Google recommends using the most specific applicable Schema.org type.
// https://schema.org/LocalBusiness subtypes
export const INDUSTRY_SCHEMA_TYPES: Record<string, string[]> = {
  plumbing:     ["LocalBusiness", "Plumber"],
  electrical:   ["LocalBusiness", "Electrician"],
  heating:      ["LocalBusiness", "HVACBusiness"],
  roofing:      ["LocalBusiness", "RoofingContractor"],
  landscaping:  ["LocalBusiness", "LandscapingBusiness"],
  genericTrade: ["LocalBusiness"],
  // Digital industry types always use plain LocalBusiness / Organization
  "web-design":           ["LocalBusiness"],
  "local-seo":            ["LocalBusiness"],
  "seo":                  ["LocalBusiness"],
  "web-hosting":          ["LocalBusiness"],
  "google-business-profile": ["LocalBusiness"],
  "email-marketing":      ["LocalBusiness"],
  "digital-marketing":    ["LocalBusiness"],
  "ppc":                  ["LocalBusiness"],
  "social-media-marketing": ["LocalBusiness"],
};

const DIGITAL_INDUSTRY_TYPES = new Set([
  "web-design","local-seo","seo","web-hosting",
  "google-business-profile",
  "email-marketing","digital-marketing","ppc","social-media-marketing",
]);

/** True if industryType is a non-digital trade/service industry. */
export function isNonDigitalIndustry(industryType: string | undefined): boolean {
  return !!(industryType && !DIGITAL_INDUSTRY_TYPES.has(industryType));
}

/**
 * Return the best Schema.org @type array for a given industryType.
 * Falls back to ["LocalBusiness"] for unknown or undefined types.
 */
export function schemaTypesForIndustry(industryType: string | undefined): string[] {
  if (!industryType) return ["LocalBusiness"];
  return INDUSTRY_SCHEMA_TYPES[industryType] ?? ["LocalBusiness"];
}

// ── CustomerProviderAddress ───────────────────────────────────────────────────

export interface CustomerProviderAddress {
  streetAddress?:  string;
  /** Required — town/city e.g. "Rotherham" */
  addressLocality: string;
  /** e.g. "South Yorkshire" */
  addressRegion?:  string;
  /** ISO 3166-1 alpha-2 e.g. "GB" */
  addressCountry?: string;
}

// ── CustomerProviderProfile ───────────────────────────────────────────────────

/**
 * Represents the actual service provider for a non-digital campaign page.
 *
 * Stored at:  config/projects/<clientSlug>/providers/<serviceKey>.json
 *
 * When `approved = true`, the renderer uses these details instead of the
 * project-level agency identity (e.g. DHM Digital) for schema and page content.
 * When the profile is missing or unapproved, the publish gate blocks the page
 * with REVIEW_REQUIRED and shows a clear remediation message.
 */
export interface CustomerProviderProfile {
  /** Trading name of the actual service provider e.g. "Rotherham Plumbing Ltd" */
  businessName:  string;
  /** Industry type matching the campaign — e.g. "plumbing", "electrical" */
  industry:      string;
  /** Schema.org @type array. Defaults from schemaTypesForIndustry(industry). */
  schemaTypes:   string[];
  /** Contact phone — must have ≥10 digits in standard format */
  phone?:        string;
  email?:        string;
  /** The provider's own website URL — used in schema and breadcrumb Home */
  url?:          string;
  address?:      CustomerProviderAddress;
  /**
   * Must be true before the profile is used in schema or the publish gate
   * passes. Setting approved = false acts as a draft / review-pending state.
   */
  approved:      boolean;
  createdAt:     string;
  updatedAt:     string;
}
