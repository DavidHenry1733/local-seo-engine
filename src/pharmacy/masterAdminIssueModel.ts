/**
 * Master Admin Issue Centre V1 — model, categories, severity, statuses.
 */

export const MASTER_ADMIN_ISSUE_CATEGORIES = [
  "Customer onboarding",
  "Website Import",
  "Google Import",
  "Business Profile",
  "Brand DNA",
  "Component DNA",
  "Campaign Builder",
  "Generation",
  "Service Page",
  "Local Page",
  "Guide",
  "Blog",
  "FAQ",
  "Marketing Assets",
  "Review Centre",
  "Publishing",
  "Sitemap",
  "Indexing",
  "Search Console",
  "Rank Tracking",
  "Competitor Intelligence",
  "Growth Intelligence",
  "Customer Dashboard",
  "Authentication",
  "Performance",
  "Infrastructure",
  "Other",
] as const;

export type MasterAdminIssueCategory = (typeof MASTER_ADMIN_ISSUE_CATEGORIES)[number];

export const MASTER_ADMIN_ISSUE_SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export type MasterAdminIssueSeverity = (typeof MASTER_ADMIN_ISSUE_SEVERITIES)[number];

export const MASTER_ADMIN_ISSUE_STATUSES = [
  "Open",
  "Investigating",
  "Fix Ready",
  "Awaiting Product Owner Test",
  "Passed",
  "Closed",
  "Reopened",
] as const;

export type MasterAdminIssueStatus = (typeof MASTER_ADMIN_ISSUE_STATUSES)[number];

export interface MasterAdminIssueCreateInput {
  tenantSlug: string;
  campaignId?: string;
  serviceId?: string;
  affectedPageOrModule?: string;
  category: MasterAdminIssueCategory;
  severity: MasterAdminIssueSeverity;
  title: string;
  description: string;
  expectedBehaviour: string;
  actualBehaviour: string;
  affectedUrl?: string;
  screenshotReference?: string;
  reproductionSteps?: string;
}

export interface MasterAdminIssueResolutionEntry {
  timestamp: string;
  user: string;
  status: MasterAdminIssueStatus;
  notes: string;
}

export interface MasterAdminIssueRecord {
  issueId: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  tenantSlug: string;
  campaignId: string;
  serviceId: string;
  affectedPageOrModule: string;
  category: MasterAdminIssueCategory;
  severity: MasterAdminIssueSeverity;
  title: string;
  description: string;
  expectedBehaviour: string;
  actualBehaviour: string;
  reproductionSteps: string;
  affectedUrl: string;
  screenshotReference: string;
  diagnosticSnapshot: Record<string, unknown> | null;
  diagnosticCollectedAt: string | null;
  status: MasterAdminIssueStatus;
  assignee: string;
  resolutionNotes: string;
  relatedFiles: string[];
  linkedAuditEventIds: string[];
  resolutionHistory: MasterAdminIssueResolutionEntry[];
  cursorPrompt: string | null;
  productOwnerTestResult: string;
  closedAt: string | null;
}

export interface MasterAdminIssueListSummary {
  issueId: string;
  createdAt: string;
  updatedAt: string;
  tenantSlug: string;
  businessName: string;
  category: MasterAdminIssueCategory;
  severity: MasterAdminIssueSeverity;
  title: string;
  status: MasterAdminIssueStatus;
  assignee: string;
  affectedUrl: string;
}

export interface MasterAdminCustomerIssueSummary {
  openCount: number;
  totalCount: number;
  lastIssueAt: string | null;
  lastIssueId: string | null;
  lastIssueTitle: string | null;
  healthImpact: "none" | "low" | "medium" | "high" | "critical";
}

export const LOCKED_SYSTEMS_FOR_DEFECT_BRIEF = [
  "Service Page renderer",
  "Local Page renderer",
  "Brand DNA",
  "Component DNA",
  "Generation engines",
  "Clinical content",
  "Publishing engines",
  "SEO engines",
  "Indexing engines",
  "Ranking engines",
];

export const SEVERITY_DEFINITIONS: Record<MasterAdminIssueSeverity, string> = {
  Critical: "Platform unavailable, data loss risk, publishing failure or multiple customers affected.",
  High: "Commercial workflow blocked for one customer or major visible defect.",
  Medium: "Partial failure or quality defect with workaround.",
  Low: "Minor usability or presentation defect.",
};
