import { useProject } from "@/context/ProjectContext";

interface IframePageProps {
  buildUrl: (slug: string) => string;
  noProjectMessage?: string;
}

export default function IframePage({ buildUrl, noProjectMessage = "Select a project to continue." }: IframePageProps) {
  const { selectedSlug } = useProject();

  if (!selectedSlug) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm" style={{ color: "hsl(215 22% 52%)" }}>{noProjectMessage}</p>
        </div>
      </div>
    );
  }

  const url = buildUrl(selectedSlug);

  return (
    <iframe
      key={url}
      src={url}
      className="flex-1 w-full border-0"
      style={{ minHeight: 0 }}
      title="Embedded page"
    />
  );
}
