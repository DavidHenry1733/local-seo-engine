import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import {
  CustomerSelectionGrid,
  type CoreServiceChannel,
  type PharmacyCustomerCard,
} from "@/components/CustomerSelectionGrid";
import { PharmacyWorkspacePanel, type WorkspaceDashboardData, type WorkspacePanelId } from "@/components/PharmacyWorkspacePanel";
import { CatchmentRegeneratePreview } from "@/components/CatchmentRegeneratePreview";
import { ImageLibraryView } from "@/components/ImageLibraryView";
import { AddClientImportButton, GoogleMapsImportModal } from "@/components/GoogleMapsImportModal";
import { GeneratePharmacyPitchWizard } from "@/components/GeneratePharmacyPitchWizard";
import { TerritoryExplorer } from "@/pages/TerritoryExplorer";
import {
  activatePharmacyWorkspace,
  campaignBuilderChooseUrl,
  closePharmacyWorkspace,
  isWorkspaceLandscapeOpen,
  readUrlWorkspaceSlug,
  workspacePanelFromHash,
} from "@/lib/pharmacyWorkspaceClient";
import {
  LayoutDashboard, Wand2, FileSearch, TrendingUp, Image, Sparkles,
  Palette, Activity, Globe, ShieldCheck, Users, KeyRound, MapPin,
  Bell, Search, FolderOpen, ChevronDown, Settings,
  Zap, CheckCircle2, ChevronRight, BookOpen,
  Check, BarChart2, BarChart3,
  RefreshCw, Play, Globe2, AlertCircle, Server,
  Lock, Eye, EyeOff, Plus, Filter, Download,
  Cpu, Wifi, Database, Clock, Shield, UserCheck,
  FileText, ExternalLink, TrendingDown, Minus,
} from "lucide-react";

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    id: "campaigns", label: "CAMPAIGNS",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",       sub: "Overview & stats",       href: "/dashboard",      color: "#818cf8", badge: null },
      { icon: Sparkles,        label: "New Pitch",       sub: "Generate pharmacy pitch", href: "/new-pitch",     color: "#fbbf24", badge: null },
      { icon: MapPin,          label: "Territory Explorer", sub: "Catchment & exclusivity", href: "/territories", color: "#38bdf8", badge: null },
      { icon: Wand2,           label: "SEO Wizard",      sub: "Campaign builder",       href: "/wizard",         color: "#a78bfa", badge: "8 stages" },
      { icon: TrendingUp,      label: "Growth Engine",   sub: "Plan & intelligence",    href: "/growth-engine",  color: "#34d399", badge: null },
      { icon: FileText,        label: "Content Review",  sub: "Authority audit",        href: "/content-review", color: "#60a5fa", badge: null },
      { icon: ShieldCheck,     label: "Review Centre",   sub: "Approve campaign pages", href: "/review-centre",  color: "#fb7185", badge: null },
      { icon: FileSearch,      label: "Page Preview",    sub: "Browse generated pages", href: "/pages",          color: "#38bdf8", badge: null },
      { icon: Image,           label: "Image Packs",     sub: "Manage visual assets",   href: "/images",         color: "#fbbf24", badge: null },
      { icon: Palette,         label: "Designs",         sub: "UI design variants",     href: "/designs",        color: "#f472b6", badge: null },
    ],
  },
  {
    id: "analytics", label: "ANALYTICS",
    items: [
      { icon: TrendingUp,  label: "Rankings",      sub: "Keyword positions",     href: "/rankings",  color: "#34d399", badge: null },
      { icon: Activity,    label: "System Health", sub: "Server & build status", href: "/health",    color: "#4ade80", badge: null },
      { icon: Globe,       label: "Live Crawl",    sub: "Index & crawl monitor", href: "/crawl",     color: "#38bdf8", badge: null },
      { icon: ShieldCheck, label: "Security",      sub: "Access & audit log",    href: "/security",  color: "#fb7185", badge: null },
    ],
  },
  {
    id: "admin", label: "ADMIN",
    items: [
      { icon: Users,    label: "Team",            sub: "Users & permissions",  href: "/team",     color: "#c084fc", badge: null },
      { icon: KeyRound, label: "Change Password", sub: "Security credentials", href: "/password", color: "#94a3b8", badge: null },
    ],
  },
];

const PROJECTS = ["InboxingProWeb", "Demo Project", "+ New project"];
const QUICK_STATS = [
  { label: "Pages",   value: "169",  color: "#818cf8" },
  { label: "Indexed", value: "142",  color: "#34d399" },
  { label: "Avg Pos.",value: "14.2", color: "#60a5fa" },
];

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function Sidebar({
  active, setActive, project, setProject, projectOpen, setProjectOpen,
}: {
  active: string; setActive: (h: string) => void;
  project: string; setProject: (p: string) => void;
  projectOpen: boolean; setProjectOpen: (v: boolean) => void;
}) {
  return (
    <aside style={{ width: 256, background: "#10121c", borderRight: "1px solid #1c1f30", display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #1c1f30" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(99,102,241,0.4)" }}>
            <Zap size={14} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e4e8f5", letterSpacing: "-0.01em", lineHeight: 1.1 }}>SEO Engine</div>
            <div style={{ fontSize: 10, color: "#3a3f5c", marginTop: 1 }}>Local Content Platform</div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button onClick={(e) => { e.stopPropagation(); setProjectOpen(!projectOpen); }}
            style={{ width: "100%", background: "#181b2a", border: "1px solid #252840", borderRadius: 8, padding: "8px 10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 22, height: 22, borderRadius: 5, background: "#2a1f60", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <FolderOpen size={11} color="#818cf8" />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#d4d8f0", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project}</span>
            </div>
            <ChevronDown size={13} color="#3a3f5c" style={{ transform: projectOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
          </button>
          {projectOpen && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, background: "#181b2a", border: "1px solid #252840", borderRadius: 8, boxShadow: "0 12px 32px rgba(0,0,0,0.5)", zIndex: 50, overflow: "hidden" }}>
              {PROJECTS.map((p, i) => (
                <button key={p} onClick={(e) => { e.stopPropagation(); if (i < 2) setProject(p); setProjectOpen(false); }}
                  style={{ width: "100%", padding: "9px 12px", background: p === project ? "#22263a" : "transparent", border: "none", cursor: "pointer", textAlign: "left", fontSize: 12.5, color: i === 2 ? "#818cf8" : "#d4d8f0", fontWeight: i === 2 ? 500 : 400, borderTop: i === 2 ? "1px solid #252840" : "none", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {p}{p === project && <CheckCircle2 size={12} color="#818cf8" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <nav style={{ flex: 1, overflowY: "auto", padding: "8px 10px", scrollbarWidth: "none" }}>
        {NAV_GROUPS.map((group) => (
          <div key={group.id} style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#2e3250", letterSpacing: "0.09em", padding: "8px 8px 4px" }}>{group.label}</div>
            {group.items.map((item) => {
              const isActive = active === item.href;
              return (
                <button key={item.href} onClick={() => setActive(item.href)}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "7px 8px", borderRadius: 7, border: "none", cursor: "pointer", background: isActive ? "linear-gradient(90deg,#1a1d30,#1e2038)" : "transparent", marginBottom: 1, position: "relative", transition: "background 0.12s" }}>
                  {isActive && <div style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: 22, borderRadius: "0 3px 3px 0", background: item.color, boxShadow: `0 0 8px ${item.color}88` }} />}
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: isActive ? item.color + "22" : "#181b2a", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <item.icon size={13} color={isActive ? item.color : "#3a3f5c"} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                    <div style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 400, color: isActive ? "#e4e8f5" : "#6b7296", lineHeight: 1.25 }}>{item.label}</div>
                    <div style={{ fontSize: 10.5, color: isActive ? "#4a5080" : "#2e3250", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{item.sub}</div>
                  </div>
                  {item.badge && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? item.color : "#3a3f5c", background: isActive ? item.color + "22" : "#181b2a", border: `1px solid ${isActive ? item.color + "44" : "#252840"}`, padding: "1px 6px", borderRadius: 10, flexShrink: 0 }}>{item.badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: "10px 14px", borderTop: "1px solid #1c1f30", display: "flex" }}>
        {QUICK_STATS.map((s, i) => (
          <div key={s.label} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid #1c1f30" : "none" }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: "-0.02em" }}>{s.value}</div>
            <div style={{ fontSize: 9.5, color: "#2e3250", marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "12px 14px", borderTop: "1px solid #1c1f30", display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0, boxShadow: "0 0 10px rgba(99,102,241,0.3)" }}>A</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#c8d0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Admin</div>
          <div style={{ fontSize: 10.5, color: "#2e3250" }}>inboxingproweb.com</div>
        </div>
        <Settings size={15} color="#2e3250" style={{ cursor: "pointer", flexShrink: 0 }} />
      </div>
    </aside>
  );
}

// ─── Top bar ─────────────────────────────────────────────────────────────────
function TopBar({ project, title, sub, setActive, onImportClient }: { project: string; title: string; sub?: string; setActive: (h: string) => void; onImportClient: () => void }) {
  return (
    <header style={{ minHeight: 52, background: "#10121c", borderBottom: "1px solid #1c1f30", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#3a3f5c", minWidth: 0, overflow: "hidden" }}>
        <BookOpen size={13} color="#2e3250" />
        <span>{project}</span>
        <ChevronRight size={12} color="#2e3250" />
        <span style={{ color: "#c8d0e0", fontWeight: 600 }}>{title}</span>
        {sub && <><ChevronRight size={12} color="#2e3250" /><span style={{ color: "#a78bfa", fontWeight: 500, fontSize: 12 }}>{sub}</span></>}
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#181b2a", border: "1px solid #1c1f30", borderRadius: 8, padding: "7px 14px", width: 220, cursor: "text" }}>
          <Search size={13} color="#2e3250" />
          <span style={{ fontSize: 12.5, color: "#2e3250" }}>Jump to page…</span>
        </div>
        <button type="button" style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <Bell size={17} color="#3a3f5c" />
          <span style={{ position: "absolute", top: 2, right: 2, width: 7, height: 7, borderRadius: "50%", background: "#818cf8", border: "2px solid #10121c" }} />
        </button>
        <AddClientImportButton compact onClick={onImportClient} />
        <button type="button" onClick={() => setActive("/territories")} style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "1px solid #334155", borderRadius: 7, padding: "7px 14px", cursor: "pointer", flexShrink: 0 }}>
          <MapPin size={13} color="#38bdf8" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e4e8f5" }}>Territory Explorer</span>
        </button>
        <button type="button" onClick={() => setActive("/new-pitch")} style={{ display: "flex", alignItems: "center", gap: 6, background: "#0f172a", border: "1px solid #334155", borderRadius: 7, padding: "7px 14px", cursor: "pointer", flexShrink: 0 }}>
          <Sparkles size={13} color="#fbbf24" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#e4e8f5" }}>Generate Pitch</span>
        </button>
        <button type="button" onClick={() => setActive("/wizard")} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", boxShadow: "0 0 14px rgba(99,102,241,0.3)", flexShrink: 0 }}>
          <Wand2 size={13} color="#fff" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>New Campaign</span>
        </button>
      </div>
    </header>
  );
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
  slug?: string;
  pharmacyName?: string;
  websiteUrl?: string;
  competitorsMatrix?: CompetitorMatrixRow[];
  localClusterPages?: LocalClusterDraft[];
  googleCatchment?: {
    googlePlaceId?: string;
    latitude?: number | null;
    longitude?: number | null;
    coverageRadius?: string;
    rankingAreas?: string[];
    nearbyAreas?: string[];
    coverageAreas?: string[];
    googleMapsEmbedUrl?: string;
    googleBusinessProfileUrl?: string;
  };
  profile?: WorkspaceDashboardData["profile"];
  serviceChannels?: Array<{ id: string; label: string; active?: boolean }>;
  importRecords?: WorkspaceDashboardData["importRecords"];
  campaigns?: WorkspaceDashboardData["campaigns"];
  localCampaigns?: WorkspaceDashboardData["localCampaigns"];
  campaignCreateEnabled?: boolean;
  livePreviewUrl?: string;
  workspace?: WorkspaceDashboardData["workspace"];
}

interface CustomersResponse {
  pharmacies?: PharmacyCustomerCard[];
  coreServiceChannels?: CoreServiceChannel[];
}

function mapIframeSrc(html: string | undefined, suburb: string, mapsUrl?: string): string {
  const stored = html?.match(/<iframe[^>]*\ssrc=["']([^"']+)["']/i)?.[1];
  if (stored) return stored;
  if (mapsUrl) return mapsUrl;
  return `https://maps.google.com/maps?q=${encodeURIComponent(suburb)}&hl=en&z=15&output=embed`;
}

function useProductionLocalities() {
  const [selectedSlug, setSelectedSlug] = useState<string>(() => readUrlWorkspaceSlug());
  const customersQuery = useQuery<CustomersResponse>({
    queryKey: ["dashboard-customers"],
    queryFn: () => apiFetch<CustomersResponse>("/api/dashboard/customers"),
    staleTime: 30_000,
  });
  const pharmacies = customersQuery.data?.pharmacies ?? [];

  const query = useQuery<TenantDashboardResponse>({
    queryKey: ["tenant-dashboard", selectedSlug],
    queryFn: () => apiFetch<TenantDashboardResponse>(`/api/dashboard/${encodeURIComponent(selectedSlug)}`),
    enabled: !!selectedSlug,
    staleTime: 10_000,
  });
  const drafts = query.data?.localClusterPages ?? [];
  const rankingAreas = query.data?.googleCatchment?.rankingAreas?.length
    ? query.data.googleCatchment.rankingAreas
    : pharmacies.find((row) => row.slug === selectedSlug)?.rankingAreas ?? [];
  const localities = rankingAreas.map((area) => {
    const draft = drafts.find((page) =>
      (page.suburbName || "").toLowerCase() === area.toLowerCase() ||
      (page.slug || "").toLowerCase().endsWith(`/${area.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`),
    );
    return {
      suburb: area,
      slug: draft?.slug || area.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      status: draft?.status || "DRAFT",
      previewBodyHtml: draft?.previewBodyHtml,
      mapSrc: mapIframeSrc(draft?.previewBodyHtml, area, query.data?.googleCatchment?.googleMapsEmbedUrl),
    };
  });
  return {
    ...query,
    localities,
    pharmacies,
    serviceChannels: customersQuery.data?.coreServiceChannels ?? [],
    selectedSlug,
    setSelectedSlug: (slug: string) => {
      localStorage.setItem("selectedSlug", slug);
      setSelectedSlug(slug);
    },
    customersLoading: customersQuery.isLoading,
    customersError: customersQuery.error instanceof Error ? customersQuery.error.message : null,
  };
}

function statusTone(status: string) {
  const live = /live|published|deployed/i.test(status) && !/not deployed/i.test(status);
  const approved = /approved/i.test(status);
  const draft = /draft|review|pending/i.test(status);
  if (live || approved) return { color: "#4ade80", bg: "#052e16", border: "#166534" };
  if (draft) return { color: "#fbbf24", bg: "#1c1200", border: "#713f12" };
  return { color: "#6b7296", bg: "#181b2a", border: "#252840" };
}

// ─── Page: Dashboard ─────────────────────────────────────────────────────────
function PageDashboard({
  setActive,
  setProject,
  onOpenCampaign,
  onImportClient,
}: {
  setActive: (h: string) => void;
  setProject: (p: string) => void;
  onOpenCampaign: (slug: string, serviceKey: string) => void;
  onImportClient: () => void;
}) {
  const {
    pharmacies,
    serviceChannels,
    selectedSlug,
    setSelectedSlug,
    data,
    isLoading,
    customersLoading,
    customersError,
  } = useProductionLocalities();
  const [workspaceOpen, setWorkspaceOpen] = useState(() => isWorkspaceLandscapeOpen());
  const [panel, setPanel] = useState<WorkspacePanelId>(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("catchment")) {
      return "catchment";
    }
    return workspacePanelFromHash();
  });

  useEffect(() => {
    if (data?.pharmacyName) setProject(data.pharmacyName);
  }, [data?.pharmacyName, setProject]);

  useEffect(() => {
    const syncFromUrl = () => {
      const slug = readUrlWorkspaceSlug();
      if (!slug) {
        setWorkspaceOpen(false);
        setProject("PharmaConnect");
        return;
      }
      setSelectedSlug(slug);
      setWorkspaceOpen(true);
      setPanel(workspacePanelFromHash());
    };
    window.addEventListener("popstate", syncFromUrl);
    window.addEventListener("hashchange", syncFromUrl);
    window.addEventListener("pharmacy-workspace-activate", syncFromUrl);
    window.addEventListener("pharmacy-workspace-close", syncFromUrl);
    return () => {
      window.removeEventListener("popstate", syncFromUrl);
      window.removeEventListener("hashchange", syncFromUrl);
      window.removeEventListener("pharmacy-workspace-activate", syncFromUrl);
      window.removeEventListener("pharmacy-workspace-close", syncFromUrl);
    };
  }, [setSelectedSlug, setProject]);

  const openWorkspace = (slug: string) => {
    const card = pharmacies.find((row) => row.slug === slug);
    setSelectedSlug(slug);
    setProject(card?.pharmacyName || slug);
    setPanel("campaigns");
    setWorkspaceOpen(true);
    activatePharmacyWorkspace(slug, "campaigns", "");
  };

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      {!workspaceOpen ? (
        <>
          <div style={{ marginBottom: 24, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div style={{ minWidth: 0, flex: "1 1 280px" }}>
              <p style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", margin: "0 0 8px" }}>PHARMACONNECT</p>
              <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Production pharmacies</h1>
              <p style={{ color: "#6b7296", fontSize: 12.5, margin: 0 }}>Select a live customer such as Gilbert or Yorkshire to open their workspace: profile, import, catchment, and campaigns.</p>
            </div>
            <div style={{ flexShrink: 0, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setActive("/new-pitch")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 16px",
                  cursor: "pointer",
                  color: "#fff",
                  fontSize: 14,
                  fontWeight: 800,
                  boxShadow: "0 0 16px rgba(99,102,241,0.35)",
                }}
              >
                <Sparkles size={15} />
                Generate New Pharmacy Pitch
              </button>
              <AddClientImportButton onClick={onImportClient} />
            </div>
          </div>
          <CustomerSelectionGrid
            pharmacies={pharmacies}
            selectedSlug={selectedSlug || null}
            onSelect={openWorkspace}
            loading={customersLoading}
            error={customersError}
            serviceChannels={serviceChannels}
            onOpenCampaign={onOpenCampaign}
          />
        </>
      ) : isLoading || !data?.slug ? (
        <p style={{ margin: 0, fontSize: 13, color: "#6b7296" }}>Opening pharmacy workspace…</p>
      ) : (
        <PharmacyWorkspacePanel
          data={data as WorkspaceDashboardData}
          panel={panel}
          onPanelChange={(next) => {
            if (selectedSlug) activatePharmacyWorkspace(selectedSlug, next);
            setPanel(next);
          }}
          onOpenCampaign={onOpenCampaign}
          onBack={() => {
            closePharmacyWorkspace();
            setWorkspaceOpen(false);
            setProject("PharmaConnect");
          }}
        />
      )}
    </main>
  );
}

// ─── Page: SEO Wizard ─────────────────────────────────────────────────────────
const STAGES = ["Profile","Service Areas","Keywords","Content","Generate","Deploy","Indexing","Done"];
function PageWizard({ src }: { src?: string }) {
  const cur = 8;
  const [checking, setChecking] = useState(false);
  const { localities } = useProductionLocalities();
  const draftCount = localities.filter((row) => /draft/i.test(row.status)).length;
  const deployedCount = localities.filter((row) => /live|published|deployed/i.test(row.status) && !/not deployed/i.test(row.status)).length;
  if (src) {
    return (
      <main style={{ flex: 1, minHeight: 0, overflow: "hidden", background: "#0b0d14" }}>
        <iframe
          title="SEO Wizard Campaign builder"
          src={src}
          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
      </main>
    );
  }
  return (
    <main style={{ flex: 1, overflowY: "auto", background: "#0b0d14", padding: "28px 32px" }}>
      {/* Stepper */}
      <div style={{ marginBottom: 32, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 15, height: 2, background: "#1c1f30", zIndex: 0 }} />
          <div style={{ position: "absolute", left: 0, top: 15, height: 2, width: `${((cur - 1) / (STAGES.length - 1)) * 100}%`, background: "linear-gradient(90deg,#6366f1,#a78bfa)", zIndex: 1 }} />
          {STAGES.map((s, i) => {
            const done = i + 1 < cur; const act = i + 1 === cur;
            return (
              <div key={s} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 2 }}>
                <div style={{ width: 30, height: 30, borderRadius: "50%", background: done ? "#6366f1" : "#10121c", border: done ? "2px solid #6366f1" : act ? "2px solid #a78bfa" : "2px solid #1c1f30", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: act ? "0 0 12px rgba(167,139,250,0.5)" : "none" }}>
                  {done ? <Check size={13} color="#fff" strokeWidth={3} /> : <span style={{ fontSize: 11, fontWeight: 700, color: act ? "#a78bfa" : "#2e3250" }}>{i + 1}</span>}
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: act ? "#a78bfa" : done ? "#4a5080" : "#2e3250", textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: "0.06em" }}>{s}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1a1d30", border: "1px solid #a78bfa33", borderRadius: 20, padding: "4px 14px", marginBottom: 12 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa", letterSpacing: "0.06em" }}>STAGE 8 OF 8</span>
        </div>
        <h1 style={{ color: "#e4e8f5", fontSize: 20, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Indexing & Rankings</h1>
          <p style={{ fontSize: 13, color: "#4a5080", margin: 0 }}>Production catchment pages, with their URL slugs and deployment status.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[["Target suburbs", String(localities.length)],["Drafts", String(draftCount)],["Deployed", String(deployedCount)],["Pending", String(localities.length - draftCount - deployedCount)]].map(([l,v]) => (
          <div key={l} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "#3a3f5c", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#e4e8f5", letterSpacing: "-0.02em" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #1c1f30", display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart2 size={15} color="#818cf8" />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e4e8f5" }}>Local target suburbs</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid #1c1f30" }}>
            {["Suburb", "URL slug", "Deployment status"].map(h => <th key={h} style={{ padding: "9px 18px", fontSize: 10.5, fontWeight: 600, color: "#2e3250", textAlign: "left", letterSpacing: "0.05em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {localities.map((row, i) => {
              const tone = statusTone(row.status);
              return (
              <tr key={row.suburb} style={{ borderBottom: i < localities.length - 1 ? "1px solid #1c1f30" : "none" }}>
                <td style={{ padding: "11px 18px", fontSize: 12.5, fontWeight: 600, color: "#d4d8f0" }}>{row.suburb}</td>
                <td style={{ padding: "11px 18px", fontSize: 11.5, color: "#818cf8", fontFamily: "monospace" }}>/{row.slug}</td>
                <td style={{ padding: "11px 18px" }}><span style={{ fontSize: 10, fontWeight: 700, color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 6, padding: "3px 9px" }}>{row.status}</span></td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
        <button onClick={() => { setChecking(true); setTimeout(() => setChecking(false), 1800); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 20px", background: "none", border: "1px solid #252840", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#6b7296" }}>
          <RefreshCw size={14} color="#6b7296" /> Refresh Data
        </button>
        <button onClick={() => { setChecking(true); setTimeout(() => setChecking(false), 1800); }} style={{ display: "flex", alignItems: "center", gap: 7, padding: "10px 24px", background: "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#fff", boxShadow: "0 0 18px rgba(99,102,241,0.35)" }}>
          <Play size={13} color="#fff" fill="#fff" />{checking ? "Running…" : "Run Fresh Check"}
        </button>
      </div>
    </main>
  );
}

// ─── Page: Page Preview ───────────────────────────────────────────────────────
function PagePreview() {
  const { selectedSlug, localities } = useProductionLocalities();
  const areas = localities.map((row) => row.suburb);
  const previewHref = selectedSlug ? `/preview/${selectedSlug}/pharmacy-first` : "";
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Page Preview</h1>
          <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>Live generated Pharmacy First page for the selected workspace</p>
        </div>
        {previewHref ? (
          <a
            href={previewHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#4f46e5", color: "#fff", textDecoration: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, boxShadow: "0 8px 24px rgba(79,70,229,0.35)" }}
          >
            👁 View Live Page Preview
          </a>
        ) : null}
      </div>
      {selectedSlug ? (
        <>
          <iframe
            title="Live page preview"
            src={previewHref}
            style={{ width: "100%", height: 720, border: "1px solid #1c1f30", borderRadius: 14, background: "#fff", marginBottom: 20 }}
          />
          <CatchmentRegeneratePreview slug={selectedSlug} serviceId="pharmacy-first" areas={areas} />
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, color: "#6b7296" }}>Select a pharmacy workspace to preview catchment pages.</p>
      )}
    </main>
  );
}

// ─── Page: Image Packs ────────────────────────────────────────────────────────
function PageImages() {
  const { selectedSlug } = useProductionLocalities();
  return <ImageLibraryView slug={selectedSlug} />;
}

// ─── Page: Designs ────────────────────────────────────────────────────────────
function PageDesigns() {
  const variants = [
    { name: "Dark Sidebar (Current)",  desc: "Premium SaaS dark nav",  status: "active",   color: "#818cf8" },
    { name: "Light Minimal",           desc: "Clean white sidebar",     status: "draft",    color: "#60a5fa" },
    { name: "Top Nav Hybrid",          desc: "Horizontal + sub-nav",    status: "draft",    color: "#f472b6" },
    { name: "Compact Icon Rail",       desc: "Collapsed icon sidebar",  status: "draft",    color: "#34d399" },
  ];
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Designs</h1>
        <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>UI design variants for the dashboard</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
        {variants.map((v) => (
          <div key={v.name} style={{ background: "#10121c", border: `1px solid ${v.status === "active" ? v.color + "44" : "#1c1f30"}`, borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
            {/* Preview */}
            <div style={{ height: 140, background: "#0b0d14", display: "flex", padding: 16, gap: 8 }}>
              <div style={{ width: 48, background: "#10121c", borderRadius: 6, border: "1px solid #1c1f30", display: "flex", flexDirection: "column", gap: 4, padding: 6 }}>
                {[1,2,3,4,5,6].map(i => <div key={i} style={{ height: 8, background: i === 2 ? v.color + "44" : "#1c1f30", borderRadius: 3, width: i === 2 ? "90%" : `${60 + i * 5}%` }} />)}
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ height: 20, background: "#10121c", borderRadius: 5, border: "1px solid #1c1f30" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, flex: 1 }}>
                  {[1,2,3,4].map(i => <div key={i} style={{ background: "#10121c", borderRadius: 6, border: "1px solid #1c1f30" }} />)}
                </div>
              </div>
            </div>
            <div style={{ padding: "14px 18px", borderTop: "1px solid #1c1f30", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#d4d8f0", marginBottom: 2 }}>{v.name}</div>
                <div style={{ fontSize: 11, color: "#3a3f5c" }}>{v.desc}</div>
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, padding: "3px 10px", borderRadius: 10, color: v.status === "active" ? v.color : "#3a3f5c", background: v.status === "active" ? v.color + "18" : "#181b2a", border: `1px solid ${v.status === "active" ? v.color + "44" : "#252840"}` }}>
                {v.status === "active" ? "Active" : "Draft"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ─── Page: Rankings ───────────────────────────────────────────────────────────
function PageRankings() {
  const { localities } = useProductionLocalities();
  const draftCount = localities.filter((row) => /draft/i.test(row.status)).length;
  const deployedCount = localities.filter((row) => /live|published|deployed/i.test(row.status) && !/not deployed/i.test(row.status)).length;
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Rankings</h1>
          <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>Selected pharmacy · local page deployment</p>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[["Suburbs", String(localities.length), "#818cf8"],["Drafts", String(draftCount), "#fbbf24"],["Deployed", String(deployedCount), "#34d399"]].map(([l,v,c]) => (
          <div key={l} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#3a3f5c", marginBottom: 8 }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: "-0.03em", lineHeight: 1 }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid #1c1f30" }}>
            {["Suburb", "URL slug", "Deployment status"].map(h => <th key={h} style={{ padding: "11px 18px", fontSize: 10.5, fontWeight: 600, color: "#2e3250", textAlign: "left", letterSpacing: "0.05em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {localities.map((row, i) => {
              const tone = statusTone(row.status);
              return (
                <tr key={row.suburb} style={{ borderBottom: i < localities.length - 1 ? "1px solid #1c1f30" : "none" }}>
                  <td style={{ padding: "12px 18px", fontSize: 12.5, fontWeight: 600, color: "#d4d8f0" }}>{row.suburb}</td>
                  <td style={{ padding: "12px 18px", fontSize: 11.5, color: "#818cf8", fontFamily: "monospace" }}>/{row.slug}</td>
                  <td style={{ padding: "12px 18px" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: tone.color, background: tone.bg, border: `1px solid ${tone.border}`, borderRadius: 8, padding: "3px 9px" }}>{row.status}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// ─── Page: System Health ─────────────────────────────────────────────────────
function PageHealth() {
  const services = [
    { name: "API Server",      status: "healthy", latency: "42ms",  uptime: "99.98%", icon: Server   },
    { name: "FTP Deploy",      status: "healthy", latency: "120ms", uptime: "99.91%", icon: Wifi     },
    { name: "PostgreSQL DB",   status: "healthy", latency: "8ms",   uptime: "100%",   icon: Database },
    { name: "Build Pipeline",  status: "healthy", latency: "—",     uptime: "99.80%", icon: Cpu      },
    { name: "GSC Integration", status: "warning", latency: "340ms", uptime: "98.20%", icon: Globe2   },
    { name: "Image CDN",       status: "healthy", latency: "65ms",  uptime: "99.95%", icon: Image    },
  ];
  const sColor = (s: string) => s === "healthy" ? { color: "#4ade80", bg: "#052e16", border: "#166534" } : { color: "#fbbf24", bg: "#1c1200", border: "#713f12" };
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>System Health</h1>
          <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>All systems operational · Last checked 1 min ago</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#052e16", border: "1px solid #166534", borderRadius: 8, padding: "6px 14px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 6px #4ade80" }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#4ade80" }}>5/6 Healthy</span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {services.map((s) => { const sc = sColor(s.status); return (
          <div key={s.name} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#181b2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={16} color="#4a5080" />
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, padding: "3px 9px", borderRadius: 10 }}>
                {s.status === "healthy" ? "Healthy" : "Warning"}
              </span>
            </div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#d4d8f0", marginBottom: 8 }}>{s.name}</div>
            <div style={{ display: "flex", gap: 16 }}>
              <div>
                <div style={{ fontSize: 10, color: "#2e3250", marginBottom: 2 }}>Latency</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#818cf8" }}>{s.latency}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#2e3250", marginBottom: 2 }}>Uptime</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>{s.uptime}</div>
              </div>
            </div>
          </div>
        ); })}
      </div>
    </main>
  );
}

// ─── Page: Live Crawl ─────────────────────────────────────────────────────────
function PageCrawl() {
  const rows = [
    { url: "/web-design-sheffield",          status: "indexed",    last: "2h ago",  code: 200 },
    { url: "/local-seo-barnsley",            status: "indexed",    last: "2h ago",  code: 200 },
    { url: "/web-design-rotherham",          status: "indexed",    last: "3h ago",  code: 200 },
    { url: "/email-marketing-sheffield",     status: "indexed",    last: "4h ago",  code: 200 },
    { url: "/local-seo-doncaster",           status: "pending",    last: "6h ago",  code: 200 },
    { url: "/website-hosting-barnsley",      status: "indexed",    last: "5h ago",  code: 200 },
    { url: "/web-design-doncaster",          status: "pending",    last: "8h ago",  code: 200 },
    { url: "/email-marketing-barnsley",      status: "excluded",   last: "12h ago", code: 301 },
  ];
  const sc = (s: string) => s === "indexed" ? { color: "#4ade80", bg: "#052e16", border: "#166534" } : s === "pending" ? { color: "#fbbf24", bg: "#1c1200", border: "#713f12" } : { color: "#fb7185", bg: "#1f0e0e", border: "#7f1d1d" };
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Live Crawl</h1>
        <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>Index & crawl monitor via Google Search Console</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[["Indexed","142","#4ade80"],["Pending","27","#fbbf24"],["Excluded","0","#fb7185"],["Coverage","84%","#818cf8"]].map(([l,v,c]) => (
          <div key={l} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12, padding: "14px 18px" }}>
            <div style={{ fontSize: 11, color: "#3a3f5c", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: c, letterSpacing: "-0.02em" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #1c1f30", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e4e8f5" }}>Crawl Log</span>
          <button style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 11.5, color: "#818cf8" }}><RefreshCw size={12} /> Re-crawl all</button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid #1c1f30" }}>
            {["URL","Status","Last Crawled","HTTP"].map(h => <th key={h} style={{ padding: "9px 18px", fontSize: 10.5, fontWeight: 600, color: "#2e3250", textAlign: "left", letterSpacing: "0.05em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => { const s = sc(r.status); return (
              <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #1c1f30" : "none" }}>
                <td style={{ padding: "11px 18px", fontSize: 11.5, color: "#6b7296", fontFamily: "monospace" }}>{r.url}</td>
                <td style={{ padding: "11px 18px" }}><span style={{ fontSize: 10, fontWeight: 600, color: s.color, background: s.bg, border: `1px solid ${s.border}`, padding: "2px 8px", borderRadius: 10 }}>{r.status}</span></td>
                <td style={{ padding: "11px 18px", fontSize: 11.5, color: "#3a3f5c" }}>{r.last}</td>
                <td style={{ padding: "11px 18px", fontSize: 11.5, color: r.code === 200 ? "#4ade80" : "#fbbf24", fontWeight: 600 }}>{r.code}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// ─── Page: Security ───────────────────────────────────────────────────────────
function PageSecurity() {
  const log = [
    { action: "Login",          user: "admin@inboxingproweb.com", ip: "82.45.12.100",  time: "Today 09:14",  ok: true  },
    { action: "FTP Deploy",     user: "admin@inboxingproweb.com", ip: "82.45.12.100",  time: "Today 09:18",  ok: true  },
    { action: "Page Generated", user: "system",                   ip: "internal",      time: "Today 09:20",  ok: true  },
    { action: "Login Failed",   user: "unknown@external.com",     ip: "194.67.23.77",  time: "Today 07:53",  ok: false },
    { action: "Password Change",user: "admin@inboxingproweb.com", ip: "82.45.12.100",  time: "Yesterday",    ok: true  },
    { action: "API Key Rotated",user: "admin@inboxingproweb.com", ip: "82.45.12.100",  time: "3 days ago",   ok: true  },
  ];
  const securityStats: { label: string; value: string; color: string; Icon: typeof UserCheck }[] = [
    { label: "Active Sessions", value: "1", color: "#34d399", Icon: UserCheck },
    { label: "Failed Logins", value: "1", color: "#fb7185", Icon: AlertCircle },
    { label: "API Keys", value: "3", color: "#818cf8", Icon: Lock },
  ];
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Security</h1>
        <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>Access log & audit trail</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {securityStats.map((stat) => (
          <div key={stat.label} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "#3a3f5c", marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: stat.color, letterSpacing: "-0.02em" }}>{stat.value}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: stat.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <stat.Icon size={16} color={stat.color} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #1c1f30" }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e4e8f5" }}>Audit Log</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid #1c1f30" }}>
            {["Action","User","IP Address","Time","Status"].map(h => <th key={h} style={{ padding: "9px 18px", fontSize: 10.5, fontWeight: 600, color: "#2e3250", textAlign: "left", letterSpacing: "0.05em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {log.map((r, i) => (
              <tr key={i} style={{ borderBottom: i < log.length - 1 ? "1px solid #1c1f30" : "none" }}>
                <td style={{ padding: "11px 18px", fontSize: 12.5, fontWeight: 500, color: "#d4d8f0" }}>{r.action}</td>
                <td style={{ padding: "11px 18px", fontSize: 11.5, color: "#4a5080" }}>{r.user}</td>
                <td style={{ padding: "11px 18px", fontSize: 11.5, color: "#3a3f5c", fontFamily: "monospace" }}>{r.ip}</td>
                <td style={{ padding: "11px 18px", fontSize: 11.5, color: "#3a3f5c" }}>{r.time}</td>
                <td style={{ padding: "11px 18px" }}>
                  {r.ok
                    ? <span style={{ fontSize: 10, fontWeight: 600, color: "#4ade80", background: "#052e16", border: "1px solid #166534", padding: "2px 8px", borderRadius: 10 }}>OK</span>
                    : <span style={{ fontSize: 10, fontWeight: 600, color: "#fb7185", background: "#1f0e0e", border: "1px solid #7f1d1d", padding: "2px 8px", borderRadius: 10 }}>BLOCKED</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

// ─── Page: Team ───────────────────────────────────────────────────────────────
function PageTeam() {
  const members = [
    { name: "Admin User",     email: "admin@inboxingproweb.com",  role: "Owner",  last: "Today",       avatar: "A", color: "#6366f1" },
    { name: "Sarah J.",       email: "sarah@inboxingproweb.com",  role: "Editor", last: "Yesterday",   avatar: "S", color: "#f472b6" },
    { name: "James K.",       email: "james@inboxingproweb.com",  role: "Viewer", last: "3 days ago",  avatar: "J", color: "#34d399" },
  ];
  const roleColor = (r: string) => r === "Owner" ? { color: "#818cf8", bg: "#1e1b4b", border: "#312e81" } : r === "Editor" ? { color: "#fbbf24", bg: "#1c1200", border: "#713f12" } : { color: "#6b7296", bg: "#181b2a", border: "#252840" };
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Team</h1>
          <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>3 members · InboxingProWeb</p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#fff" }}>
          <Plus size={13} color="#fff" /> Invite Member
        </button>
      </div>
      <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden" }}>
        {members.map((m, i) => { const rc = roleColor(m.role); return (
          <div key={m.email} style={{ padding: "18px 22px", borderBottom: i < members.length - 1 ? "1px solid #1c1f30" : "none", display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: `linear-gradient(135deg, ${m.color}88, ${m.color}44)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff", flexShrink: 0, border: `2px solid ${m.color}44` }}>{m.avatar}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: "#d4d8f0", marginBottom: 2 }}>{m.name}</div>
              <div style={{ fontSize: 11.5, color: "#3a3f5c" }}>{m.email}</div>
            </div>
            <div style={{ fontSize: 11, color: "#2e3250" }}>Last active: {m.last}</div>
            <span style={{ fontSize: 10, fontWeight: 600, color: rc.color, background: rc.bg, border: `1px solid ${rc.border}`, padding: "3px 10px", borderRadius: 10 }}>{m.role}</span>
          </div>
        ); })}
      </div>
    </main>
  );
}

// ─── Page: Change Password ────────────────────────────────────────────────────
function PagePassword() {
  const [show, setShow] = useState(false);
  const [saved, setSaved] = useState(false);
  const field = (label: string, ph: string) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7296", marginBottom: 6, letterSpacing: "0.03em" }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: "#181b2a", border: "1px solid #252840", borderRadius: 8, padding: "10px 14px", gap: 8 }}>
        <input type={show ? "text" : "password"} placeholder={ph} style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: "#d4d8f0", fontFamily: "inherit" }} />
        <button onClick={() => setShow(!show)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex" }}>
          {show ? <EyeOff size={14} color="#3a3f5c" /> : <Eye size={14} color="#3a3f5c" />}
        </button>
      </div>
    </div>
  );
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Change Password</h1>
        <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: "0 0 28px" }}>Update your security credentials</p>
        <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, padding: "24px" }}>
          {field("Current Password", "Enter current password")}
          {field("New Password", "Min. 8 characters")}
          {field("Confirm New Password", "Repeat new password")}
          {/* Strength */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: "#3a3f5c" }}>Password strength</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#34d399" }}>Strong</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {[1,2,3,4].map(i => <div key={i} style={{ flex: 1, height: 4, borderRadius: 4, background: i <= 3 ? "#34d399" : "#1c1f30" }} />)}
            </div>
          </div>
          <button
            onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            style={{ width: "100%", padding: "11px", background: saved ? "#052e16" : "linear-gradient(135deg,#4f46e5,#7c3aed)", border: saved ? "1px solid #166534" : "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: saved ? "#4ade80" : "#fff", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, boxShadow: saved ? "none" : "0 0 16px rgba(99,102,241,0.35)" }}>
            {saved ? <><Check size={14} /> Password Updated</> : <><Shield size={14} color="#fff" /> Update Password</>}
          </button>
        </div>
      </div>
    </main>
  );
}

// ─── Page router ─────────────────────────────────────────────────────────────
const PAGE_META: Record<string, { title: string; sub?: string }> = {
  "/dashboard": { title: "Dashboard" },
  "/":          { title: "Dashboard" },
  "/new-pitch": { title: "Generate Pitch", sub: "New pharmacy onboarding" },
  "/territories": { title: "Territory Explorer", sub: "Catchment checker" },
  "/catchment-checker": { title: "Territory Explorer", sub: "Catchment checker" },
  "/wizard":    { title: "SEO Wizard", sub: "Campaign builder" },
  "/growth-engine": { title: "Growth Engine", sub: "Plan & intelligence" },
  "/content-review": { title: "Content Review", sub: "Authority audit" },
  "/review-centre": { title: "Review Centre", sub: "Approve campaign pages" },
  "/pages":     { title: "Page Preview" },
  "/images":    { title: "Image Packs" },
  "/designs":   { title: "Designs" },
  "/rankings":  { title: "Rankings" },
  "/health":    { title: "System Health" },
  "/crawl":     { title: "Live Crawl" },
  "/security":  { title: "Security" },
  "/team":      { title: "Team" },
  "/password":  { title: "Change Password" },
};

function pathToNav(path: string): string {
  const clean = (path.split("?")[0] || "/").replace(/\/$/, "") || "/";
  if (clean === "/" || clean === "/dashboard") return "/dashboard";
  if (clean === "/catchment-checker") return "/territories";
  if (clean.startsWith("/services") || clean.startsWith("/pages")) return "/pages";
  if (PAGE_META[clean]) return clean;
  return "/dashboard";
}

function EmbeddedToolFrame({ src, title }: { src: string; title: string }) {
  if (!src) {
    return (
      <main style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#0b0d14" }}>
        <p style={{ color: "#6b7296", fontSize: 13 }}>Select a pharmacy to open {title}.</p>
      </main>
    );
  }
  return (
    <main style={{ flex: 1, minHeight: 0, overflow: "hidden", background: "#0b0d14" }}>
      <iframe title={title} src={src} style={{ width: "100%", height: "100%", border: 0, display: "block", background: "#0b0d14" }} />
    </main>
  );
}

function PageContent({
  active,
  setActive,
  setProject,
  wizardSrc,
  growthSrc,
  reviewSrc,
  contentReviewSrc,
  onOpenCampaign,
  onImportClient,
}: {
  active: string;
  setActive: (h: string) => void;
  setProject: (p: string) => void;
  wizardSrc: string;
  growthSrc: string;
  reviewSrc: string;
  contentReviewSrc: string;
  onOpenCampaign: (slug: string, serviceKey: string) => void;
  onImportClient: () => void;
}) {
  switch (active) {
    case "/dashboard": return <PageDashboard setActive={setActive} setProject={setProject} onOpenCampaign={onOpenCampaign} onImportClient={onImportClient} />;
    case "/new-pitch": return <GeneratePharmacyPitchWizard />;
    case "/territories": return <TerritoryExplorer />;
    case "/wizard":    return <PageWizard src={wizardSrc} />;
    case "/growth-engine": return <EmbeddedToolFrame src={growthSrc} title="Growth Engine" />;
    case "/content-review": return <EmbeddedToolFrame src={contentReviewSrc} title="Content Review" />;
    case "/review-centre": return <EmbeddedToolFrame src={reviewSrc} title="Review Centre" />;
    case "/pages":     return <PagePreview />;
    case "/images":    return <PageImages />;
    case "/designs":   return <PageDesigns />;
    case "/rankings":  return <PageRankings />;
    case "/health":    return <PageHealth />;
    case "/crawl":     return <PageCrawl />;
    case "/security":  return <PageSecurity />;
    case "/team":      return <PageTeam />;
    case "/password":  return <PagePassword />;
    default:           return <PageDashboard setActive={setActive} setProject={setProject} onOpenCampaign={onOpenCampaign} onImportClient={onImportClient} />;
  }
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function DarkDashboardShell() {
  const [location, setLocation] = useLocation();
  const [active, setActiveState] = useState(() => pathToNav(location));
  const [project,     setProject]     = useState("PharmaConnect");
  const [projectOpen, setProjectOpen] = useState(false);
  const [wizardSrc,   setWizardSrc]   = useState("");
  const [importOpen,  setImportOpen]  = useState(false);
  const [toolSlug, setToolSlug] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("slug") || localStorage.getItem("selectedSlug") || "",
  );
  useEffect(() => {
    const syncSlug = () => {
      setToolSlug(new URLSearchParams(window.location.search).get("slug") || localStorage.getItem("selectedSlug") || "");
    };
    window.addEventListener("popstate", syncSlug);
    window.addEventListener("pharmacy-workspace-activate", syncSlug);
    window.addEventListener("pharmacy-workspace-close", syncSlug);
    return () => {
      window.removeEventListener("popstate", syncSlug);
      window.removeEventListener("pharmacy-workspace-activate", syncSlug);
      window.removeEventListener("pharmacy-workspace-close", syncSlug);
    };
  }, []);
  const setActive = (href: string) => {
    const [pathPart, queryPart] = href.split("?");
    const next = pathToNav(pathPart);
    if (next === "/wizard") {
      const workspaceSlug =
        (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("slug")) ||
        toolSlug ||
        "";
      if (workspaceSlug) {
        activatePharmacyWorkspace(workspaceSlug, "campaigns");
        setActiveState("/dashboard");
        return;
      }
      setActiveState("/dashboard");
      setLocation("/");
      return;
    }
    setActiveState(next);
    let search = queryPart ? `?${queryPart}` : "";
    if (!search && typeof window !== "undefined") {
      const slug = new URLSearchParams(window.location.search).get("slug");
      if (slug && next !== "/territories" && next !== "/new-pitch") {
        search = `?slug=${encodeURIComponent(slug)}`;
      }
    }
    const hash = typeof window === "undefined" ? "" : window.location.hash;
    setLocation((next === "/dashboard" ? "/" : next) + search + hash);
  };
  useEffect(() => {
    if (pathToNav(location) === "/wizard") {
      const workspaceSlug =
        (typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("slug")) ||
        toolSlug ||
        "";
      if (workspaceSlug) {
        activatePharmacyWorkspace(workspaceSlug, "campaigns");
        return;
      }
      setLocation("/");
      return;
    }
    setActiveState(pathToNav(location));
  }, [location, setLocation, toolSlug]);
  const meta = PAGE_META[active] ?? { title: "Dashboard" };
  const slug = toolSlug;
  const growthSrc = slug ? `/api/growth-engine?slug=${encodeURIComponent(slug)}&embedded=1` : "";
  const reviewSrc = slug ? `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&embedded=1` : "";
  const contentReviewSrc = slug ? `/api/pharmacy-authority-readiness?slug=${encodeURIComponent(slug)}&embedded=1` : "";
  const setupSrc = slug ? `/api/setup?slug=${encodeURIComponent(slug)}&embedded=1` : "";
  const openCampaignBuilder = (nextSlug: string, serviceKey: string) => {
    setWizardSrc(campaignBuilderChooseUrl(nextSlug, serviceKey));
    activatePharmacyWorkspace(nextSlug, "campaigns", serviceKey);
  };
  const openImportClient = () => setImportOpen(true);

  return (
    <div
      style={{ display: "flex", height: "100%", minHeight: 0, flex: 1, fontFamily: "'Inter', system-ui, sans-serif", background: "#0b0d14", color: "#c8d0e0", overflow: "hidden" }}
      onClick={() => setProjectOpen(false)}
    >
      <Sidebar active={active} setActive={setActive} project={project} setProject={setProject} projectOpen={projectOpen} setProjectOpen={setProjectOpen} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar project={project} title={meta.title} sub={wizardSrc && active === "/wizard" ? "Campaign builder" : meta.sub} setActive={setActive} onImportClient={openImportClient} />
        <PageContent
          active={active}
          setActive={setActive}
          setProject={setProject}
          wizardSrc={wizardSrc || setupSrc}
          growthSrc={growthSrc}
          reviewSrc={reviewSrc}
          contentReviewSrc={contentReviewSrc}
          onOpenCampaign={openCampaignBuilder}
          onImportClient={openImportClient}
        />
      </div>
      <GoogleMapsImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}

export default DarkDashboardShell;
