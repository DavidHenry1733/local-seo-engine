/**
 * Google Business Profile URL resolution — share links, kgmid, redirects (setup Step 1 only).
 */
import { parseGooglePlaceIdFromUrl } from "./growthEngineCustomerSetupGoogleMatchService.ts";

export interface ResolvedGoogleBusinessUrl {
  inputUrl: string;
  finalUrl: string;
  redirected: boolean;
}

export interface GoogleUrlEntityHints {
  inputUrl: string;
  finalUrl: string;
  redirected: boolean;
  placeId: string;
  kgMid: string;
  searchQueryFromUrl: string;
  entityHintUsed: boolean;
}

function normalizeKgMid(value: string): string {
  const decoded = decodeURIComponent(String(value || "").trim());
  const match = decoded.match(/(\/?g\/[a-z0-9]+)/i);
  if (!match) return "";
  const id = match[1].replace(/^\/g\//i, "g/").replace(/^g\//i, "");
  return `/g/${id}`;
}

/** Extract kgmid=/g/... or encoded kgmid=%2Fg%2F... from Google Search / share redirect URLs. */
export function extractKgMidFromGoogleUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const param = parsed.searchParams.get("kgmid");
    if (param) {
      const normalized = normalizeKgMid(param);
      if (normalized) return normalized;
    }
  } catch {
    /* fall through to regex */
  }

  const paramMatch = raw.match(/[?&]kgmid=([^&]+)/i)?.[1];
  if (paramMatch) {
    const normalized = normalizeKgMid(paramMatch);
    if (normalized) return normalized;
  }

  const inlineMatch = raw.match(/(\/g\/[a-z0-9]+)/i);
  return inlineMatch ? normalizeKgMid(inlineMatch[1]) : "";
}

/** Extract q= search term from resolved Google Search URLs. */
export function extractGoogleSearchQueryFromUrl(url: string): string {
  const raw = String(url || "").trim();
  if (!raw) return "";

  try {
    const parsed = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const q = parsed.searchParams.get("q");
    if (q) return q.replace(/\+/g, " ").trim();
  } catch {
    /* fall through */
  }

  const match = raw.match(/[?&]q=([^&]+)/i)?.[1];
  return match ? decodeURIComponent(match.replace(/\+/g, " ")).trim() : "";
}

export async function resolveGoogleBusinessProfileUrl(inputUrl: string): Promise<ResolvedGoogleBusinessUrl> {
  const input = String(inputUrl || "").trim();
  if (!input) {
    return { inputUrl: input, finalUrl: input, redirected: false };
  }

  const normalized = input.startsWith("http") ? input : `https://${input}`;

  try {
    const res = await fetch(normalized, {
      redirect: "follow",
      headers: {
        "User-Agent": "PharmaConnectGoogleProfileImport/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    const finalUrl = res.url || normalized;
    return {
      inputUrl: input,
      finalUrl,
      redirected: finalUrl.replace(/\/$/, "") !== normalized.replace(/\/$/, ""),
    };
  } catch {
    return { inputUrl: input, finalUrl: normalized, redirected: false };
  }
}

export function extractPlaceIdFromGoogleUrl(url: string): string {
  return parseGooglePlaceIdFromUrl(url);
}

/** True when the user pasted an explicit Google Maps / Profile / share URL. */
export function isGoogleProfileInputUrl(url: string): boolean {
  const raw = String(url || "").trim().toLowerCase();
  if (!raw) return false;
  return (
    raw.includes("share.google") ||
    raw.includes("maps.app.goo.gl") ||
    raw.includes("google.com/maps") ||
    raw.includes("google.com/search") ||
    raw.includes("g.page") ||
    raw.includes("goo.gl/maps") ||
    /[?&](query_place_id|place_id|kgmid)=/i.test(raw) ||
    /\/place\//i.test(raw)
  );
}

export async function resolveGoogleUrlEntityHints(inputUrl: string): Promise<GoogleUrlEntityHints> {
  const resolved = await resolveGoogleBusinessProfileUrl(inputUrl);
  const placeId =
    extractPlaceIdFromGoogleUrl(resolved.finalUrl) || extractPlaceIdFromGoogleUrl(resolved.inputUrl);
  const kgMid =
    extractKgMidFromGoogleUrl(resolved.finalUrl) || extractKgMidFromGoogleUrl(resolved.inputUrl);
  const searchQueryFromUrl =
    extractGoogleSearchQueryFromUrl(resolved.finalUrl) || extractGoogleSearchQueryFromUrl(resolved.inputUrl);
  const entityHintUsed = Boolean(kgMid || searchQueryFromUrl);

  return {
    inputUrl: resolved.inputUrl,
    finalUrl: resolved.finalUrl,
    redirected: resolved.redirected,
    placeId,
    kgMid,
    searchQueryFromUrl,
    entityHintUsed,
  };
}

/** @deprecated Use resolveGoogleUrlEntityHints */
export async function resolveGoogleUrlAndPlaceId(inputUrl: string): Promise<{
  resolved: ResolvedGoogleBusinessUrl;
  placeId: string;
}> {
  const hints = await resolveGoogleUrlEntityHints(inputUrl);
  return {
    resolved: {
      inputUrl: hints.inputUrl,
      finalUrl: hints.finalUrl,
      redirected: hints.redirected,
    },
    placeId: hints.placeId,
  };
}
