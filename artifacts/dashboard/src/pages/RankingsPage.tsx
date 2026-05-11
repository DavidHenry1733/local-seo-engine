import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import TopBar from "@/components/TopBar";
import { TrendingUp, TrendingDown, Minus, RefreshCw, Loader2, BarChart3 } from "lucide-react";
import { useState } from "react";

interface KeywordEntry {
  keyword: string;
  url: string;
  position: number | null;
  previousPosition: number | null;
  lastCheckedAt: string | null;
  isHub?: boolean;
}

interface KeywordReport {
  checkedAt: string;
  keywords: KeywordEntry[];
  summary: { tracked: number; top3: number; top10: number; top100: number };
}

interface KtResponse {
  report: KeywordReport | null;
  availableTargets: number;
}

function PositionBadge({ pos, prev }: { pos: number | null; prev: number | null }) {
  if (pos === null) return <span className="text-xs" style={{ color: "hsl(220 12% 60%)" }}>—</span>;
  const diff = prev !== null ? prev - pos : null;
  const color = pos <= 3 ? "hsl(142 71% 55%)" : pos <= 10 ? "hsl(217 91% 65%)" : pos <= 20 ? "hsl(38 92% 60%)" : "hsl(215 22% 60%)";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm font-bold" style={{ color }}>#{pos}</span>
      {diff !== null && diff !== 0 && (
        <span className="flex items-center text-[10px]" style={{ color: diff > 0 ? "hsl(142 71% 55%)" : "hsl(0 72% 55%)" }}>
          {diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
          {Math.abs(diff)}
        </span>
      )}
      {diff === 0 && <Minus size={9} style={{ color: "hsl(220 12% 60%)" }} />}
    </div>
  );
}

export default function RankingsPage() {
  const { selectedSlug } = useProject();
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<KtResponse>({
    queryKey: ["keyword-tracking", selectedSlug],
    queryFn: () =>
      apiFetch<KtResponse>(`/api/keyword-tracking?projectSlug=${encodeURIComponent(selectedSlug)}`),
    enabled: !!selectedSlug,
    staleTime: 30_000,
  });

  const { data: jobData } = useQuery({
    queryKey: ["kt-job", jobId],
    queryFn: () => apiFetch(`/api/keyword-tracking/job/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (d) => {
      const status = (d?.state?.data as { status?: string })?.status;
      return status === "running" ? 2000 : false;
    },
  });

  const runMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/keyword-tracking/run", {
        method: "POST",
        body: JSON.stringify({ projectSlug: selectedSlug }),
      }),
    onSuccess: (d: { jobId?: string }) => {
      if (d.jobId) setJobId(d.jobId);
    },
  });

  const jobStatus = (jobData as { status?: string; progress?: { done: number; total: number; current: string } } | undefined);
  const isRunning = jobStatus?.status === "running" || runMutation.isPending;
  if (jobStatus?.status === "done" && jobId) {
    setJobId(null);
    void qc.invalidateQueries({ queryKey: ["keyword-tracking", selectedSlug] });
  }

  const report = data?.report;
  const keywords = report?.keywords ?? [];
  const summary = report?.summary;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Rankings" subtitle="Google keyword position tracking" />

      <div className="flex-1 overflow-y-auto p-6">
        {!selectedSlug ? (
          <div className="text-center pt-24 text-sm" style={{ color: "hsl(220 12% 58%)" }}>Select a project above.</div>
        ) : (
          <>
            {/* Summary */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex gap-4">
                {summary && (
                  <>
                    {[
                      { label: "Tracked",  val: summary.tracked,  color: "hsl(220 12% 60%)" },
                      { label: "Top 3",    val: summary.top3,     color: "hsl(142 71% 55%)" },
                      { label: "Top 10",   val: summary.top10,    color: "hsl(217 80% 50%)" },
                      { label: "Top 100",  val: summary.top100,   color: "hsl(38 92% 60%)" },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <div className="text-xl font-bold" style={{ color: s.color }}>{s.val}</div>
                        <div className="text-[10px]" style={{ color: "hsl(220 12% 58%)" }}>{s.label}</div>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <button
                onClick={() => runMutation.mutate()}
                disabled={isRunning}
                className="flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                style={{ background: "hsl(217 91% 60%)", color: "#fff" }}
              >
                {isRunning ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    {jobStatus?.progress ? `${jobStatus.progress.done}/${jobStatus.progress.total}` : "Running…"}
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    Run Check ({data?.availableTargets ?? 0} keywords)
                  </>
                )}
              </button>
            </div>

            {/* Table */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 90%)" }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="animate-spin" style={{ color: "hsl(220 12% 60%)" }} />
                </div>
              ) : keywords.length === 0 ? (
                <div className="flex flex-col items-center py-16 text-center">
                  <BarChart3 size={30} className="mb-3" style={{ color: "hsl(220 12% 72%)" }} />
                  <p className="text-sm" style={{ color: "hsl(220 12% 55%)" }}>
                    {report ? "No keywords tracked yet" : "No ranking data — click Run Check to start"}
                  </p>
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr style={{ borderBottom: "1px solid hsl(220 16% 92%)" }}>
                      {["Keyword", "URL", "Position", "Change", "Last Checked"].map((h) => (
                        <th
                          key={h}
                          className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-wider"
                          style={{ color: "hsl(220 12% 60%)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {keywords.map((kw, i) => (
                      <tr
                        key={i}
                        style={{ borderBottom: i < keywords.length - 1 ? "1px solid hsl(220 16% 92%)" : "none" }}
                      >
                        <td className="px-5 py-3">
                          <span className="text-xs font-medium" style={{ color: "hsl(220 20% 16%)" }}>{kw.keyword}</span>
                          {kw.isHub && (
                            <span className="ml-2 text-[9px] px-1.5 py-0.5 rounded font-bold"
                              style={{ background: "hsl(280 65% 60% / 0.15)", color: "hsl(280 65% 70%)" }}>HUB</span>
                          )}
                        </td>
                        <td className="px-5 py-3 max-w-52">
                          <a href={kw.url} target="_blank" rel="noreferrer"
                            className="text-[11px] truncate block hover:underline"
                            style={{ color: "hsl(217 80% 50%)" }}
                          >
                            {kw.url.replace(/^https?:\/\//, "")}
                          </a>
                        </td>
                        <td className="px-5 py-3">
                          <PositionBadge pos={kw.position} prev={null} />
                        </td>
                        <td className="px-5 py-3">
                          {kw.previousPosition !== null && kw.position !== null ? (
                            <PositionBadge pos={kw.position} prev={kw.previousPosition} />
                          ) : (
                            <span className="text-xs" style={{ color: "hsl(220 12% 65%)" }}>—</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-[11px]" style={{ color: "hsl(220 12% 60%)" }}>
                          {kw.lastCheckedAt ? new Date(kw.lastCheckedAt).toLocaleDateString() : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {report?.checkedAt && (
              <p className="text-[10px] mt-3" style={{ color: "hsl(220 12% 65%)" }}>
                Last checked: {new Date(report.checkedAt).toLocaleString()}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
