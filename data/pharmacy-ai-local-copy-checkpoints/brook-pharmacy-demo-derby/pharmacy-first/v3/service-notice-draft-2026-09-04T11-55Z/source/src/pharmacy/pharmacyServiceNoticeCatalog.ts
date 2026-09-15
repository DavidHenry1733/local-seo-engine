/**
 * Renderer-owned service-notice catalog.
 * AI generation must not rewrite these strings. Status stays draft until
 * a designated clinical reviewer explicitly approves page content.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import type {
  ProfilePrescribingSupplyStatus,
  ProfileServiceDeliveryMode,
  ProfileServiceFundingModel,
  ProfileUkNation,
} from "./pharmacyProfileV2Fields.ts";

export const SERVICE_NOTICE_COMPONENT_VERSION = 1;
export const SERVICE_NOTICE_CATALOG_DIR = "data/pharmacy-service-notices";
export const PHARMACY_FIRST_ENGLAND_NHS_NOTICE_ID = "pharmacy-first-england-nhs-v1";

export type ServiceNoticeStatus = "draft" | "approved";

export interface ServiceNoticeContentApproval {
  approved: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  note: string;
}

export interface ServiceNoticeRecord {
  id: string;
  version: number;
  componentVersion: number;
  serviceId: string;
  ukNation: ProfileUkNation;
  fundingModel: ProfileServiceFundingModel;
  allowedFunding: ProfileServiceFundingModel[];
  allowedDeliveryModes: ProfileServiceDeliveryMode[];
  requiresDeliveryConfirmed: boolean;
  requiresPrescribingSupplyConfirmed: boolean;
  allowedPrescribingSupply: ProfilePrescribingSupplyStatus[];
  status: ServiceNoticeStatus;
  aiMustNotRewrite: true;
  rendererOwned: true;
  heading: string;
  body: string;
  contentApproval: ServiceNoticeContentApproval;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map((x) => str(x)).filter(Boolean) : [];
}

export function serviceNoticeCatalogDir(): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, SERVICE_NOTICE_CATALOG_DIR);
}

export function loadServiceNoticeRecord(filePath: string): ServiceNoticeRecord {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
  const approval = (raw.contentApproval && typeof raw.contentApproval === "object"
    ? raw.contentApproval
    : {}) as Record<string, unknown>;
  const status = str(raw.status) === "approved" ? "approved" : "draft";
  const contentApproved = approval.approved === true;
  return {
    id: str(raw.id),
    version: Number(raw.version) || 1,
    componentVersion: Number(raw.componentVersion) || SERVICE_NOTICE_COMPONENT_VERSION,
    serviceId: str(raw.serviceId),
    ukNation: (str(raw.ukNation) || "unknown") as ProfileUkNation,
    fundingModel: (str(raw.fundingModel) || "unknown") as ProfileServiceFundingModel,
    allowedFunding: strArray(raw.allowedFunding) as ProfileServiceFundingModel[],
    allowedDeliveryModes: strArray(raw.allowedDeliveryModes) as ProfileServiceDeliveryMode[],
    requiresDeliveryConfirmed: raw.requiresDeliveryConfirmed !== false,
    requiresPrescribingSupplyConfirmed: raw.requiresPrescribingSupplyConfirmed !== false,
    allowedPrescribingSupply: strArray(raw.allowedPrescribingSupply) as ProfilePrescribingSupplyStatus[],
    status: contentApproved ? "approved" : status,
    aiMustNotRewrite: true,
    rendererOwned: true,
    heading: str(raw.heading) || "Eligibility and important information",
    body: str(raw.body),
    contentApproval: {
      approved: contentApproved,
      approvedBy: str(approval.approvedBy) || null,
      approvedAt: str(approval.approvedAt) || null,
      note:
        str(approval.note) ||
        "Reviewer identity confirmation is not approval of this page content.",
    },
  };
}

export function loadServiceNoticeCatalog(): ServiceNoticeRecord[] {
  const dir = serviceNoticeCatalogDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => loadServiceNoticeRecord(path.join(dir, name)))
    .filter((row) => row.id && row.body && row.aiMustNotRewrite);
}

export function getServiceNoticeById(id: string): ServiceNoticeRecord | null {
  return loadServiceNoticeCatalog().find((row) => row.id === id) || null;
}

export function pharmacyFirstEnglandNhsNotice(): ServiceNoticeRecord {
  const notice = getServiceNoticeById(PHARMACY_FIRST_ENGLAND_NHS_NOTICE_ID);
  if (!notice) throw new Error(`Missing renderer-owned notice ${PHARMACY_FIRST_ENGLAND_NHS_NOTICE_ID}`);
  return notice;
}
