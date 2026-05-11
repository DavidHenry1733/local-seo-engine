import { useState } from "react";
import {
  LayoutDashboard, Wand2, FileSearch, TrendingUp, Image,
  Palette, Activity, Globe, ShieldCheck, Users, KeyRound,
  Bell, Search, FolderOpen, ChevronDown, Settings,
  Zap, CheckCircle2, ChevronRight, BookOpen,
  Check, RefreshCw, Play, BarChart2,
} from "lucide-react";

// ─── Nav config (identical to DarkSidebar) ───────────────────────────────────
const NAV_GROUPS = [
  {
    id: "campaigns", label: "CAMPAIGNS",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",       sub: "Overview & stats",       href: "/api/dashboard",            color: "#818cf8", badge: null },
      { icon: Wand2,           label: "SEO Wizard",      sub: "Campaign builder",       href: "/api/setup",                color: "#a78bfa", badge: "8 stages" },
      { icon: FileSearch,      label: "Page Preview",    sub: "Browse generated pages", href: "/api/preview",              color: "#60a5fa", badge: "169" },
      { icon: Image,           label: "Image Packs",     sub: "Manage visual assets",   href: "/api/dashboard#tab-packs",  color: "#fbbf24", badge: null },
      { icon: Palette,         label: "Designs",         sub: "UI design variants",     href: "/api/designs",              color: "#f472b6", badge: null },
    ],
  },
  {
    id: "analytics", label: "ANALYTICS",
    items: [
      { icon: TrendingUp,  label: "Rankings",      sub: "Keyword positions",    href: "/api/ranking",               color: "#34d399", badge: null },
      { icon: Activity,    label: "System Health", sub: "Server & build status",href: "/api/dashboard#tab-health",  color: "#4ade80", badge: null },
      { icon: Globe,       label: "Live Crawl",    sub: "Index & crawl monitor",href: "/api/dashboard#tab-crawl",   color: "#38bdf8", badge: null },
      { icon: ShieldCheck, label: "Security",      sub: "Access & audit log",   href: "/api/dashboard#tab-security",color: "#fb7185", badge: null },
    ],
  },
  {
    id: "admin", label: "ADMIN",
    items: [
      { icon: Users,    label: "Team",            sub: "Users & permissions",  href: "/admin/users",           color: "#c084fc", badge: null },
      { icon: KeyRound, label: "Change Password", sub: "Security credentials", href: "/admin/change-password", color: "#94a3b8", badge: null },
    ],
  },
];

const PROJECTS   = ["InboxingProWeb", "Demo Project", "+ New project"];
const QUICK_STATS = [
  { label: "Pages",   value: "169",  color: "#818cf8" },
  { label: "Indexed", value: "142",  color: "#34d399" },
  { label: "Avg Pos.",value: "14.2", color: "#60a5fa" },
];

// ─── Wizard stepper data ──────────────────────────────────────────────────────
const STAGES = [
  { id: 1, label: "Profile" },
  { id: 2, label: "Service Areas" },
  { id: 3, label: "Keywords" },
  { id: 4, label: "Content" },
  { id: 5, label: "Generate" },
  { id: 6, label: "Deploy" },
  { id: 7, label: "Indexing" },
  { id: 8, label: "Done" },
];

const INDEX_STATS = [
  { label: "Total Pages", value: "169" },
  { label: "Indexed",     value: "142" },
  { label: "Pending",     value: "27"  },
  { label: "Errors",      value: "0"   },
];

const KEYWORD_RANKINGS = [
  { keyword: "web design rotherham",         position: 3,  change: "+2", volume: "1,200", difficulty: "Medium" },
  { keyword: "seo agency rotherham",         position: 5,  change: "+1", volume: "850",   difficulty: "High"   },
  { keyword: "affordable web design barnsley",position: 1, change: "0",  volume: "450",   difficulty: "Low"    },
  { keyword: "local seo expert sheffield",   position: 8,  change: "+4", volume: "2,100", difficulty: "Hard"   },
  { keyword: "ecommerce website design",     position: 12, change: "-1", volume: "3,500", difficulty: "Hard"   },
];

const positionColor = (p: number) =>
  p <= 3 ? { bg: "#052e16", text: "#4ade80", border: "#166534" }
  : p <= 10 ? { bg: "#1e1b4b", text: "#818cf8", border: "#312e81" }
  : { bg: "#1a1c2e", text: "#6b7296", border: "#252840" };

// ─── Component ────────────────────────────────────────────────────────────────
export function DarkSidebarWizard() {
  const [active,      setActive]      = useState("/api/setup");
  const [projectOpen, setProjectOpen] = useState(false);
  const [project,     setProject]     = useState("InboxingProWeb");
  const [isChecking,  setIsChecking]  = useState(false);
  const currentStage = 8;

  const currentPage = { title: "SEO Wizard", sub: "Stage 8 — Indexing & Rankings" };

  return (
    <div
      style={{
        display: "flex", height: "900px",
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#0b0d14", color: "#c8d0e0",
        overflow: "hidden",
      }}
      onClick={() => setProjectOpen(false)}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside style={{
        width: 256, background: "#10121c",
        borderRight: "1px solid #1c1f30",
        display: "flex", flexDirection: "column", flexShrink: 0,
      }}>
        {/* Logo */}
        <div style={{ padding: "16px 16px 14px", borderBottom: "1px solid #1c1f30" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 14px rgba(99,102,241,0.4)",
            }}>
              <Zap size={14} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "#e4e8f5", letterSpacing: "-0.01em", lineHeight: 1.1 }}>SEO Engine</div>
              <div style={{ fontSize: 10, color: "#3a3f5c", marginTop: 1 }}>Local Content Platform</div>
            </div>
          </div>

          {/* Project switcher */}
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => { e.stopPropagation(); setProjectOpen(!projectOpen); }}
              style={{
                width: "100%", background: "#181b2a", border: "1px solid #252840",
                borderRadius: 8, padding: "8px 10px", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: "#2a1f60", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <FolderOpen size={11} color="#818cf8" />
                </div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#d4d8f0", maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project}</span>
              </div>
              <ChevronDown size={13} color="#3a3f5c" style={{ transform: projectOpen ? "rotate(180deg)" : "none", transition: "0.2s", flexShrink: 0 }} />
            </button>

            {projectOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
                background: "#181b2a", border: "1px solid #252840", borderRadius: 8,
                boxShadow: "0 12px 32px rgba(0,0,0,0.5)", zIndex: 50, overflow: "hidden",
              }}>
                {PROJECTS.map((p, i) => (
                  <button key={p}
                    onClick={(e) => { e.stopPropagation(); if (i < 2) setProject(p); setProjectOpen(false); }}
                    style={{
                      width: "100%", padding: "9px 12px",
                      background: p === project ? "#22263a" : "transparent",
                      border: "none", cursor: "pointer", textAlign: "left",
                      fontSize: 12.5, color: i === 2 ? "#818cf8" : "#d4d8f0",
                      fontWeight: i === 2 ? 500 : 400,
                      borderTop: i === 2 ? "1px solid #252840" : "none",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                    }}
                  >
                    {p}
                    {p === project && <CheckCircle2 size={12} color="#818cf8" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "8px 10px", scrollbarWidth: "none" }}>
          {NAV_GROUPS.map((group) => (
            <div key={group.id} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#2e3250", letterSpacing: "0.09em", padding: "8px 8px 4px" }}>
                {group.label}
              </div>
              {group.items.map((item) => {
                const isActive = active === item.href;
                return (
                  <button key={item.href} onClick={() => setActive(item.href)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 10,
                      padding: "7px 8px", borderRadius: 7, border: "none", cursor: "pointer",
                      background: isActive ? "linear-gradient(90deg, #1a1d30 0%, #1e2038 100%)" : "transparent",
                      marginBottom: 1, position: "relative", transition: "background 0.12s",
                    }}
                  >
                    {isActive && (
                      <div style={{
                        position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                        width: 3, height: 22, borderRadius: "0 3px 3px 0",
                        background: item.color, boxShadow: `0 0 8px ${item.color}88`,
                      }} />
                    )}
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: isActive ? item.color + "22" : "#181b2a",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, transition: "background 0.12s",
                    }}>
                      <item.icon size={13} color={isActive ? item.color : "#3a3f5c"} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div style={{ fontSize: 12.5, fontWeight: isActive ? 600 : 400, color: isActive ? "#e4e8f5" : "#6b7296", lineHeight: 1.25 }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 10.5, color: isActive ? "#4a5080" : "#2e3250", marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.sub}
                      </div>
                    </div>
                    {item.badge && (
                      <span style={{
                        fontSize: 10, fontWeight: 600,
                        color: isActive ? item.color : "#3a3f5c",
                        background: isActive ? item.color + "22" : "#181b2a",
                        border: `1px solid ${isActive ? item.color + "44" : "#252840"}`,
                        padding: "1px 6px", borderRadius: 10, flexShrink: 0,
                      }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Stats bar */}
        <div style={{ padding: "10px 14px", borderTop: "1px solid #1c1f30", display: "flex" }}>
          {QUICK_STATS.map((s, i) => (
            <div key={s.label} style={{ flex: 1, textAlign: "center", borderRight: i < 2 ? "1px solid #1c1f30" : "none" }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: s.color, lineHeight: 1, letterSpacing: "-0.02em" }}>{s.value}</div>
              <div style={{ fontSize: 9.5, color: "#2e3250", marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* User footer */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid #1c1f30", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
            boxShadow: "0 0 10px rgba(99,102,241,0.3)",
          }}>A</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#c8d0e0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Admin</div>
            <div style={{ fontSize: 10.5, color: "#2e3250" }}>inboxingproweb.com</div>
          </div>
          <Settings size={15} color="#2e3250" style={{ cursor: "pointer", flexShrink: 0 }} />
        </div>
      </aside>

      {/* ── Main area ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header style={{
          height: 52, background: "#10121c", borderBottom: "1px solid #1c1f30",
          display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#3a3f5c" }}>
            <BookOpen size={13} color="#2e3250" />
            <span>{project}</span>
            <ChevronRight size={12} color="#2e3250" />
            <span style={{ color: "#c8d0e0", fontWeight: 600 }}>{currentPage.title}</span>
            <ChevronRight size={12} color="#2e3250" />
            <span style={{ color: "#a78bfa", fontWeight: 500, fontSize: 12 }}>Stage 8</span>
          </div>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8,
            background: "#181b2a", border: "1px solid #1c1f30", borderRadius: 8,
            padding: "7px 14px", maxWidth: 360, marginLeft: "auto", cursor: "text",
          }}>
            <Search size={13} color="#2e3250" />
            <span style={{ fontSize: 12.5, color: "#2e3250" }}>Jump to page, campaign…</span>
            <kbd style={{ marginLeft: "auto", fontSize: 10, color: "#2e3250", background: "#10121c", padding: "2px 6px", borderRadius: 4, border: "1px solid #1c1f30" }}>⌘K</kbd>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
              <Bell size={17} color="#3a3f5c" />
              <span style={{ position: "absolute", top: 2, right: 2, width: 7, height: 7, borderRadius: "50%", background: "#818cf8", border: "2px solid #10121c" }} />
            </button>
            <button
              onClick={() => setActive("/api/setup")}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer",
                boxShadow: "0 0 14px rgba(99,102,241,0.3)",
              }}
            >
              <Wand2 size={13} color="#fff" />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>New Campaign</span>
            </button>
          </div>
        </header>

        {/* Wizard content */}
        <main style={{ flex: 1, overflowY: "auto", background: "#0b0d14", padding: "28px 32px" }}>

          {/* Stage stepper */}
          <div style={{ marginBottom: 32, position: "relative" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative" }}>
              {/* Track */}
              <div style={{ position: "absolute", left: 0, right: 0, top: 15, height: 2, background: "#1c1f30", zIndex: 0 }} />
              <div style={{
                position: "absolute", left: 0, top: 15, height: 2,
                width: `${((currentStage - 1) / (STAGES.length - 1)) * 100}%`,
                background: "linear-gradient(90deg, #6366f1, #a78bfa)", zIndex: 1,
              }} />
              {STAGES.map((stage) => {
                const done   = stage.id < currentStage;
                const active = stage.id === currentStage;
                return (
                  <div key={stage.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", zIndex: 2 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "50%",
                      background: done ? "#6366f1" : active ? "#10121c" : "#10121c",
                      border: done ? "2px solid #6366f1" : active ? "2px solid #a78bfa" : "2px solid #1c1f30",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      boxShadow: active ? "0 0 12px rgba(167,139,250,0.5)" : "none",
                      transition: "all 0.2s",
                    }}>
                      {done
                        ? <Check size={13} color="#fff" strokeWidth={3} />
                        : <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#a78bfa" : "#2e3250" }}>{stage.id}</span>
                      }
                    </div>
                    <span style={{
                      fontSize: 9.5, fontWeight: 600, letterSpacing: "0.06em",
                      color: active ? "#a78bfa" : done ? "#4a5080" : "#2e3250",
                      textTransform: "uppercase", whiteSpace: "nowrap",
                    }}>
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stage heading */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#1a1d30", border: "1px solid #a78bfa33", borderRadius: 20, padding: "4px 14px", marginBottom: 12 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#a78bfa" }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: "#a78bfa", letterSpacing: "0.06em" }}>STAGE 8 OF 8</span>
            </div>
            <h1 style={{ color: "#e4e8f5", fontSize: 20, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
              Indexing &amp; Rankings
            </h1>
            <p style={{ fontSize: 13, color: "#4a5080", margin: 0, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
              Monitor Google Search Console indexing status and track keyword ranking movements for your deployed pages.
            </p>
          </div>

          {/* Stats cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
            {INDEX_STATS.map((s) => (
              <div key={s.label} style={{
                background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12,
                padding: "16px 18px",
              }}>
                <div style={{ fontSize: 11, color: "#3a3f5c", marginBottom: 6, letterSpacing: "0.04em" }}>{s.label}</div>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#e4e8f5", letterSpacing: "-0.02em" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Keyword rankings table */}
          <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #1c1f30", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#1a1d30", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <BarChart2 size={16} color="#818cf8" />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#e4e8f5" }}>Keyword Rankings</div>
                <div style={{ fontSize: 11, color: "#3a3f5c" }}>Initial SERP positions for target clusters</div>
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #1c1f30" }}>
                  {["Target Keyword", "Position", "Change", "Vol / Diff"].map((h) => (
                    <th key={h} style={{ padding: "10px 20px", fontSize: 10.5, fontWeight: 600, color: "#2e3250", letterSpacing: "0.06em", textAlign: "left" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {KEYWORD_RANKINGS.map((row, i) => {
                  const pc = positionColor(row.position);
                  return (
                    <tr key={i} style={{ borderBottom: i < KEYWORD_RANKINGS.length - 1 ? "1px solid #1c1f30" : "none" }}>
                      <td style={{ padding: "12px 20px" }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: "#d4d8f0" }}>{row.keyword}</div>
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: pc.text, background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: 6, padding: "3px 9px" }}>
                          #{row.position}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px" }}>
                        <span style={{
                          fontSize: 11.5, fontWeight: 600,
                          color: row.change.startsWith("+") ? "#4ade80" : row.change.startsWith("-") ? "#fb7185" : "#3a3f5c",
                        }}>
                          {row.change === "0" ? "—" : row.change}
                        </span>
                      </td>
                      <td style={{ padding: "12px 20px", fontSize: 11.5, color: "#4a5080" }}>
                        {row.volume} <span style={{ color: "#252840" }}>/</span> {row.difficulty}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer actions */}
          <div style={{ display: "flex", justifyContent: "center", gap: 12, paddingTop: 4 }}>
            <button
              onClick={() => { setIsChecking(true); setTimeout(() => setIsChecking(false), 2000); }}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "10px 20px",
                background: "none", border: "1px solid #252840", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 500, color: "#6b7296",
              }}
            >
              <RefreshCw size={14} color="#6b7296" style={{ animation: isChecking ? "spin 1s linear infinite" : "none" }} />
              Refresh Data
            </button>
            <button
              onClick={() => { setIsChecking(true); setTimeout(() => setIsChecking(false), 2000); }}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "10px 24px",
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                border: "none", borderRadius: 8, cursor: "pointer",
                fontSize: 13, fontWeight: 600, color: "#fff",
                boxShadow: "0 0 18px rgba(99,102,241,0.35)",
              }}
            >
              <Play size={13} color="#fff" fill="#fff" />
              {isChecking ? "Running Check…" : "Run Fresh Check"}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
