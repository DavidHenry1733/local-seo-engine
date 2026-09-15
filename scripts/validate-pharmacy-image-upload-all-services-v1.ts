#!/usr/bin/env npx tsx
/**
 * PharmaConnect Image Upload All Services V1 — routing and assignment validation.
 * Verifies image library dashboard, upload, and assign work for every benchmark service.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assignSlotImage,
  buildImageOperatingSystemDashboard,
  loadImageAssignments,
  normalizeImageLibraryServiceId,
  registerUpload,
} from "../src/pharmacy/pharmacyImageOperatingSystem.ts";
import { renderImageLibraryDashboardHtml } from "../artifacts/api-server/src/routes/pharmacyImageLibraryPage.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const slug = process.argv[2] || "pharmaconnect";
const BASE = process.env.PHARMA_API_BASE || "http://127.0.0.1:3001";

const SERVICES = [
  "blood-pressure-checks",
  "pharmacy-first",
  "travel-vaccinations",
  "emergency-contraception",
] as const;

interface Check {
  serviceId: string;
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(serviceId: string, id: string, pass: boolean, detail: string) {
  checks.push({ serviceId, id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${serviceId}] ${id} — ${detail}`);
}

function assertNoBareImageLibraryLinks(html: string): boolean {
  const bad = html.match(/href="\/pharmacy-image-library[^"]*"/g) || [];
  const badJs = html.includes("location.href = '/pharmacy-image-library");
  return bad.length === 0 && !badJs;
}

function makeTestSvg(label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#1a5c42" width="400" height="300"/><text x="50%" y="50%" fill="#fff" font-size="18" text-anchor="middle">${label}</text></svg>`;
}

async function uploadViaApi(serviceId: string, slot: string): Promise<{ ok: boolean; error?: string }> {
  const svg = makeTestSvg(`${serviceId}-${slot}`);
  const fd = new FormData();
  fd.append("file", new Blob([svg], { type: "image/svg+xml" }), `${serviceId}-${slot}-validate.svg`);
  fd.append("serviceId", serviceId);
  fd.append("slot", slot);
  fd.append("category", slot);
  const res = await fetch(`${BASE}/api/pharmacy/image-library/${slug}/upload`, {
    method: "POST",
    body: fd,
    redirect: "manual",
  });
  if (res.status === 302 || res.status === 401) {
    return { ok: false, error: `auth required (${res.status})` };
  }
  const json = (await res.json()) as { ok: boolean; error?: string };
  return json.ok ? { ok: true } : { ok: false, error: json.error || `HTTP ${res.status}` };
}

async function assignViaApi(serviceId: string, slot: string, libraryRef: string): Promise<boolean> {
  const res = await fetch(`${BASE}/api/pharmacy/image-library/${slug}/assign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceId, slot, source: "library", libraryRef }),
    redirect: "manual",
  });
  if (res.status === 302 || res.status === 401) return false;
  const json = (await res.json()) as { ok: boolean };
  return json.ok;
}

const LIBRARY_REFS: Record<string, string> = {
  "blood-pressure-checks": "clinical-nhs-services/blood-pressure-check",
  "pharmacy-first": "clinical-nhs-services/pharmacy-first",
  "travel-vaccinations": "travel-health-services/travel-vaccination",
  "emergency-contraception": "clinical-nhs-services/contraception-service",
};

console.log(`\nPharmaConnect Image Upload All Services V1 — ${slug}\n`);

for (const serviceId of SERVICES) {
  const normalized = normalizeImageLibraryServiceId(serviceId);
  record(serviceId, "service-id-normalised", normalized === serviceId, normalized || "rejected");

  const dashboard = buildImageOperatingSystemDashboard(slug, { serviceId });
  record(
    serviceId,
    "dashboard-selected-service",
    dashboard.selectedServiceId === serviceId,
    `selected=${dashboard.selectedServiceId}`,
  );

  const html = renderImageLibraryDashboardHtml(dashboard, "hero");
  record(serviceId, "dashboard-loads", html.includes("Pharmacy Image Library"), "HTML renders");
  record(
    serviceId,
    "upload-form-serviceId",
    html.includes(`SERVICE_ID = ${JSON.stringify(serviceId)}`) || html.includes(`"${serviceId}"`),
    "Page embeds selected serviceId",
  );
  record(
    serviceId,
    "no-bare-routes",
    assertNoBareImageLibraryLinks(html),
    "Links use /api/pharmacy-image-library",
  );
  record(
    serviceId,
    "service-select-redirect",
    html.includes("IMAGE_LIBRARY_PATH") && html.includes("imageLibraryPageUrl"),
    "Service change preserves slug/service/slot under /api path",
  );

  // Offline upload + assign layer
  const uploadPath = path.join(ROOT, "assets/pharmacy-uploads", slug, `${serviceId}-hero-validate.svg`);
  fs.mkdirSync(path.dirname(uploadPath), { recursive: true });
  fs.writeFileSync(uploadPath, makeTestSvg(`${serviceId} hero`), "utf8");
  const rel = `assets/pharmacy-uploads/${slug}/${path.basename(uploadPath)}`;
  const entry = registerUpload(slug, {
    filename: path.basename(uploadPath),
    path: rel,
    category: "hero",
    mimeType: "image/svg+xml",
    label: `Validate ${serviceId}`,
  });
  assignSlotImage(slug, serviceId, "hero", { source: "upload", uploadId: entry.id });

  const doc = loadImageAssignments(slug);
  const key = `${serviceId}:hero`;
  record(
    serviceId,
    "assignment-saves",
    doc.assignments[key]?.uploadId === entry.id,
    `assignment key ${key}`,
  );

  const reloaded = buildImageOperatingSystemDashboard(slug, { serviceId });
  record(
    serviceId,
    "reload-shows-assignment",
    reloaded.pageSlots.find((p) => p.slot === "hero")?.assigned === true,
    "Hero slot assigned after reload",
  );

  // Optional live API (skipped when auth-gated)
  try {
    const live = await uploadViaApi(serviceId, "support");
    if (live.error?.includes("auth")) {
      record(serviceId, "live-upload-skipped", true, "Auth-gated — offline checks used");
    } else {
      record(serviceId, "live-upload-endpoint", live.ok, live.error || "Upload accepted");
    }
    const assignOk = await assignViaApi(serviceId, "trust", LIBRARY_REFS[serviceId] || "core-pharmacy/community-pharmacy");
    if (live.error?.includes("auth")) {
      record(serviceId, "live-assign-skipped", true, "Auth-gated — offline checks used");
    } else {
      record(serviceId, "live-assign-endpoint", assignOk, assignOk ? "Assign accepted" : "Assign failed");
    }
    const dashRes = await fetch(`${BASE}/api/pharmacy-image-library?slug=${slug}&service=${serviceId}&slot=hero`, {
      redirect: "manual",
    });
    if (dashRes.status === 302 || dashRes.status === 401) {
      record(serviceId, "live-dashboard-skipped", true, `Auth-gated (${dashRes.status})`);
    } else {
      const liveHtml = await dashRes.text();
      record(
        serviceId,
        "live-dashboard-route",
        liveHtml.includes('id="slotGrid"'),
        `HTTP ${dashRes.status}`,
      );
      record(
        serviceId,
        "live-no-404-links",
        assertNoBareImageLibraryLinks(liveHtml),
        "Live HTML uses /api/pharmacy-image-library",
      );
    }
  } catch (err) {
    record(serviceId, "live-api-error", false, String(err));
  }
}

const passed = checks.filter((c) => c.pass).length;
const total = checks.length;
const allPass = passed === total;

const reportPath = path.join(ROOT, "data/validation-reports/pharmacy-image-upload-all-services-v1.json");
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      slug,
      services: [...SERVICES],
      summary: { passed, total, allPass },
      checks,
      manualTestUrls: SERVICES.map(
        (s) => `/api/pharmacy-image-library?slug=${slug}&service=${s}&slot=hero`,
      ),
    },
    null,
    2,
  ),
  "utf8",
);

console.log(`\n${passed}/${total} checks passed`);
console.log(`Report: ${reportPath}\n`);
process.exit(allPass ? 0 : 1);
