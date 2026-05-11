import { useProject } from "@/context/ProjectContext";
import { ChevronDown, Globe } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const { projects, selectedSlug, setSelectedSlug, selectedProject } = useProject();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header
      className="flex items-center justify-between px-6 h-14 shrink-0"
      style={{ background: "hsl(0 0% 100%)", borderBottom: "1px solid hsl(220 16% 90%)" }}
    >
      {/* Page title */}
      <div>
        <h1 className="text-sm font-semibold leading-tight" style={{ color: "hsl(220 20% 16%)" }}>{title}</h1>
        {subtitle && (
          <p className="text-[11px] mt-0.5" style={{ color: "hsl(220 12% 52%)" }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Project selector */}
      {projects.length > 0 && (
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              background: "hsl(220 14% 96%)",
              border: "1px solid hsl(220 16% 88%)",
              color: "hsl(220 20% 30%)",
            }}
          >
            <Globe size={12} style={{ color: "hsl(217 91% 60%)" }} />
            <span className="max-w-36 truncate">
              {selectedProject?.businessName ?? selectedSlug ?? "Select project"}
            </span>
            <ChevronDown size={12} />
          </button>

          {open && (
            <div
              className="absolute right-0 top-full mt-1 rounded-lg overflow-hidden z-50 min-w-48"
              style={{
                background: "hsl(0 0% 100%)",
                border: "1px solid hsl(220 16% 88%)",
                boxShadow: "0 8px 24px rgba(0,0,0,.10)",
              }}
            >
              {projects.map((p) => (
                <button
                  key={p.clientSlug}
                  onClick={() => { setSelectedSlug(p.clientSlug); setOpen(false); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-xs text-left transition-colors"
                  style={{
                    background: p.clientSlug === selectedSlug ? "hsl(217 91% 60% / 0.08)" : "transparent",
                    color: p.clientSlug === selectedSlug ? "hsl(217 80% 45%)" : "hsl(220 16% 35%)",
                  }}
                >
                  <span className="font-medium truncate">{p.businessName}</span>
                  <span className="ml-auto text-[10px] opacity-50">{p.clientSlug}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
