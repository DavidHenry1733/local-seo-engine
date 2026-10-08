import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Loader2, MapPin, Search, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";

const CITIES = ["Manchester", "Liverpool", "Birmingham", "Leeds", "Sheffield"] as const;
const LICENSE_GBP = 1000;
const FULL_POSTCODE_RE = /^([A-Z]{1,2}\d[A-Z\d]?)\s*(\d[A-Z]{2})$/i;
const OUTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?$/i;

type LicenseStatus = "available" | "reserved";

type PharmacyLead = {
  pharmacyName: string;
  postcode: string;
  outcode: string;
  slug?: string;
  registeredCompanyName?: string;
  companyNumber?: string;
  primaryDirectorName?: string;
  matchMethod: string;
  licenseStatus: LicenseStatus;
};

type TerritoryLead = {
  rank: number;
  outcode: string;
  town: string;
  region: string;
  postTown: string;
  areaName: string;
  outcodePopulation: number;
  radiusMiles: number;
  polygonOutcodes: string[];
  totalCatchmentPopulation: number;
  primaryCatchmentPopulation: number;
  clinicalDemand: number | null;
  licenseStatus: LicenseStatus;
  pharmacies: PharmacyLead[];
  totalEligibleIndependentsInCluster?: number;
  candidateNames?: string[];
};

type TopTerritoriesResponse = {
  ok: true;
  query: { city: string; metro: string; outcode: string };
  source: string;
  territories: TerritoryLead[];
};

type ClusterResponse = {
  ok: true;
  anchorOutcode: string;
  postTown: string;
  areaName: string;
  polygonOutcodes: string[];
  primaryCatchmentPopulation: number;
  totalCatchmentPopulation: number;
  clinicalDemand: number | null;
  licenseStatus: LicenseStatus;
};

type QueryKind = "city" | "outcode" | "postcode";

function classifyQuery(raw: string): { kind: QueryKind; value: string; outcode: string; postcode: string } {
  const value = raw.replace(/\s+/g, " ").trim();
  const compact = value.toUpperCase();
  const full = compact.match(FULL_POSTCODE_RE);
  if (full) {
    const outcode = full[1].replace(/\s+/g, "");
    return { kind: "postcode", value: `${outcode} ${full[2]}`, outcode, postcode: `${outcode} ${full[2]}` };
  }
  if (OUTCODE_RE.test(compact.replace(/\s+/g, ""))) {
    const outcode = compact.replace(/\s+/g, "");
    return { kind: "outcode", value: outcode, outcode, postcode: "" };
  }
  return { kind: "city", value, outcode: "", postcode: "" };
}

function formatInt(value: number): string {
  return Math.round(value).toLocaleString("en-GB");
}

function pitchHref(pharmacyName: string, postcode: string, claim = false): string {
  const params = new URLSearchParams();
  if (pharmacyName) params.set("pharmacyName", pharmacyName);
  if (postcode) params.set("postcode", postcode);
  if (claim) params.set("claim", "1");
  return `/new-pitch?${params.toString()}`;
}

const page: CSSProperties = { flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" };
const card: CSSProperties = {
  background: "#10121c",
  border: "1px solid #1c1f30",
  borderRadius: 16,
  padding: 20,
};
const inputStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: "#181b2a",
  border: "1px solid #252840",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 14,
  color: "#e4e8f5",
  fontFamily: "inherit",
  outline: "none",
};

function StatusBadge({ status }: { status: LicenseStatus }) {
  const reserved = status === "reserved";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        background: reserved ? "#450a0a" : "#052e16",
        color: reserved ? "#fda4af" : "#4ade80",
        border: `1px solid ${reserved ? "#7f1d1d" : "#166534"}`,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: reserved ? "#f87171" : "#22c55e" }} />
      {reserved ? "Reserved" : "Available"}
    </span>
  );
}

function TerritoryCard({
  territory,
  onPitch,
}: {
  territory: TerritoryLead;
  onPitch: (href: string) => void;
}) {
  const polygon = territory.polygonOutcodes.join(", ");
  return (
    <article style={{ ...card, display: "grid", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: "0 0 6px", color: "#818cf8", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em" }}>
            RANK #{territory.rank}
          </p>
          <h2 style={{ margin: 0, color: "#e4e8f5", fontSize: 18, fontWeight: 800, letterSpacing: "-0.02em" }}>
            #{territory.rank} · {territory.outcode} — {territory.areaName}
          </h2>
          <p style={{ margin: "6px 0 0", color: "#6b7296", fontSize: 12.5 }}>
            {territory.postTown}
            {territory.region && territory.region !== territory.postTown ? ` · ${territory.region}` : ""}
          </p>
        </div>
        <StatusBadge status={territory.licenseStatus} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
        <div style={{ background: "#181b2a", border: "1px solid #252840", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7296" }}>
            ONS catchment
          </div>
          <div style={{ marginTop: 4, color: "#e4e8f5", fontWeight: 800, fontSize: 15 }}>
            {formatInt(territory.primaryCatchmentPopulation)} residents
          </div>
        </div>
        <div style={{ background: "#181b2a", border: "1px solid #252840", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7296" }}>
            15-mile radial reach
          </div>
          <div style={{ marginTop: 4, color: "#e4e8f5", fontWeight: 800, fontSize: 15 }}>
            {formatInt(territory.totalCatchmentPopulation)}
          </div>
        </div>
        <div style={{ background: "#181b2a", border: "1px solid #252840", borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7296" }}>
            Clinical demand
          </div>
          <div style={{ marginTop: 4, color: "#e4e8f5", fontWeight: 800, fontSize: 15 }}>
            {territory.clinicalDemand != null ? `${formatInt(territory.clinicalDemand)} / mo` : "Not yet measured"}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7296", marginBottom: 6 }}>
          Cluster polygon
        </div>
        <p style={{ margin: 0, color: "#c8d0e0", fontSize: 13, lineHeight: 1.5 }}>{polygon}</p>
      </div>

      <div>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7296", marginBottom: 8 }}>
          Eligible independent pharmacies
          {territory.totalEligibleIndependentsInCluster != null
            ? ` · ${territory.totalEligibleIndependentsInCluster} in cluster`
            : ""}
        </div>
        {territory.pharmacies.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["Trading name", "Postcode", "Registered entity", "Primary director", "Status", ""].map((label) => (
                    <th
                      key={label || "action"}
                      style={{
                        textAlign: "left",
                        padding: "8px 8px 8px 0",
                        color: "#6b7296",
                        fontSize: 10,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        borderBottom: "1px solid #1c1f30",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {territory.pharmacies.map((pharmacy) => (
                  <tr key={`${pharmacy.companyNumber || pharmacy.pharmacyName}-${pharmacy.postcode}`}>
                    <td style={{ padding: "10px 8px 10px 0", color: "#e4e8f5", fontWeight: 650, borderBottom: "1px solid #181b2a" }}>
                      {pharmacy.pharmacyName}
                    </td>
                    <td style={{ padding: "10px 8px 10px 0", color: "#c8d0e0", borderBottom: "1px solid #181b2a", whiteSpace: "nowrap" }}>
                      {pharmacy.postcode}
                    </td>
                    <td style={{ padding: "10px 8px 10px 0", color: "#c8d0e0", borderBottom: "1px solid #181b2a" }}>
                      {pharmacy.registeredCompanyName || "—"}
                      {pharmacy.companyNumber ? ` (${pharmacy.companyNumber})` : ""}
                    </td>
                    <td style={{ padding: "10px 8px 10px 0", color: "#c8d0e0", borderBottom: "1px solid #181b2a" }}>
                      {pharmacy.primaryDirectorName || "—"}
                    </td>
                    <td style={{ padding: "10px 8px 10px 0", borderBottom: "1px solid #181b2a" }}>
                      <StatusBadge status={pharmacy.licenseStatus} />
                    </td>
                    <td style={{ padding: "10px 0", borderBottom: "1px solid #181b2a", textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => onPitch(pitchHref(pharmacy.pharmacyName, pharmacy.postcode || territory.outcode))}
                        style={{
                          background: "#0f172a",
                          color: "#e4e8f5",
                          border: "1px solid #334155",
                          borderRadius: 8,
                          padding: "7px 10px",
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        Generate Executive Pitch
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p style={{ margin: 0, color: "#6b7296", fontSize: 13 }}>No independent pharmacies matched in this polygon yet.</p>
        )}
      </div>
    </article>
  );
}

export function TerritoryExplorer() {
  const [, setLocation] = useLocation();
  const initial = useMemo(() => {
    const q = new URLSearchParams(typeof window === "undefined" ? "" : window.location.search).get("q");
    return q?.trim() || "Manchester";
  }, []);
  const [draft, setDraft] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cluster, setCluster] = useState<ClusterResponse | null>(null);
  const [territories, setTerritories] = useState<TerritoryLead[]>([]);
  const parsed = useMemo(() => classifyQuery(query), [query]);

  const goPitch = useCallback(
    (href: string) => {
      setLocation(href);
    },
    [setLocation],
  );

  const runSearch = useCallback(async (raw: string) => {
    const next = classifyQuery(raw);
    if (!next.value) {
      setError("Enter a city, outcode, or postcode.");
      return;
    }
    setBusy(true);
    setError("");
    setCluster(null);
    setTerritories([]);
    setQuery(next.value);
    setDraft(next.value);
    const params = new URLSearchParams(window.location.search);
    params.set("q", next.value);
    window.history.replaceState(null, "", `/territories?${params.toString()}`);
    try {
      if (next.kind === "postcode" || next.kind === "outcode") {
        const clusterRow = await apiFetch<ClusterResponse>(
          `/api/growth-engine/territory-cluster?outcode=${encodeURIComponent(next.outcode)}`,
        );
        setCluster(clusterRow);
        const ranked = await apiFetch<TopTerritoriesResponse>(
          `/api/growth-engine/top-territories?outcode=${encodeURIComponent(next.outcode)}&limit=1`,
          { signal: AbortSignal.timeout(180000) },
        );
        setTerritories(ranked.territories || []);
      } else {
        const ranked = await apiFetch<TopTerritoriesResponse>(
          `/api/growth-engine/top-territories?city=${encodeURIComponent(next.value)}&limit=10`,
          { signal: AbortSignal.timeout(180000) },
        );
        setTerritories(ranked.territories || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Territory lookup failed.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(initial);
  }, [initial, runSearch]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void runSearch(draft);
  };

  const claimPostcode = parsed.postcode || territories[0]?.pharmacies[0]?.postcode || parsed.outcode;
  const catchmentReserved = cluster?.licenseStatus === "reserved" || territories[0]?.licenseStatus === "reserved";

  return (
    <main style={page}>
      <div style={{ maxWidth: 1120 }}>
        <p style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", margin: "0 0 8px" }}>
          PHARMACONNECT
        </p>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              Territory Explorer
            </h1>
            <p style={{ color: "#6b7296", fontSize: 13, margin: 0, lineHeight: 1.5, maxWidth: 640 }}>
              Check 15-mile outcode clusters, ONS catchment population, and exclusive licensing before you pitch.
            </p>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5, color: "#c8d0e0" }}>
            <span>🟢 Available to License</span>
            <span>🔴 Territory Reserved</span>
          </div>
        </div>

        <form onSubmit={onSubmit} style={{ ...card, marginTop: 22, display: "grid", gap: 14 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 320px", display: "flex", alignItems: "center", gap: 8, background: "#181b2a", border: "1px solid #252840", borderRadius: 10, paddingLeft: 12 }}>
              <Search size={15} color="#6b7296" />
              <input
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Enter City, Postcode, or Outcode"
                aria-label="Enter City, Postcode, or Outcode"
                style={{ ...inputStyle, border: "none", background: "transparent", paddingLeft: 0 }}
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                background: busy ? "#1e2038" : "linear-gradient(135deg,#1d4ed8,#005EB8)",
                border: "none",
                borderRadius: 10,
                padding: "12px 18px",
                color: "#fff",
                fontWeight: 800,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {busy ? <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} /> : <MapPin size={15} />}
              {busy ? "Resolving cluster…" : "Check catchment"}
            </button>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CITIES.map((city) => {
              const active = parsed.kind === "city" && parsed.value.toLowerCase() === city.toLowerCase();
              return (
                <button
                  key={city}
                  type="button"
                  onClick={() => void runSearch(city)}
                  style={{
                    borderRadius: 999,
                    border: `1px solid ${active ? "#1d4ed8" : "#252840"}`,
                    background: active ? "#172554" : "#181b2a",
                    color: active ? "#93c5fd" : "#c8d0e0",
                    padding: "7px 12px",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </form>

        {error && (
          <p role="alert" style={{ margin: "16px 0 0", color: "#fda4af", fontSize: 13 }}>
            {error}
          </p>
        )}

        {parsed.kind === "postcode" && cluster && (
          <section style={{ ...card, marginTop: 18, borderColor: catchmentReserved ? "#7f1d1d" : "#1d4ed8", background: catchmentReserved ? "#1c1014" : "#101624" }}>
            <p style={{ margin: "0 0 6px", color: "#93c5fd", fontSize: 11, fontWeight: 800, letterSpacing: "0.14em" }}>
              15-MILE PROTECTED POLYGON
            </p>
            <h2 style={{ margin: "0 0 10px", color: "#e4e8f5", fontSize: 20, fontWeight: 800 }}>
              {parsed.postcode} · {cluster.anchorOutcode} — {cluster.areaName}
            </h2>
            <p style={{ margin: "0 0 14px", color: "#c8d0e0", fontSize: 13.5, lineHeight: 1.55 }}>
              {cluster.polygonOutcodes.join(", ")}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7296" }}>
                  ONS population pool
                </div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "#fff" }}>
                  ~{formatInt(cluster.primaryCatchmentPopulation)} residents
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7296" }}>
                  Estimated monthly patient demand
                </div>
                <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: "#fff" }}>
                  {cluster.clinicalDemand != null
                    ? `${formatInt(cluster.clinicalDemand)} / month`
                    : "Generate a pitch to measure live Ads demand"}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "#6b7296" }}>
                  Licence
                </div>
                <div style={{ marginTop: 8 }}>
                  <StatusBadge status={cluster.licenseStatus} />
                </div>
              </div>
            </div>
            {catchmentReserved ? (
              <p style={{ margin: 0, color: "#fda4af", fontSize: 13, fontWeight: 700 }}>This 15-mile cluster is already reserved.</p>
            ) : (
              <button
                type="button"
                onClick={() => goPitch(pitchHref("", claimPostcode, true))}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: "linear-gradient(135deg,#005EB8,#1d4ed8)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 14,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                <Sparkles size={15} />
                Claim Exclusive Territory License (£{LICENSE_GBP.toLocaleString("en-GB")}/yr)
              </button>
            )}
          </section>
        )}

        <div style={{ marginTop: 22, display: "grid", gap: 16 }}>
          {busy && !territories.length && !cluster && (
            <p style={{ color: "#6b7296", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={15} style={{ animation: "spin 1s linear infinite" }} />
              Ranking high-density outcodes and matching independent pharmacies…
            </p>
          )}
          {territories.map((territory) => (
            <TerritoryCard key={territory.outcode} territory={territory} onPitch={goPitch} />
          ))}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}

export default TerritoryExplorer;
