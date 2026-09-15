/**
 * Master Admin Workflow Acknowledgements — orchestration signals without modifying locked engines.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";

export interface CommercialIntelligenceApprovalRecord {
  approvedAt: string;
  approvedBy: string;
  approvedVersion: string;
  intelligenceEvidenceRevision?: string;
  competitorEvidenceRevision?: string;
  localMarketRevision?: string;
  growthIntelligenceRevision?: string;
}

interface WorkflowDoc {
  version: number;
  acknowledgements: Record<string, string>;
  lastOperator?: string;
  commercialIntelligenceApproval?: CommercialIntelligenceApprovalRecord;
}

function workflowDocPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-workflow.json`);
}

function readDoc(slug: string): WorkflowDoc {
  const file = workflowDocPath(slug);
  if (!fs.existsSync(file)) return { version: 1, acknowledgements: {} };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as WorkflowDoc;
    return {
      version: raw.version || 1,
      acknowledgements: raw.acknowledgements || {},
      lastOperator: raw.lastOperator,
      commercialIntelligenceApproval: raw.commercialIntelligenceApproval,
    };
  } catch {
    return { version: 1, acknowledgements: {} };
  }
}

function writeDoc(slug: string, doc: WorkflowDoc): void {
  fs.mkdirSync(path.dirname(workflowDocPath(slug)), { recursive: true });
  fs.writeFileSync(workflowDocPath(slug), JSON.stringify(doc, null, 2));
}

export function isWorkflowAcknowledged(slug: string, key: string): boolean {
  return Boolean(readDoc(slug).acknowledgements[key]);
}

export function writeWorkflowAcknowledgement(slug: string, key: string, operator: string): { key: string; acknowledgedAt: string } {
  const doc = readDoc(slug);
  const acknowledgedAt = new Date().toISOString();
  doc.acknowledgements[key] = acknowledgedAt;
  doc.lastOperator = operator;
  writeDoc(slug, doc);
  return { key, acknowledgedAt };
}

export function readCommercialIntelligenceApproval(slug: string): CommercialIntelligenceApprovalRecord | null {
  const doc = readDoc(slug);
  if (doc.commercialIntelligenceApproval) return doc.commercialIntelligenceApproval;
  const ackAt = doc.acknowledgements["commercial-intelligence-approved"];
  if (!ackAt) return null;
  return {
    approvedAt: ackAt,
    approvedBy: doc.lastOperator || "unknown",
    approvedVersion: doc.commercialIntelligenceApproval?.approvedVersion || "1",
  };
}

export function writeCommercialIntelligenceApproval(
  slug: string,
  operator: string,
  approvedVersion: string,
  revisions?: {
    intelligenceEvidenceRevision?: string;
    competitorEvidenceRevision?: string;
    localMarketRevision?: string;
    growthIntelligenceRevision?: string;
  },
): CommercialIntelligenceApprovalRecord {
  const doc = readDoc(slug);
  const approvedAt = new Date().toISOString();
  const record: CommercialIntelligenceApprovalRecord = {
    approvedAt,
    approvedBy: operator,
    approvedVersion,
    intelligenceEvidenceRevision: revisions?.intelligenceEvidenceRevision,
    competitorEvidenceRevision: revisions?.competitorEvidenceRevision,
    localMarketRevision: revisions?.localMarketRevision,
    growthIntelligenceRevision: revisions?.growthIntelligenceRevision,
  };
  doc.acknowledgements["commercial-intelligence-approved"] = approvedAt;
  doc.commercialIntelligenceApproval = record;
  doc.lastOperator = operator;
  writeDoc(slug, doc);
  return record;
}
