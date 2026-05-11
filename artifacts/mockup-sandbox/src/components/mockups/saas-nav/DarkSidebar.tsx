import { useState } from "react";
import {
  LayoutDashboard, Wand2, FileSearch, TrendingUp, Image,
  Palette, Activity, Globe, ShieldCheck, Users, KeyRound,
  Bell, Search, FolderOpen, ChevronDown, Settings,
  Zap, CheckCircle2, ArrowRight, ExternalLink,
  BarChart3, BookOpen, ChevronRight,
} from "lucide-react";

// ─── All routes: exactly 1 click away ────────────────────────────────────────
const NAV_GROUPS = [
  {
    id: "campaigns",
    label: "CAMPAIGNS",
    items: [
      {
        icon: LayoutDashboard,
        label: "Dashboard",
        sub: "Overview & stats",
        href: "/api/dashboard",
        color: "#818cf8",
        badge: null,
      },
      {
        icon: Wand2,
        label: "SEO Wizard",
        sub: "Campaign builder",
        href: "/api/setup",
        color: "#a78bfa",
        badge: "8 stages",
      },
      {
        icon: FileSearch,
        label: "Page Preview",
        sub: "Browse generated pages",
        href: "/api/preview",
        color: "#60a5fa",
        badge: "169",
      },
      {
        icon: Image,
        label: "Image Packs",
        sub: "Manage visual assets",
        href: "/api/dashboard#tab-packs",
        color: "#fbbf24",
        badge: null,
      },
      {
        icon: Palette,
        label: "Designs",
        sub: "UI design variants",
        href: "/api/designs",
        color: "#f472b6",
        badge: null,
      },
    ],
  },
  {
    id: "analytics",
    label: "ANALYTICS",
    items: [
      {
        icon: TrendingUp,
        label: "Rankings",
        sub: "Keyword positions",
        href: "/api/ranking",
        color: "#34d399",
        badge: null,
      },
      {
        icon: Activity,
        label: "System Health",
        sub: "Server & build status",
        href: "/api/dashboard#tab-health",
        color: "#4ade80",
        badge: null,
      },
      {
        icon: Globe,
        label: "Live Crawl",
        sub: "Index & crawl monitor",
        href: "/api/dashboard#tab-crawl",
        color: "#38bdf8",
        badge: null,
      },
      {
        icon: ShieldCheck,
        label: "Security",
        sub: "Access & audit log",
        href: "/api/dashboard#tab-security",
        color: "#fb7185",
        badge: null,
      },
    ],
  },
  {
    id: "admin",
    label: "ADMIN",
    items: [
      {
        icon: Users,
        label: "Team",
        sub: "Users & permissions",
        href: "/admin/users",
        color: "#c084fc",
        badge: null,
      },
      {
        icon: KeyRound,
        label: "Change Password",
        sub: "Security credentials",
        href: "/admin/change-password",
        color: "#94a3b8",
        badge: null,
      },
    ],
  },
];

const PROJECTS = ["InboxingProWeb", "Demo Project", "+ New project"];

const QUICK_STATS = [
  { label: "Pages",    value: "169", color: "#818cf8" },
  { label: "Indexed",  value: "142", color: "#34d399" },
  { label: "Avg Pos.", value: "14.2",color: "#60a5fa" },
];

// ─── Main content stubs per route ─────────────────────────────────────────────
const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  "/api/dashboard":               { title: "Dashboard",       sub: "Campaign overview · InboxingProWeb" },
  "/api/setup":                   { title: "SEO Wizard",      sub: "8-stage campaign builder" },
  "/api/preview":                 { title: "Page Preview",    sub: "169 generated pages" },
  "/api/dashboard#tab-packs":     { title: "Image Packs",     sub: "Visual asset library" },
  "/api/designs":                 { title: "Designs",         sub: "UI design variants" },
  "/api/ranking":                 { title: "Rankings",        sub: "Keyword position tracker" },
  "/api/dashboard#tab-health":    { title: "System Health",   sub: "Server & build status" },
  "/api/dashboard#tab-crawl":     { title: "Live Crawl",      sub: "Index & crawl monitor" },
  "/api/dashboard#tab-security":  { title: "Security",        sub: "Access & audit log" },
  "/admin/users":                 { title: "Team",            sub: "Users & permissions" },
  "/admin/change-password":       { title: "Change Password", sub: "Security credentials" },
};

export function DarkSidebar() {
  const [active, setActive]           = useState("/api/dashboard");
  const [projectOpen, setProjectOpen] = useState(false);
  const [project, setProject]         = useState("InboxingProWeb");

  const currentPage = PAGE_TITLES[active] ?? { title: "Dashboard", sub: "" };

  // Build breadcrumb from active route
  const activeItem = NAV_GROUPS.flatMap((g) => g.items).find((i) => i.href === active);

  return (
    <div
      style={{
        display: "flex",
        height: "900px",
        fontFamily: "'Inter', system-ui, sans-serif",
        background: "#0b0d14",
        color: "#c8d0e0",
      }}
      onClick={() => setProjectOpen(false)}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 256,
          background: "#10121c",
          borderRight: "1px solid #1c1f30",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "16px 16px 14px",
            borderBottom: "1px solid #1c1f30",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 14px rgba(99,102,241,0.4)",
              }}
            >
              <Zap size={14} color="#fff" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: "#e4e8f5",
                  letterSpacing: "-0.01em",
                  lineHeight: 1.1,
                }}
              >
                SEO Engine
              </div>
              <div style={{ fontSize: 10, color: "#3a3f5c", marginTop: 1 }}>
                Local Content Platform
              </div>
            </div>
          </div>

          {/* Project switcher */}
          <div style={{ position: "relative" }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setProjectOpen(!projectOpen);
              }}
              style={{
                width: "100%",
                background: "#181b2a",
                border: "1px solid #252840",
                borderRadius: 8,
                padding: "8px 10px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transition: "border-color 0.15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    background: "#2a1f60",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <FolderOpen size={11} color="#818cf8" />
                </div>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    color: "#d4d8f0",
                    maxWidth: 130,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {project}
                </span>
              </div>
              <ChevronDown
                size={13}
                color="#3a3f5c"
                style={{
                  transform: projectOpen ? "rotate(180deg)" : "none",
                  transition: "0.2s",
                  flexShrink: 0,
                }}
              />
            </button>

            {/* Dropdown */}
            {projectOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  right: 0,
                  background: "#181b2a",
                  border: "1px solid #252840",
                  borderRadius: 8,
                  boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
                  zIndex: 50,
                  overflow: "hidden",
                }}
              >
                {PROJECTS.map((p, i) => (
                  <button
                    key={p}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (i < 2) setProject(p);
                      setProjectOpen(false);
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      background: p === project ? "#22263a" : "transparent",
                      border: "none",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: 12.5,
                      color: i === 2 ? "#818cf8" : "#d4d8f0",
                      fontWeight: i === 2 ? 500 : 400,
                      borderTop: i === 2 ? "1px solid #252840" : "none",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
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

        {/* Navigation — all items always visible, 1 click to anywhere */}
        <nav
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 10px",
            scrollbarWidth: "none",
          }}
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.id} style={{ marginBottom: 6 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: "#2e3250",
                  letterSpacing: "0.09em",
                  padding: "8px 8px 4px",
                }}
              >
                {group.label}
              </div>

              {group.items.map((item) => {
                const isActive = active === item.href;
                return (
                  <button
                    key={item.href}
                    onClick={() => setActive(item.href)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "7px 8px",
                      borderRadius: 7,
                      border: "none",
                      cursor: "pointer",
                      background: isActive
                        ? "linear-gradient(90deg, #1a1d30 0%, #1e2038 100%)"
                        : "transparent",
                      marginBottom: 1,
                      position: "relative",
                      transition: "background 0.12s",
                    }}
                  >
                    {/* Active left bar */}
                    {isActive && (
                      <div
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "50%",
                          transform: "translateY(-50%)",
                          width: 3,
                          height: 22,
                          borderRadius: "0 3px 3px 0",
                          background: item.color,
                          boxShadow: `0 0 8px ${item.color}88`,
                        }}
                      />
                    )}

                    {/* Icon */}
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        background: isActive ? item.color + "22" : "#181b2a",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "background 0.12s",
                      }}
                    >
                      <item.icon
                        size={13}
                        color={isActive ? item.color : "#3a3f5c"}
                      />
                    </div>

                    {/* Label + sub */}
                    <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: isActive ? 600 : 400,
                          color: isActive ? "#e4e8f5" : "#6b7296",
                          lineHeight: 1.25,
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          fontSize: 10.5,
                          color: isActive ? "#4a5080" : "#2e3250",
                          marginTop: 1,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.sub}
                      </div>
                    </div>

                    {/* Badge */}
                    {item.badge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: isActive ? item.color : "#3a3f5c",
                          background: isActive ? item.color + "22" : "#181b2a",
                          border: `1px solid ${isActive ? item.color + "44" : "#252840"}`,
                          padding: "1px 6px",
                          borderRadius: 10,
                          flexShrink: 0,
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Quick stats bar */}
        <div
          style={{
            padding: "10px 14px",
            borderTop: "1px solid #1c1f30",
            display: "flex",
            gap: 0,
          }}
        >
          {QUICK_STATS.map((s, i) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                textAlign: "center",
                borderRight: i < 2 ? "1px solid #1c1f30" : "none",
              }}
            >
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: s.color,
                  lineHeight: 1,
                  letterSpacing: "-0.02em",
                }}
              >
                {s.value}
              </div>
              <div style={{ fontSize: 9.5, color: "#2e3250", marginTop: 2 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* User footer */}
        <div
          style={{
            padding: "12px 14px",
            borderTop: "1px solid #1c1f30",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 0 10px rgba(99,102,241,0.3)",
            }}
          >
            A
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#c8d0e0",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              Admin
            </div>
            <div style={{ fontSize: 10.5, color: "#2e3250" }}>
              inboxingproweb.com
            </div>
          </div>
          <Settings
            size={15}
            color="#2e3250"
            style={{ cursor: "pointer", flexShrink: 0 }}
          />
        </div>
      </aside>

      {/* ── Main area ───────────────────────────────────────────────────── */}
      <div
        style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}
      >
        {/* Top bar */}
        <header
          style={{
            height: 52,
            background: "#10121c",
            borderBottom: "1px solid #1c1f30",
            display: "flex",
            alignItems: "center",
            padding: "0 20px",
            gap: 12,
            flexShrink: 0,
          }}
        >
          {/* Breadcrumb */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#3a3f5c",
            }}
          >
            <BookOpen size={13} color="#2e3250" />
            <span>{project}</span>
            <ChevronRight size={12} color="#2e3250" />
            <span style={{ color: "#c8d0e0", fontWeight: 600 }}>
              {currentPage.title}
            </span>
          </div>

          {/* Search */}
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#181b2a",
              border: "1px solid #1c1f30",
              borderRadius: 8,
              padding: "7px 14px",
              maxWidth: 360,
              marginLeft: "auto",
              cursor: "text",
            }}
          >
            <Search size={13} color="#2e3250" />
            <span style={{ fontSize: 12.5, color: "#2e3250" }}>
              Jump to page, campaign…
            </span>
            <kbd
              style={{
                marginLeft: "auto",
                fontSize: 10,
                color: "#2e3250",
                background: "#10121c",
                padding: "2px 6px",
                borderRadius: 4,
                border: "1px solid #1c1f30",
                letterSpacing: "0.02em",
              }}
            >
              ⌘K
            </kbd>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button
              style={{
                position: "relative",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <Bell size={17} color="#3a3f5c" />
              <span
                style={{
                  position: "absolute",
                  top: 2,
                  right: 2,
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: "#818cf8",
                  border: "2px solid #10121c",
                }}
              />
            </button>

            {/* New campaign CTA */}
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                border: "none",
                borderRadius: 7,
                padding: "7px 14px",
                cursor: "pointer",
                boxShadow: "0 0 14px rgba(99,102,241,0.3)",
              }}
              onClick={() => setActive("/api/setup")}
            >
              <Wand2 size={13} color="#fff" />
              <span
                style={{ fontSize: 12, fontWeight: 600, color: "#fff" }}
              >
                New Campaign
              </span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "24px 28px",
            background: "#0b0d14",
          }}
        >
          {/* Page header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: 24,
            }}
          >
            <div>
              <h1
                style={{
                  color: "#e4e8f5",
                  fontSize: 22,
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: "-0.03em",
                }}
              >
                {currentPage.title}
              </h1>
              <p
                style={{
                  color: "#3a3f5c",
                  fontSize: 13,
                  margin: "5px 0 0",
                }}
              >
                {currentPage.sub}
              </p>
            </div>
            <button
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12,
                color: "#818cf8",
                background: "#181b2a",
                border: "1px solid #252840",
                borderRadius: 7,
                padding: "7px 12px",
                cursor: "pointer",
              }}
            >
              Open live page <ExternalLink size={12} />
            </button>
          </div>

          {/* Stats row (only shown on Dashboard) */}
          {active === "/api/dashboard" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, 1fr)",
                  gap: 12,
                  marginBottom: 20,
                }}
              >
                {[
                  { label: "Pages Live",   value: "169",  icon: CheckCircle2, color: "#818cf8", sub: "4 campaigns" },
                  { label: "Indexed",      value: "142",  icon: BarChart3,    color: "#34d399", sub: "84% coverage" },
                  { label: "Avg Position", value: "14.2", icon: TrendingUp,   color: "#60a5fa", sub: "↓ 2.1 better" },
                  { label: "Impressions",  value: "8.4k", icon: Globe,        color: "#fbbf24", sub: "+23% this week" },
                ].map((s) => (
                  <div
                    key={s.label}
                    style={{
                      background: "#10121c",
                      border: "1px solid #1c1f30",
                      borderTop: `2px solid ${s.color}`,
                      borderRadius: 10,
                      padding: "16px 18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        marginBottom: 10,
                      }}
                    >
                      <span style={{ fontSize: 11.5, color: "#3a3f5c", fontWeight: 500 }}>
                        {s.label}
                      </span>
                      <s.icon size={14} color={s.color} />
                    </div>
                    <div
                      style={{
                        fontSize: 28,
                        fontWeight: 800,
                        color: "#e4e8f5",
                        lineHeight: 1,
                        letterSpacing: "-0.03em",
                      }}
                    >
                      {s.value}
                    </div>
                    <div style={{ fontSize: 10.5, color: s.color, marginTop: 6, fontWeight: 500 }}>
                      {s.sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Active campaigns + nav shortcuts */}
              <div
                style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 14 }}
              >
                <div
                  style={{
                    background: "#10121c",
                    border: "1px solid #1c1f30",
                    borderRadius: 10,
                    padding: 20,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <h3 style={{ color: "#c8d0e0", fontSize: 13.5, fontWeight: 700, margin: 0 }}>
                      Active Campaigns
                    </h3>
                    <button
                      style={{
                        fontSize: 11,
                        color: "#818cf8",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                      onClick={() => setActive("/api/preview")}
                    >
                      View all <ArrowRight size={11} />
                    </button>
                  </div>
                  {[
                    { name: "Local SEO",      city: "Sheffield",  count: 24, color: "#818cf8" },
                    { name: "Web Design",     city: "Barnsley",   count: 18, color: "#60a5fa" },
                    { name: "Email Marketing",city: "Rotherham",  count: 31, color: "#f472b6" },
                    { name: "Website Hosting",city: "Doncaster",  count: 21, color: "#fbbf24" },
                  ].map((c, i) => (
                    <div
                      key={c.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "10px 0",
                        borderBottom: i < 3 ? "1px solid #1c1f30" : "none",
                        cursor: "pointer",
                      }}
                      onClick={() => setActive("/api/preview")}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: c.color,
                            boxShadow: `0 0 5px ${c.color}88`,
                          }}
                        />
                        <span style={{ fontSize: 13, color: "#8891b4" }}>
                          <span style={{ color: "#c8d0e0", fontWeight: 500 }}>{c.name}</span>
                          {" · "}{c.city}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11.5, color: "#3a3f5c" }}>{c.count} pages</span>
                        <span
                          style={{
                            fontSize: 10.5,
                            color: "#34d399",
                            background: "#0d2218",
                            border: "1px solid #0f3320",
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontWeight: 600,
                          }}
                        >
                          Live
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quick navigation card */}
                <div
                  style={{
                    background: "#10121c",
                    border: "1px solid #1c1f30",
                    borderRadius: 10,
                    padding: 20,
                  }}
                >
                  <h3 style={{ color: "#c8d0e0", fontSize: 13.5, fontWeight: 700, margin: "0 0 14px" }}>
                    Quick Access
                  </h3>
                  {NAV_GROUPS.flatMap((g) => g.items)
                    .filter((i) =>
                      ["/api/setup", "/api/ranking", "/api/preview", "/api/dashboard#tab-health", "/admin/users"].includes(i.href)
                    )
                    .map((item) => (
                      <button
                        key={item.href}
                        onClick={() => setActive(item.href)}
                        style={{
                          width: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#181b2a",
                          border: "1px solid #1c1f30",
                          borderRadius: 7,
                          padding: "9px 11px",
                          cursor: "pointer",
                          marginBottom: 7,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          <item.icon size={13} color={item.color} />
                          <span style={{ fontSize: 12.5, color: "#8891b4", fontWeight: 500 }}>
                            {item.label}
                          </span>
                        </div>
                        <ArrowRight size={12} color="#2e3250" />
                      </button>
                    ))}
                </div>
              </div>
            </>
          )}

          {/* Placeholder for non-dashboard pages */}
          {active !== "/api/dashboard" && (
            <div
              style={{
                background: "#10121c",
                border: "1px dashed #1c1f30",
                borderRadius: 12,
                padding: "60px 40px",
                textAlign: "center",
              }}
            >
              {activeItem && (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: (activeItem.color) + "18",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 16px",
                  }}
                >
                  <activeItem.icon size={24} color={activeItem.color} />
                </div>
              )}
              <div style={{ fontSize: 17, fontWeight: 700, color: "#c8d0e0", marginBottom: 8 }}>
                {currentPage.title}
              </div>
              <div style={{ fontSize: 13, color: "#3a3f5c", marginBottom: 24 }}>
                {currentPage.sub}
              </div>
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none",
                  borderRadius: 8,
                  padding: "10px 20px",
                  cursor: "pointer",
                  boxShadow: "0 0 14px rgba(99,102,241,0.3)",
                }}
              >
                <ExternalLink size={13} color="#fff" />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>
                  Open {currentPage.title}
                </span>
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
