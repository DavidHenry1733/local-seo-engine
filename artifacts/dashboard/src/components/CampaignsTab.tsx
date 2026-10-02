import { useState } from "react";
import { apiFetch } from "@/lib/api";

const YORKSHIRE_PHARMACY_SLUG = "yorkshire-pharmacy-and-health-clinic";
const YORKSHIRE_PHARMACY_FIRST_GENERATE_AREAS = [
  "Darfield",
  "Wombwell",
  "Thurnscoe",
  "Grimethorpe",
  "Goldthorpe",
  "Worsbrough",
  "Hoyland",
  "Cudworth",
  "Mexborough",
  "Royston",
];

function areasForSlug(slug: string, fallback: string[] = []): string[] {
  if (slug === YORKSHIRE_PHARMACY_SLUG) return YORKSHIRE_PHARMACY_FIRST_GENERATE_AREAS;
  return fallback.filter(Boolean);
}

export function CampaignsTab({
  slug,
  campaign = "pharmacy-first",
  areas = [],
}: {
  slug: string;
  campaign?: string;
  areas?: string[];
}) {
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleCreateCampaignVersion() {
    if (creating) return;
    setCreating(true);
    setMessage(null);
    try {
      const result = await apiFetch<{
        ok?: boolean;
        duplicate?: boolean;
        error?: string;
        run?: { candidateVersion?: string };
      }>("/api/growth-engine/campaign-builder/generate", {
        method: "POST",
        body: JSON.stringify({
          slug,
          campaign,
          areas: areasForSlug(slug, areas),
        }),
      });
      if (result.duplicate) {
        setMessage("This campaign is already running. No extra calls were started.");
        return;
      }
      setMessage(
        result.run?.candidateVersion
          ? `Campaign version ${result.run.candidateVersion} is generating. Nothing was published or indexed.`
          : "Campaign version generation started. Nothing was published or indexed.",
      );
    } catch (error: unknown) {
      setCreating(false);
      setMessage(error instanceof Error ? error.message : "Could not create the campaign version.");
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p className="mb-3 text-xs text-slate-500">
        Create a new campaign version with one Google-grounded Gemini rewrite per area. Previous runs stay as inactive history.
      </p>
      <button
        type="button"
        onClick={handleCreateCampaignVersion}
        disabled={creating}
        className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
        style={{
          background: creating ? "#334155" : "#059669",
          cursor: creating ? "wait" : "pointer",
          opacity: creating ? 0.7 : 1,
        }}
      >
        {creating ? "Creating campaign version…" : "Create new campaign version"}
      </button>
      {message && <p className="mt-2 text-[11px] text-slate-400">{message}</p>}
    </div>
  );
}
