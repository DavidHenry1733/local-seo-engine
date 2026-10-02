import React from "react";
import { campaignBuilderChooseUrl, pharmacyWorkspaceHref } from "./pharmacyWorkspaceClient";

export interface PharmacyCustomerCard {
  slug: string;
  pharmacyName: string;
  townCity: string;
  postcode: string;
  website: string;
  brandPrimaryColor: string;
  displayAddress?: string;
  rankingAreaCount: number;
  rankingAreas?: string[];
  googlePlaceId?: string;
  coverageRadius?: string;
  activeServiceChannels: string[];
}

export interface CoreServiceChannel {
  id: string;
  label: string;
}

const DEFAULT_SERVICE_LABELS: CoreServiceChannel[] = [
  { id: "pharmacy-first", label: "Pharmacy First" },
  { id: "blood-pressure-checks", label: "Blood Pressure Checks" },
  { id: "travel-vaccinations", label: "Travel Vaccinations" },
  { id: "flu-vaccinations", label: "Flu Vaccination" },
];

export interface CustomerSelectionGridProps {
  pharmacies: PharmacyCustomerCard[];
  selectedSlug: string | null;
  onSelect: (slug: string) => void;
  loading?: boolean;
  error?: string | null;
  serviceChannels?: CoreServiceChannel[];
  onOpenCampaign?: (slug: string, serviceKey: string) => void;
}

function serviceLabel(id: string, channels: CoreServiceChannel[]): string {
  return channels.find((channel) => channel.id === id)?.label || id.replace(/-/g, " ");
}

export function openPharmacyCard(slug: string, onSelect?: (next: string) => void): void {
  onSelect?.(slug);
  const params = new URLSearchParams(window.location.search);
  params.set("slug", slug);
  window.location.search = `?${params.toString()}`;
}

export const CustomerSelectionGrid: React.FC<CustomerSelectionGridProps> = ({
  pharmacies,
  selectedSlug,
  onSelect,
  loading = false,
  error = null,
  serviceChannels = DEFAULT_SERVICE_LABELS,
  onOpenCampaign,
}) => {
  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-6 py-16 text-center text-sm text-slate-400">
        Loading production pharmacies…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 px-6 py-10 text-center text-sm text-rose-200">
        {error}
      </div>
    );
  }

  if (!pharmacies.length) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-6 py-16 text-center text-sm text-slate-400">
        No production pharmacies are available.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" style={{ position: "relative", zIndex: 2 }}>
      {pharmacies.map((pharmacy) => {
        const selected = pharmacy.slug === selectedSlug;
        return (
          <a
            key={pharmacy.slug}
            href={pharmacyWorkspaceHref(pharmacy.slug)}
            data-pharmacy-slug={pharmacy.slug}
            role="link"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              openPharmacyCard(pharmacy.slug, onSelect);
            }}
            className={`group block w-full rounded-2xl border p-5 text-left no-underline transition ${
              selected
                ? "border-indigo-400/80 bg-indigo-500/10 shadow-[0_0_0_1px_rgba(129,140,248,0.35)]"
                : "border-slate-800 bg-slate-950/70 hover:border-slate-600 hover:bg-slate-900/80"
            }`}
            style={{
              cursor: "pointer",
              pointerEvents: "auto",
              display: "block",
              textDecoration: "none",
              color: "inherit",
              position: "relative",
              zIndex: 3,
            }}
          >
            <div className="mb-4 flex items-start justify-between gap-3" style={{ pointerEvents: "none" }}>
              <div>
                <div
                  className="mb-2 h-1.5 w-10 rounded-full"
                  style={{ backgroundColor: pharmacy.brandPrimaryColor || "#818cf8" }}
                />
                <h3 className="text-base font-semibold tracking-tight text-slate-100">
                  {pharmacy.pharmacyName}
                </h3>
                <p className="mt-1 text-sm text-slate-400">
                  {pharmacy.townCity}
                  {pharmacy.postcode ? ` · ${pharmacy.postcode}` : ""}
                </p>
              </div>
              {selected && (
                <span className="rounded-full bg-indigo-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-indigo-300">
                  Selected
                </span>
              )}
            </div>

            <p className="mb-4 line-clamp-2 text-xs text-slate-500" style={{ pointerEvents: "none" }}>
              {pharmacy.displayAddress || pharmacy.website || pharmacy.slug}
            </p>

            <div className="mb-4 flex flex-wrap gap-1.5">
              {pharmacy.activeServiceChannels.map((channelId) => (
                <button
                  key={channelId}
                  type="button"
                  data-campaign={channelId}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (onOpenCampaign) {
                      onOpenCampaign(pharmacy.slug, channelId);
                      return;
                    }
                    window.location.assign(campaignBuilderChooseUrl(pharmacy.slug, channelId));
                  }}
                  className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300 hover:border-indigo-400 hover:text-indigo-200"
                  style={{ cursor: "pointer", pointerEvents: "auto", background: "#0f172a", color: "#cbd5e1" }}
                >
                  {serviceLabel(channelId, serviceChannels)}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500" style={{ pointerEvents: "none" }}>
              <span>{pharmacy.rankingAreaCount} catchment areas</span>
              <span className={pharmacy.googlePlaceId ? "text-emerald-400" : "text-slate-600"}>
                {pharmacy.googlePlaceId ? "Google Place connected" : "Place ID pending"}
              </span>
            </div>
          </a>
        );
      })}
    </div>
  );
};

export default CustomerSelectionGrid;
