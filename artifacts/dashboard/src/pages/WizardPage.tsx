import { useProject } from "@/context/ProjectContext";
import TopBar from "@/components/TopBar";
import { useSearch } from "wouter";

export default function WizardPage() {
  const { selectedSlug } = useProject();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const campaignId = params.get("campaign") ?? "";

  const url = selectedSlug
    ? `/api/setup?slug=${encodeURIComponent(selectedSlug)}${campaignId ? `&campaign=${encodeURIComponent(campaignId)}` : ""}&embedded=1`
    : "";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="SEO Wizard" subtitle="Configure and generate campaigns" />
      {!selectedSlug ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "hsl(215 22% 45%)" }}>Select a project to launch the wizard.</p>
        </div>
      ) : (
        <iframe
          key={url}
          src={url}
          className="flex-1 w-full border-0"
          style={{ minHeight: 0 }}
          title="SEO Wizard"
        />
      )}
    </div>
  );
}
