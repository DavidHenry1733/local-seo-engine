import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import TopBar from "@/components/TopBar";
import {
  ArrowLeft, Globe, Key, MapPin, CheckCircle2, RefreshCw,
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

const FG    = "hsl(220 20% 16%)";
const CARD  = { background: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 90%)" };
const MUTED = "hsl(220 12% 55%)";
const BLUE  = "hsl(217 80% 50%)";
const GREEN = "hsl(142 60% 38%)";
const AMBER = "hsl(38 85% 48%)";
const RED   = "hsl(0 72% 50%)";
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

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
      style={{
        background: "hsl(220 20% 98%)",
        border: "1px solid hsl(220 16% 88%)",
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = BLUE)}
      onBlur={(e) => (e.currentTarget.style.borderColor = "hsl(220 16% 88%)")}
    />
  );
}

function ActionButton({
  onClick, disabled, loading, icon: Icon, label, accent = BLUE, variant = "outline",
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean;
  icon: React.ElementType; label: string; accent?: string; variant?: "solid" | "outline";
}) {
  const isSolid = variant === "solid";
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
      style={
        isSolid
          ? { background: accent, color: "#fff" }
          : { background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }
      }
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {label}
    </button>
  );
}

function EventIcon({ status }: { status?: string }) {
  if (status === "success") return <CheckCircle2 size={11} style={{ color: GREEN, flexShrink: 0 }} />;
  if (status === "failed")  return <XCircle      size={11} style={{ color: RED,   flexShrink: 0 }} />;
  if (status === "warning") return <AlertCircle  size={11} style={{ color: AMBER, flexShrink: 0 }} />;
  if (status === "deferred") return <Clock       size={11} style={{ color: MUTED, flexShrink: 0 }} />;
  return <Loader2 size={11} className="animate-spin" style={{ color: BLUE, flexShrink: 0 }} />;
}

function RolloutProgress({ jobId, slug, onDone }: { jobId: string; slug: string; onDone: () => void }) {
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
  const recent    = [...progressEvents].slice(-6).reverse();
  const isDone    = job && job.status !== "running";

  return (
    <div className="rounded-xl p-4 space-y-3" style={{ background: isDone && !failed ? "hsl(142 40% 95%)" : "hsl(220 20% 98%)", border: `1px solid ${isDone && !failed ? "hsl(142 40% 82%)" : "hsl(220 16% 88%)"}` }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isDone
            ? <CheckCheck size={14} style={{ color: GREEN }} />
            : <Loader2 size={14} className="animate-spin" style={{ color: BLUE }} />}
          <span className="text-xs font-semibold" style={{ color: "hsl(220 20% 16%)" }}>
            {isDone
              ? `Done — ${succeeded} page${succeeded !== 1 ? "s" : ""} regenerated${failed ? `, ${failed} failed` : ""}`
              : "Regenerating pages…"}
          </span>
        </div>
        {!isDone && (
          <span className="text-[10px]" style={{ color: MUTED }}>{succeeded} done{failed ? `, ${failed} failed` : ""}</span>
        )}
      </div>

      <div className="space-y-1">
        {recent.map((ev, i) => (
          <div key={i} className="flex items-start gap-2">
            <EventIcon status={ev.status} />
            <div className="min-w-0">
              <span className="text-[11px] text-white font-medium">{ev.area ?? "—"}</span>
              {ev.step && <span className="text-[11px] ml-1.5" style={{ color: MUTED }}>{ev.step}</span>}
            </div>
          </div>
        ))}
        {events.length === 0 && (
          <div className="text-[11px]" style={{ color: MUTED }}>Starting up…</div>
        )}
      </div>

      {job?.error && (
        <p className="text-[11px]" style={{ color: RED }}>Error: {job.error}</p>
      )}
    </div>
  );
}

export default function CampaignDetailPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { selectedSlug } = useProject();
  const qc = useQueryClient();

  const { data: detail, isLoading, isError } = useQuery<CampaignDetail>({
    queryKey: ["campaign-detail", selectedSlug, campaignId],
    queryFn: () => apiFetch<CampaignDetail>(`/api/campaigns/${selectedSlug}/${campaignId}/detail`),
    enabled: !!(selectedSlug && campaignId),
  });

  const [moneyPageUrl, setMoneyPageUrl]   = useState<string | null>(null);
  const [focusKeyword, setFocusKeyword]   = useState<string | null>(null);
  const [toast, setToast]                 = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [deploying, setDeploying]                 = useState(false);
  const [rebuildingMap, setRebuildingMap]         = useState(false);
  const [gscUrl, setGscUrl]                       = useState<string | null>(null);
  const [regenHubLoading, setRegenHubLoading]     = useState(false);
  const [regenHubResult, setRegenHubResult]       = useState<{ liveUrl?: string; sitemapNote?: string; ftpError?: string | null } | null>(null);
  const [rolloutJobId, setRolloutJobId]           = useState<string | null>(null);
  const [rolling, setRolling]                     = useState(false);

  const currentMoneyUrl = moneyPageUrl ?? detail?.moneyPageUrl ?? "";
  const currentKeyword  = focusKeyword ?? detail?.focusKeyword  ?? "";

  const isDirty =
    (moneyPageUrl !== null && moneyPageUrl !== detail?.moneyPageUrl) ||
    (focusKeyword !== null && focusKeyword !== detail?.focusKeyword);

  function showToast(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 4000);
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>(`/api/campaigns/${selectedSlug}/${campaignId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ moneyPageUrl: currentMoneyUrl, focusKeyword: currentKeyword }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-detail", selectedSlug, campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", selectedSlug] });
      setMoneyPageUrl(null);
      setFocusKeyword(null);
      showToast("Settings saved");
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  async function handleRollout() {
    if (!selectedSlug || !campaignId) return;
    setRolling(true);
    setRolloutJobId(null);
    try {
      const r = await apiFetch<{ jobId: string }>("/api/rollout", {
        method: "POST",
        body: JSON.stringify({ clientSlug: selectedSlug, campaignId }),
      });
      setRolloutJobId(r.jobId);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Rollout failed to start", "err");
      setRolling(false);
    }
  }

  function handleRolloutDone() {
    setRolling(false);
    qc.invalidateQueries({ queryKey: ["campaign-detail", selectedSlug, campaignId] });
    qc.invalidateQueries({ queryKey: ["campaigns", selectedSlug] });
    showToast("All pages regenerated and deployed");
  }

  async function handleDeploy() {
    if (!selectedSlug) return;
    setDeploying(true);
    try {
      const r = await apiFetch<{ uploaded: string[]; failed: unknown[] }>("/api/pages/deploy", {
        method: "POST",
        body: JSON.stringify({ clientSlug: selectedSlug }),
      });
      qc.invalidateQueries({ queryKey: ["campaigns", selectedSlug] });
      showToast(`Uploaded ${r.uploaded?.length ?? 0} pages via FTP`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Deploy failed", "err");
    } finally {
      setDeploying(false);
    }
  }

  async function handleRegenerateHub() {
    if (!selectedSlug || !campaignId) return;
    setRegenHubLoading(true);
    setRegenHubResult(null);
    try {
      const r = await apiFetch<{ success: boolean; liveUrl?: string; sitemapNote?: string; ftpError?: string | null }>(
        "/api/rollout/hub",
        {
          method: "POST",
          body: JSON.stringify({
            clientSlug:    selectedSlug,
            campaignId,
            moneyPageUrl:  currentMoneyUrl || undefined,
            focusKeyword:  currentKeyword  || undefined,
          }),
        }
      );
      setRegenHubResult({ liveUrl: r.liveUrl, sitemapNote: r.sitemapNote, ftpError: r.ftpError });
      qc.invalidateQueries({ queryKey: ["campaign-detail", selectedSlug, campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", selectedSlug] });
      showToast("Hub page regenerated");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Hub regeneration failed", "err");
    } finally {
      setRegenHubLoading(false);
    }
  }

  async function handleRebuildSitemap() {
    if (!selectedSlug || !detail?.sitemapUrl) return;
    setRebuildingMap(true);
    try {
      await apiFetch("/api/sitemap/rebuild", {
        method: "POST",
        body: JSON.stringify({ clientSlug: selectedSlug }),
      });
      const r = await apiFetch<{ gscUrl?: string }>("/api/search-console/submit-sitemap", {
        method: "POST",
        body: JSON.stringify({
          projectSlug: selectedSlug,
          sitemapUrl:  detail.sitemapUrl,
          campaignId,
        }),
      });
      if (r.gscUrl) setGscUrl(r.gscUrl);
      showToast("Sitemap rebuilt — open GSC to submit");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Rebuild failed", "err");
    } finally {
      setRebuildingMap(false);
    }
  }

  if (!selectedSlug) {
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar title="Campaign Detail" />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: MUTED }}>Select a project first</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Campaign Detail" subtitle={detail?.serviceName ?? "Loading…"} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        <a
          href={import.meta.env.BASE_URL}
          className="inline-flex items-center gap-1.5 text-xs font-medium"
          style={{ color: MUTED, textDecoration: "none" }}
        >
          <ArrowLeft size={12} /> Back to Dashboard
        </a>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin" style={{ color: MUTED }} />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 rounded-xl px-5 py-4 text-sm" style={{ ...CARD, color: RED }}>
            <AlertCircle size={16} /> Could not load campaign details.
          </div>
        )}

        {detail && (
          <>
            {/* Info row */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Service",   value: detail.serviceName },
                { label: "City",      value: detail.city },
                { label: "Pages",     value: `${detail.areasCount} area${detail.areasCount !== 1 ? "s" : ""}${detail.hubGenerated ? " + hub" : ""}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl px-4 py-3" style={CARD}>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: MUTED }}>{label}</div>
                  <div className="text-sm font-semibold" style={{ color: "hsl(220 20% 16%)" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Editable settings */}
            <div className="rounded-xl p-5 space-y-4" style={CARD}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: "hsl(220 20% 16%)" }}>Campaign Settings</h2>

              <div className="grid grid-cols-1 gap-4">
                <Field label="Money Page URL">
                  <div className="flex items-center gap-2">
                    <Globe size={13} style={{ color: MUTED, flexShrink: 0 }} />
                    <Input
                      value={currentMoneyUrl}
                      onChange={setMoneyPageUrl}
                      placeholder="https://example.com/service-page/"
                    />
                  </div>
                  <p className="text-[10px] mt-1.5" style={{ color: MUTED }}>
                    The root service hub page this campaign links back to.
                  </p>
                </Field>

                <Field label="Focus Keyword">
                  <div className="flex items-center gap-2">
                    <Key size={13} style={{ color: MUTED, flexShrink: 0 }} />
                    <Input
                      value={currentKeyword}
                      onChange={setFocusKeyword}
                      placeholder="e.g. Local SEO Barnsley"
                    />
                  </div>
                </Field>
              </div>

              <div className="flex items-center gap-3 pt-1">
                <ActionButton
                  onClick={() => saveMutation.mutate()}
                  disabled={!isDirty}
                  loading={saveMutation.isPending}
                  icon={Save}
                  label="Save Settings"
                  variant="solid"
                  accent={BLUE}
                />
                {!isDirty && <span className="text-[10px]" style={{ color: MUTED }}>No unsaved changes</span>}
                {isDirty  && <span className="text-[10px]" style={{ color: AMBER }}>Unsaved changes</span>}
              </div>
            </div>

            {/* Actions */}
            <div className="rounded-xl p-5 space-y-4" style={CARD}>
              <div>
                <h2 className="text-sm font-semibold" style={{ color: "hsl(220 20% 16%)" }}>Actions</h2>
                <p className="text-[11px] mt-0.5" style={{ color: MUTED }}>
                  Use <strong style={{ color: "hsl(220 20% 16%)" }}>Regenerate & Deploy All Pages</strong> to rebuild every page with the latest template and push to your live site in one step.
                </p>
              </div>

              {/* Primary: regenerate + deploy */}
              <ActionButton
                onClick={handleRollout}
                loading={rolling}
                disabled={rolling}
                icon={Zap}
                label="Regenerate & Deploy All Pages"
                accent={GREEN}
                variant="solid"
              />

              {/* Live progress */}
              {rolloutJobId && (
                <RolloutProgress
                  jobId={rolloutJobId}
                  slug={selectedSlug}
                  onDone={handleRolloutDone}
                />
              )}

              {/* Secondary actions */}
              <div className="pt-1" style={{ borderTop: "1px solid hsl(220 16% 92%)" }}>
                <p className="text-[10px] mb-2.5 font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Other actions</p>
                <div className="flex flex-wrap gap-3">
                  <ActionButton
                    onClick={handleRegenerateHub}
                    loading={regenHubLoading}
                    icon={RotateCcw}
                    label={detail.hubGenerated ? "Regenerate Hub Page" : "Generate Hub Page"}
                    accent={AMBER}
                  />
                  <ActionButton
                    onClick={handleDeploy}
                    loading={deploying}
                    icon={Upload}
                    label="Upload to FTP (no regen)"
                    accent={BLUE}
                  />
                  <ActionButton
                    onClick={handleRebuildSitemap}
                    loading={rebuildingMap}
                    icon={RefreshCw}
                    label="Rebuild Sitemap"
                    accent={BLUE}
                  />
                  {gscUrl && (
                    <a
                      href={gscUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                      style={{ background: `${AMBER}18`, color: AMBER, border: `1px solid ${AMBER}30` }}
                    >
                      <ExternalLink size={14} /> Open GSC to Submit Sitemap
                    </a>
                  )}
                </div>
              </div>

              {regenHubResult && (
                <div className="rounded-lg px-4 py-3 text-xs space-y-1"
                  style={{ background: "hsl(142 60% 9%)", border: "1px solid hsl(142 60% 18%)", color: GREEN }}>
                  <div className="font-semibold">Hub page regenerated</div>
                  {regenHubResult.liveUrl && (
                    <div>
                      <a href={regenHubResult.liveUrl} target="_blank" rel="noopener noreferrer"
                        className="underline" style={{ color: BLUE }}>
                        {regenHubResult.liveUrl}
                      </a>
                    </div>
                  )}
                  {regenHubResult.sitemapNote && <div style={{ color: MUTED }}>📋 {regenHubResult.sitemapNote}</div>}
                  {regenHubResult.ftpError    && <div style={{ color: AMBER }}>FTP: {regenHubResult.ftpError}</div>}
                </div>
              )}

              {detail.sitemapUrl && (
                <p className="text-[10px]" style={{ color: MUTED }}>
                  Sitemap: <span style={{ color: "hsl(220 20% 16%)" }}>{detail.sitemapUrl}</span>
                </p>
              )}
            </div>

            {/* Areas list */}
            <div className="rounded-xl overflow-hidden" style={CARD}>
              <div className="px-5 py-3" style={{ borderBottom: "1px solid hsl(220 16% 92%)" }}>
                <h2 className="text-sm font-semibold" style={{ color: "hsl(220 20% 16%)" }}>
                  Generated Pages ({detail.areasCount}{detail.hubGenerated ? " + hub" : ""})
                </h2>
              </div>
              <div className="divide-y" style={{ borderColor: "hsl(220 16% 92%)" }}>
                {detail.hubGenerated && detail.hubPath && (
                  <div className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={12} style={{ color: GREEN }} />
                      <span className="text-xs font-medium" style={{ color: "hsl(220 20% 16%)" }}>{detail.city} Hub</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wide"
                        style={{ background: `${AMBER}20`, color: AMBER }}>hub</span>
                    </div>
                    {detail.domain && detail.hubPath && (
                      <a
                        href={`${detail.domain}${detail.hubPath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px]"
                        style={{ color: BLUE }}
                      >
                        View <ExternalLink size={10} />
                      </a>
                    )}
                  </div>
                )}
                {detail.areas.map((a) => (
                  <div key={a.area} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <MapPin size={11} style={{ color: MUTED }} />
                      <span className="text-xs" style={{ color: "hsl(220 20% 16%)" }}>{a.area}</span>
                    </div>
                    {detail.domain && a.remotePath && (
                      <a
                        href={`${detail.domain}${a.remotePath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px]"
                        style={{ color: MUTED }}
                      >
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
          className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-xl"
          style={{
            background: toast.kind === "ok" ? "hsl(142 60% 18%)" : "hsl(0 60% 18%)",
            border: `1px solid ${toast.kind === "ok" ? "hsl(142 60% 28%)" : "hsl(0 60% 28%)"}`,
            color: toast.kind === "ok" ? GREEN : RED,
          }}
        >
          {toast.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
