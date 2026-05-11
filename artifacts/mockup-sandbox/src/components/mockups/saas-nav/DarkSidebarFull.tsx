import { useState } from "react";
import {
  LayoutDashboard, Wand2, FileSearch, TrendingUp, Image,
  Palette, Activity, Globe, ShieldCheck, Users, KeyRound,
  Bell, Search, FolderOpen, ChevronDown, Settings,
  Zap, CheckCircle2, ChevronRight, BookOpen,
  Check, ArrowUpRight, BarChart2, BarChart3,
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
      { icon: Wand2,           label: "SEO Wizard",      sub: "Campaign builder",       href: "/wizard",         color: "#a78bfa", badge: "8 stages" },
      { icon: FileSearch,      label: "Page Preview",    sub: "Browse generated pages", href: "/pages",          color: "#60a5fa", badge: "169" },
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

// ─── Colour helpers ───────────────────────────────────────────────────────────
const posColor = (p: number) =>
  p <= 3  ? { bg: "#052e16", text: "#4ade80", border: "#166534" }
  : p <= 10 ? { bg: "#1e1b4b", text: "#818cf8", border: "#312e81" }
  : { bg: "#1a1c2e", text: "#6b7296", border: "#252840" };

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
function TopBar({ project, title, sub, setActive }: { project: string; title: string; sub?: string; setActive: (h: string) => void }) {
  return (
    <header style={{ height: 52, background: "#10121c", borderBottom: "1px solid #1c1f30", display: "flex", alignItems: "center", padding: "0 20px", gap: 12, flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#3a3f5c" }}>
        <BookOpen size={13} color="#2e3250" />
        <span>{project}</span>
        <ChevronRight size={12} color="#2e3250" />
        <span style={{ color: "#c8d0e0", fontWeight: 600 }}>{title}</span>
        {sub && <><ChevronRight size={12} color="#2e3250" /><span style={{ color: "#a78bfa", fontWeight: 500, fontSize: 12 }}>{sub}</span></>}
      </div>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: "#181b2a", border: "1px solid #1c1f30", borderRadius: 8, padding: "7px 14px", maxWidth: 360, marginLeft: "auto", cursor: "text" }}>
        <Search size={13} color="#2e3250" />
        <span style={{ fontSize: 12.5, color: "#2e3250" }}>Jump to page, campaign…</span>
        <kbd style={{ marginLeft: "auto", fontSize: 10, color: "#2e3250", background: "#10121c", padding: "2px 6px", borderRadius: 4, border: "1px solid #1c1f30" }}>⌘K</kbd>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
          <Bell size={17} color="#3a3f5c" />
          <span style={{ position: "absolute", top: 2, right: 2, width: 7, height: 7, borderRadius: "50%", background: "#818cf8", border: "2px solid #10121c" }} />
        </button>
        <button onClick={() => setActive("/wizard")} style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer", boxShadow: "0 0 14px rgba(99,102,241,0.3)" }}>
          <Wand2 size={13} color="#fff" />
          <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>New Campaign</span>
        </button>
      </div>
    </header>
  );
}

// ─── Page: Dashboard ─────────────────────────────────────────────────────────
function PageDashboard({ setActive }: { setActive: (h: string) => void }) {
  const stats = [
    { label: "Pages Live",   value: "169", sub: "4 campaigns",      color: "#818cf8", icon: FileText },
    { label: "Indexed",      value: "142", sub: "84% coverage",     color: "#34d399", icon: Globe2 },
    { label: "Avg Position", value: "14.2",sub: "▼ 2.1 better",    color: "#60a5fa", icon: TrendingUp },
    { label: "Impressions",  value: "8.4k",sub: "+23% this week",   color: "#fbbf24", icon: BarChart3 },
  ];
  const campaigns = [
    { name: "Local SEO",       area: "Sheffield",  pages: 24, color: "#818cf8" },
    { name: "Web Design",      area: "Barnsley",   pages: 18, color: "#60a5fa" },
    { name: "Email Marketing", area: "Rotherham",  pages: 31, color: "#fb7185" },
    { name: "Website Hosting", area: "Doncaster",  pages: 21, color: "#fbbf24" },
  ];
  const quick = [
    { label: "SEO Wizard",    href: "/wizard",   icon: Wand2 },
    { label: "Page Preview",  href: "/pages",    icon: FileSearch },
    { label: "Rankings",      href: "/rankings", icon: TrendingUp },
    { label: "System Health", href: "/health",   icon: Activity },
    { label: "Team",          href: "/team",     icon: Users },
  ];
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Dashboard</h1>
          <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>Campaign overview · InboxingProWeb</p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 6, background: "#181b2a", border: "1px solid #252840", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "#6b7296" }}>
          <ExternalLink size={12} color="#6b7296" /> Open live page
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 24 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
              <span style={{ fontSize: 11.5, color: "#3a3f5c", letterSpacing: "0.03em" }}>{s.label}</span>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: s.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <s.icon size={13} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#e4e8f5", letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 6 }}>{s.value}</div>
            <div style={{ fontSize: 10.5, color: "#34d399" }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 14 }}>
        <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1c1f30", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e4e8f5" }}>Active Campaigns</span>
            <button onClick={() => setActive("/pages")} style={{ fontSize: 11.5, color: "#818cf8", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>View all <ArrowUpRight size={11} /></button>
          </div>
          {campaigns.map((c, i) => (
            <div key={c.name} style={{ padding: "14px 20px", borderBottom: i < campaigns.length - 1 ? "1px solid #1c1f30" : "none", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#d4d8f0" }}>{c.name}</span>
                <span style={{ fontSize: 12, color: "#3a3f5c" }}> · {c.area}</span>
              </div>
              <span style={{ fontSize: 11.5, color: "#4a5080" }}>{c.pages} pages</span>
              <span style={{ fontSize: 10, fontWeight: 600, color: "#34d399", background: "#052e16", border: "1px solid #166534", padding: "2px 8px", borderRadius: 10 }}>Live</span>
            </div>
          ))}
        </div>
        <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1c1f30" }}>
            <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e4e8f5" }}>Quick Access</span>
          </div>
          {quick.map((q) => (
            <button key={q.label} onClick={() => setActive(q.href)} style={{ width: "100%", padding: "13px 20px", borderBottom: "1px solid #1c1f30", background: "none", border: "none", borderBottom: "1px solid #1c1f30", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <q.icon size={13} color="#3a3f5c" />
                <span style={{ fontSize: 12.5, color: "#6b7296" }}>{q.label}</span>
              </div>
              <Plus size={13} color="#252840" />
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

// ─── Page: SEO Wizard ─────────────────────────────────────────────────────────
const STAGES = ["Profile","Service Areas","Keywords","Content","Generate","Deploy","Indexing","Done"];
function PageWizard() {
  const cur = 8;
  const [checking, setChecking] = useState(false);
  const keywords = [
    { kw: "web design rotherham",          pos: 3,  ch: "+2", vol: "1,200", diff: "Medium" },
    { kw: "seo agency rotherham",          pos: 5,  ch: "+1", vol: "850",   diff: "High"   },
    { kw: "affordable web design barnsley",pos: 1,  ch: "0",  vol: "450",   diff: "Low"    },
    { kw: "local seo expert sheffield",    pos: 8,  ch: "+4", vol: "2,100", diff: "Hard"   },
    { kw: "ecommerce website design",      pos: 12, ch: "-1", vol: "3,500", diff: "Hard"   },
  ];
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
        <p style={{ fontSize: 13, color: "#4a5080", margin: 0 }}>Monitor Google Search Console indexing and keyword ranking movements for your deployed pages.</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
        {[["Total Pages","169"],["Indexed","142"],["Pending","27"],["Errors","0"]].map(([l,v]) => (
          <div key={l} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12, padding: "16px 18px" }}>
            <div style={{ fontSize: 11, color: "#3a3f5c", marginBottom: 6 }}>{l}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "#e4e8f5", letterSpacing: "-0.02em" }}>{v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden", marginBottom: 20 }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #1c1f30", display: "flex", alignItems: "center", gap: 10 }}>
          <BarChart2 size={15} color="#818cf8" />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#e4e8f5" }}>Keyword Rankings</span>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid #1c1f30" }}>
            {["Target Keyword","Position","Change","Vol / Diff"].map(h => <th key={h} style={{ padding: "9px 18px", fontSize: 10.5, fontWeight: 600, color: "#2e3250", textAlign: "left", letterSpacing: "0.05em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {keywords.map((r, i) => { const pc = posColor(r.pos); return (
              <tr key={i} style={{ borderBottom: i < keywords.length - 1 ? "1px solid #1c1f30" : "none" }}>
                <td style={{ padding: "11px 18px", fontSize: 12.5, fontWeight: 500, color: "#d4d8f0" }}>{r.kw}</td>
                <td style={{ padding: "11px 18px" }}><span style={{ fontSize: 11, fontWeight: 700, color: pc.text, background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: 6, padding: "3px 9px" }}>#{r.pos}</span></td>
                <td style={{ padding: "11px 18px", fontSize: 11.5, fontWeight: 600, color: r.ch.startsWith("+") ? "#4ade80" : r.ch.startsWith("-") ? "#fb7185" : "#3a3f5c" }}>{r.ch === "0" ? "—" : r.ch}</td>
                <td style={{ padding: "11px 18px", fontSize: 11.5, color: "#4a5080" }}>{r.vol} / {r.diff}</td>
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
  const pages = [
    { title: "Web Design Sheffield",      url: "/web-design-sheffield",      status: "live",    score: 94 },
    { title: "Local SEO Barnsley",        url: "/local-seo-barnsley",        status: "live",    score: 88 },
    { title: "Web Design Rotherham",      url: "/web-design-rotherham",      status: "live",    score: 91 },
    { title: "Email Marketing Sheffield", url: "/email-marketing-sheffield",  status: "live",    score: 76 },
    { title: "Website Hosting Barnsley",  url: "/website-hosting-barnsley",  status: "live",    score: 83 },
    { title: "Local SEO Doncaster",       url: "/local-seo-doncaster",       status: "review",  score: 62 },
    { title: "Web Design Doncaster",      url: "/web-design-doncaster",      status: "live",    score: 89 },
    { title: "Email Marketing Barnsley",  url: "/email-marketing-barnsley",  status: "live",    score: 79 },
    { title: "Website Hosting Sheffield", url: "/website-hosting-sheffield", status: "live",    score: 87 },
  ];
  const scoreColor = (s: number) => s >= 85 ? "#4ade80" : s >= 70 ? "#fbbf24" : "#fb7185";
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Page Preview</h1>
          <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>169 generated pages across 4 campaigns</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={{ display: "flex", alignItems: "center", gap: 6, background: "#181b2a", border: "1px solid #252840", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "#6b7296" }}><Filter size={12} /> Filter</button>
          <button style={{ display: "flex", alignItems: "center", gap: 6, background: "#181b2a", border: "1px solid #252840", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "#6b7296" }}><Download size={12} /> Export</button>
        </div>
      </div>
      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#10121c", border: "1px solid #1c1f30", borderRadius: 8, padding: "9px 14px", marginBottom: 20 }}>
        <Search size={13} color="#2e3250" />
        <span style={{ fontSize: 12.5, color: "#2e3250" }}>Search pages by title, URL, or service…</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 }}>
        {pages.map((p) => (
          <div key={p.url} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12, padding: "16px 18px", cursor: "pointer" }}>
            {/* Mock page thumbnail */}
            <div style={{ height: 80, background: "#0b0d14", borderRadius: 8, marginBottom: 12, border: "1px solid #1c1f30", display: "flex", flexDirection: "column", padding: "8px 10px", gap: 4 }}>
              <div style={{ height: 8, width: "70%", background: "#1c1f30", borderRadius: 4 }} />
              <div style={{ height: 6, width: "90%", background: "#151722", borderRadius: 4 }} />
              <div style={{ height: 6, width: "80%", background: "#151722", borderRadius: 4 }} />
              <div style={{ height: 6, width: "60%", background: "#151722", borderRadius: 4 }} />
              <div style={{ marginTop: 4, height: 14, width: 60, background: "#1a1d30", borderRadius: 4, border: "1px solid #252840" }} />
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#d4d8f0", marginBottom: 4 }}>{p.title}</div>
            <div style={{ fontSize: 10.5, color: "#3a3f5c", fontFamily: "monospace", marginBottom: 10 }}>{p.url}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: p.status === "live" ? "#4ade80" : "#fbbf24", background: p.status === "live" ? "#052e16" : "#1c1a00", border: `1px solid ${p.status === "live" ? "#166534" : "#713f12"}`, padding: "2px 8px", borderRadius: 10 }}>
                {p.status === "live" ? "Live" : "Review"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 32, height: 4, background: "#1c1f30", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${p.score}%`, background: scoreColor(p.score), borderRadius: 4 }} />
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: scoreColor(p.score) }}>{p.score}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

// ─── Page: Image Packs ────────────────────────────────────────────────────────
function PageImages() {
  const packs = [
    { name: "Web Design — Sheffield",      count: 12, type: "AI Generated", color: "#818cf8", used: 8  },
    { name: "Local SEO — Barnsley",        count: 9,  type: "Library",      color: "#34d399", used: 9  },
    { name: "Email Marketing — Rotherham", count: 15, type: "Hybrid",       color: "#f472b6", used: 12 },
    { name: "Website Hosting — Doncaster", count: 7,  type: "Uploaded",     color: "#fbbf24", used: 7  },
    { name: "Web Design — Rotherham",      count: 11, type: "AI Generated", color: "#818cf8", used: 6  },
    { name: "Local SEO — Sheffield",       count: 8,  type: "Library",      color: "#34d399", used: 8  },
  ];
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Image Packs</h1>
          <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>Visual asset library for all campaigns</p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 6, background: "linear-gradient(135deg,#4f46e5,#7c3aed)", border: "none", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600, color: "#fff" }}>
          <Plus size={13} color="#fff" /> New Pack
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {packs.map((p) => (
          <div key={p.name} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden", cursor: "pointer" }}>
            {/* Image grid preview */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 2, padding: 12 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ aspectRatio: "1", borderRadius: 5, background: i === 0 ? p.color + "33" : "#181b2a", border: `1px solid ${i === 0 ? p.color + "44" : "#1c1f30"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {i === 0 && <Image size={11} color={p.color} />}
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 16px", borderTop: "1px solid #1c1f30" }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#d4d8f0", marginBottom: 4 }}>{p.name}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10.5, color: "#3a3f5c" }}>{p.count} images · {p.type}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: p.color, background: p.color + "18", padding: "2px 8px", borderRadius: 10 }}>{p.used}/{p.count} used</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
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
  const rows = [
    { kw: "web design sheffield",          pos: 2,  prev: 4,  vol: "2,400", diff: "High"   },
    { kw: "web design rotherham",          pos: 3,  prev: 5,  vol: "1,200", diff: "Medium" },
    { kw: "local seo barnsley",            pos: 4,  prev: 4,  vol: "880",   diff: "Medium" },
    { kw: "seo agency rotherham",          pos: 5,  prev: 6,  vol: "850",   diff: "High"   },
    { kw: "affordable web design barnsley",pos: 1,  prev: 1,  vol: "450",   diff: "Low"    },
    { kw: "email marketing sheffield",     pos: 7,  prev: 11, vol: "620",   diff: "Medium" },
    { kw: "local seo expert sheffield",    pos: 8,  prev: 12, vol: "2,100", diff: "Hard"   },
    { kw: "website hosting barnsley",      pos: 9,  prev: 9,  vol: "390",   diff: "Low"    },
    { kw: "ecommerce website design",      pos: 12, prev: 11, vol: "3,500", diff: "Hard"   },
  ];
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Rankings</h1>
          <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>Keyword position tracker · Updated 2 hours ago</p>
        </div>
        <button style={{ display: "flex", alignItems: "center", gap: 6, background: "#181b2a", border: "1px solid #252840", borderRadius: 8, padding: "8px 14px", cursor: "pointer", fontSize: 12, color: "#6b7296" }}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[["Avg Position","6.8","▼ 1.4 better","#34d399"],["Top 3","3","keywords","#818cf8"],["Top 10","7","keywords","#60a5fa"]].map(([l,v,s,c]) => (
          <div key={l} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#3a3f5c", marginBottom: 8 }}>{l}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c, letterSpacing: "-0.03em", lineHeight: 1, marginBottom: 4 }}>{v}</div>
            <div style={{ fontSize: 10.5, color: "#4a5080" }}>{s}</div>
          </div>
        ))}
      </div>
      <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ borderBottom: "1px solid #1c1f30" }}>
            {["Keyword","Position","Change","Volume","Difficulty"].map(h => <th key={h} style={{ padding: "11px 18px", fontSize: 10.5, fontWeight: 600, color: "#2e3250", textAlign: "left", letterSpacing: "0.05em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const diff = r.prev - r.pos;
              const pc = posColor(r.pos);
              return (
                <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid #1c1f30" : "none" }}>
                  <td style={{ padding: "12px 18px", fontSize: 12.5, fontWeight: 500, color: "#d4d8f0" }}>{r.kw}</td>
                  <td style={{ padding: "12px 18px" }}><span style={{ fontSize: 11, fontWeight: 700, color: pc.text, background: pc.bg, border: `1px solid ${pc.border}`, borderRadius: 6, padding: "3px 9px" }}>#{r.pos}</span></td>
                  <td style={{ padding: "12px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 600, color: diff > 0 ? "#4ade80" : diff < 0 ? "#fb7185" : "#3a3f5c" }}>
                      {diff > 0 ? <TrendingUp size={12} /> : diff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                      {diff === 0 ? "—" : Math.abs(diff)}
                    </div>
                  </td>
                  <td style={{ padding: "12px 18px", fontSize: 11.5, color: "#4a5080" }}>{r.vol}</td>
                  <td style={{ padding: "12px 18px" }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 8, color: r.diff === "Low" ? "#4ade80" : r.diff === "Medium" ? "#fbbf24" : "#fb7185", background: r.diff === "Low" ? "#052e16" : r.diff === "Medium" ? "#1c1200" : "#1f0e0e", border: `1px solid ${r.diff === "Low" ? "#166534" : r.diff === "Medium" ? "#713f12" : "#7f1d1d"}` }}>{r.diff}</span>
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
  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px", letterSpacing: "-0.02em" }}>Security</h1>
        <p style={{ color: "#3a3f5c", fontSize: 12.5, margin: 0 }}>Access log & audit trail</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>
        {[["Active Sessions","1","#34d399",UserCheck],["Failed Logins","1","#fb7185",AlertCircle],["API Keys","3","#818cf8",Lock]].map(([l,v,c,I]) => (
          <div key={l} style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 12, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 11, color: "#3a3f5c", marginBottom: 6 }}>{l}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c, letterSpacing: "-0.02em" }}>{v}</div>
            </div>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: (c as string) + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <I size={16} color={c as string} />
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
  "/wizard":    { title: "SEO Wizard", sub: "Stage 8" },
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

function PageContent({ active, setActive }: { active: string; setActive: (h: string) => void }) {
  switch (active) {
    case "/dashboard": return <PageDashboard setActive={setActive} />;
    case "/wizard":    return <PageWizard />;
    case "/pages":     return <PagePreview />;
    case "/images":    return <PageImages />;
    case "/designs":   return <PageDesigns />;
    case "/rankings":  return <PageRankings />;
    case "/health":    return <PageHealth />;
    case "/crawl":     return <PageCrawl />;
    case "/security":  return <PageSecurity />;
    case "/team":      return <PageTeam />;
    case "/password":  return <PagePassword />;
    default:           return <PageDashboard setActive={setActive} />;
  }
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export function DarkSidebarFull() {
  const [active,      setActive]      = useState("/dashboard");
  const [project,     setProject]     = useState("InboxingProWeb");
  const [projectOpen, setProjectOpen] = useState(false);
  const meta = PAGE_META[active] ?? { title: "Dashboard" };

  return (
    <div
      style={{ display: "flex", height: "900px", fontFamily: "'Inter', system-ui, sans-serif", background: "#0b0d14", color: "#c8d0e0", overflow: "hidden" }}
      onClick={() => setProjectOpen(false)}
    >
      <Sidebar active={active} setActive={setActive} project={project} setProject={setProject} projectOpen={projectOpen} setProjectOpen={setProjectOpen} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar project={project} title={meta.title} sub={meta.sub} setActive={setActive} />
        <PageContent active={active} setActive={setActive} />
      </div>
    </div>
  );
}
