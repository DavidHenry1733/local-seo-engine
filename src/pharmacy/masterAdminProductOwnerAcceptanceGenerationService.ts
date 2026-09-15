/**
 * NT-E2E-26A — Product Owner dashboard acceptance generation contract.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  HISTORICAL_ACCIDENTAL_JOB_ID,
  readAuthorisedEcosystemGenerationRecord,
  type AuthorisedEcosystemGenerationRecord,
} from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import type {
  AuthorisedGenerationInitiationSource,
  DashboardExternalPackageRecord,
  ProductOwnerAcceptanceGenerationContract,
  ProductOwnerAcceptanceGenerationSummary,
} from "./masterAdminProductOwnerAcceptanceGenerationModel.ts";

const CONTRACT_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/product-owner-acceptance-generation");

export const PRODUCT_OWNER_DASHBOARD_INITIATION_SOURCE = "product_owner_dashboard" as const;
export const SERVICE_LAYER_INITIATION_SOURCE = "service_layer" as const;

export const PRODUCT_OWNER_TEST_PACKAGE_CONFIRMATION =
  "This will create a new RC1 package through the Product Owner dashboard using the locked Canonical Generation Plan.\n\nPrevious packages will remain preserved for audit and will not be published.";

function contractPath(slug: string): string {
  return path.join(CONTRACT_DIR, slug, "contract.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export function readProductOwnerAcceptanceGenerationContract(
  slug: string,
): ProductOwnerAcceptanceGenerationContract | null {
  const file = contractPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ProductOwnerAcceptanceGenerationContract;
    return raw?.enabled ? raw : null;
  } catch {
    return null;
  }
}

export function isProductOwnerGenerationRequired(slug: string): boolean {
  return Boolean(readProductOwnerAcceptanceGenerationContract(slug));
}

export function resolveAuthorisedGenerationInitiationSource(
  record: AuthorisedEcosystemGenerationRecord | null,
): AuthorisedGenerationInitiationSource | null {
  if (!record) return null;
  if (record.initiationSource) return record.initiationSource;
  return SERVICE_LAYER_INITIATION_SOURCE;
}

export function isDashboardAuthorisedGenerationRecord(
  slug: string,
  record: AuthorisedEcosystemGenerationRecord | null = readAuthorisedEcosystemGenerationRecord(slug),
): boolean {
  return resolveAuthorisedGenerationInitiationSource(record) === PRODUCT_OWNER_DASHBOARD_INITIATION_SOURCE;
}

export function buildDashboardExternalPackageRecord(
  record: AuthorisedEcosystemGenerationRecord,
): DashboardExternalPackageRecord {
  return {
    jobId: record.jobId || "unknown",
    status: "Generated outside the Product Owner browser acceptance flow",
    label: "Previous RC1 package exists",
    generatedAt: record.completedAt || record.initiatedAt,
    initiationSource: resolveAuthorisedGenerationInitiationSource(record) || SERVICE_LAYER_INITIATION_SOURCE,
    preservedForAudit: true,
  };
}

export function buildProductOwnerAcceptanceGenerationSummary(slug: string): ProductOwnerAcceptanceGenerationSummary {
  const contract = readProductOwnerAcceptanceGenerationContract(slug);
  const record = readAuthorisedEcosystemGenerationRecord(slug);
  const externalFromContract = contract?.dashboardExternalPackages?.[0] || null;
  const externalFromRecord =
    contract && record?.jobId && !isDashboardAuthorisedGenerationRecord(slug, record)
      ? buildDashboardExternalPackageRecord(record)
      : null;

  return {
    required: Boolean(contract),
    stageLabel: contract?.activeStageLabel || "Product Owner Generation Required",
    previousDashboardExternalPackage: externalFromContract || externalFromRecord,
    generateActionLabel: "Generate Product Owner Test Package",
    confirmationMessage: PRODUCT_OWNER_TEST_PACKAGE_CONFIRMATION,
  };
}

export function enableProductOwnerAcceptanceGenerationContract(
  slug: string,
  operator: string,
  options?: {
    dashboardExternalPackages?: DashboardExternalPackageRecord[];
    preservedHistoricalPackageJobIds?: string[];
  },
): ProductOwnerAcceptanceGenerationContract {
  const record = readAuthorisedEcosystemGenerationRecord(slug);
  const dashboardExternalPackages =
    options?.dashboardExternalPackages ||
    (record?.jobId && !isDashboardAuthorisedGenerationRecord(slug, record)
      ? [buildDashboardExternalPackageRecord(record)]
      : []);

  const preservedHistoricalPackageJobIds = [
    ...(options?.preservedHistoricalPackageJobIds || []),
    HISTORICAL_ACCIDENTAL_JOB_ID,
    ...dashboardExternalPackages.map((p) => p.jobId),
  ].filter(Boolean);

  const contract: ProductOwnerAcceptanceGenerationContract = {
    version: 1,
    slug,
    mode: "product_owner_generation_required",
    enabled: true,
    enabledAt: new Date().toISOString(),
    enabledBy: operator,
    activeStageLabel: "Product Owner Generation Required",
    preservedHistoricalPackageJobIds: [...new Set(preservedHistoricalPackageJobIds)],
    dashboardExternalPackages,
  };
  writeJsonAtomic(contractPath(slug), contract);
  return contract;
}

export function patchAuthorisedGenerationInitiationSource(
  slug: string,
  initiationSource: AuthorisedGenerationInitiationSource,
  packageRevision?: string | null,
): AuthorisedEcosystemGenerationRecord | null {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/authorised-ecosystem-generation", slug, "latest.json");
  if (!fs.existsSync(file)) return null;
  const record = JSON.parse(fs.readFileSync(file, "utf8")) as AuthorisedEcosystemGenerationRecord;
  record.initiationSource = initiationSource;
  if (packageRevision !== undefined) record.packageRevision = packageRevision;
  writeJsonAtomic(file, record);
  return record;
}
