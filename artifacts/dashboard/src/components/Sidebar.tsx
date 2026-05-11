import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Wand2, Eye, ImageIcon, Palette,
  TrendingUp, Activity, Globe, Shield, Users, Lock,
  ChevronRight,
} from "lucide-react";

interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard",       path: "/",          icon: LayoutDashboard },
  { label: "SEO Wizard",      path: "/wizard",    icon: Wand2 },
  { label: "Page Preview",    path: "/pages",     icon: Eye },
  { label: "Image Packs",     path: "/images",    icon: ImageIcon },
  { label: "Designs",         path: "/designs",   icon: Palette },
  { label: "Rankings",        path: "/rankings",  icon: TrendingUp },
  { label: "System Health",   path: "/health",    icon: Activity },
  { label: "Live Crawl",      path: "/crawl",     icon: Globe },
  { label: "Security",        path: "/security",  icon: Shield },
  { label: "Team",            path: "/team",      icon: Users },
  { label: "Change Password", path: "/password",  icon: Lock },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside
      className="flex flex-col w-56 shrink-0 h-screen"
      style={{ background: "hsl(220 20% 98%)", borderRight: "1px solid hsl(220 16% 90%)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-14 shrink-0" style={{ borderBottom: "1px solid hsl(220 16% 90%)" }}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "hsl(217 91% 60%)" }}
        >
          <Globe size={14} className="text-white" />
        </div>
        <div>
          <div className="text-xs font-bold leading-tight" style={{ color: "hsl(220 20% 16%)" }}>InboxingPro</div>
          <div className="text-[10px]" style={{ color: "hsl(220 12% 52%)" }}>SEO Engine</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.path === "/" ? location === "/" : location.startsWith(item.path);
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              href={item.path}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg mb-0.5 transition-colors cursor-pointer"
              style={{
                background: isActive ? "hsl(217 91% 60% / 0.10)" : "transparent",
                color: isActive ? "hsl(217 80% 45%)" : "hsl(220 16% 40%)",
              }}
            >
              <Icon
                size={15}
                className="shrink-0 transition-colors"
                style={{ color: isActive ? "hsl(217 80% 50%)" : "hsl(220 12% 55%)" }}
              />
              <span className="text-xs font-medium flex-1 truncate">{item.label}</span>
              {isActive && (
                <ChevronRight size={11} style={{ color: "hsl(217 80% 50%)" }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-3 shrink-0" style={{ borderTop: "1px solid hsl(220 16% 90%)" }}>
        <div className="text-[10px]" style={{ color: "hsl(220 12% 60%)" }}>
          Local SEO Engine v2.0
        </div>
      </div>
    </aside>
  );
}
