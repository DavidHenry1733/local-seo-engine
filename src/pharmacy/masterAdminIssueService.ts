/**
 * Master Admin Issue Centre V1 — persistence, reports, Cursor defect brief.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { recordMasterAdminAudit } from "./masterAdminAuditService.ts";
import { collectMasterAdminIssueDiagnostics, redactDiagnosticsObject } from "./masterAdminIssueDiagnosticsService.ts";
import {
  LOCKED_SYSTEMS_FOR_DEFECT_BRIEF,
  type MasterAdminCustomerIssueSummary,
  type MasterAdminIssueCreateInput,
  type MasterAdminIssueListSummary,
  type MasterAdminIssueRecord,
  type MasterAdminIssueSeverity,
  type MasterAdminIssueStatus,
} from "./masterAdminIssueModel.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";

const ISSUES_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/issues");
const INDEX_PATH = path.join(ISSUES_DIR, "index.json");

function ensureIssuesDir(): void {
  fs.mkdirSync(ISSUES_DIR, { recursive: true });
}

function issueFile(issueId: string): string {
  return path.join(ISSUES_DIR, `${issueId}.json`);
}

function readIndex(): MasterAdminIssueListSummary[] {
  if (!fs.existsSync(INDEX_PATH)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8")) as { summaries?: MasterAdminIssueListSummary[] };
    return Array.isArray(raw.summaries) ? raw.summaries : [];
  } catch {
    return [];
  }
}

function writeIndex(summaries: MasterAdminIssueListSummary[]): void {
  ensureIssuesDir();
  summaries.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  fs.writeFileSync(INDEX_PATH, JSON.stringify({ version: 1, updatedAt: new Date().toISOString(), summaries }, null, 2));
}

function readIssue(issueId: string): MasterAdminIssueRecord | null {
  const file = issueFile(issueId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as MasterAdminIssueRecord;
  } catch {
    return null;
  }
}

function writeIssue(issue: MasterAdminIssueRecord): void {
  ensureIssuesDir();
  fs.writeFileSync(issueFile(issue.issueId), JSON.stringify(issue, null, 2));
  const summaries = readIndex().filter((s) => s.issueId !== issue.issueId);
  summaries.unshift(toSummary(issue));
  writeIndex(summaries);
}

function toSummary(issue: MasterAdminIssueRecord): MasterAdminIssueListSummary {
  const profile = readJsonProfile(issue.tenantSlug);
  return {
    issueId: issue.issueId,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    tenantSlug: issue.tenantSlug,
    businessName: profile?.pharmacyName || issue.tenantSlug,
    category: issue.category,
    severity: issue.severity,
    title: issue.title,
    status: issue.status,
    assignee: issue.assignee,
    affectedUrl: issue.affectedUrl,
  };
}

function readJsonProfile(slug: string): { pharmacyName?: string } | null {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: Record<string, unknown> };
    const data = normalizeProfileData(doc.data || {});
    return { pharmacyName: data.pharmacyName };
  } catch {
    return null;
  }
}

function generateIssueId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const existing = readIndex();
  const today = existing.filter((i) => i.issueId.includes(date));
  const seq = String(today.length + 1).padStart(3, "0");
  return `MAI-${date}-${seq}`;
}

export function listMasterAdminIssueSummaries(): MasterAdminIssueListSummary[] {
  return readIndex();
}

export function getMasterAdminIssue(issueId: string): MasterAdminIssueRecord | null {
  return readIssue(issueId);
}

export function createMasterAdminIssue(input: MasterAdminIssueCreateInput, createdBy: string): MasterAdminIssueRecord {
  const tenantSlug = safeAdminSlug(input.tenantSlug);
  if (!tenantSlug) throw new Error("Valid tenant slug is required");

  const now = new Date().toISOString();
  const issueId = generateIssueId();
  const diagnostics = collectMasterAdminIssueDiagnostics({
    tenantSlug,
    campaignId: input.campaignId,
    serviceId: input.serviceId,
    affectedUrl: input.affectedUrl,
    affectedPageOrModule: input.affectedPageOrModule,
    category: input.category,
  });

  const audit = recordMasterAdminAudit({
    user: createdBy,
    slug: tenantSlug,
    action: "issue_created",
    status: "success",
    evidence: `Issue ${issueId} created: ${input.title}`,
    meta: { issueId, category: input.category, severity: input.severity },
  });

  const issue: MasterAdminIssueRecord = {
    issueId,
    createdAt: now,
    createdBy,
    updatedAt: now,
    tenantSlug,
    campaignId: input.campaignId || input.serviceId || "",
    serviceId: input.serviceId || "",
    affectedPageOrModule: input.affectedPageOrModule || "",
    category: input.category,
    severity: input.severity,
    title: input.title,
    description: input.description,
    expectedBehaviour: input.expectedBehaviour,
    actualBehaviour: input.actualBehaviour,
    reproductionSteps: input.reproductionSteps || "",
    affectedUrl: input.affectedUrl || "",
    screenshotReference: input.screenshotReference || "",
    diagnosticSnapshot: diagnostics,
    diagnosticCollectedAt: now,
    status: "Open",
    assignee: "Unassigned",
    resolutionNotes: "",
    relatedFiles: (diagnostics.relatedStoredFiles as string[]) || [],
    linkedAuditEventIds: [audit.id],
    resolutionHistory: [{ timestamp: now, user: createdBy, status: "Open", notes: "Issue created" }],
    cursorPrompt: null,
    productOwnerTestResult: "",
    closedAt: null,
  };

  writeIssue(issue);
  return issue;
}

export function refreshMasterAdminIssueDiagnostics(issueId: string, user: string): MasterAdminIssueRecord {
  const issue = readIssue(issueId);
  if (!issue) throw new Error("Issue not found");

  const diagnostics = collectMasterAdminIssueDiagnostics({
    tenantSlug: issue.tenantSlug,
    campaignId: issue.campaignId,
    serviceId: issue.serviceId,
    affectedUrl: issue.affectedUrl,
    affectedPageOrModule: issue.affectedPageOrModule,
    category: issue.category,
  });

  issue.diagnosticSnapshot = diagnostics;
  issue.diagnosticCollectedAt = new Date().toISOString();
  issue.updatedAt = issue.diagnosticCollectedAt;
  issue.relatedFiles = (diagnostics.relatedStoredFiles as string[]) || [];

  recordMasterAdminAudit({
    user,
    slug: issue.tenantSlug,
    action: "issue_diagnostics_refresh",
    status: "success",
    evidence: `Diagnostics refreshed for ${issueId}`,
    meta: { issueId },
  });

  writeIssue(issue);
  return issue;
}

export function updateMasterAdminIssueStatus(
  issueId: string,
  status: MasterAdminIssueStatus,
  user: string,
  notes = "",
): MasterAdminIssueRecord {
  const issue = readIssue(issueId);
  if (!issue) throw new Error("Issue not found");

  const now = new Date().toISOString();
  issue.status = status;
  issue.updatedAt = now;
  if (notes) issue.resolutionNotes = notes;
  if (status === "Closed" || status === "Passed") issue.closedAt = now;
  if (status === "Reopened") issue.closedAt = null;

  issue.resolutionHistory.push({ timestamp: now, user, status, notes: notes || `Status changed to ${status}` });

  recordMasterAdminAudit({
    user,
    slug: issue.tenantSlug,
    action: "issue_status_change",
    status: "success",
    evidence: `${issueId} → ${status}`,
    meta: { issueId, status, notes },
  });

  writeIssue(issue);
  return issue;
}

export function buildMasterAdminCustomerIssueSummary(tenantSlug: string): MasterAdminCustomerIssueSummary {
  const slug = safeAdminSlug(tenantSlug);
  const issues = readIndex().filter((i) => i.tenantSlug === slug);
  const open = issues.filter((i) => !["Closed", "Passed"].includes(i.status));
  const sorted = [...issues].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const last = sorted[0];

  let healthImpact: MasterAdminCustomerIssueSummary["healthImpact"] = "none";
  if (open.some((i) => i.severity === "Critical")) healthImpact = "critical";
  else if (open.some((i) => i.severity === "High")) healthImpact = "high";
  else if (open.some((i) => i.severity === "Medium")) healthImpact = "medium";
  else if (open.some((i) => i.severity === "Low")) healthImpact = "low";

  return {
    openCount: open.length,
    totalCount: issues.length,
    lastIssueAt: last?.createdAt || null,
    lastIssueId: last?.issueId || null,
    lastIssueTitle: last?.title || null,
    healthImpact,
  };
}

export function buildDiagnosticReport(issueId: string): Record<string, unknown> {
  const issue = readIssue(issueId);
  if (!issue) throw new Error("Issue not found");

  const diag = issue.diagnosticSnapshot || {};
  return redactDiagnosticsObject({
    issueSummary: {
      issueId: issue.issueId,
      title: issue.title,
      category: issue.category,
      severity: issue.severity,
      status: issue.status,
      createdAt: issue.createdAt,
      createdBy: issue.createdBy,
    },
    customerAndCampaign: {
      tenantSlug: issue.tenantSlug,
      campaignId: issue.campaignId,
      serviceId: issue.serviceId,
      affectedPageOrModule: issue.affectedPageOrModule,
    },
    browserVisibleDefect: issue.description,
    expectedBehaviour: issue.expectedBehaviour,
    actualBehaviour: issue.actualBehaviour,
    reproductionSteps: issue.reproductionSteps,
    runtimeEvidence: diag,
    relevantStoredFiles: issue.relatedFiles,
    recentAuditEvents: (diag.systemState as Record<string, unknown>)?.latestRelevantAuditEvents || [],
    recentErrors: diag.errors || [],
    lockedSystemsMustNotModify: LOCKED_SYSTEMS_FOR_DEFECT_BRIEF,
    recommendedInvestigationScope: [
      `Tenant: ${issue.tenantSlug}`,
      `Category: ${issue.category}`,
      issue.affectedUrl ? `URL: ${issue.affectedUrl}` : "URL: not specified",
      "Root cause to be traced from stored evidence above",
    ],
  }) as Record<string, unknown>;
}

export function buildDiagnosticReportPlainText(issueId: string): string {
  const report = buildDiagnosticReport(issueId);
  return ["MASTER ADMIN DIAGNOSTIC REPORT", "================================", "", JSON.stringify(report, null, 2)].join("\n");
}

export function generateCursorDefectBrief(issueId: string, user: string): string {
  const issue = readIssue(issueId);
  if (!issue) throw new Error("Issue not found");

  const diag = issue.diagnosticSnapshot || {};
  const tenant = (diag.tenant as Record<string, unknown>) || {};
  const page = (diag.page as Record<string, unknown>) || {};

  const brief = `COMMERCIAL RELEASE PROGRAMME V1
RELEASE DEFECT
ONE ISSUE POLICY

Confirmed browser-visible defect:
${issue.actualBehaviour || issue.description}

Target tenant:
${issue.tenantSlug}${tenant.businessName ? ` (${tenant.businessName})` : ""}

Target campaign:
${issue.campaignId || issue.serviceId || "Not specified in issue record"}

Target URL:
${issue.affectedUrl || "Not specified in issue record"}

Locked systems (do not modify):
${LOCKED_SYSTEMS_FOR_DEFECT_BRIEF.map((s) => `- ${s}`).join("\n")}

Objective:
Resolve the reported ${issue.category} issue for tenant ${issue.tenantSlug}: ${issue.title}

Trace requirements:
- Reproduce using: ${issue.reproductionSteps || "Steps not recorded — verify from affected URL and diagnostics"}
- Expected behaviour: ${issue.expectedBehaviour}
- Actual behaviour: ${issue.actualBehaviour}
- Page type (from diagnostics): ${page.pageType || "unknown"}
- Lifecycle at report time: ${tenant.lifecycleStatus || "unknown"}
- Root cause to be traced.

Fix scope:
- Operational/support fix only unless Product Owner approves engine changes
- Do not modify locked rendering, generation, publishing, SEO, indexing, or ranking engines

Do not modify:
${LOCKED_SYSTEMS_FOR_DEFECT_BRIEF.map((s) => `- ${s}`).join("\n")}

Validation:
- Confirm defect reproduced in browser
- Apply fix within approved scope
- Build and PM2 reload
- WAIT FOR PRODUCT OWNER TEST
- STOP.

Issue ID: ${issue.issueId}
Severity: ${issue.severity}
Category: ${issue.category}
Diagnostic collected: ${issue.diagnosticCollectedAt || "not collected"}
`;

  issue.cursorPrompt = brief;
  issue.updatedAt = new Date().toISOString();
  writeIssue(issue);

  recordMasterAdminAudit({
    user,
    slug: issue.tenantSlug,
    action: "issue_cursor_prompt_generated",
    status: "success",
    evidence: `Cursor prompt generated for ${issueId}`,
    meta: { issueId },
  });

  return brief;
}

export function runControlledValidationIssue(user: string): { created: MasterAdminIssueRecord; closed: MasterAdminIssueRecord } {
  const created = createMasterAdminIssue(
    {
      tenantSlug: "broom-lane-pharmacy",
      category: "Local Page",
      severity: "Low",
      title: "Validation issue — no production defect",
      description: "Sprint 6B controlled validation issue. No production defect.",
      expectedBehaviour: "Issue Centre validation completes without modifying generated pages.",
      actualBehaviour: "Validation issue — no production defect.",
      reproductionSteps: "Create issue via controlled validation script.",
      affectedPageOrModule: "Local Page",
      serviceId: "pharmacy-first",
    },
    user,
  );

  generateCursorDefectBrief(created.issueId, user);
  buildDiagnosticReport(created.issueId);

  const closed = updateMasterAdminIssueStatus(
    created.issueId,
    "Closed",
    user,
    "Sprint 6B controlled validation complete — no production defect.",
  );

  return { created, closed };
}
