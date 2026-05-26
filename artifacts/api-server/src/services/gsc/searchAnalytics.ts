import { google } from "googleapis";

export type GscDiscoveredPage = {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function isoDateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function discoverPagesFromGsc(params: {
  siteUrl: string;
  accessToken: string;
  days?: number;
  rowLimit?: number;
}): Promise<GscDiscoveredPage[]> {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: params.accessToken });

  const searchconsole = google.searchconsole({ version: "v1", auth });

  const res = await searchconsole.searchanalytics.query({
    siteUrl: params.siteUrl,
    requestBody: {
      startDate: isoDateDaysAgo(params.days ?? 480),
      endDate: new Date().toISOString().slice(0, 10),
      dimensions: ["page"],
      rowLimit: params.rowLimit ?? 25000,
    },
  });

  return (res.data.rows || [])
    .map((row: any) => ({
      url: String(row.keys?.[0] || ""),
      clicks: row.clicks || 0,
      impressions: row.impressions || 0,
      ctr: row.ctr || 0,
      position: row.position || 0,
    }))
    .filter((p) => p.url.startsWith("http"));
}
