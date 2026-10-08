import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { activatePharmacyWorkspace } from "@/lib/pharmacyWorkspaceClient";

type PortfolioRow = {
  rank: number;
  serviceId: string;
  deployServiceId: string;
  label: string;
  shortLabel: string;
  monthlySearchDemand: number;
  projectedAnnualRevenueGbp: number;
  revenuePerCaptureGbp: number;
  opportunityScore: number;
  deployed: boolean;
  deployable: boolean;
  action: "live" | "deploy" | "score-only";
};

type PortfolioPayload = {
  ok?: boolean;
  error?: string;
  pharmacyName?: string;
  locationName?: string;
  cached?: boolean;
  launchOrder?: Array<{ rank: number; serviceId: string; label: string; opportunityScore: number; deployed: boolean }>;
  nextUnbuilt?: Array<{ rank: number; serviceId: string; label: string; opportunityScore: number }>;
  services?: PortfolioRow[];
};

type FunnelRow = PortfolioRow & {
  visitors: number;
  bookings: number;
  monthlyRevenue: number;
  annualRevenue: number;
};

type SortKey =
  | "rank"
  | "label"
  | "monthlySearchDemand"
  | "visitors"
  | "bookings"
  | "revenuePerCaptureGbp"
  | "monthlyRevenue"
  | "annualRevenue"
  | "opportunityScore";

function gbp(value?: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: digits,
  }).format(value);
}

function count(value?: number | null, digits = 0): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-GB", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(value);
}

function projectRow(row: PortfolioRow, sharePct: number, bookingPct: number): FunnelRow {
  const visitors = row.monthlySearchDemand * (sharePct / 100);
  const bookings = visitors * (bookingPct / 100);
  const monthlyRevenue = bookings * (row.revenuePerCaptureGbp || 0);
  return {
    ...row,
    visitors,
    bookings,
    monthlyRevenue,
    annualRevenue: monthlyRevenue * 12,
  };
}

export function ClinicalServiceOpportunityMatrix({
  slug,
  marketSharePct = 5,
  bookingRatePct = 1.5,
}: {
  slug: string;
  marketSharePct?: number;
  bookingRatePct?: number;
}) {
  const [payload, setPayload] = useState<PortfolioPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("annualRevenue");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployMessage, setDeployMessage] = useState<string | null>(null);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    try {
      const query = force ? "?force=1" : "";
      const data = await apiFetch<PortfolioPayload>(
        `/api/growth-engine/${encodeURIComponent(slug)}/portfolio-opportunity${query}`,
      );
      if (data?.ok === false) throw new Error(data.error || "Portfolio opportunity failed");
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

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((dir) => (dir === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setSortDir(key === "label" ? "asc" : "desc");
    }
  }

  const rows = useMemo(() => {
    const list = (payload?.services || []).map((row) => projectRow(row, marketSharePct, bookingRatePct));
    list.sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const cmp =
        typeof left === "string" || typeof right === "string"
          ? String(left || "").localeCompare(String(right || ""), "en-GB")
          : Number(left || 0) - Number(right || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [payload?.services, marketSharePct, bookingRatePct, sortKey, sortDir]);

  async function deployService(row: PortfolioRow) {
    if (deploying) return;
    setDeploying(row.serviceId);
    setDeployMessage(null);
    try {
      const result = await apiFetch<{
        ok?: boolean;
        success?: boolean;
        duplicate?: boolean;
        error?: string;
        campaign?: { name?: string };
      }>(`/api/dashboard/${encodeURIComponent(slug)}/campaigns`, {
        method: "POST",
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          serviceId: row.deployServiceId,
          operatorConfirmed: true,
          initiationSource: "portfolio_opportunity_matrix",
        }),
      });
      if (result.duplicate) {
        setDeployMessage(`${row.shortLabel} already has a campaign. Opening Campaigns.`);
      } else {
        setDeployMessage(
          result.campaign?.name
            ? `${result.campaign.name} is ready on Campaigns.`
            : `${row.shortLabel} campaign record created.`,
        );
      }
      activatePharmacyWorkspace(slug, "campaigns", row.deployServiceId);
    } catch (err) {
      setDeployMessage(err instanceof Error ? err.message : "Could not deploy this service yet.");
    } finally {
      setDeploying(null);
    }
  }

  const header = (key: SortKey, label: string) => (
    <th className="px-3 py-2">
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className="font-bold uppercase tracking-wider text-slate-500 hover:text-slate-200"
      >
        {label}
        {sortKey === key ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
      </button>
    </th>
  );

  return (
    <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/70 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">Clinical Service Opportunity &amp; Priority Matrix</h3>
          <p className="mt-1 text-xs text-slate-500">
            Full clinical catalog for {payload?.locationName || "this catchment"}
            {` · ${marketSharePct}% local share × ${bookingRatePct.toFixed(1)}% booking`}
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load(true)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 disabled:opacity-60"
        >
          {loading ? "Loading…" : "Refresh portfolio"}
        </button>
      </div>
      {payload?.launchOrder?.length ? (
        <div className="mb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Top recommended launch order</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {payload.launchOrder.map((item) => (
              <span
                key={item.serviceId}
                className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-100"
              >
                #{item.rank} {item.label}
                {item.deployed ? <span className="ml-1 text-emerald-300">live</span> : null}
              </span>
            ))}
          </div>
          {payload.nextUnbuilt?.length ? (
            <p className="mt-2 text-xs text-slate-400">
              Next unbuilt: {payload.nextUnbuilt.map((item) => item.label).join(" → ")}
            </p>
          ) : null}
        </div>
      ) : null}
      {error && (
        <div className="mb-3 rounded-lg border border-rose-500/40 bg-rose-950/60 px-3 py-2 text-sm text-rose-200">{error}</div>
      )}
      {deployMessage && <p className="mb-3 text-xs text-slate-400">{deployMessage}</p>}
      {loading && !payload ? (
        <p className="text-sm text-slate-400">Scoring clinical services from local patient demand…</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-[11px]">
              <tr>
                {header("label", "Clinical Service")}
                {header("monthlySearchDemand", "Monthly Searches")}
                {header("visitors", "Catchment Visitors / mo")}
                {header("bookings", "Booked Patients / mo")}
                {header("revenuePerCaptureGbp", "Avg Treatment Value")}
                {header("monthlyRevenue", "Monthly Revenue")}
                {header("annualRevenue", "Annual Revenue")}
                <th className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">Priority / Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.serviceId} className="border-t border-slate-800">
                  <td className="px-3 py-2 text-slate-100">{row.label}</td>
                  <td className="px-3 py-2 tabular-nums">{count(row.monthlySearchDemand)}</td>
                  <td className="px-3 py-2 tabular-nums">{count(row.visitors, 1)}</td>
                  <td className="px-3 py-2 tabular-nums">{count(row.bookings, 1)}</td>
                  <td className="px-3 py-2 tabular-nums">{gbp(row.revenuePerCaptureGbp)}</td>
                  <td className="px-3 py-2 tabular-nums">{gbp(row.monthlyRevenue)}</td>
                  <td className="px-3 py-2 tabular-nums font-semibold text-white">{gbp(row.annualRevenue)}</td>
                  <td className="px-3 py-2">
                    {row.deployed ? (
                      <button
                        type="button"
                        onClick={() => activatePharmacyWorkspace(slug, "campaigns", row.deployServiceId)}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200"
                      >
                        Live
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={Boolean(deploying)}
                        onClick={() => void deployService(row)}
                        className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white disabled:opacity-60"
                      >
                        {deploying === row.serviceId ? "Deploying…" : "Deploy"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
