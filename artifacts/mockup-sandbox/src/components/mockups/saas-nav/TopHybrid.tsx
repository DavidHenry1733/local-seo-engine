import { useState } from "react";
import {
  LayoutDashboard, Wand2, FileSearch, TrendingUp, Image,
  Palette, Activity, Globe, ShieldCheck, Users, KeyRound,
  Bell, Search, ChevronDown, Settings, MoreHorizontal,
  Zap, BarChart3, CheckCircle2, ArrowUpRight, Menu,
  BookOpen, Layers, Database,
} from "lucide-react";

const ICON_RAIL = [
  { icon: LayoutDashboard, label: "Dashboard",   href: "/api/dashboard", color: "#6366f1" },
  { icon: Wand2,           label: "SEO Wizard",  href: "/api/setup",     color: "#8b5cf6" },
  { icon: FileSearch,      label: "Pages",       href: "/api/preview",   color: "#3b82f6" },
  { icon: TrendingUp,      label: "Rankings",    href: "/api/ranking",   color: "#10b981" },
  { icon: Image,           label: "Images",      href: "/api/dashboard#tab-packs", color: "#f59e0b" },
  { icon: Palette,         label: "Designs",     href: "/api/designs",   color: "#ec4899" },
  { icon: Activity,        label: "Health",      href: "/api/dashboard#tab-health", color: "#22c55e" },
  { icon: Globe,           label: "Crawl",       href: "/api/dashboard#tab-crawl",  color: "#06b6d4" },
  { icon: ShieldCheck,     label: "Security",    href: "/api/dashboard#tab-security", color: "#f43f5e" },
  { icon: Users,           label: "Team",        href: "/admin/users",   color: "#a78bfa" },
];

const TOP_NAV = [
  { label: "Overview",    href: "/api/dashboard" },
  { label: "Content",     items: [
    { label: "Page Preview",  href: "/api/preview",  icon: FileSearch },
    { label: "SEO Wizard",    href: "/api/setup",    icon: Wand2 },
    { label: "Image Packs",   href: "/api/dashboard#tab-packs", icon: Image },
    { label: "Designs",       href: "/api/designs",  icon: Palette },
  ]},
  { label: "Analytics",   items: [
    { label: "Rankings",      href: "/api/ranking",  icon: TrendingUp },
    { label: "System Health", href: "/api/dashboard#tab-health", icon: Activity },
    { label: "Live Crawl",    href: "/api/dashboard#tab-crawl",  icon: Globe },
  ]},
  { label: "System",      items: [
    { label: "Security",         href: "/api/dashboard#tab-security", icon: ShieldCheck },
    { label: "Team",             href: "/admin/users",                icon: Users },
    { label: "Change Password",  href: "/admin/change-password",      icon: KeyRound },
  ]},
];

const STATS = [
  { label: "Pages Live",   value: "169",  sub: "+7 this week",  color: "#6366f1", icon: Layers },
  { label: "Indexed",      value: "142",  sub: "83% coverage",  color: "#10b981", icon: CheckCircle2 },
  { label: "Avg Position", value: "14.2", sub: "↓2.1 improved", color: "#3b82f6", icon: TrendingUp },
  { label: "Total Pages",  value: "169",  sub: "4 campaigns",   color: "#f59e0b", icon: Database },
];

export function TopHybrid() {
  const [activeNav, setActiveNav] = useState("/api/dashboard");
  const [activeRail, setActiveRail] = useState("/api/dashboard");
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  return (
    <div style={{ display: "flex", height: "900px", fontFamily: "'Inter', system-ui, sans-serif", background: "#f1f5f9", flexDirection: "column" }}>

      {/* Top navigation bar */}
      <header style={{
        background: "#fff", borderBottom: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        height: 52, display: "flex", alignItems: "center", flexShrink: 0, zIndex: 10,
      }}>
        {/* Logo */}
        <div style={{
          width: 56, height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
          borderRight: "1px solid #f1f5f9",
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 2px 6px rgba(99,102,241,0.3)",
          }}>
            <Zap size={16} color="#fff" />
          </div>
        </div>

        {/* Project selector */}
        <button
          onClick={() => setOpenMenu(openMenu === "project" ? null : "project")}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "0 16px", height: "100%", border: "none",
            background: "none", cursor: "pointer", borderRight: "1px solid #f1f5f9",
          }}
        >
          <div style={{
            width: 20, height: 20, borderRadius: 5, background: "#ede9fe",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BookOpen size={11} color="#7c3aed" />
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#1e293b" }}>InboxingProWeb</span>
          <ChevronDown size={13} color="#94a3b8" />
        </button>

        {/* Top nav items */}
        <nav style={{ display: "flex", height: "100%", paddingLeft: 4 }}>
          {TOP_NAV.map((item) => {
            const isActive = "href" in item ? activeNav === item.href : false;
            const isOpen = openMenu === item.label;
            return (
              <div key={item.label} style={{ position: "relative" }}>
                <button
                  onClick={() => {
                    if ("href" in item) { setActiveNav(item.href); setOpenMenu(null); }
                    else setOpenMenu(isOpen ? null : item.label);
                  }}
                  style={{
                    height: "100%", padding: "0 14px", border: "none", cursor: "pointer",
                    background: "none", display: "flex", alignItems: "center", gap: 5,
                    borderBottom: `2px solid ${"href" in item && isActive ? "#6366f1" : "transparent"}`,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: isActive ? 600 : 400, color: isActive ? "#6366f1" : "#475569" }}>
                    {item.label}
                  </span>
                  {"items" in item && <ChevronDown size={12} color="#94a3b8" style={{ transform: isOpen ? "rotate(180deg)" : "none", transition: "0.15s" }} />}
                </button>

                {/* Dropdown */}
                {"items" in item && isOpen && (
                  <div style={{
                    position: "absolute", top: "100%", left: 0, zIndex: 100,
                    background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.12)", padding: "6px", minWidth: 200,
                  }}>
                    {item.items.map((sub) => (
                      <button
                        key={sub.href}
                        onClick={() => { setActiveNav(sub.href); setOpenMenu(null); }}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 10,
                          padding: "8px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                          background: activeNav === sub.href ? "#f0f4ff" : "transparent",
                          marginBottom: 1,
                        }}
                      >
                        <div style={{
                          width: 26, height: 26, borderRadius: 6, background: "#f8fafc",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <sub.icon size={13} color="#64748b" />
                        </div>
                        <span style={{ fontSize: 13, color: activeNav === sub.href ? "#6366f1" : "#334155", fontWeight: activeNav === sub.href ? 600 : 400 }}>
                          {sub.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right actions */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, paddingRight: 14 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 7,
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "6px 12px",
          }}>
            <Search size={13} color="#94a3b8" />
            <span style={{ fontSize: 12, color: "#94a3b8" }}>Search…</span>
            <kbd style={{ fontSize: 10, color: "#94a3b8", background: "#fff", padding: "1px 4px", borderRadius: 3, border: "1px solid #e2e8f0" }}>⌘K</kbd>
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "#6366f1", border: "none", borderRadius: 7, padding: "7px 14px", cursor: "pointer",
          }}>
            <Wand2 size={13} color="#fff" />
            <span style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}>New Campaign</span>
          </button>
          <div style={{ position: "relative" }}>
            <Bell size={17} color="#64748b" style={{ cursor: "pointer" }} />
            <span style={{ position: "absolute", top: -2, right: -2, width: 7, height: 7, borderRadius: "50%", background: "#6366f1", border: "2px solid #fff" }} />
          </div>
          <div style={{
            width: 28, height: 28, borderRadius: "50%",
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff", cursor: "pointer",
          }}>A</div>
        </div>
      </header>

      {/* Body: icon rail + content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Icon rail */}
        <div style={{
          width: 56, background: "#fff", borderRight: "1px solid #e2e8f0",
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 8, gap: 2, flexShrink: 0,
        }}>
          {ICON_RAIL.map((item) => {
            const isActive = activeRail === item.href;
            return (
              <button
                key={item.href}
                title={item.label}
                onClick={() => setActiveRail(item.href)}
                style={{
                  width: 40, height: 40, borderRadius: 8, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: isActive ? item.color + "18" : "transparent",
                  transition: "background 0.15s",
                  position: "relative",
                }}
              >
                <item.icon size={18} color={isActive ? item.color : "#94a3b8"} />
                {isActive && (
                  <div style={{
                    position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
                    width: 3, height: 20, borderRadius: "0 2px 2px 0", background: item.color,
                  }} />
                )}
              </button>
            );
          })}
          <div style={{ flex: 1 }} />
          <button style={{ width: 40, height: 40, borderRadius: 8, border: "none", cursor: "pointer", background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
            <Settings size={17} color="#94a3b8" />
          </button>
        </div>

        {/* Main content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "22px 26px" }} onClick={() => setOpenMenu(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <h1 style={{ color: "#0f172a", fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Dashboard</h1>
              <p style={{ color: "#64748b", fontSize: 13, margin: "3px 0 0" }}>InboxingProWeb — Local SEO campaign hub</p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                fontSize: 12, color: "#475569", background: "#fff",
                border: "1px solid #e2e8f0", borderRadius: 7, padding: "7px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                <Menu size={13} /> Manage
              </button>
              <button style={{
                fontSize: 12, color: "#6366f1", background: "#eef2ff",
                border: "1px solid #c7d2fe", borderRadius: 7, padding: "7px 12px", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}>
                Export <ArrowUpRight size={13} />
              </button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 18 }}>
            {STATS.map((s) => (
              <div key={s.label} style={{
                background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "18px 20px",
                borderTop: `3px solid ${s.color}`,
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ fontSize: 11.5, color: "#64748b", fontWeight: 500 }}>{s.label}</span>
                  <s.icon size={15} color={s.color} />
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 5 }}>{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Bottom */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ color: "#0f172a", fontSize: 14, fontWeight: 700, margin: 0 }}>Active Campaigns</h3>
                <MoreHorizontal size={16} color="#94a3b8" style={{ cursor: "pointer" }} />
              </div>
              {["Local SEO · Sheffield", "Web Design · Barnsley", "Email Marketing · Rotherham", "Website Hosting · Doncaster"].map((name, i) => (
                <div key={name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 0", borderBottom: i < 3 ? "1px solid #f8fafc" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10b981" }} />
                    <span style={{ fontSize: 13, color: "#334155" }}>{name}</span>
                  </div>
                  <span style={{ fontSize: 11, background: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: 10, fontWeight: 500 }}>Live</span>
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
              <h3 style={{ color: "#0f172a", fontSize: 14, fontWeight: 700, margin: "0 0 16px" }}>Tools & Shortcuts</h3>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "SEO Wizard",   icon: Wand2,      color: "#6366f1" },
                  { label: "Rankings",     icon: TrendingUp, color: "#10b981" },
                  { label: "Page Preview", icon: FileSearch, color: "#3b82f6" },
                  { label: "Image Packs",  icon: Image,      color: "#f59e0b" },
                  { label: "System",       icon: Activity,   color: "#22c55e" },
                  { label: "Team",         icon: Users,      color: "#8b5cf6" },
                ].map((a) => (
                  <button key={a.label} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#f8fafc", border: "1px solid #f1f5f9",
                    borderRadius: 8, padding: "9px 11px", cursor: "pointer",
                  }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: a.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <a.icon size={12} color={a.color} />
                    </div>
                    <span style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}>{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
