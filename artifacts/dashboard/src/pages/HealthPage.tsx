import { useProject } from "@/context/ProjectContext";
import TopBar from "@/components/TopBar";

export default function HealthPage() {
  const { selectedSlug } = useProject();
  const url = selectedSlug ? `/api/health?slug=${encodeURIComponent(selectedSlug)}&embedded=1` : "";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="System Health" subtitle="Site-wide audit and issue tracking" />
      {!selectedSlug ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "hsl(215 22% 45%)" }}>Select a project to run a health check.</p>
        </div>
      ) : (
        <iframe key={url} src={url} className="flex-1 w-full border-0" style={{ minHeight: 0 }} title="System Health" />
      )}
    </div>
  );
}
