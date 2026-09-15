/**
 * Google Places API connection helpers — env detection and structured errors.
 */

export type GooglePlacesConnectionErrorCode =
  | "api-key-missing"
  | "invalid-key"
  | "billing-disabled"
  | "api-not-enabled"
  | "no-coordinates"
  | "branch-location-required"
  | "no-place-found"
  | "quota-rate-limit"
  | "unknown-api-error";

export interface GooglePlacesConnectionError {
  code: GooglePlacesConnectionErrorCode;
  message: string;
  httpStatus?: number;
  detail?: string;
}

export const GOOGLE_PLACES_ENV_VAR = "GOOGLE_PLACES_API_KEY";

export function hasGooglePlacesApiKey(): boolean {
  return Boolean(process.env[GOOGLE_PLACES_ENV_VAR]?.trim());
}

export function classifyPlacesHttpError(status: number, body: string): GooglePlacesConnectionError {
  const lower = body.toLowerCase();

  if (status === 429 || lower.includes("quota") || lower.includes("rate limit")) {
    return {
      code: "quota-rate-limit",
      message: "Google Places quota or rate limit exceeded. Try again later.",
      httpStatus: status,
      detail: body.slice(0, 300),
    };
  }

  if (lower.includes("billing") || lower.includes("billing account")) {
    return {
      code: "billing-disabled",
      message: "Google Cloud billing is disabled or not linked for Places API.",
      httpStatus: status,
      detail: body.slice(0, 300),
    };
  }

  if (
    lower.includes("not enabled") ||
    lower.includes("access not configured") ||
    lower.includes("service disabled") ||
    lower.includes("places.googleapis.com")
  ) {
    return {
      code: "api-not-enabled",
      message: "Places API (New) is not enabled for this Google Cloud project.",
      httpStatus: status,
      detail: body.slice(0, 300),
    };
  }

  if (status === 401 || status === 403 || lower.includes("api key") || lower.includes("invalid")) {
    return {
      code: "invalid-key",
      message: "Google Places API key is invalid or not authorized for this request.",
      httpStatus: status,
      detail: body.slice(0, 300),
    };
  }

  return {
    code: "unknown-api-error",
    message: `Google Places API returned an unexpected error (HTTP ${status}).`,
    httpStatus: status,
    detail: body.slice(0, 300),
  };
}

export function missingApiKeyError(): GooglePlacesConnectionError {
  return {
    code: "api-key-missing",
    message: `Google Places API key is not configured. Set ${GOOGLE_PLACES_ENV_VAR} in the server environment.`,
  };
}

export function noCoordinatesError(): GooglePlacesConnectionError {
  return {
    code: "no-coordinates",
    message: "Pharmacy profile is missing latitude and longitude. Add coordinates in Your Pharmacy.",
  };
}

export function noPlaceFoundError(context: string): GooglePlacesConnectionError {
  return {
    code: "no-place-found",
    message: `No matching place found on Google Places for ${context}.`,
  };
}

export function formatPlacesErrorForDisplay(error: GooglePlacesConnectionError): string {
  const labels: Record<GooglePlacesConnectionErrorCode, string> = {
    "api-key-missing": "API key missing",
    "invalid-key": "Invalid API key",
    "billing-disabled": "Billing disabled",
    "api-not-enabled": "API not enabled",
    "no-coordinates": "No coordinates",
    "branch-location-required": "Branch/location required",
    "no-place-found": "No place found",
    "quota-rate-limit": "Quota / rate limit",
    "unknown-api-error": "Unknown API error",
  };
  return `${labels[error.code]}: ${error.message}`;
}

export async function placesApiFetch(
  url: string,
  init: RequestInit,
): Promise<{ ok: true; data: unknown } | { ok: false; error: GooglePlacesConnectionError }> {
  if (!hasGooglePlacesApiKey()) {
    return { ok: false, error: missingApiKeyError() };
  }

  try {
    const res = await fetch(url, init);
    if (res.ok) {
      return { ok: true, data: await res.json() };
    }
    const body = await res.text();
    return { ok: false, error: classifyPlacesHttpError(res.status, body) };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        code: "unknown-api-error",
        message: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
