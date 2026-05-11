import { useState } from "react";
import {
  LayoutDashboard, Wand2, FileSearch, TrendingUp, Image,
  Palette, Activity, Globe, ShieldCheck, Users, KeyRound,
  Bell, Search, FolderOpen, ChevronDown, Settings,
  Zap, BarChart3, CheckCircle2, ArrowUpRight, ChevronRight,
} from "lucide-react";

const NAV = [
  {
    section: "Core",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",    href: "/api/dashboard", accent: "#6366f1" },
      { icon: Wand2,           label: "SEO Wizard",   href: "/api/setup",     accent: "#8b5cf6" },
      { icon: FileSearch,      label: "Page Preview", href: "/api/preview",   accent: "#3b82f6" },
      { icon: TrendingUp,      label: "Rankings",     href: "/api/ranking",   accent: "#10b981" },
      { icon: Image,           label: "Image Packs",  href: "/api/dashboard#tab-packs", accent: "#f59e0b" },
      { icon: Palette,         label: "Designs",      href: "/api/designs",   accent: "#ec4899" },
    ],
  },
  {
    section: "Monitoring",
    items: [
      { icon: Activity,    label: "System Health", href: "/api/dashboard#tab-health",   accent: "#10b981" },
      { icon: Globe,       label: "Live Crawl",    href: "/api/dashboard#tab-crawl",    accent: "#3b82f6" },
      { icon: ShieldCheck, label: "Security",      href: "/api/dashboard#tab-security", accent: "#f43f5e" },
    ],
  },
  {
    section: "Administration",
    items: [
      { icon: Users,    label: "Team",            href: "/admin/users",           accent: "#6366f1" },
      { icon: KeyRound, label: "Change Password", href: "/admin/change-password", accent: "#64748b" },
    ],
  },
];

const STATS = [
  { label: "Pages Live",   value: "169",  delta: "+7 this week", good: true,  icon: CheckCircle2, color: "#10b981" },
  { label: "Indexed",      value: "142",  delta: "+12 today",    good: true,  icon: BarChart3,    color: "#6366f1" },
  { label: "Avg Position", value: "14.2", delta: "-2.1 better",  good: true,  icon: TrendingUp,   color: "#3b82f6" },
  { label: "Impressions",  value: "8.4k", delta: "+23% week",    good: true,  icon: Zap,          color: "#f59e0b" },
];

export function LightSidebar() {
  const [active, setActive] = useState("/api/dashboard");
  const [projectOpen, setProjectOpen] = useState(false);

  return (
    <div style={{ display: "flex", height: "900px", fontFamily: "'Inter', system-ui, sans-serif", background: "#f8fafc" }}>

      {/* Sidebar */}
      <aside style={{
        width: 248, background: "#fff",
        borderRight: "1px solid #e8ecf0",
        display: "flex", flexDirection: "column", flexShrink: 0,
        boxShadow: "2px 0 8px rgba(0,0,0,0.04)",
      }}>
        {/* Logo */}
        <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
            }}>
              <Zap size={15} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", lineHeight: 1 }}>SEO Engine</div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>Content Platform</div>
            </div>
          </div>

          <button
            onClick={() => setProjectOpen(!projectOpen)}
            style={{
              width: "100%", background: "#f8fafc", border: "1px solid #e2e8f0",
              borderRadius: 8, padding: "8px 10px", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{
                width: 20, height: 20, borderRadius: 5, background: "#ede9fe",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FolderOpen size={11} color="#7c3aed" />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1e293b" }}>InboxingProWeb</span>
            </div>
            <ChevronDown size={13} color="#94a3b8" style={{ transform: projectOpen ? "rotate(180deg)" : "none", transition: "0.2s" }} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
          {NAV.map((group) => (
            <div key={group.section} style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10.5, fontWeight: 600, color: "#94a3b8", letterSpacing: "0.06em", textTransform: "uppercase", padding: "0 8px 6px" }}>
                {group.section}
              </div>
              {group.items.map((item) => {
                const isActive = active === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => setActive(item.href)}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 9px", borderRadius: 7, border: "none", cursor: "pointer",
                      background: isActive ? "#f0f4ff" : "transparent",
                      marginBottom: 1, gap: 8,
                      transition: "background 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: 6,
                        background: isActive ? item.accent + "18" : "#f1f5f9",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <item.icon size={13} color={isActive ? item.accent : "#94a3b8"} />
                      </div>
                      <span style={{
                        fontSize: 13, fontWeight: isActive ? 600 : 400,
                        color: isActive ? "#1e293b" : "#64748b",
                      }}>
                        {item.label}
                      </span>
                    </div>
                    {isActive && <ChevronRight size={13} color={item.accent} />}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{ padding: "12px 14px", borderTop: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>A</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#1e293b" }}>Admin</div>
              <div style={{ fontSize: 11, color: "#94a3b8", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>admin@inboxingproweb.com</div>
            </div>
            <Settings size={15} color="#94a3b8" style={{ cursor: "pointer", flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <header style={{
          height: 56, background: "#fff", borderBottom: "1px solid #e8ecf0",
          display: "flex", alignItems: "center", padding: "0 24px", gap: 12, flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8,
            background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8,
            padding: "7px 14px", maxWidth: 380,
          }}>
            <Search size={14} color="#94a3b8" />
            <span style={{ fontSize: 13, color: "#94a3b8" }}>Search pages, campaigns…</span>
            <kbd style={{
              marginLeft: "auto", fontSize: 11, color: "#94a3b8",
              background: "#fff", padding: "1px 5px", borderRadius: 4,
              border: "1px solid #e2e8f0",
            }}>⌘K</kbd>
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer",
            boxShadow: "0 2px 8px rgba(99,102,241,0.3)",
          }}>
            <Wand2 size={14} color="#fff" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>New Campaign</span>
          </button>
          <div style={{ position: "relative" }}>
            <Bell size={18} color="#64748b" style={{ cursor: "pointer" }} />
            <span style={{
              position: "absolute", top: -3, right: -3, width: 8, height: 8,
              borderRadius: "50%", background: "#6366f1", border: "2px solid #fff",
            }} />
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 22 }}>
            <div>
              <h1 style={{ color: "#0f172a", fontSize: 21, fontWeight: 800, margin: 0, letterSpacing: "-0.02em" }}>Dashboard</h1>
              <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>InboxingProWeb · Local SEO overview</p>
            </div>
            <button style={{
              display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#6366f1",
              background: "#f0f4ff", border: "1px solid #c7d2fe", borderRadius: 7, padding: "6px 12px", cursor: "pointer",
            }}>
              View full report <ArrowUpRight size={13} />
            </button>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
            {STATS.map((s) => (
              <div key={s.label} style={{
                background: "#fff", border: "1px solid #e8ecf0",
                borderRadius: 12, padding: "18px 20px",
                boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>{s.label}</span>
                  <div style={{
                    width: 28, height: 28, borderRadius: 7,
                    background: s.color + "15",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <s.icon size={14} color={s.color} />
                  </div>
                </div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#0f172a", lineHeight: 1, letterSpacing: "-0.02em" }}>{s.value}</div>
                <div style={{ fontSize: 11, color: "#10b981", marginTop: 5, fontWeight: 500 }}>{s.delta}</div>
              </div>
            ))}
          </div>

          {/* Lower grid */}
          <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14 }}>
            <div style={{
              background: "#fff", border: "1px solid #e8ecf0", borderRadius: 12, padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ color: "#0f172a", fontSize: 14, fontWeight: 700, margin: 0 }}>Active Campaigns</h3>
                <span style={{ fontSize: 12, color: "#6366f1", cursor: "pointer" }}>View all</span>
              </div>
              {["Local SEO · Sheffield", "Web Design · Barnsley", "Email Marketing · Rotherham", "Website Hosting · Doncaster"].map((name, i) => (
                <div key={name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 0", borderBottom: i < 3 ? "1px solid #f1f5f9" : "none",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{name}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{
                      fontSize: 11, color: "#10b981", background: "#dcfce7",
                      padding: "2px 8px", borderRadius: 10, fontWeight: 500,
                    }}>Live</span>
                    <ArrowUpRight size={13} color="#94a3b8" style={{ cursor: "pointer" }} />
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: "#fff", border: "1px solid #e8ecf0", borderRadius: 12, padding: 20,
              boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
            }}>
              <h3 style={{ color: "#0f172a", fontSize: 14, fontWeight: 700, margin: "0 0 14px" }}>Quick Access</h3>
              {[
                { label: "SEO Wizard",     icon: Wand2,      href: "/api/setup",     color: "#6366f1" },
                { label: "Rankings",       icon: TrendingUp, href: "/api/ranking",   color: "#10b981" },
                { label: "Page Preview",   icon: FileSearch, href: "/api/preview",   color: "#3b82f6" },
                { label: "System Health",  icon: Activity,   href: "/api/dashboard", color: "#f59e0b" },
                { label: "Team",           icon: Users,      href: "/admin/users",   color: "#8b5cf6" },
              ].map((a) => (
                <div key={a.label} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 0", borderBottom: "1px solid #f8fafc", cursor: "pointer",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: 7,
                      background: a.color + "15",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <a.icon size={13} color={a.color} />
                    </div>
                    <span style={{ fontSize: 13, color: "#334155", fontWeight: 500 }}>{a.label}</span>
                  </div>
                  <ChevronRight size={14} color="#cbd5e1" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
