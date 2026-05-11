import { useProject } from "@/context/ProjectContext";
import TopBar from "@/components/TopBar";

export default function CrawlPage() {
  const { selectedSlug } = useProject();
  const url = selectedSlug ? `/api/crawl?slug=${encodeURIComponent(selectedSlug)}&embedded=1` : "";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Live Crawl" subtitle="Real-time page crawl and validation" />
      {!selectedSlug ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "hsl(215 22% 45%)" }}>Select a project to run a crawl.</p>
        </div>
      ) : (
        <iframe key={url} src={url} className="flex-1 w-full border-0" style={{ minHeight: 0 }} title="Live Crawl" />
      )}
    </div>
  );
}
