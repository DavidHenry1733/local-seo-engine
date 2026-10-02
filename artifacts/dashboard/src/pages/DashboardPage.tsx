import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiFetch } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import TopBar from "@/components/TopBar";
import CampaignPanel from "@/components/CampaignPanel";
import {
  FileText, Rocket, BarChart3, TrendingUp, Plus, Loader2,
} from "lucide-react";

interface Campaign {
  id: string;
  city: string;
  serviceName: string;
  status: "new" | "in_progress" | "generated" | "deployed";
  currentStage: number;
  pagesGenerated: number;
  pagesDeployed: number;
  areasSelected: number;
  updatedAt: string;
  focusKeyword?: string;
  moneyPageUrl?: string;
}

interface CampaignsResponse {
  campaigns: Campaign[];
}

interface CompetitorMatrixRow {
  name: string;
  reviewCount: number;
  rating: number;
  address: string;
}

interface LocalClusterDraft {
  suburbName?: string;
  slug?: string;
  status?: string;
  clinicalPathway?: string;
  previewBodyHtml?: string;
}

interface TenantDashboardResponse {
  competitorsMatrix?: CompetitorMatrixRow[];
  localClusterPages?: LocalClusterDraft[];
}

const CLINICAL_DRAFTS = [
  { id: "uti", label: "UTIs", pattern: /uti|urinary tract/i },
  { id: "shingles", label: "Shingles", pattern: /shingles/i },
  { id: "sinusitis", label: "Sinusitis", pattern: /sinusitis/i },
] as const;

function draftPlainText(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function LocalCatchmentOptimizer({ tenantSlug }: { tenantSlug: string }) {
  const [pathwayId, setPathwayId] = useState<(typeof CLINICAL_DRAFTS)[number]["id"]>("uti");
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<TenantDashboardResponse>({
    queryKey: ["tenant-dashboard", tenantSlug],
    queryFn: () => apiFetch<TenantDashboardResponse>(`/api/dashboard/${encodeURIComponent(tenantSlug)}`),
    enabled: !!tenantSlug,
    staleTime: 10_000,
  });

  const pushLive = useMutation({
    mutationFn: () =>
      apiFetch<{ message?: string }>(`/api/dashboard/${encodeURIComponent(tenantSlug)}/generate`, {
        method: "POST",
      }),
    onSuccess: (result) => setPushMessage(result.message || "Local page push requested."),
    onError: (err: Error) => setPushMessage(err.message || "Could not push the local page live."),
  });

  const competitors = data?.competitorsMatrix ?? [];
  const pathway = CLINICAL_DRAFTS.find((item) => item.id === pathwayId) ?? CLINICAL_DRAFTS[0];
  const drafts = (data?.localClusterPages ?? []).filter((page) =>
    pathway.pattern.test(`${page.suburbName ?? ""} ${page.clinicalPathway ?? ""} ${page.previewBodyHtml ?? ""}`),
  );

  return (
    <div className="rounded-xl overflow-hidden mb-4" style={CARD}>
      <div className="px-4 py-3" style={{ borderBottom: DIVIDER }}>
        <h2 className="text-sm font-semibold" style={{ color: FG }}>
          NHS Pharmacy First - Local Catchment Optimizer
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="p-4 min-w-0 border-b md:border-b-0 md:border-r" style={{ borderColor: "hsl(220 16% 92%)" }}>
          <h3 className="text-xs font-semibold mb-2" style={{ color: FG }}>DataForSEO local competitor matrix</h3>
          {isLoading ? (
            <div className="flex items-center gap-2 py-6 text-xs" style={{ color: MUTED }}>
              <Loader2 size={14} className="animate-spin" /> Loading competitor matrix
            </div>
          ) : isError ? (
            <p className="text-xs" style={{ color: MUTED }}>{error instanceof Error ? error.message : "Competitor matrix is unavailable."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: DIVIDER }}>
                    {["Name", "Reviews Count", "Star Rating", "Address"].map((heading) => (
                      <th key={heading} className="text-[10px] font-medium py-2 pr-3" style={{ color: MUTED }}>{heading}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {competitors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-xs py-4" style={{ color: MUTED }}>No local competitors returned for this project.</td>
                    </tr>
                  ) : competitors.map((row) => (
                    <tr key={`${row.name}-${row.address}`} style={{ borderBottom: DIVIDER }}>
                      <td className="text-xs font-medium py-2 pr-3" style={{ color: FG }}>{row.name || "—"}</td>
                      <td className="text-xs py-2 pr-3" style={{ color: FG }}>{row.reviewCount}</td>
                      <td className="text-xs py-2 pr-3" style={{ color: FG }}>{row.rating}</td>
                      <td className="text-xs py-2 pr-3" style={{ color: MUTED }}>{row.address || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="p-4 min-w-0">
          <h3 className="text-xs font-semibold mb-2" style={{ color: FG }}>Clinical Content Auditor</h3>
          <label className="block text-[10px] font-medium mb-1" style={{ color: MUTED }} htmlFor="clinical-draft-pathway">
            Preview text drafts
          </label>
          <select
            id="clinical-draft-pathway"
            value={pathwayId}
            onChange={(event) => setPathwayId(event.target.value as (typeof CLINICAL_DRAFTS)[number]["id"])}
            className="text-xs rounded-lg px-2 py-1.5 mb-3 w-full"
            style={{ color: FG, background: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 86%)" }}
          >
            {CLINICAL_DRAFTS.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
          <div className="rounded-lg p-3 mb-3 overflow-y-auto" style={{ background: "hsl(220 20% 98%)", border: DIVIDER, maxHeight: 180 }}>
            {isLoading ? (
              <p className="text-xs" style={{ color: MUTED }}>Loading drafts</p>
            ) : drafts.length === 0 ? (
              <p className="text-xs" style={{ color: MUTED }}>No stored {pathway.label} draft for this project.</p>
            ) : drafts.map((draft) => {
              const text = draftPlainText(draft.previewBodyHtml ?? "");
              return (
                <div key={draft.slug || draft.suburbName} className="mb-3 last:mb-0">
                  <div className="text-[10px] font-semibold mb-1" style={{ color: FG }}>{draft.suburbName || draft.slug || pathway.label}</div>
                  <p className="text-xs" style={{ color: MUTED }}>{text || "Draft has no preview text."}</p>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            disabled={pushLive.isPending}
            onClick={() => {
              setPushMessage(null);
              pushLive.mutate();
            }}
            className="text-xs font-semibold px-3 py-2 rounded-lg"
            style={{
              background: "hsl(142 71% 36%)",
              color: "#fff",
              border: "none",
              cursor: pushLive.isPending ? "wait" : "pointer",
              opacity: pushLive.isPending ? 0.7 : 1,
            }}
          >
            🚀 Push Local Page Live
          </button>
          {pushMessage && (
            <p className="text-[10px] mt-2" style={{ color: MUTED }}>{pushMessage}</p>
          )}
        </div>
      </div>
    </div>
  );
}

const FG      = "hsl(220 20% 16%)";
const MUTED   = "hsl(220 12% 55%)";
const MUTED2  = "hsl(220 12% 65%)";
const CARD    = { background: "hsl(0 0% 100%)", border: "1px solid hsl(220 16% 90%)" };
const DIVIDER = "1px solid hsl(220 16% 92%)";

function StatusDot({ status }: { status: Campaign["status"] }) {
  const colors: Record<Campaign["status"], string> = {
    deployed:    "hsl(142 71% 45%)",
    generated:   "hsl(217 91% 60%)",
    in_progress: "hsl(38 92% 55%)",
    new:         "hsl(220 12% 65%)",
  };
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7,
      borderRadius: "50%", background: colors[status] ?? colors.new, flexShrink: 0,
    }} />
  );
}

export default function DashboardPage() {
  const { selectedSlug, selectedProject } = useProject();
  const [openCampaignId, setOpenCampaignId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<CampaignsResponse>({
    queryKey: ["campaigns", selectedSlug],
    queryFn: () => apiFetch<CampaignsResponse>(`/api/campaigns/${selectedSlug}`),
    enabled: !!selectedSlug,
    staleTime: 10_000,
  });

  const campaigns = data?.campaigns ?? [];
  const totalPages        = campaigns.reduce((s, c) => s + (c.pagesGenerated ?? 0), 0);
  const totalDeployed     = campaigns.reduce((s, c) => s + (c.pagesDeployed ?? 0), 0);
  const activeCampaigns   = campaigns.filter((c) => c.status === "in_progress").length;
  const deployedCampaigns = campaigns.filter((c) => c.status === "deployed").length;

  const stats = [
    { label: "Pages",    value: totalPages,        icon: FileText,   accent: "hsl(217 91% 60%)" },
    { label: "Live",     value: totalDeployed,     icon: Rocket,     accent: "hsl(142 71% 45%)" },
    { label: "Active",   value: activeCampaigns,   icon: BarChart3,  accent: "hsl(38 92% 55%)"  },
    { label: "Deployed", value: deployedCampaigns, icon: TrendingUp, accent: "hsl(280 65% 60%)" },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar
        title="PharmaConnect Operations Panel"
        subtitle={selectedProject?.businessName ?? selectedSlug ?? "Overview"}
      />

      <div className="flex-1 overflow-y-auto p-4">
        {!selectedSlug ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 mb-4">
              {stats.map((stat) => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="rounded-xl p-3" style={CARD}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon size={11} style={{ color: stat.accent }} />
                      <span className="text-[9px] font-medium" style={{ color: MUTED }}>{stat.label}</span>
                    </div>
                    <div className="text-lg font-bold" style={{ color: FG }}>
                      {isLoading ? <span className="text-sm" style={{ color: MUTED2 }}>—</span> : stat.value}
                    </div>
                  </div>
                );
              })}
            </div>

            <LocalCatchmentOptimizer tenantSlug={selectedSlug} />

            <div className="rounded-xl overflow-hidden" style={CARD}>
              <div className="flex items-center justify-between px-4 py-3"
                style={{ borderBottom: DIVIDER }}>
                <h2 className="text-sm font-semibold" style={{ color: FG }}>Campaigns</h2>
                <Link href="/wizard"
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg"
                  style={{ background: "hsl(217 91% 60% / 0.10)", color: "hsl(217 80% 45%)", textDecoration: "none" }}>
                  <Plus size={11} /> New
                </Link>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={20} className="animate-spin" style={{ color: MUTED2 }} />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <BarChart3 size={28} className="mb-3" style={{ color: MUTED2 }} />
                  <p className="text-sm font-medium mb-1" style={{ color: MUTED }}>No campaigns yet</p>
                  <Link href="/wizard" className="text-xs font-semibold px-4 py-2 rounded-lg mt-2"
                    style={{ background: "hsl(217 91% 60%)", color: "#fff", textDecoration: "none" }}>
                    Launch Wizard
                  </Link>
                </div>
              ) : (
                <div>
                  {campaigns.map((c, i) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 16px",
                        cursor: "pointer",
                        borderBottom: i < campaigns.length - 1 ? DIVIDER : "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(220 20% 98%)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                      onClick={() => setOpenCampaignId(c.id)}
                    >
                      <StatusDot status={c.status} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="text-xs font-semibold truncate" style={{ color: FG }}>{c.serviceName}</div>
                        <div className="text-[10px] truncate" style={{ color: MUTED }}>{c.city}</div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div className="text-[10px] font-medium" style={{ color: MUTED }}>
                          {c.pagesGenerated ?? 0} pages
                        </div>
                        <div className="text-[9px]" style={{ color: MUTED2 }}>
                          Stage {c.currentStage}
                        </div>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setOpenCampaignId(c.id); }}
                        className="text-[10px] font-medium px-2.5 py-1 rounded"
                        style={{
                          background: "hsl(217 91% 60% / 0.10)",
                          color: "hsl(217 80% 45%)",
                          flexShrink: 0,
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        View →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {openCampaignId && selectedSlug && (
        <CampaignPanel
          campaignId={openCampaignId}
          slug={selectedSlug}
          onClose={() => setOpenCampaignId(null)}
        />
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-4">
      <BarChart3 size={40} className="mb-4" style={{ color: "hsl(220 12% 75%)" }} />
      <h2 className="text-base font-semibold mb-2" style={{ color: "hsl(220 20% 16%)" }}>No project selected</h2>
      <p className="text-sm" style={{ color: "hsl(220 12% 55%)" }}>
        Select a project from the dropdown above to view your dashboard.
      </p>
    </div>
  );
}
