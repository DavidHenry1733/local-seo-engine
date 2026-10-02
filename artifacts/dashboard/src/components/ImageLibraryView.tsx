import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { apiFetch } from "@/lib/api";
import { readWorkspaceSlug } from "@/lib/pharmacyWorkspaceClient";

const PAGE_SLOTS = ["hero", "support", "trust", "conversion"] as const;

interface MatrixCell {
  serviceId: string;
  serviceName: string;
  slot: string;
  assigned: boolean;
  source?: string;
  previewUrl?: string | null;
  libraryRef?: string | null;
}

interface ServiceCatalogEntry {
  serviceId: string;
  serviceName: string;
  status?: "active" | "pipeline";
}

interface ImageLibraryDashboard {
  slug?: string;
  pharmacyName?: string;
  selectedServiceId?: string;
  serviceCatalog?: ServiceCatalogEntry[];
  matrix?: MatrixCell[];
}

export function ImageLibraryView({ slug }: { slug?: string }) {
  const resolvedSlug = slug || readWorkspaceSlug();
  const [data, setData] = useState<ImageLibraryDashboard | null>(null);
  const [serviceId, setServiceId] = useState("pharmacy-first");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!resolvedSlug) return;
    let cancelled = false;
    setLoading(true);
    apiFetch<{ ok?: boolean; dashboard?: ImageLibraryDashboard }>(
      `/api/pharmacy/image-library/${encodeURIComponent(resolvedSlug)}/data?service=${encodeURIComponent(serviceId)}`,
    )
      .then((payload) => {
        if (cancelled) return;
        setData(payload.dashboard || null);
        setError(null);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Could not load image matrix.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resolvedSlug, serviceId]);

  const catalog = (data?.serviceCatalog || []).filter((channel) => channel.status === "active");
  const activeNames = catalog.map((channel) => channel.serviceName).join(", ");
  const rows = useMemo(() => {
    const byService = new Map<string, MatrixCell[]>();
    for (const cell of data?.matrix || []) {
      if (!PAGE_SLOTS.includes(cell.slot as (typeof PAGE_SLOTS)[number])) continue;
      if (catalog.every((channel) => channel.serviceId !== cell.serviceId)) continue;
      const list = byService.get(cell.serviceId) || [];
      list.push(cell);
      byService.set(cell.serviceId, list);
    }
    return catalog.map((channel) => ({
      ...channel,
      cells: byService.get(channel.serviceId) || [],
    }));
  }, [catalog, data?.matrix]);

  if (!resolvedSlug) {
    return (
      <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
        <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Image matrix</h1>
        <p style={{ color: "#6b7296", fontSize: 13 }}>Select a production pharmacy to load the four campaign asset slots.</p>
      </main>
    );
  }

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
        <div>
          <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Image matrix</h1>
          <p style={{ color: "#6b7296", fontSize: 12.5, margin: 0 }}>
            {data?.pharmacyName || resolvedSlug}{activeNames ? ` — ${activeNames}` : ""}
          </p>
        </div>
        <select
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          style={{ background: "#181b2a", color: "#d4d8f0", border: "1px solid #252840", borderRadius: 8, padding: "8px 12px" }}
        >
          {catalog.map((channel) => (
            <option key={channel.serviceId} value={channel.serviceId}>
              {channel.serviceName}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p style={{ color: "#6b7296", fontSize: 13 }}>Loading production slot matrix…</p>
      ) : error ? (
        <p style={{ color: "#fb7185", fontSize: 13 }}>{error}</p>
      ) : (
        <div style={{ overflowX: "auto", border: "1px solid #1c1f30", borderRadius: 14, background: "#10121c" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Service</th>
                {PAGE_SLOTS.map((slot) => (
                  <th key={slot} style={thStyle}>{slot}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.serviceId}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, color: "#e4e8f5" }}>{row.serviceName}</div>
                    <div style={{ fontSize: 11, color: "#4a5080" }}>{row.serviceId}</div>
                  </td>
                  {PAGE_SLOTS.map((slot) => {
                    const cell = row.cells.find((item) => item.slot === slot);
                    return (
                      <td key={slot} style={tdStyle}>
                        <a
                          href={`/api/pharmacy-image-library?slug=${encodeURIComponent(resolvedSlug)}&service=${encodeURIComponent(row.serviceId)}&slot=${slot}`}
                          style={{ color: cell?.assigned ? "#34d399" : "#fb7185", fontWeight: 700, textDecoration: "none" }}
                        >
                          {cell?.assigned ? "Assigned" : "Empty"}
                        </a>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const thStyle: CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#6b7296",
  padding: "12px 16px",
  borderBottom: "1px solid #1c1f30",
};

const tdStyle: CSSProperties = {
  padding: "14px 16px",
  borderBottom: "1px solid #1c1f30",
  fontSize: 13,
};

export default ImageLibraryView;
