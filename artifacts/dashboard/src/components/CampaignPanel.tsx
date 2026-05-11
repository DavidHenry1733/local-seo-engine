import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  X, Globe, Key, MapPin, CheckCircle2, RefreshCw,
  Upload, ExternalLink, Save, Loader2, AlertCircle, RotateCcw,
  Zap, XCircle, CheckCheck, Clock,
} from "lucide-react";

interface CampaignDetail {
  campaignId: string;
  city: string;
  serviceName: string;
  serviceKey: string;
  moneyPageUrl: string;
  focusKeyword: string;
  stage: number;
  areasCount: number;
  areas: Array<{ area: string; remotePath: string; tier: string }>;
  hubGenerated: boolean;
  hubPath: string;
  domain: string;
  sitemapUrl: string;
}

interface RolloutEvent {
  type: string;
  area?: string;
  tier?: string;
  step?: string;
  status?: string;
  durationMs?: number;
  message?: string;
}

interface JobState {
  jobId: string;
  status: "running" | "done" | "error" | "cancelled";
  events: RolloutEvent[];
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

const FG     = "hsl(220 20% 16%)";
const CARD   = { background: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 90%)" };
const MUTED  = "hsl(220 12% 55%)";
const BLUE   = "hsl(217 80% 50%)";
const GREEN  = "hsl(142 60% 38%)";
const AMBER  = "hsl(38 85% 48%)";
const RED    = "hsl(0 72% 50%)";
const DIVIDER = "hsl(220 16% 92%)";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: MUTED }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function Inp({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
      style={{ background: "hsl(220 20% 98%)", border: "1px solid hsl(220 16% 88%)", color: FG }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "hsl(217 91% 60%)")}
      onBlur={(e)  => (e.currentTarget.style.borderColor = "hsl(220 16% 88%)")}
    />
  );
}

function Btn({
  onClick, disabled, loading, icon: Icon, label, accent = BLUE, solid = false,
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean;
  icon: React.ElementType; label: string; accent?: string; solid?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-50"
      style={solid
        ? { background: accent, color: "#fff" }
        : { background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}
    >
      {loading ? <Loader2 size={12} className="animate-spin" /> : <Icon size={12} />}
      {label}
    </button>
  );
}

function EventIcon({ status }: { status?: string }) {
  if (status === "success")  return <CheckCircle2 size={10} style={{ color: GREEN, flexShrink: 0 }} />;
  if (status === "failed")   return <XCircle      size={10} style={{ color: RED,   flexShrink: 0 }} />;
  if (status === "warning")  return <AlertCircle  size={10} style={{ color: AMBER, flexShrink: 0 }} />;
  if (status === "deferred") return <Clock        size={10} style={{ color: MUTED, flexShrink: 0 }} />;
  return <Loader2 size={10} className="animate-spin" style={{ color: BLUE, flexShrink: 0 }} />;
}

function RolloutProgress({ jobId, onDone }: { jobId: string; onDone: () => void }) {
  const doneRef = useRef(false);

  const { data: job } = useQuery<JobState>({
    queryKey: ["rollout-job", jobId],
    queryFn:  () => apiFetch<JobState>(`/api/rollout/status/${jobId}`),
    refetchInterval: (query) => {
      const d = query.state.data as JobState | undefined;
      if (d && d.status !== "running") return false;
      return 2000;
    },
  });

  useEffect(() => {
    if (job && job.status !== "running" && !doneRef.current) {
      doneRef.current = true;
      setTimeout(onDone, 1500);
    }
  }, [job, onDone]);

  const events = job?.events ?? [];
  const progressEvents = events.filter((e) => e.type === "progress");
  const succeeded = progressEvents.filter((e) => e.status === "success").length;
  const failed    = progressEvents.filter((e) => e.status === "failed").length;
  const recent    = [...progressEvents].slice(-5).reverse();
  const isDone    = job && job.status !== "running";

  return (
    <div className="rounded-lg p-3 space-y-2" style={{
      background: isDone && !failed ? "hsl(142 40% 96%)" : "hsl(220 20% 98%)",
      border: `1px solid ${isDone && !failed ? "hsl(142 40% 82%)" : "hsl(220 16% 88%)"}`,
    }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {isDone
            ? <CheckCheck size={12} style={{ color: GREEN }} />
            : <Loader2 size={12} className="animate-spin" style={{ color: BLUE }} />}
          <span className="text-[11px] font-semibold" style={{ color: FG }}>
            {isDone
              ? `Done — ${succeeded} page${succeeded !== 1 ? "s" : ""} regenerated${failed ? `, ${failed} failed` : ""}`
              : "Regenerating pages…"}
          </span>
        </div>
        {!isDone && (
          <span className="text-[10px]" style={{ color: MUTED }}>{succeeded} done</span>
        )}
      </div>

      <div className="space-y-1">
        {recent.map((ev, i) => (
          <div key={i} className="flex items-start gap-1.5">
            <EventIcon status={ev.status} />
            <div className="min-w-0">
              <span className="text-[10px] font-medium" style={{ color: FG }}>{ev.area ?? "—"}</span>
              {ev.step && <span className="text-[10px] ml-1" style={{ color: MUTED }}>{ev.step}</span>}
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-[10px]" style={{ color: MUTED }}>Starting up…</div>
        )}
      </div>

      {job?.error && <p className="text-[10px]" style={{ color: RED }}>Error: {job.error}</p>}
    </div>
  );
}

interface Props {
  campaignId: string;
  slug: string;
  onClose: () => void;
}

export default function CampaignPanel({ campaignId, slug, onClose }: Props) {
  const qc = useQueryClient();

  const { data: detail, isLoading, isError } = useQuery<CampaignDetail>({
    queryKey: ["campaign-detail", slug, campaignId],
    queryFn: () => apiFetch<CampaignDetail>(`/api/campaigns/${slug}/${campaignId}/detail`),
    enabled: !!(slug && campaignId),
  });

  const [moneyPageUrl, setMoneyPageUrl] = useState<string | null>(null);
  const [focusKeyword, setFocusKeyword] = useState<string | null>(null);
  const [toast, setToast]               = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [deploying, setDeploying]               = useState(false);
  const [rebuildingMap, setRebuildingMap]       = useState(false);
  const [gscUrl, setGscUrl]                     = useState<string | null>(null);
  const [regenLoading, setRegenLoading]         = useState(false);
  const [regenResult, setRegenResult]           = useState<{ liveUrl?: string; sitemapNote?: string; ftpError?: string | null } | null>(null);
  const [rolloutJobId, setRolloutJobId]         = useState<string | null>(null);
  const [rolling, setRolling]                   = useState(false);

  const currentMoneyUrl = moneyPageUrl ?? detail?.moneyPageUrl ?? "";
  const currentKeyword  = focusKeyword  ?? detail?.focusKeyword  ?? "";
  const isDirty =
    (moneyPageUrl !== null && moneyPageUrl !== detail?.moneyPageUrl) ||
    (focusKeyword  !== null && focusKeyword  !== detail?.focusKeyword);

  function showToast(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>(`/api/campaigns/${slug}/${campaignId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ moneyPageUrl: currentMoneyUrl, focusKeyword: currentKeyword }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-detail", slug, campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", slug] });
      setMoneyPageUrl(null);
      setFocusKeyword(null);
      showToast("Settings saved");
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  async function handleRollout() {
    setRolling(true);
    setRolloutJobId(null);
    try {
      const r = await apiFetch<{ jobId: string }>("/api/rollout", {
        method: "POST",
        body: JSON.stringify({ clientSlug: slug, campaignId }),
      });
      setRolloutJobId(r.jobId);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Rollout failed to start", "err");
      setRolling(false);
    }
  }

  function handleRolloutDone() {
    setRolling(false);
    qc.invalidateQueries({ queryKey: ["campaign-detail", slug, campaignId] });
    qc.invalidateQueries({ queryKey: ["campaigns", slug] });
    showToast("All pages regenerated and deployed");
  }

  async function handleDeploy() {
    setDeploying(true);
    try {
      const r = await apiFetch<{ uploaded: string[]; failed: unknown[] }>("/api/pages/deploy", {
        method: "POST",
        body: JSON.stringify({ clientSlug: slug }),
      });
      qc.invalidateQueries({ queryKey: ["campaigns", slug] });
      showToast(`Uploaded ${r.uploaded?.length ?? 0} pages via FTP`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Deploy failed", "err");
    } finally {
      setDeploying(false);
    }
  }

  async function handleRegenHub() {
    setRegenLoading(true);
    setRegenResult(null);
    try {
      const r = await apiFetch<{ success: boolean; liveUrl?: string; sitemapNote?: string; ftpError?: string | null }>(
        "/api/rollout/hub",
        {
          method: "POST",
          body: JSON.stringify({ clientSlug: slug, campaignId, moneyPageUrl: currentMoneyUrl || undefined, focusKeyword: currentKeyword || undefined }),
        },
      );
      setRegenResult({ liveUrl: r.liveUrl, sitemapNote: r.sitemapNote, ftpError: r.ftpError });
      qc.invalidateQueries({ queryKey: ["campaign-detail", slug, campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", slug] });
      showToast("Hub page regenerated");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Hub regen failed", "err");
    } finally {
      setRegenLoading(false);
    }
  }

  async function handleRebuildSitemap() {
    if (!detail?.sitemapUrl) return;
    setRebuildingMap(true);
    try {
      await apiFetch("/api/sitemap/rebuild", {
        method: "POST",
        body: JSON.stringify({ clientSlug: slug }),
      });
      const r = await apiFetch<{ gscUrl?: string }>("/api/search-console/submit-sitemap", {
        method: "POST",
        body: JSON.stringify({ projectSlug: slug, sitemapUrl: detail.sitemapUrl, campaignId }),
      });
      if (r.gscUrl) setGscUrl(r.gscUrl);
      showToast("Sitemap rebuilt");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Rebuild failed", "err");
    } finally {
      setRebuildingMap(false);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.30)", zIndex: 9000 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: "fixed",
          top: 0, right: 0, bottom: 0,
          width: "min(540px, 100vw)",
          background: "hsl(0 0% 98%)",
          borderLeft: "1px solid hsl(220 16% 88%)",
          zIndex: 9001,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "-4px 0 24px rgba(0,0,0,.08)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: `1px solid ${DIVIDER}`, flexShrink: 0, background: "hsl(0 0% 100%)" }}
        >
          <div>
            <div className="text-sm font-bold" style={{ color: FG }}>
              {isLoading ? "Loading…" : detail ? `${detail.city} — ${detail.serviceName}` : "Campaign Detail"}
            </div>
            {detail && (
              <div className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                Stage {detail.stage} of 8 · {detail.areasCount} cluster areas{detail.hubGenerated ? " · Hub ✓" : ""}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg"
            style={{ background: "hsl(220 14% 94%)", color: MUTED }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 space-y-4" style={{ overflowY: "auto" }}>
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={22} className="animate-spin" style={{ color: MUTED }} />
            </div>
          )}

          {isError && (
            <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
              style={{ ...CARD, color: RED }}>
              <AlertCircle size={16} /> Could not load campaign details. Check your session.
            </div>
          )}

          {detail && (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Service", value: detail.serviceName },
                  { label: "City",    value: detail.city },
                  { label: "Pages",   value: `${detail.areasCount} area${detail.areasCount !== 1 ? "s" : ""}${detail.hubGenerated ? " + hub" : ""}` },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl px-3 py-2.5" style={CARD}>
                    <div className="text-[9px] uppercase tracking-wider mb-1" style={{ color: MUTED }}>{label}</div>
                    <div className="text-xs font-semibold" style={{ color: FG }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Settings */}
              <div className="rounded-xl p-4 space-y-3" style={CARD}>
                <h2 className="text-xs font-semibold" style={{ color: FG }}>Campaign Settings</h2>
                <Field label="Money Page URL">
                  <div className="flex items-center gap-2">
                    <Globe size={12} style={{ color: MUTED, flexShrink: 0 }} />
                    <Inp value={currentMoneyUrl} onChange={setMoneyPageUrl} placeholder="https://example.com/service-page/" />
                  </div>
                </Field>
                <Field label="Focus Keyword">
                  <div className="flex items-center gap-2">
                    <Key size={12} style={{ color: MUTED, flexShrink: 0 }} />
                    <Inp value={currentKeyword} onChange={setFocusKeyword} placeholder="e.g. Local SEO Barnsley" />
                  </div>
                </Field>
                <div className="flex items-center gap-3 pt-1">
                  <Btn onClick={() => saveMutation.mutate()} disabled={!isDirty} loading={saveMutation.isPending} icon={Save} label="Save Settings" solid accent={BLUE} />
                  {isDirty  && <span className="text-[10px]" style={{ color: AMBER }}>Unsaved changes</span>}
                  {!isDirty && <span className="text-[10px]" style={{ color: MUTED }}>No unsaved changes</span>}
                </div>
              </div>

              {/* Actions */}
              <div className="rounded-xl p-4 space-y-3" style={CARD}>
                <div>
                  <h2 className="text-xs font-semibold" style={{ color: FG }}>Actions</h2>
                  <p className="text-[10px] mt-0.5" style={{ color: MUTED }}>
                    Regenerate rebuilds every page with the latest template and deploys in one step.
                  </p>
                </div>

                <Btn onClick={handleRollout} loading={rolling} disabled={rolling} icon={Zap} label="Regenerate & Deploy All Pages" accent={GREEN} solid />

                {rolloutJobId && (
                  <RolloutProgress jobId={rolloutJobId} onDone={handleRolloutDone} />
                )}

                <div className="pt-2" style={{ borderTop: `1px solid ${DIVIDER}` }}>
                  <p className="text-[9px] uppercase tracking-wider font-semibold mb-2" style={{ color: MUTED }}>Other actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Btn onClick={handleRegenHub} loading={regenLoading} icon={RotateCcw} label={detail.hubGenerated ? "Regenerate Hub" : "Generate Hub"} accent={AMBER} />
                    <Btn onClick={handleDeploy} loading={deploying} icon={Upload} label="Upload to FTP (no regen)" accent={BLUE} />
                    <Btn onClick={handleRebuildSitemap} loading={rebuildingMap} icon={RefreshCw} label="Rebuild Sitemap" accent={BLUE} />
                    {gscUrl && (
                      <a href={gscUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                        style={{ background: `${AMBER}18`, color: AMBER, border: `1px solid ${AMBER}30` }}>
                        <ExternalLink size={12} /> Open GSC
                      </a>
                    )}
                  </div>
                </div>

                {regenResult && (
                  <div className="rounded-lg px-3 py-2.5 text-xs space-y-1"
                    style={{ background: "hsl(142 40% 95%)", border: "1px solid hsl(142 40% 80%)", color: GREEN }}>
                    <div className="font-semibold">Hub regenerated</div>
                    {regenResult.liveUrl && (
                      <a href={regenResult.liveUrl} target="_blank" rel="noopener noreferrer" className="underline block" style={{ color: BLUE }}>
                        {regenResult.liveUrl}
                      </a>
                    )}
                    {regenResult.ftpError && <div style={{ color: AMBER }}>FTP: {regenResult.ftpError}</div>}
                  </div>
                )}

                {detail.sitemapUrl && (
                  <p className="text-[10px]" style={{ color: MUTED }}>
                    Sitemap: <span style={{ color: FG }}>{detail.sitemapUrl}</span>
                  </p>
                )}
              </div>

              {/* Pages */}
              <div className="rounded-xl overflow-hidden" style={CARD}>
                <div className="px-4 py-3" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
                  <h2 className="text-xs font-semibold" style={{ color: FG }}>
                    Generated Pages ({detail.areasCount}{detail.hubGenerated ? " + hub" : ""})
                  </h2>
                </div>
                <div className="divide-y" style={{ borderColor: DIVIDER }}>
                  {detail.hubGenerated && detail.hubPath && (
                    <div className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 size={11} style={{ color: GREEN }} />
                        <span className="text-xs font-medium" style={{ color: FG }}>{detail.city} Hub</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                          style={{ background: `${AMBER}18`, color: AMBER }}>hub</span>
                      </div>
                      {detail.domain && detail.hubPath && (
                        <a href={`${detail.domain}${detail.hubPath}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px]" style={{ color: BLUE }}>
                          View <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  )}
                  {detail.areas.map((a) => (
                    <div key={a.area} className="flex items-center justify-between px-4 py-2">
                      <div className="flex items-center gap-2">
                        <MapPin size={10} style={{ color: MUTED }} />
                        <span className="text-xs" style={{ color: FG }}>{a.area}</span>
                      </div>
                      {detail.domain && a.remotePath && (
                        <a href={`${detail.domain}${a.remotePath}`} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px]" style={{ color: MUTED }}>
                          {a.remotePath} <ExternalLink size={10} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Toast */}
        {toast && (
          <div
            className="absolute bottom-5 left-5 right-5 flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium shadow-lg"
            style={{
              background: toast.kind === "ok" ? "hsl(142 40% 95%)" : "hsl(0 40% 95%)",
              border: `1px solid ${toast.kind === "ok" ? "hsl(142 40% 80%)" : "hsl(0 40% 80%)"}`,
              color: toast.kind === "ok" ? GREEN : RED,
            }}
          >
            {toast.kind === "ok" ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            {toast.msg}
          </div>
        )}
      </div>
    </>
  );
}
