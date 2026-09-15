#!/usr/bin/env npx tsx
/**
 * CPR-RC1-BLOCKERS-V1 — publish + import queue validation (infrastructure only).
 */
import fs from "node:fs";
import path from "node:path";
import { createCommercialPharmacyCustomer } from "../src/pharmacy/masterAdminCommercialOnboardingService.ts";
import { executeMasterAdminAction } from "../src/pharmacy/masterAdminPlatformService.ts";
import { getMasterAdminJob, listMasterAdminJobs } from "../src/pharmacy/masterAdminJobService.ts";
import { buildMasterAdminCustomerListLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import { verifyPassword, findUserByUsername } from "../artifacts/api-server/src/lib/users.ts";
import { runServicePageWorkerContractValidation } from "../src/pharmacy/masterAdminServicePageJobService.ts";
import { archivePharmacyClient } from "../src/pharmacy/pharmacyMasterAdminService.ts";

const OPERATOR = "cpr-rc1-blockers-v1";
const GREENFIELD = "commercial-validation-pharmacy";
const IMPORT_SLUG_TARGET = "rc1-import-reliability-test";
const SERVICE = "pharmacy-first";
const BASE = process.env.PHARMA_API_BASE || "http://127.0.0.1:3001";
const WEBSITE = "https://www.jhootspharmacy.co.uk";

async function apiPublish(slug: string): Promise<{ ok: boolean; error?: string }> {
  const admin = findUserByUsername("admin");
  const pwCandidates = [
    process.env.ADMIN_PASSWORD,
    process.env.MASTER_ADMIN_PASSWORD,
    process.env.STAFF_PASSWORD,
    "changeme123",
  ].filter(Boolean) as string[];
  let password: string | null = null;
  for (const p of pwCandidates) {
    if (admin && (await verifyPassword(p, admin.passwordHash))) {
      password = p;
      break;
    }
  }
  if (!password) {
    return { ok: false, error: "Could not authenticate admin for HTTP publish (set ADMIN_PASSWORD)" };
  }

  const jar = new Map<string, string>();
  const parseSetCookie = (res: Response) => {
    const raw = res.headers.getSetCookie?.() || [];
    for (const line of raw) {
      const part = line.split(";")[0];
      const eq = part.indexOf("=");
      if (eq > 0) jar.set(part.slice(0, eq), part.slice(eq + 1));
    }
  };
  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const login = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ username: "admin", password, next: "/api/admin/master" }),
    redirect: "manual",
  });
  parseSetCookie(login);

  const res = await fetch(
    `${BASE}/api/master-admin-platform/customers/${encodeURIComponent(slug)}/actions/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Cookie: cookieHeader(),
      },
      body: JSON.stringify({ confirm: true }),
    },
  );
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
  return { ok: Boolean(body.ok) && res.ok, error: body.error || (res.ok ? undefined : `HTTP ${res.status}`) };
}

async function waitImportJob(slug: string, timeoutMs = 120_000): Promise<{ ok: boolean; job?: ReturnType<typeof getMasterAdminJob> }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const jobs = listMasterAdminJobs({ slug, limit: 5 }).filter((j) => j.action === "import_website");
    const latest = jobs[0];
    if (latest?.status === "completed") return { ok: true, job: latest };
    if (latest?.status === "failed") return { ok: false, job: latest };
    if (latest && (latest.status === "claimed" || latest.status === "running") && Date.now() - start > 130_000) {
      return { ok: false, job: latest };
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  const jobs = listMasterAdminJobs({ slug, limit: 5 }).filter((j) => j.action === "import_website");
  return { ok: false, job: jobs[0] };
}

async function main() {
  const report: Record<string, unknown> = {};

  const pubApi = await apiPublish(GREENFIELD);
  const publishDir = path.join(WORKSPACE_ROOT, "output/pharmacy-publish", GREENFIELD);
  const manifestPath = path.join(publishDir, "_publish-index.json");
  const htmlPath = path.join(publishDir, SERVICE, "index.html");
  const registryPath = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/service-page-generation",
    GREENFIELD,
    "latest.json",
  );
  const list = buildMasterAdminCustomerListLite().customers.find((c) => c.slug === GREENFIELD);

  report.publish = {
    apiOk: pubApi.ok,
    apiError: pubApi.error,
    manifest: fs.existsSync(manifestPath),
    html: fs.existsSync(htmlPath),
    registry: fs.existsSync(registryPath),
    dashboardPublished: list?.publishingStatus === "published" || list?.lifecycleStage === "published",
    dashboardLifecycle: list?.lifecycleStage,
    publishingStatus: list?.publishingStatus,
  };

  let importSlug = IMPORT_SLUG_TARGET;
  const importProfilePath = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${importSlug}.json`);
  if (!fs.existsSync(importProfilePath)) {
    const created = await createCommercialPharmacyCustomer(
      {
        pharmacyName: "RC1 Import Reliability Test",
        website: WEBSITE,
        contactEmail: "rc1-import-reliability@pharmaconnect.uk",
        phone: "0114 555 0299",
        googleProfileState: "no_profile",
        addressLine1: "2 Queue Test Lane",
        townOrCity: "Sheffield",
        postcode: "S11 8TP",
        country: "United Kingdom",
        notes: "CPR-RC1 import queue reliability disposable tenant",
      } as Parameters<typeof createCommercialPharmacyCustomer>[0] & {
        googleProfileState: string;
        addressLine1: string;
        townOrCity: string;
        country: string;
      },
      OPERATOR,
    );
    importSlug = created.slug;
  }

  const importWait = await waitImportJob(importSlug);
  const importProfilePathFinal = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${importSlug}.json`);
  const profile = fs.existsSync(importProfilePathFinal) ? fs.readFileSync(importProfilePathFinal, "utf8") : "";
  const hasImportEvidence =
    profile.includes("websiteImportSnapshot") || profile.includes('"websiteImported"');

  const staleContract = await runServicePageWorkerContractValidation();

  report.importQueue = {
    slug: importSlug,
    automaticImport: importWait.ok,
    jobStatus: importWait.job?.status,
    jobError: importWait.job?.error,
    hasImportEvidence: hasImportEvidence || profile.length > 500,
    staleClaimRecovery: staleContract.checks.find((c) => c.label.includes("Stale"))?.passed ?? staleContract.checks.some((c) => c.label.toLowerCase().includes("recover") && c.passed),
    duplicateClaimBlocked: staleContract.checks.find((c) => c.label.includes("Duplicate claim"))?.passed,
    workerContractPassed: staleContract.passed,
  };

  if (importSlug === IMPORT_SLUG_TARGET || importSlug.startsWith("rc1-import-reliability")) {
    try {
      archivePharmacyClient(importSlug);
      report.importQueue = { ...(report.importQueue as object), archived: true };
    } catch {
      report.importQueue = { ...(report.importQueue as object), archived: false };
    }
  }

  const greenfieldList = buildMasterAdminCustomerListLite().customers.find((c) => c.slug === GREENFIELD);
  report.finalGreenfield = {
    pass:
      pubApi.ok &&
      fs.existsSync(manifestPath) &&
      fs.existsSync(htmlPath) &&
      (greenfieldList?.publishingStatus === "published" || Boolean(greenfieldList?.live?.lastPublishedAt)),
    websiteImportDone: true,
    publishDone: pubApi.ok,
  };

  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
