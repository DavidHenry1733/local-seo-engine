import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle, ExternalLink, Loader2, MapPin, Sparkles } from "lucide-react";
import { apiFetch, authUrl } from "@/lib/api";
import { activatePharmacyWorkspace } from "@/lib/pharmacyWorkspaceClient";

const STEPS = [
  { id: "catchments", label: "Identifying local catchment areas and neighbourhoods..." },
  { id: "demand", label: "Querying Google Ads search demand for 10 clinical services..." },
  { id: "serp", label: "Auditing local competitor SERP rankings and content gaps..." },
  { id: "report", label: "Generating Executive Board Report..." },
] as const;

type PitchResult = {
  ok: true;
  slug: string;
  pharmacyName: string;
  townCity: string;
  postcode: string;
  catchments: string[];
  reportUrl: string;
  workspaceUrl: string;
  elapsedMs: number;
  monthlySearchDemand: number | null;
  warnings?: string[];
};

const fieldStyle: CSSProperties = {
  width: "100%",
  background: "#181b2a",
  border: "1px solid #252840",
  borderRadius: 8,
  padding: "11px 14px",
  fontSize: 14,
  color: "#e4e8f5",
  fontFamily: "inherit",
  outline: "none",
};

export function GeneratePharmacyPitchWizard() {
  const queryClient = useQueryClient();
  const [pharmacyName, setPharmacyName] = useState("");
  const [postcode, setPostcode] = useState("");
  const [gphcNumber, setGphcNumber] = useState("");
  const [claimLicense, setClaimLicense] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [activeStep, setActiveStep] = useState(-1);
  const [result, setResult] = useState<PitchResult | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const name = params.get("pharmacyName") || params.get("name") || "";
    const pc = params.get("postcode") || "";
    if (name) setPharmacyName(name);
    if (pc) setPostcode(pc.toUpperCase());
    setClaimLicense(params.get("claim") === "1");
  }, []);

  useEffect(() => {
    if (!busy) return;
    setActiveStep(0);
    const timers = [
      window.setTimeout(() => setActiveStep(1), 4000),
      window.setTimeout(() => setActiveStep(2), 14000),
      window.setTimeout(() => setActiveStep(3), 50000),
    ];
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [busy]);

  const completedThrough = result ? STEPS.length - 1 : Math.max(-1, activeStep);

  const elapsedLabel = useMemo(() => {
    if (!result) return "";
    const seconds = Math.max(1, Math.round(result.elapsedMs / 1000));
    return `${seconds}s`;
  }, [result]);

  const submit = async () => {
    const name = pharmacyName.trim();
    const pc = postcode.trim();
    if (!name) {
      setError("Enter the pharmacy name.");
      return;
    }
    if (!pc) {
      setError("Enter a UK postcode.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const data = await apiFetch<PitchResult>("/api/growth-engine/generate-pitch", {
        method: "POST",
        body: JSON.stringify({
          pharmacyName: name,
          postcode: pc,
          gphcNumber: gphcNumber.trim(),
        }),
        signal: AbortSignal.timeout(180000),
      });
      setResult(data);
      await queryClient.invalidateQueries({ queryKey: ["dashboard-customers"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Pitch generation failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "#0b0d14" }}>
      <div style={{ maxWidth: 720 }}>
        <p style={{ color: "#818cf8", fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", margin: "0 0 8px" }}>
          ONBOARDING
        </p>
        <h1 style={{ color: "#e4e8f5", fontSize: 22, fontWeight: 700, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
          Generate New Pharmacy Pitch
        </h1>
        <p style={{ color: "#6b7296", fontSize: 13, margin: "0 0 24px", lineHeight: 1.5 }}>
          Enter a UK pharmacy name and postcode. We resolve the catchment cluster, pull live Google Ads demand for
          10 clinical services, audit local SERP competitors, and open the Executive Opportunity Report.
        </p>
        {claimLicense && (
          <p style={{ margin: "0 0 18px", padding: "10px 12px", borderRadius: 10, background: "#172554", border: "1px solid #1d4ed8", color: "#bfdbfe", fontSize: 13 }}>
            Exclusive territory licence enquiry — £1,000/yr. Complete the pharmacy details to generate the pitch pack.
          </p>
        )}

        <div style={{ background: "#10121c", border: "1px solid #1c1f30", borderRadius: 14, padding: 24 }}>
          <div style={{ display: "grid", gap: 16 }}>
            <label htmlFor="pitch-pharmacy-name" style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7296", marginBottom: 6 }}>
                Pharmacy Name
              </span>
              <input
                id="pitch-pharmacy-name"
                value={pharmacyName}
                onChange={(event) => setPharmacyName(event.target.value)}
                disabled={busy}
                placeholder="Broadway Pharmacy"
                autoComplete="organization"
                style={fieldStyle}
              />
            </label>
            <label htmlFor="pitch-postcode" style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7296", marginBottom: 6 }}>
                Postcode
              </span>
              <input
                id="pitch-postcode"
                value={postcode}
                onChange={(event) => setPostcode(event.target.value.toUpperCase())}
                disabled={busy}
                placeholder="PR2 9EA"
                autoComplete="postal-code"
                style={{ ...fieldStyle, textTransform: "uppercase" }}
              />
            </label>
            <label htmlFor="pitch-gphc" style={{ display: "block" }}>
              <span style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#6b7296", marginBottom: 6 }}>
                GPhC Number <span style={{ fontWeight: 500, color: "#3a3f5c" }}>(optional)</span>
              </span>
              <input
                id="pitch-gphc"
                value={gphcNumber}
                onChange={(event) => setGphcNumber(event.target.value)}
                disabled={busy}
                placeholder="GPhC verified"
                autoComplete="off"
                style={fieldStyle}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            data-testid="generate-pharmacy-pitch"
            style={{
              marginTop: 20,
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: busy ? "#1e2038" : "linear-gradient(135deg,#4f46e5,#7c3aed)",
              border: "none",
              borderRadius: 8,
              padding: "12px 16px",
              cursor: busy ? "wait" : "pointer",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              boxShadow: busy ? "none" : "0 0 16px rgba(99,102,241,0.35)",
            }}
          >
            {busy ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Sparkles size={16} />}
            {busy ? "Generating pitch…" : "Generate pitch"}
          </button>

          {(busy || result) && (
            <ol style={{ listStyle: "none", margin: "20px 0 0", padding: 0, display: "grid", gap: 10 }}>
              {STEPS.map((step, index) => {
                const done = result ? true : index < completedThrough;
                const current = !result && index === completedThrough;
                return (
                  <li
                    key={step.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      color: done ? "#4ade80" : current ? "#e4e8f5" : "#3a3f5c",
                      fontSize: 13,
                      lineHeight: 1.45,
                    }}
                  >
                    {done ? (
                      <CheckCircle2 size={16} color="#4ade80" style={{ flexShrink: 0, marginTop: 1 }} />
                    ) : current ? (
                      <Loader2 size={16} color="#818cf8" style={{ flexShrink: 0, marginTop: 1, animation: "spin 1s linear infinite" }} />
                    ) : (
                      <Circle size={16} color="#2e3250" style={{ flexShrink: 0, marginTop: 1 }} />
                    )}
                    <span>
                      {done ? "[✓] " : current ? "[…] " : "[ ] "}
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {error && (
            <p role="alert" style={{ margin: "16px 0 0", color: "#fda4af", fontSize: 13 }}>
              {error}
            </p>
          )}

          {result && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 12,
                border: "1px solid #166534",
                background: "#052e16",
              }}
            >
              <p style={{ margin: "0 0 8px", color: "#4ade80", fontSize: 14, fontWeight: 700 }}>
                Pitch ready for {result.pharmacyName}, {result.townCity} {result.postcode}
                {elapsedLabel ? ` · ${elapsedLabel}` : ""}
              </p>
              <p style={{ margin: "0 0 14px", color: "#86efac", fontSize: 12.5 }}>
                Catchments: {result.catchments.join(", ") || "n/a"}
                {result.monthlySearchDemand != null
                  ? ` · ${result.monthlySearchDemand.toLocaleString("en-GB")} monthly local searches`
                  : ""}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                <a
                  href={authUrl(result.reportUrl)}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#166534",
                    color: "#fff",
                    textDecoration: "none",
                    borderRadius: 8,
                    padding: "9px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  <ExternalLink size={14} />
                  Executive Opportunity Report
                </a>
                <button
                  type="button"
                  onClick={() => activatePharmacyWorkspace(result.slug, "intelligence")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#0f172a",
                    color: "#e4e8f5",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    padding: "9px 14px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <MapPin size={14} />
                  Workspace Dashboard
                </button>
              </div>
            </div>
          )}
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </main>
  );
}

export default GeneratePharmacyPitchWizard;
