import React from "react";
import { campaignBuilderChooseUrl, pharmacyProfileWizardHref } from "./pharmacyWorkspaceClient";

export type WorkspacePanelId = "profile" | "import" | "catchment" | "campaigns";

export interface WorkspaceDashboardData {
  slug: string;
  pharmacyName: string;
  websiteUrl: string;
  brandPrimaryColor: string;
  profile?: {
    email?: string;
    phone?: string;
    addressLine1?: string;
    townCity?: string;
    county?: string;
    postcode?: string;
    displayAddress?: string;
  };
  googleCatchment?: {
    googlePlaceId?: string;
    latitude?: number | null;
    longitude?: number | null;
    googleBusinessProfileUrl?: string;
    googleMapsEmbedUrl?: string;
    coverageRadius?: string;
    rankingAreas?: string[];
    nearbyAreas?: string[];
    coverageAreas?: string[];
  };
  importRecords?: {
    google?: Record<string, string>;
    website?: Record<string, string>;
  };
  serviceChannels?: Array<{ id: string; label: string; active?: boolean; status?: "active" | "pipeline" }>;
  campaigns?: Array<{
    id: string;
    serviceId: string;
    label: string;
    name: string;
    status: string;
    publishingStatus?: string;
    areaCount: number;
    href: string;
    builderHref: string;
    reviewHref: string;
  }>;
  workspace?: {
    profileHref?: string;
    growthHref?: string;
    campaignsHref?: string;
    importHref?: string;
  };
}

const CORE_SERVICE_CHANNELS: Array<{ id: string; label: string }> = [
  { id: "pharmacy-first", label: "Pharmacy First" },
  { id: "blood-pressure-checks", label: "Blood Pressure Checks" },
  { id: "travel-vaccinations", label: "Travel Vaccinations" },
  { id: "flu-vaccinations", label: "Flu Vaccination" },
];

const PANELS: Array<{ id: WorkspacePanelId; label: string; hint: string }> = [
  { id: "profile", label: "Profile", hint: "Customer record" },
  { id: "import", label: "Import", hint: "Google & website" },
  { id: "catchment", label: "Catchment", hint: "Ranking areas" },
  { id: "campaigns", label: "Campaigns", hint: "Core channels" },
];

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-slate-100">{value || "—"}</div>
    </div>
  );
}

function openCampaignChannel(
  event: React.MouseEvent,
  slug: string,
  serviceKey: string,
  onOpenCampaign?: (slug: string, serviceKey: string) => void,
): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  event.stopPropagation();
  if (onOpenCampaign) {
    onOpenCampaign(slug, serviceKey);
    return;
  }
  window.location.assign(campaignBuilderChooseUrl(slug, serviceKey));
}

export function PharmacyWorkspacePanel({
  data,
  panel,
  onPanelChange,
  onBack,
  onOpenCampaign,
}: {
  data: WorkspaceDashboardData;
  panel: WorkspacePanelId;
  onPanelChange: (panel: WorkspacePanelId) => void;
  onBack: () => void;
  onOpenCampaign?: (slug: string, serviceKey: string) => void;
}) {
  const catchment = data.googleCatchment || {};
  const profile = data.profile || {};
  const googleImport = data.importRecords?.google || {};
  const websiteImport = data.importRecords?.website || {};
  const serviceChannels = (data.serviceChannels?.length ? data.serviceChannels : CORE_SERVICE_CHANNELS)
    .filter((channel) => channel.active !== false && (channel.status ?? "active") === "active");
  const profileHref = pharmacyProfileWizardHref(data.slug);

  return (
    <div className="flex min-h-[70vh] overflow-hidden rounded-2xl border border-slate-800 bg-[#10121c]">
      <aside className="flex w-56 shrink-0 flex-col border-r border-slate-800 bg-[#0d1018]">
        <button
          type="button"
          onClick={onBack}
          className="border-b border-slate-800 px-4 py-3 text-left text-xs font-semibold text-indigo-300 hover:bg-slate-900"
        >
          ← All pharmacies
        </button>
        <div className="px-4 py-4">
          <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</div>
          <div className="mt-1 text-sm font-semibold leading-snug text-slate-100">{data.pharmacyName}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2 pb-4">
          {PANELS.map((item) => {
            const active = item.id === panel;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onPanelChange(item.id)}
                className={`rounded-lg px-3 py-2.5 text-left ${
                  active ? "bg-indigo-500/15 text-indigo-200" : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
                }`}
              >
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-[11px] text-slate-500">{item.hint}</div>
              </button>
            );
          })}
        </nav>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto p-6">
        {panel === "profile" && (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-slate-50">Customer profile</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Pharmacy" value={data.pharmacyName} />
              <Field label="Slug" value={data.slug} />
              <Field label="Town" value={profile.townCity} />
              <Field label="Postcode" value={profile.postcode} />
              <Field label="Phone" value={profile.phone} />
              <Field label="Email" value={profile.email} />
              <Field label="Website" value={data.websiteUrl} />
              <Field label="Address" value={profile.displayAddress || profile.addressLine1} />
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {serviceChannels.map((channel) => {
                const href = campaignBuilderChooseUrl(data.slug, channel.id);
                return (
                  <a
                    key={channel.id}
                    href={href}
                    data-campaign={channel.id}
                    onClick={(event) => openCampaignChannel(event, data.slug, channel.id, onOpenCampaign)}
                    className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200 no-underline hover:border-indigo-400 hover:bg-indigo-500/20"
                    style={{ cursor: "pointer" }}
                  >
                    {channel.label}
                  </a>
                );
              })}
            </div>
            <a href={profileHref} className="mt-5 inline-block text-sm text-indigo-300 underline">
              Open full profile dashboard
            </a>
          </div>
        )}

        {panel === "import" && (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-slate-50">Import history</h2>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Google Business Profile</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <p>Status: {googleImport.status || "not imported"}</p>
                  <p>Imported: {googleImport.importedAt || "—"}</p>
                  <p>Place ID: {googleImport.placeId || catchment.googlePlaceId || "—"}</p>
                  <p>Listing: {googleImport.businessName || "—"}</p>
                  <p>Address: {googleImport.address || "—"}</p>
                  <p className="text-slate-500">{googleImport.message}</p>
                </div>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                <h3 className="mb-3 text-sm font-semibold text-slate-200">Website import</h3>
                <div className="space-y-2 text-sm text-slate-300">
                  <p>Status: {websiteImport.status || "not imported"}</p>
                  <p>Imported: {websiteImport.importedAt || "—"}</p>
                  <p>Website: {websiteImport.website || data.websiteUrl || "—"}</p>
                  <p className="text-slate-500">{websiteImport.message}</p>
                </div>
              </div>
            </div>
            {data.workspace?.importHref && (
              <a href={data.workspace.importHref} className="mt-5 inline-block text-sm text-indigo-300 underline">
                Open customer setup / import
              </a>
            )}
          </div>
        )}

        {panel === "catchment" && (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-slate-50">Google catchment</h2>
            <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Field label="Place ID" value={catchment.googlePlaceId} />
              <Field label="Coverage" value={catchment.coverageRadius} />
              <Field label="Coordinates" value={
                catchment.latitude != null && catchment.longitude != null
                  ? `${catchment.latitude}, ${catchment.longitude}`
                  : ""
              } />
            </div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Ranking areas</h3>
            <div className="mb-4 flex flex-wrap gap-2">
              {(catchment.rankingAreas || []).map((area) => (
                <span key={area} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-200">{area}</span>
              ))}
            </div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Nearby areas</h3>
            <div className="flex flex-wrap gap-2">
              {(catchment.nearbyAreas || []).map((area) => (
                <span key={area} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 text-xs text-slate-400">{area}</span>
              ))}
            </div>
            {catchment.googleMapsEmbedUrl && (
              <iframe
                title="Catchment map"
                className="mt-5 h-64 w-full rounded-xl border border-slate-800"
                src={catchment.googleMapsEmbedUrl}
              />
            )}
          </div>
        )}

        {panel === "campaigns" && (
          <div>
            <h2 className="mb-4 text-xl font-semibold text-slate-50">Campaign records</h2>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {(data.campaigns || []).map((campaign) => (
                <div key={campaign.serviceId} className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
                  <div className="text-sm font-semibold text-slate-100">{campaign.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{campaign.name}</div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                    <span>{campaign.status.replace(/_/g, " ")}</span>
                    <span>{campaign.areaCount} areas</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-3 text-xs">
                    <a href={campaign.href} className="text-indigo-300 underline">Campaign record</a>
                    <a href={campaign.builderHref} className="text-indigo-300 underline">Builder</a>
                    <a href={campaign.reviewHref} className="text-indigo-300 underline">Review</a>
                  </div>
                </div>
              ))}
            </div>
            {data.workspace?.campaignsHref && (
              <a href={data.workspace.campaignsHref} className="mt-5 inline-block text-sm text-indigo-300 underline">
                Open all campaign records
              </a>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
