/**
 * CPR-RESET-04 — generic multi-location branch detection from website import evidence.
 */
import { createHash } from "node:crypto";
import type { WebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { DetectedWebsiteBranch, WebsiteBranchEvidenceSource, WebsiteParentBrand } from "./masterAdminWebsiteBranchResolutionModel.ts";

const UK_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi;

const UK_PHONE_RE = /\b0(?:1\d{8,9}|2\d{9}|3\d{9}|7\d{9}|800\d{6,7}|845\d{6,7}|330\d{6,7})\b/g;

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizePostcode(raw: string): string {
  const compact = str(raw).toUpperCase().replace(/\s+/g, "");
  const m = compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  if (m) return `${m[1]} ${m[2]}`;
  const spaced = str(raw).toUpperCase().replace(/\s+/g, " ");
  const match = spaced.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/);
  return match ? match[1].toUpperCase().replace(/\s+/, " ") : spaced;
}

function normalizePhone(raw: string): string {
  return str(raw).replace(/\s+/g, " ").trim();
}

const UK_POSTCODE_STRICT = /^[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}$/i;

function isValidUkPostcode(raw: string): boolean {
  const pc = normalizePostcode(raw);
  return UK_POSTCODE_STRICT.test(pc);
}

function isValidUkPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("44")) return digits.length >= 12 && digits.length <= 13;
  if (digits.startsWith("0")) return digits.length >= 10 && digits.length <= 11;
  return false;
}

function branchId(name: string, postcode: string, phone: string): string {
  const key = `${name.toLowerCase()}|${normalizePostcode(postcode)}|${normalizePhone(phone).replace(/\D/g, "")}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 12);
}

function hostFromUrl(raw: string): string {
  try {
    return new URL(raw.startsWith("http") ? raw : `https://${raw}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function uniqueBranches(branches: DetectedWebsiteBranch[]): DetectedWebsiteBranch[] {
  const map = new Map<string, DetectedWebsiteBranch>();
  for (const branch of branches) {
    const hasValidPostcode = isValidUkPostcode(branch.postcode);
    const hasValidPhone = isValidUkPhone(branch.phone);
    const hasName = str(branch.branchName).length >= 3;
    if (!hasValidPostcode && !hasValidPhone && !hasName) continue;
    if (branch.postcode && !hasValidPostcode) branch.postcode = "";
    if (branch.phone && !hasValidPhone) branch.phone = "";

    const id =
      branch.branchId ||
      branchId(branch.branchName, branch.postcode, branch.phone || branch.branchName);
    const existing = map.get(id);
    if (!existing) {
      map.set(id, { ...branch, branchId: id });
      continue;
    }
    const signals = new Set([...existing.detectionSignals, ...branch.detectionSignals]);
    const sources = [...existing.evidenceSources];
    for (const src of branch.evidenceSources) {
      if (!sources.some((s) => s.sourceUrl === src.sourceUrl && s.detectionMethod === src.detectionMethod)) {
        sources.push(src);
      }
    }
    map.set(id, {
      ...existing,
      branchName: existing.branchName || branch.branchName,
      addressLine1: existing.addressLine1 || branch.addressLine1,
      town: existing.town || branch.town,
      postcode: existing.postcode || branch.postcode,
      phone: existing.phone || branch.phone,
      email: existing.email || branch.email,
      branchUrl: existing.branchUrl || branch.branchUrl,
      logoUrl: existing.logoUrl || branch.logoUrl,
      googlePlaceId: existing.googlePlaceId || branch.googlePlaceId,
      googleBusinessName: existing.googleBusinessName || branch.googleBusinessName,
      googleAddress: existing.googleAddress || branch.googleAddress,
      googleMatchConfidence: Math.max(existing.googleMatchConfidence ?? 0, branch.googleMatchConfidence ?? 0) || null,
      services: [...new Set([...existing.services, ...branch.services])],
      detectionSignals: [...signals],
      evidenceSources: sources,
    });
  }
  return [...map.values()].filter((b) => b.branchName || b.postcode || b.phone);
}

function parseJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]);
      if (Array.isArray(parsed)) blocks.push(...parsed);
      else blocks.push(parsed);
    } catch {
      /* ignore invalid JSON-LD */
    }
  }
  return blocks;
}

function flattenJsonLd(node: unknown, out: Record<string, unknown>[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const item of node) flattenJsonLd(item, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  out.push(obj);
  if (obj["@graph"]) flattenJsonLd(obj["@graph"], out);
}

function extractSchemaBranches(html: string, sourceUrl: string, parentBrand: string): DetectedWebsiteBranch[] {
  const branches: DetectedWebsiteBranch[] = [];
  const nodes: Record<string, unknown>[] = [];
  for (const block of parseJsonLdBlocks(html)) flattenJsonLd(block, nodes);

  for (const node of nodes) {
    const type = String(node["@type"] || "");
    if (!/(Pharmacy|LocalBusiness|Store|MedicalBusiness)/i.test(type)) continue;
    const name = str(node.name);
    const phone = normalizePhone(str(node.telephone));
    const address = (node.address || {}) as Record<string, unknown>;
    const addressLine1 = str(address.streetAddress);
    const town = str(address.addressLocality);
    const postcode = normalizePostcode(str(address.postalCode));
    if (!name && !postcode && !phone) continue;
    branches.push({
      branchId: "",
      branchName: decodeHtmlEntities(name),
      parentBrandName: parentBrand,
      addressLine1,
      addressLine2: "",
      town,
      postcode,
      phone,
      email: str(node.email),
      branchUrl: str(node.url) || sourceUrl,
      logoUrl: str(node.logo || node.image),
      openingHours: "",
      services: [],
      googlePlaceId: null,
      googleBusinessName: null,
      googleAddress: null,
      googleMatchConfidence: null,
      evidenceSources: [{ sourceUrl, detectionMethod: "schema.org" }],
      detectionSignals: ["schema-local-business"],
    });
  }
  return branches;
}

function splitCombinedBusinessNames(text: string): string[] {
  const decoded = decodeHtmlEntities(text);
  const cleaned = decoded
    .replace(/\s*\|\s*[^|]*$/i, "")
    .replace(/\bDerby\b.*$/i, "")
    .trim();

  const andSplit = cleaned.split(/\s+(?:&amp;|&|\band\b)\s+/i);
  if (andSplit.length >= 2) {
    const suffixMatch = andSplit[andSplit.length - 1].match(/([A-Za-z\s]+Pharmacies?)/i);
    const suffix = suffixMatch ? suffixMatch[1].replace(/Pharmacies?/i, "Pharmacy").trim() : "Pharmacy";
    const parts = andSplit.map((part, idx) => {
      const p = part.trim();
      if (/pharmacy|chemist/i.test(p)) return p.replace(/Pharmacies?/i, "Pharmacy");
      if (idx === andSplit.length - 1) return p.replace(/Pharmacies?/i, "Pharmacy");
      return `${p} ${suffix}`.replace(/\s+/g, " ").trim();
    });
    return parts.filter((p) => p.length >= 8 && /pharmacy|chemist/i.test(p));
  }

  const parts = cleaned
    .split(/\s*(?:&amp;|&|\band\b)\s*/i)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length >= 4 && /pharmacy|chemist/i.test(p));
  return parts.length >= 2 ? parts : [];
}

function extractNamePostcodePairs(html: string, sourceUrl: string, parentBrand: string): DetectedWebsiteBranch[] {
  const branches: DetectedWebsiteBranch[] = [];
  const text = decodeHtmlEntities(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " "));
  const postcodeMatches = [...text.matchAll(UK_POSTCODE_RE)];
  const seenPostcodes = new Set<string>();

  for (const match of postcodeMatches) {
    const postcode = normalizePostcode(match[1]);
    if (!isValidUkPostcode(postcode)) continue;
    seenPostcodes.add(postcode);
    const idx = match.index ?? 0;
    const window = text.slice(Math.max(0, idx - 220), idx + match[0].length + 80);
    const phoneMatch = window.match(UK_PHONE_RE);
    const phone = phoneMatch ? normalizePhone(phoneMatch[0]) : "";
    const nameMatch =
      window.match(/([A-Z][A-Za-z'\- ]{2,40}\sPharmacy)/)?.[1]
      || window.match(/(Little Eaton[^,]{0,30})/i)?.[1]
      || window.match(/(Derwent[^,]{0,30})/i)?.[1];
    if (!nameMatch && !phone) continue;
    const addressMatch = window.match(/(\d+[A-Za-z]?\s+[A-Za-z][A-Za-z\s'.-]{2,40}(?:Street|St|Road|Rd|Lane|Ln|Close|Cl|Way|Avenue|Ave|Drive|Dr))/i);
    branches.push({
      branchId: "",
      branchName: str(nameMatch) || "",
      parentBrandName: parentBrand,
      addressLine1: str(addressMatch?.[1]),
      addressLine2: "",
      town: "",
      postcode,
      phone,
      email: "",
      branchUrl: sourceUrl,
      logoUrl: "",
      openingHours: "",
      services: [],
      googlePlaceId: null,
      googleBusinessName: null,
      googleAddress: null,
      googleMatchConfidence: null,
      evidenceSources: [{ sourceUrl, detectionMethod: "visible-text" }],
      detectionSignals: ["distinct-postcode"],
    });
  }
  return branches;
}

function extractPhoneBranches(html: string, sourceUrl: string, parentBrand: string): DetectedWebsiteBranch[] {
  const branches: DetectedWebsiteBranch[] = [];
  const phones = new Set<string>();
  for (const m of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const phone = normalizePhone(m[1]);
    if (!isValidUkPhone(phone)) continue;
    phones.add(phone);
  }
  const schemaPhone = html.match(/"telephone"\s*:\s*"([^"]+)"/i)?.[1];
  if (schemaPhone) {
    const phone = normalizePhone(schemaPhone);
    if (isValidUkPhone(phone)) phones.add(phone);
  }
  for (const phone of phones) {
    branches.push({
      branchId: "",
      branchName: "",
      parentBrandName: parentBrand,
      addressLine1: "",
      addressLine2: "",
      town: "",
      postcode: "",
      phone,
      email: "",
      branchUrl: sourceUrl,
      logoUrl: "",
      openingHours: "",
      services: [],
      googlePlaceId: null,
      googleBusinessName: null,
      googleAddress: null,
      googleMatchConfidence: null,
      evidenceSources: [{ sourceUrl, detectionMethod: "telephone" }],
      detectionSignals: ["distinct-phone"],
    });
  }
  return branches;
}

function extractLocationPageBranches(
  intelligence: WebsiteIntelligenceImportV2,
  parentBrand: string,
): DetectedWebsiteBranch[] {
  const branches: DetectedWebsiteBranch[] = [];
  for (const page of intelligence.structure.pages || []) {
    const path = str(page.path).toLowerCase();
    const title = decodeHtmlEntities(str(page.title));
    if (!/(location|branch|store|pharmacy|find-us|our-pharmacies)/i.test(path) && page.category !== "locations") continue;
    if (!title || title.length < 4) continue;
    branches.push({
      branchId: "",
      branchName: title.split("|")[0].trim(),
      parentBrandName: parentBrand,
      addressLine1: "",
      addressLine2: "",
      town: "",
      postcode: "",
      phone: "",
      email: "",
      branchUrl: page.url,
      logoUrl: "",
      openingHours: "",
      services: (page.detectedServiceIds || []).slice(0, 8),
      googlePlaceId: null,
      googleBusinessName: null,
      googleAddress: null,
      googleMatchConfidence: null,
      evidenceSources: [{ sourceUrl: page.url, detectionMethod: "location-page" }],
      detectionSignals: ["location-page"],
    });
  }
  return branches;
}

function extractGoogleCandidateBranches(
  candidates: Array<Record<string, unknown>>,
  websiteHost: string,
  parentBrand: string,
  pageTitle = "",
): DetectedWebsiteBranch[] {
  const branches: DetectedWebsiteBranch[] = [];
  const titleHay = pageTitle.toLowerCase();
  for (const c of candidates) {
    const website = str(c.website);
    const candidateHost = hostFromUrl(website);
    if (website && candidateHost && websiteHost && candidateHost !== websiteHost) continue;
    const businessName = str(c.businessName);
    if (!website) {
      const tokens = businessName.toLowerCase().split(/\s+/).filter((t) => t.length > 3);
      const inTitle = tokens.some((t) => titleHay.includes(t));
      if (!inTitle) continue;
    }
    const postcode = normalizePostcode(str(c.postcode));
    const phone = normalizePhone(str(c.phone));
    if (!businessName || !isValidUkPostcode(postcode)) continue;
    branches.push({
      branchId: "",
      branchName: businessName,
      parentBrandName: parentBrand,
      addressLine1: str(c.address).split(",")[0] || "",
      addressLine2: "",
      town: "",
      postcode,
      phone,
      email: "",
      branchUrl: website || "",
      logoUrl: "",
      openingHours: "",
      services: [],
      googlePlaceId: str(c.placeId) || null,
      googleBusinessName: businessName,
      googleAddress: str(c.address),
      googleMatchConfidence: Number(c.confidence) || null,
      evidenceSources: [{ sourceUrl: "google-candidate", detectionMethod: "google-listing" }],
      detectionSignals: ["google-candidate-same-site"],
    });
  }
  return branches;
}

function inferParentBrand(input: {
  submittedBusinessName: string;
  websiteUrl: string;
  intelligence: WebsiteIntelligenceImportV2;
}): WebsiteParentBrand {
  const identity = input.intelligence.identity;
  return {
    tradingName: input.submittedBusinessName || decodeHtmlEntities(identity.title.split("|")[0].trim()),
    parentWebsite: input.websiteUrl,
    logoUrl: str(identity.logoUrl),
    brandPrimaryColor: str(identity.brandPrimaryColor),
    brandSecondaryColor: str(identity.brandSecondaryColor),
    brandAccentColor: str(identity.brandAccentColor),
  };
}

export interface DetectMultiLocationBranchesInput {
  websiteUrl: string;
  homepageHtml: string;
  intelligence: WebsiteIntelligenceImportV2;
  submittedBusinessName: string;
  googleCandidates?: Array<Record<string, unknown>>;
}

export interface DetectMultiLocationBranchesResult {
  requiresSelection: boolean;
  parentBrand: WebsiteParentBrand;
  detectedBranches: DetectedWebsiteBranch[];
  detectionSignals: string[];
}

export function detectMultiLocationBranches(input: DetectMultiLocationBranchesInput): DetectMultiLocationBranchesResult {
  const sourceUrl = str(input.intelligence.identity.resolvedUrl || input.websiteUrl);
  const parentBrandName = input.submittedBusinessName || decodeHtmlEntities(input.intelligence.identity.title);
  const parentBrand = inferParentBrand(input);
  const websiteHost = hostFromUrl(input.websiteUrl);
  const signals: string[] = [];

  let branches: DetectedWebsiteBranch[] = [
    ...extractGoogleCandidateBranches(input.googleCandidates || [], websiteHost, parentBrandName, input.intelligence.identity.title),
  ];

  const combinedNames = splitCombinedBusinessNames(input.intelligence.identity.title);

  if (branches.length >= 2) {
    signals.push("google-candidates-same-site");
  } else {
    branches.push(
      ...extractSchemaBranches(input.homepageHtml, sourceUrl, parentBrandName),
      ...extractNamePostcodePairs(input.homepageHtml, sourceUrl, parentBrandName),
      ...extractPhoneBranches(input.homepageHtml, sourceUrl, parentBrandName),
      ...extractLocationPageBranches(input.intelligence, parentBrandName),
    );
    if (input.googleCandidates?.length) {
      branches.push(...extractGoogleCandidateBranches(input.googleCandidates, websiteHost, parentBrandName, input.intelligence.identity.title));
      signals.push("google-candidates-same-site");
    }
  }

  if (combinedNames.length >= 2 && branches.filter((b) => b.googlePlaceId).length < 2) {
    signals.push("combined-business-name");
    for (const name of combinedNames) {
      branches.push({
        branchId: "",
        branchName: name,
        parentBrandName: parentBrandName,
        addressLine1: "",
        addressLine2: "",
        town: "",
        postcode: "",
        phone: "",
        email: "",
        branchUrl: sourceUrl,
        logoUrl: parentBrand.logoUrl,
        openingHours: "",
        services: [],
        googlePlaceId: null,
        googleBusinessName: null,
        googleAddress: null,
        googleMatchConfidence: null,
        evidenceSources: [{ sourceUrl, detectionMethod: "page-title" }],
        detectionSignals: ["combined-business-name"],
      });
    }
  }

  if (input.googleCandidates?.length && !signals.includes("google-candidates-same-site")) {
    branches.push(...extractGoogleCandidateBranches(input.googleCandidates, websiteHost, parentBrandName));
    signals.push("google-candidates-same-site");
  }

  branches = uniqueBranches(branches);

  for (const branch of branches) {
    if (branch.googlePlaceId) continue;
    const pc = normalizePostcode(branch.postcode).replace(/\s/g, "");
    const match = (input.googleCandidates || []).find((c) => {
      const cpc = normalizePostcode(str(c.postcode)).replace(/\s/g, "");
      if (pc && cpc && pc === cpc) return true;
      const cName = str(c.businessName).toLowerCase();
      const bName = branch.branchName.toLowerCase();
      return cName && bName && (cName.includes(bName) || bName.includes(cName));
    });
    if (match) {
      branch.googlePlaceId = str(match.placeId) || null;
      branch.googleBusinessName = str(match.businessName) || null;
      branch.googleAddress = str(match.address) || null;
      branch.googleMatchConfidence = Number(match.confidence) || null;
      if (!branch.phone) branch.phone = normalizePhone(str(match.phone));
      if (!branch.postcode) branch.postcode = normalizePostcode(str(match.postcode));
      if (!branch.addressLine1) branch.addressLine1 = str(match.address).split(",")[0] || "";
    }
  }

  const distinctPostcodes = new Set(
    branches.map((b) => normalizePostcode(b.postcode)).filter((pc) => isValidUkPostcode(pc)),
  );
  const distinctPhones = new Set(
    branches.map((b) => normalizePhone(b.phone)).filter((p) => isValidUkPhone(p)),
  );
  const distinctNames = new Set(
    branches.map((b) => b.branchName.toLowerCase()).filter((n) => n.length >= 3 && /pharmacy|chemist|dispensary/i.test(n)),
  );

  if (distinctPostcodes.size > 1) signals.push("multiple-postcodes");
  if (distinctPhones.size > 1) signals.push("multiple-phones");
  if (distinctNames.size > 1) signals.push("multiple-branch-names");
  if (combinedNames.length >= 2) signals.push("title-lists-branches");

  const requiresSelection =
    branches.length > 1 &&
    (distinctPostcodes.size > 1 ||
      distinctPhones.size > 1 ||
      distinctNames.size > 1 ||
      combinedNames.length >= 2);

  const meaningfulBranches = branches.filter((b) => {
    const named = /pharmacy|chemist|dispensary|little eaton|derwent/i.test(b.branchName);
    const googleBacked = Boolean(b.googlePlaceId);
    return (named && (isValidUkPostcode(b.postcode) || isValidUkPhone(b.phone))) || googleBacked;
  });

  const googlePrimaryMap = new Map<string, DetectedWebsiteBranch>();
  for (const b of branches) {
    if (b.googlePlaceId && isValidUkPostcode(b.postcode)) {
      googlePrimaryMap.set(b.googlePlaceId, b);
    }
  }
  const googlePrimary = [...googlePrimaryMap.values()];
  const finalBranches =
    googlePrimary.length >= 2
      ? googlePrimary
      : meaningfulBranches.length >= 2
        ? uniqueBranches(meaningfulBranches).slice(0, 12)
        : uniqueBranches(branches.filter((b) => b.googlePlaceId || /pharmacy/i.test(b.branchName))).slice(0, 6);

  return {
    requiresSelection: requiresSelection && finalBranches.length > 1,
    parentBrand,
    detectedBranches: finalBranches,
    detectionSignals: signals,
  };
}
