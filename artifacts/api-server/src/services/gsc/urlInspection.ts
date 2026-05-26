import { google } from "googleapis";

export type GscIndexResult = {
  url: string;
  verdict: string;
  coverageState: string;
  indexingState: string;
  robotsTxtState?: string;
  pageFetchState?: string;
  googleCanonical?: string;
  userCanonical?: string;
  lastCrawlTime?: string;
  raw?: unknown;
  error?: string;
};

export async function inspectUrlWithGsc(params: {
  url: string;
  siteUrl: string;
  accessToken: string;
}): Promise<GscIndexResult> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: params.accessToken });

  const searchconsole = google.searchconsole({ version: "v1", auth });

  try {
    const response = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: params.url,
        siteUrl: params.siteUrl,
        languageCode: "en-GB",
      },
    });

    const inspection = response.data.inspectionResult?.indexStatusResult;

    return {
      url: params.url,
      verdict: inspection?.verdict || "UNKNOWN",
      coverageState: inspection?.coverageState || "UNKNOWN",
      indexingState: inspection?.indexingState || "UNKNOWN",
      robotsTxtState: inspection?.robotsTxtState || undefined,
      pageFetchState: inspection?.pageFetchState || undefined,
      googleCanonical: inspection?.googleCanonical || undefined,
      userCanonical: inspection?.userCanonical || undefined,
      lastCrawlTime: inspection?.lastCrawlTime || undefined,
      raw: response.data,
    };
  } catch (err: any) {
    return {
      url: params.url,
      verdict: "ERROR",
      coverageState: "ERROR",
      indexingState: "ERROR",
      error: err?.message || String(err),
    };
  }
}

