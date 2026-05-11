import { useProject } from "@/context/ProjectContext";
import TopBar from "@/components/TopBar";

export default function ImagesPage() {
  const { selectedSlug } = useProject();
  const url = selectedSlug ? `/image-library/packs-html?slug=${encodeURIComponent(selectedSlug)}` : "";

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TopBar title="Image Packs" subtitle="Manage image library and packs" />
      {!selectedSlug ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm" style={{ color: "hsl(215 22% 45%)" }}>Select a project to view image packs.</p>
        </div>
      ) : (
        <iframe key={url} src={url} className="flex-1 w-full border-0" style={{ minHeight: 0 }} title="Image Packs" />
      )}
    </div>
  );
}
