import React, { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type LandscapeRow = {
  competitor: string;
  serviceId: string;
  serviceLabel: string;
  keyword: string;
  rankingPosition: number;
  rankingSource: "google-maps" | "google-organic";
  googleReviews: number | null;
  starRating: number | null;
  threatLevel: "High" | "Medium" | "Low";
  displacementOpportunity: string;
};

type ContentGapRow = {
  title: string;
  url: string;
  domain: string;
  rankGroup: number;
  contentTypeLabel: "Generic Homepage" | "Thin Service Summary" | "Dedicated Page";
  catchmentPagesLabel: string;
};

type ContentGapQuery = {
  keyword: string;
  serviceLabel: string;
  vulnerabilityLine: string;
  rows: ContentGapRow[];
};

type CompetitorRadarPayload = {
  ok?: boolean;
  error?: string;
  pharmacyName?: string;
  locationName?: string;
  capturedAt?: string;
  cached?: boolean;
  catchments?: string[];
  landscape?: LandscapeRow[];
  queries?: Array<{ keyword: string; label: string }>;
  contentGap?: {
    pharmacyCatchmentPageCount?: number;
    queries?: ContentGapQuery[];
    overall?: { lackingClusterPct?: number; takeaway?: string };
  };
};

function count(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(value);
}

function threatClass(level: LandscapeRow["threatLevel"]): string {
  if (level === "High") return "border-rose-500/30 bg-rose-500/10 text-rose-100";
  if (level === "Medium") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-slate-600 bg-slate-800 text-slate-200";
}

function typeClass(label: ContentGapRow["contentTypeLabel"]): string {
  if (label === "Dedicated Page") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (label === "Thin Service Summary") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-slate-600 bg-slate-800 text-slate-200";
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "");
}

export function LocalCompetitorLandscape({ slug }: { slug: string }) {
  const [payload, setPayload] = useState<CompetitorRadarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const query = force ? "?force=1" : "";
      const data = await apiFetch<CompetitorRadarPayload>(
        `/api/growth-engine/${encodeURIComponent(slug)}/competitor-radar${query}`,
      );
      if (data?.ok === false) throw new Error(data.error || "Competitor radar failed");
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(false);
  }, [slug]);

  const rows = payload?.landscape || [];
  const gap = payload?.contentGap;
  const groups = rows.reduce<Record<string, LandscapeRow[]>>((acc, row) => {
    const key = row.serviceLabel || row.keyword;
    acc[key] = acc[key] || [];
    acc[key].push(row);
    return acc;
  }, {});

  return (
    <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Local Competitor Landscape</h3>
          <p className="mt-1 text-xs text-slate-500">
            Local Google listings · top operators per clinical search
            {payload?.locationName ? ` · ${payload.locationName}` : ""}
            {payload?.cached ? " · cached" : ""}
            {payload?.catchments?.length ? ` · ${payload.catchments.length} catchments` : ""}
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-60"
        >
          {loading ? "Loading…" : "Refresh SERP"}
        </button>
      </div>
      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">{error}</div>
      )}
      {loading && !payload ? (
        <p className="text-sm text-slate-400">Checking who currently appears when local patients search…</p>
      ) : !rows.length ? (
        <p className="text-sm text-slate-400">No measured competitor listings yet. Refresh SERP to collect live ranks.</p>
      ) : (
        Object.entries(groups).map(([label, group]) => (
          <div key={label} className="mb-4 last:mb-0">
            <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              {label}
              {group[0]?.keyword ? ` · “${group[0].keyword}”` : ""}
            </div>
            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[880px] text-left text-xs text-slate-300">
                <thead className="bg-slate-900 text-[11px]">
                  <tr>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500">Competitor</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500">Ranking position</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500">Google reviews</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500">Star rating</th>
                    <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500">Threat level / displacement opportunity</th>
                  </tr>
                </thead>
                <tbody>
                  {group.map((row) => (
                    <tr key={`${row.keyword}-${row.competitor}-${row.rankingPosition}`} className="border-t border-slate-800">
                      <td className="px-3 py-2 text-slate-100">{row.competitor}</td>
                      <td className="px-3 py-2">#{row.rankingPosition}</td>
                      <td className="px-3 py-2">{count(row.googleReviews)}</td>
                      <td className="px-3 py-2">{row.starRating == null ? "—" : row.starRating.toFixed(1)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${threatClass(row.threatLevel)}`}>
                          {row.threatLevel}
                        </span>
                        <span className="ml-2 text-slate-400">{row.displacementOpportunity}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
      {gap?.queries?.length ? (
        <div className="mt-6 border-t border-slate-800 pt-5">
          <h3 className="text-base font-semibold text-white">Competitor Vulnerability &amp; Content Gap</h3>
          <p className="mt-1 text-xs text-slate-500">
            What current ranking pages actually are — homepage, thin summary, or a real local service page.
          </p>
          {gap.overall?.takeaway ? (
            <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm leading-relaxed text-emerald-50">
              {gap.overall.takeaway}
            </div>
          ) : null}
          {gap.queries.map((query) => (
            <div key={query.keyword} className="mt-4">
              <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                {query.serviceLabel}
                {query.keyword ? ` · “${query.keyword}”` : ""}
              </div>
              {query.vulnerabilityLine ? (
                <p className="mb-2 text-xs text-amber-200">{query.vulnerabilityLine}</p>
              ) : null}
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full min-w-[720px] text-left text-xs text-slate-300">
                  <thead className="bg-slate-900 text-[11px]">
                    <tr>
                      <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500">Competitor URL &amp; Rank</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500">Content Type Detected</th>
                      <th className="px-3 py-2 font-bold uppercase tracking-wider text-slate-500">Neighborhood Catchment Pages</th>
                    </tr>
                  </thead>
                  <tbody>
                    {query.rows.map((row) => (
                      <tr key={`${query.keyword}-${row.rankGroup}-${row.url}`} className="border-t border-slate-800">
                        <td className="px-3 py-2">
                          <div className="font-semibold text-slate-100">#{row.rankGroup} · {row.domain}</div>
                          <a
                            href={row.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-0.5 block break-all text-[11px] text-slate-500 no-underline hover:text-sky-300"
                          >
                            {shortUrl(row.url)}
                          </a>
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${typeClass(row.contentTypeLabel)}`}>
                            {row.contentTypeLabel}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-300">{row.catchmentPagesLabel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
