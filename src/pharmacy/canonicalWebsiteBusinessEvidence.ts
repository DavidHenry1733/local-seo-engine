/**
 * Website-only business identity read from a produced crawl artifact.
 * Selected fields win when they already carry website evidence.
 * Address candidates and their stored website snippets fill cleared selected slots.
 * Google sources are never used.
 */
import type { WebsiteImportFieldValue } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";

export interface WebsiteAddressCandidateRecord {
  addressLine1?: string;
  town?: string;
  postcode?: string;
  sourceUrl?: string;
  sourceType?: string;
  matchedSnippet?: string;
  confidence?: number;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function decodeBasicEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&#8211;/g, "–").replace(/&nbsp;/g, " ");
}

export function bestWebsiteAddressCandidate(business: { addressCandidates?: unknown } | null | undefined): WebsiteAddressCandidateRecord | null {
  const list = Array.isArray(business?.addressCandidates)
    ? business.addressCandidates as WebsiteAddressCandidateRecord[]
    : [];
  const website = list.filter((candidate) => {
    const source = str(candidate.sourceUrl);
    const type = str(candidate.sourceType).toLowerCase();
    return source && source !== "google-candidate" && !type.includes("google");
  });
  website.sort((a, b) => Number(b.confidence || 0) - Number(a.confidence || 0));
  return website[0] || null;
}

function phoneFromWebsiteSnippet(snippet: string): string {
  const match = snippet.match(/\b0\d(?:[\d\s]{8,16})\d\b/);
  return match ? match[0].replace(/\s+/g, " ").trim() : "";
}

function emailFromWebsiteSnippet(snippet: string): string {
  const match = snippet.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match ? match[0] : "";
}

function nameFromWebsiteSnippet(snippet: string, addressLine1: string): string {
  const streetStart = addressLine1.split(/\s+/).slice(0, 2).join(" ");
  for (const part of snippet.split("|")) {
    const text = part.replace(/\s+/g, " ").trim();
    if (!text || !/pharmacy|chemist|clinic/i.test(text)) continue;
    if (streetStart && !text.toLowerCase().includes(streetStart.toLowerCase())) continue;
    const name = text.split(",")[0]?.trim() || "";
    if (name.length >= 3) return name;
  }
  return "";
}

function fieldOrWebsite(
  field: WebsiteImportFieldValue | null | undefined,
  fallback: { value: string; sourceUrl: string; method: string; confidence: number | null },
): WebsiteImportFieldValue | null {
  if (str(field?.selected)) return field || null;
  if (!fallback.value) return field || null;
  return {
    selected: fallback.value,
    confidence: fallback.confidence ?? 0,
    candidates: [],
    evidence: {
      sourceUrl: fallback.sourceUrl,
      detectionMethod: fallback.method,
      confidence: fallback.confidence ?? 0,
      detectedAt: "",
    },
  };
}

export function resolveCanonicalWebsiteBusinessFields(business: {
  businessName?: WebsiteImportFieldValue | null;
  phone?: WebsiteImportFieldValue | null;
  email?: WebsiteImportFieldValue | null;
  address?: WebsiteImportFieldValue | null;
  town?: WebsiteImportFieldValue | null;
  postcode?: WebsiteImportFieldValue | null;
  addressCandidates?: unknown;
} | null | undefined): {
  businessName: WebsiteImportFieldValue | null;
  phone: WebsiteImportFieldValue | null;
  email: WebsiteImportFieldValue | null;
  address: WebsiteImportFieldValue | null;
  town: WebsiteImportFieldValue | null;
  postcode: WebsiteImportFieldValue | null;
} {
  const addressCandidate = bestWebsiteAddressCandidate(business);
  const snippet = decodeBasicEntities(str(addressCandidate?.matchedSnippet));
  const sourceUrl = str(addressCandidate?.sourceUrl);
  const method = str(addressCandidate?.sourceType) || "contact-page";
  const confidence = addressCandidate?.confidence ?? null;
  const fallback = (value: string) => ({ value, sourceUrl, method, confidence });
  return {
    businessName: fieldOrWebsite(business?.businessName, fallback(nameFromWebsiteSnippet(snippet, str(addressCandidate?.addressLine1)))),
    address: fieldOrWebsite(business?.address, fallback(str(addressCandidate?.addressLine1))),
    town: fieldOrWebsite(business?.town, fallback(str(addressCandidate?.town))),
    postcode: fieldOrWebsite(business?.postcode, fallback(str(addressCandidate?.postcode))),
    phone: fieldOrWebsite(business?.phone, fallback(phoneFromWebsiteSnippet(snippet))),
    email: fieldOrWebsite(business?.email, fallback(emailFromWebsiteSnippet(snippet))),
  };
}
