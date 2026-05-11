import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  ArrowLeft, Globe, Key, MapPin, CheckCircle2, RefreshCw,
  Upload, ExternalLink, Save, Loader2, AlertCircle, RotateCcw,
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

const FG      = "hsl(220 20% 16%)";
const CARD    = { background: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 90%)" };
const MUTED   = "hsl(220 12% 55%)";
const BLUE    = "hsl(217 80% 50%)";
const GREEN   = "hsl(142 60% 38%)";
const AMBER   = "hsl(38 85% 48%)";
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

function CampaignInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors"
      style={{ background: "hsl(220 20% 98%)", border: "1px solid hsl(220 16% 88%)", color: FG }}
      onFocus={(e) => (e.currentTarget.style.borderColor = "hsl(217 91% 60%)")}
      onBlur={(e) => (e.currentTarget.style.borderColor = "hsl(220 16% 88%)")}
    />
  );
}

function ActionBtn({
  onClick, disabled, loading, icon: Icon, label, accent = BLUE, variant = "outline",
}: {
  onClick: () => void; disabled?: boolean; loading?: boolean;
  icon: React.ElementType; label: string; accent?: string; variant?: "solid" | "outline";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity disabled:opacity-50"
      style={
        variant === "solid"
          ? { background: accent, color: "#fff" }
          : { background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }
      }
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
      {label}
    </button>
  );
}

interface Props {
  campaignId: string;
  clientSlug: string;
  onClose: () => void;
}

export default function CampaignDetailPanel({ campaignId, clientSlug, onClose }: Props) {
  const qc = useQueryClient();

  const { data: detail, isLoading, isError } = useQuery<CampaignDetail>({
    queryKey: ["campaign-detail", clientSlug, campaignId],
    queryFn: () => apiFetch<CampaignDetail>(`/api/campaigns/${clientSlug}/${campaignId}/detail`),
    enabled: !!(clientSlug && campaignId),
  });

  const [moneyPageUrl, setMoneyPageUrl] = useState<string | null>(null);
  const [focusKeyword, setFocusKeyword] = useState<string | null>(null);
  const [toast, setToast]               = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [deploying, setDeploying]       = useState(false);
  const [rebuildingMap, setRebuildingMap] = useState(false);
  const [gscUrl, setGscUrl]             = useState<string | null>(null);
  const [regenHubLoading, setRegenHubLoading] = useState(false);
  const [regenHubResult, setRegenHubResult]   = useState<{ liveUrl?: string; sitemapNote?: string; ftpError?: string | null } | null>(null);

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
      apiFetch<{ success: boolean }>(`/api/campaigns/${clientSlug}/${campaignId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ moneyPageUrl: currentMoneyUrl, focusKeyword: currentKeyword }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["campaign-detail", clientSlug, campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientSlug] });
      setMoneyPageUrl(null);
      setFocusKeyword(null);
      showToast("Settings saved");
    },
    onError: (e: Error) => showToast(e.message, "err"),
  });

  async function handleDeploy() {
    setDeploying(true);
    try {
      const r = await apiFetch<{ uploaded: string[]; failed: unknown[] }>("/api/pages/deploy", {
        method: "POST",
        body: JSON.stringify({ clientSlug }),
      });
      qc.invalidateQueries({ queryKey: ["campaigns", clientSlug] });
      showToast(`Deployed ${r.uploaded?.length ?? 0} pages`);
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Deploy failed", "err");
    } finally {
      setDeploying(false);
    }
  }

  async function handleRegenerateHub() {
    setRegenHubLoading(true);
    setRegenHubResult(null);
    try {
      const r = await apiFetch<{ success: boolean; liveUrl?: string; sitemapNote?: string; ftpError?: string | null }>(
        "/api/rollout/hub",
        {
          method: "POST",
          body: JSON.stringify({
            clientSlug,
            campaignId,
            moneyPageUrl: currentMoneyUrl || undefined,
            focusKeyword: currentKeyword  || undefined,
          }),
        }
      );
      setRegenHubResult({ liveUrl: r.liveUrl, sitemapNote: r.sitemapNote, ftpError: r.ftpError });
      qc.invalidateQueries({ queryKey: ["campaign-detail", clientSlug, campaignId] });
      qc.invalidateQueries({ queryKey: ["campaigns", clientSlug] });
      showToast("Hub page regenerated");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Hub regeneration failed", "err");
    } finally {
      setRegenHubLoading(false);
    }
  }

  async function handleRebuildSitemap() {
    if (!detail?.sitemapUrl) return;
    setRebuildingMap(true);
    try {
      await apiFetch("/api/sitemap/rebuild", {
        method: "POST",
        body: JSON.stringify({ clientSlug }),
      });
      const r = await apiFetch<{ gscUrl?: string }>("/api/search-console/submit-sitemap", {
        method: "POST",
        body: JSON.stringify({ projectSlug: clientSlug, sitemapUrl: detail.sitemapUrl, campaignId }),
      });
      if (r.gscUrl) setGscUrl(r.gscUrl);
      showToast("Sitemap rebuilt — open GSC to submit");
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : "Rebuild failed", "err");
    } finally {
      setRebuildingMap(false);
    }
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden" style={{ background: "hsl(0 0% 97%)" }}>
      <div className="flex items-center gap-3 px-6 py-4 shrink-0"
        style={{ borderBottom: `1px solid ${DIVIDER}`, background: "hsl(0 0% 100%)" }}>
        <a
          href="#"
          onClick={(e) => { e.preventDefault(); onClose(); }}
          className="flex items-center gap-1.5 text-xs font-medium"
          style={{ color: MUTED, textDecoration: "none" }}
        >
          <ArrowLeft size={14} /> Back
        </a>
        <span style={{ color: DIVIDER }}>|</span>
        <span className="text-sm font-semibold" style={{ color: FG }}>{detail?.serviceName ?? "Campaign Detail"}</span>
        {detail && <span className="text-xs" style={{ color: MUTED }}>{detail.city}</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={22} className="animate-spin" style={{ color: MUTED }} />
          </div>
        )}

        {isError && (
          <div className="flex items-center gap-2 rounded-xl px-5 py-4 text-sm"
            style={{ ...CARD, color: "hsl(0 72% 50%)" }}>
            <AlertCircle size={16} /> Could not load campaign details.
          </div>
        )}

        {detail && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Service", value: detail.serviceName },
                { label: "City",    value: detail.city },
                { label: "Pages",   value: `${detail.areasCount} area${detail.areasCount !== 1 ? "s" : ""}${detail.hubGenerated ? " + hub" : ""}` },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl px-4 py-3" style={CARD}>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: MUTED }}>{label}</div>
                  <div className="text-sm font-semibold" style={{ color: FG }}>{value}</div>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-5 space-y-4" style={CARD}>
              <h2 className="text-sm font-semibold mb-1" style={{ color: FG }}>Campaign Settings</h2>
              <div className="grid grid-cols-1 gap-4">
                <Field label="Money Page URL">
                  <div className="flex items-center gap-2">
                    <Globe size={13} style={{ color: MUTED, flexShrink: 0 }} />
                    <CampaignInput value={currentMoneyUrl} onChange={setMoneyPageUrl} placeholder="https://example.com/service-page/" />
                  </div>
                  <p className="text-[10px] mt-1.5" style={{ color: MUTED }}>
                    The root service hub page this campaign links back to.
                  </p>
                </Field>
                <Field label="Focus Keyword">
                  <div className="flex items-center gap-2">
                    <Key size={13} style={{ color: MUTED, flexShrink: 0 }} />
                    <CampaignInput value={currentKeyword} onChange={setFocusKeyword} placeholder="e.g. Local SEO Barnsley" />
                  </div>
                </Field>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <ActionBtn onClick={() => saveMutation.mutate()} disabled={!isDirty} loading={saveMutation.isPending} icon={Save} label="Save Settings" variant="solid" accent={BLUE} />
                {isDirty
                  ? <span className="text-[10px]" style={{ color: AMBER }}>Unsaved changes</span>
                  : <span className="text-[10px]" style={{ color: MUTED }}>No unsaved changes</span>
                }
              </div>
            </div>

            <div className="rounded-xl p-5 space-y-4" style={CARD}>
              <h2 className="text-sm font-semibold" style={{ color: FG }}>Actions</h2>
              <div className="flex flex-wrap gap-3">
                <ActionBtn onClick={handleRegenerateHub} loading={regenHubLoading} icon={RotateCcw} label={detail.hubGenerated ? "Regenerate Hub Page" : "Generate Hub Page"} accent={AMBER} variant="solid" />
                <ActionBtn onClick={handleDeploy} loading={deploying} icon={Upload} label="Redeploy All Pages via FTP" accent={GREEN} />
                <ActionBtn onClick={handleRebuildSitemap} loading={rebuildingMap} icon={RefreshCw} label="Rebuild Sitemap" accent={BLUE} />
                {gscUrl && (
                  <a href={gscUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                    style={{ background: `${AMBER}18`, color: AMBER, border: `1px solid ${AMBER}30` }}>
                    <ExternalLink size={14} /> Open GSC to Submit Sitemap
                  </a>
                )}
              </div>

              {regenHubResult && (
                <div className="rounded-lg px-4 py-3 text-xs space-y-1"
                  style={{ background: "hsl(142 40% 95%)", border: "1px solid hsl(142 40% 80%)", color: GREEN }}>
                  <div className="font-semibold">✓ Hub page regenerated and uploaded</div>
                  {regenHubResult.liveUrl && (
                    <a href={regenHubResult.liveUrl} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: BLUE }}>
                      {regenHubResult.liveUrl}
                    </a>
                  )}
                  {regenHubResult.sitemapNote && <div style={{ color: MUTED }}>📋 {regenHubResult.sitemapNote}</div>}
                  {regenHubResult.ftpError && <div style={{ color: AMBER }}>⚠ FTP: {regenHubResult.ftpError}</div>}
                </div>
              )}

              {detail.sitemapUrl && (
                <p className="text-[10px]" style={{ color: MUTED }}>
                  Sitemap: <span style={{ color: FG }}>{detail.sitemapUrl}</span>
                </p>
              )}
            </div>

            <div className="rounded-xl overflow-hidden" style={CARD}>
              <div className="px-5 py-3" style={{ borderBottom: `1px solid ${DIVIDER}` }}>
                <h2 className="text-sm font-semibold" style={{ color: FG }}>
                  Generated Pages ({detail.areasCount}{detail.hubGenerated ? " + hub" : ""})
                </h2>
              </div>
              <div className="divide-y" style={{ borderColor: DIVIDER }}>
                {detail.hubGenerated && detail.hubPath && (
                  <div className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={12} style={{ color: GREEN }} />
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
                  <div key={a.area} className="flex items-center justify-between px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <MapPin size={11} style={{ color: MUTED }} />
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

      {toast && (
        <div className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50"
          style={{
            background: toast.kind === "ok" ? "hsl(142 40% 95%)" : "hsl(0 40% 95%)",
            border: `1px solid ${toast.kind === "ok" ? "hsl(142 40% 80%)" : "hsl(0 40% 80%)"}`,
            color: toast.kind === "ok" ? GREEN : "hsl(0 72% 50%)",
          }}>
          {toast.kind === "ok" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
