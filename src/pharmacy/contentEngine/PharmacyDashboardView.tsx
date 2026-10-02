import React, { useEffect, useState } from "react";
import { type CoreServiceChannel, type PharmacyCustomerCard } from "./CustomerSelectionGrid";
import { PharmacyWorkspacePanel, type WorkspaceDashboardData, type WorkspacePanelId } from "./PharmacyWorkspacePanel";
import {
  activatePharmacyWorkspace,
  campaignBuilderChooseUrl,
  closePharmacyWorkspace,
  isWorkspaceLandscapeOpen,
  pharmacyWorkspaceHref,
  readWorkspaceSlug,
  workspacePanelFromHash,
} from "./pharmacyWorkspaceClient";

interface CustomersResponse {
  success: boolean;
  pharmacies?: PharmacyCustomerCard[];
  coreServiceChannels?: CoreServiceChannel[];
  error?: string;
}

const CUSTOMERS_ENDPOINT = "/api/dashboard/customers";

async function readJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

export const PharmacyDashboardView: React.FC = () => {
  const [pharmacies, setPharmacies] = useState<PharmacyCustomerCard[]>([]);
  const [serviceChannels, setServiceChannels] = useState<CoreServiceChannel[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(() =>
    isWorkspaceLandscapeOpen() ? readWorkspaceSlug() : null,
  );
  const [workspaceOpen, setWorkspaceOpen] = useState(() => isWorkspaceLandscapeOpen());
  const [panel, setPanel] = useState<WorkspacePanelId>(() => workspacePanelFromHash());
  const [workspace, setWorkspace] = useState<WorkspaceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    readJson<CustomersResponse>(CUSTOMERS_ENDPOINT)
      .then((payload) => {
        if (cancelled) return;
        setPharmacies(payload.pharmacies || []);
        setServiceChannels(payload.coreServiceChannels || []);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Could not load production pharmacies.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedSlug || !workspaceOpen) {
      setWorkspace(null);
      return;
    }
    let cancelled = false;
    setDetailLoading(true);
    readJson<WorkspaceDashboardData>(`/api/dashboard/${encodeURIComponent(selectedSlug)}`)
      .then((payload) => {
        if (!cancelled) setWorkspace(payload);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Could not load pharmacy workspace.");
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSlug, workspaceOpen]);

  useEffect(() => {
    const onActivate = (event: Event) => {
      const detail = (event as CustomEvent<{ slug?: string; panel?: WorkspacePanelId }>).detail || {};
      if (!detail.slug) return;
      setSelectedSlug(detail.slug);
      setWorkspaceOpen(true);
      setPanel(detail.panel || "profile");
    };
    const onClose = () => {
      setWorkspaceOpen(false);
      setPanel("profile");
    };
    window.addEventListener("pharmacy-workspace-activate", onActivate);
    window.addEventListener("pharmacy-workspace-close", onClose);
    window.addEventListener("popstate", onClose);
    return () => {
      window.removeEventListener("pharmacy-workspace-activate", onActivate);
      window.removeEventListener("pharmacy-workspace-close", onClose);
      window.removeEventListener("popstate", onClose);
    };
  }, []);

  const openWorkspace = (slug: string) => {
    localStorage.setItem("selectedSlug", slug);
    localStorage.setItem("pharmacyWorkspaceView", "landscape");
    setSelectedSlug(slug);
    setPanel("profile");
    setWorkspaceOpen(true);
    const params = new URLSearchParams(window.location.search);
    params.set("slug", slug);
    window.location.search = `?${params.toString()}`;
  };

  const changePanel = (next: WorkspacePanelId) => {
    if (selectedSlug) activatePharmacyWorkspace(selectedSlug, next);
    setPanel(next);
  };

  return (
    <div className="min-h-screen bg-[#0b0d16] p-6 font-sans text-slate-100">
      {!workspaceOpen ? (
        <>
          <div className="mb-8 flex flex-col gap-2 border-b border-slate-800 pb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
              PharmaConnect
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-50">Production pharmacies</h1>
            <p className="max-w-2xl text-sm text-slate-400">
              Select a live customer to open their workspace: profile, import history, Google catchment, and campaign records.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" style={{ position: "relative", zIndex: 2 }}>
            {loading ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-6 py-16 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
                Loading production pharmacies…
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-900/60 bg-rose-950/40 px-6 py-10 text-center text-sm text-rose-200 md:col-span-2 xl:col-span-3">
                {error}
              </div>
            ) : (
              pharmacies.map((pharmacy) => {
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
                      openWorkspace(pharmacy.slug);
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
                    <div style={{ pointerEvents: "none" }}>
                      <div className="mb-4 flex items-start justify-between gap-3">
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
                      </div>
                      <p className="mb-4 line-clamp-2 text-xs text-slate-500">
                        {pharmacy.displayAddress || pharmacy.website || pharmacy.slug}
                      </p>
                      <div className="mb-4 flex flex-wrap gap-1.5" style={{ pointerEvents: "auto" }}>
                        {(pharmacy.activeServiceChannels.length
                          ? pharmacy.activeServiceChannels
                          : serviceChannels.map((channel) => channel.id)
                        ).map((channelId) => (
                          <button
                            key={channelId}
                            type="button"
                            data-campaign={channelId}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              window.location.assign(campaignBuilderChooseUrl(pharmacy.slug, channelId));
                            }}
                            className="rounded-md border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-300 hover:border-indigo-400 hover:text-indigo-200"
                            style={{ cursor: "pointer", background: "#0f172a", color: "#cbd5e1" }}
                          >
                            {serviceChannels.find((channel) => channel.id === channelId)?.label || channelId}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        <span>{pharmacy.rankingAreaCount} catchment areas</span>
                        <span className={pharmacy.googlePlaceId ? "text-emerald-400" : "text-slate-600"}>
                          {pharmacy.googlePlaceId ? "Google Place connected" : "Place ID pending"}
                        </span>
                      </div>
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </>
      ) : (
        <>
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">Active workspace</p>
              <h1 className="text-xl font-bold text-slate-50">{workspace?.pharmacyName || selectedSlug}</h1>
            </div>
          </div>
          {detailLoading || !workspace ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950/80 px-6 py-16 text-center text-sm text-slate-400">
              Opening pharmacy workspace…
            </div>
          ) : (
            <PharmacyWorkspacePanel
              data={workspace}
              panel={panel}
              onPanelChange={changePanel}
              onOpenCampaign={(slug, serviceKey) => {
                window.location.assign(campaignBuilderChooseUrl(slug, serviceKey));
              }}
              onBack={() => {
                closePharmacyWorkspace();
                setWorkspaceOpen(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};
