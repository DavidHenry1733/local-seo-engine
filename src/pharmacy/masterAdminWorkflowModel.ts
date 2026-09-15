/**
 * Master Admin Workflow Engine V1 — guided operational lifecycle model.
 */
export const WORKFLOW_STAGE_ORDER = [
  "create_customer",
  "website_import",
  "google_import",
  "business_profile_intelligence",
  "resolve_import_conflicts",
  "approve_business_profile",
  "competitor_analysis",
  "local_market_intelligence",
  "generate_growth_intelligence",
  "commercial_intelligence",
  "generate_ecosystem",
  "quality_review",
  "publish",
  "request_indexing",
  "initialise_rank_tracking",
  "monitoring",
  "live_customer",
] as const;

/** Internal generation stages collapsed into Commercial Intelligence in operator UI. */
export const COMMERCIAL_INTELLIGENCE_GENERATION_STAGES = [
  "competitor_analysis",
  "local_market_intelligence",
  "generate_growth_intelligence",
] as const;

/** Operator-facing workflow ladder (one active commercial intelligence stage). */
export const OPERATOR_WORKFLOW_DISPLAY_ORDER = [
  "website_import",
  "business_profile_intelligence",
  "commercial_intelligence",
  "generate_ecosystem",
  "quality_review",
  "publish",
  "request_indexing",
  "initialise_rank_tracking",
] as const;

export type WorkflowStageId = (typeof WORKFLOW_STAGE_ORDER)[number] | "suspended" | "archived";

export type WorkflowStageStatus = "complete" | "current" | "blocked" | "pending";

export interface WorkflowStageGuidance {
  purpose: string;
  expectedOutcome: string;
  checksBeforeContinuing: string[];
  typicalDuration: string;
  commonProblems: string[];
}

export interface WorkflowStageDefinition {
  id: WorkflowStageId;
  label: string;
  guidance: WorkflowStageGuidance;
  allowedActionIds: string[];
  estimatedMinutes: number;
}

export interface WorkflowStageView {
  id: WorkflowStageId;
  label: string;
  status: WorkflowStageStatus;
  timestamp: string | null;
  operator: string | null;
  durationMs: number | null;
  evidence: string | null;
}

export interface WorkflowTransitionRecord {
  fromStage: WorkflowStageId;
  toStage: WorkflowStageId;
  timestamp: string;
  operator: string;
  durationMs: number | null;
  reason: string;
  evidence: string;
}

export interface WorkflowHistoryStore {
  version: 2;
  slug: string;
  updatedAt: string;
  currentStage: WorkflowStageId;
  transitions: WorkflowTransitionRecord[];
  executions: WorkflowStageExecution[];
}

export interface WorkflowStageExecution {
  stageId: WorkflowStageId;
  actionId: string;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  operator: string;
  evidence: string;
  warnings: string[];
  errors: string[];
  retryCount: number;
  status: "queued" | "running" | "completed" | "failed";
  jobId?: string;
}

export interface WorkflowOrchestrationState {
  canContinue: boolean;
  continueLabel: string;
  blockingReason: string | null;
  stageActionId: string | null;
  stageActionLabel: string | null;
  activeJob: {
    id: string;
    status: string;
    progress: number;
    progressLabel: string;
    action: string;
  } | null;
  lastExecution: WorkflowStageExecution | null;
}

export interface CustomerWorkflowState {
  slug: string;
  currentStage: WorkflowStageId;
  currentStageLabel: string;
  previousStage: WorkflowStageId | null;
  nextStage: WorkflowStageId | null;
  nextStageLabel: string | null;
  nextAction: { id: string; label: string } | null;
  completedStages: WorkflowStageId[];
  blockedStages: WorkflowStageId[];
  outstandingActions: Array<{ id: string; label: string; enabled: boolean; reason?: string }>;
  completionPct: number;
  estimatedMinutesRemaining: number;
  stages: WorkflowStageView[];
  guidance: WorkflowStageGuidance;
  history: WorkflowTransitionRecord[];
  executions: WorkflowStageExecution[];
  orchestration: WorkflowOrchestrationState;
}

export const WORKFLOW_STAGE_DEFINITIONS: Record<WorkflowStageId, WorkflowStageDefinition> = {
  create_customer: {
    id: "create_customer",
    label: "Create Customer",
    estimatedMinutes: 5,
    allowedActionIds: [],
    guidance: {
      purpose: "Register the pharmacy tenant and minimal business profile.",
      expectedOutcome: "Customer profile JSON and registry entry exist.",
      checksBeforeContinuing: ["Pharmacy name recorded", "Unique slug assigned"],
      typicalDuration: "2–5 minutes",
      commonProblems: ["Duplicate slug", "Missing contact email"],
    },
  },
  website_import: {
    id: "website_import",
    label: "Website Import",
    estimatedMinutes: 10,
    allowedActionIds: ["import_website"],
    guidance: {
      purpose: "Import website intelligence into the business profile.",
      expectedOutcome: "Website import snapshot stored on profile.",
      checksBeforeContinuing: ["Valid website URL", "Import snapshot present"],
      typicalDuration: "5–15 minutes",
      commonProblems: ["Unreachable website", "National chain site detected"],
    },
  },
  google_import: {
    id: "google_import",
    label: "Google Import",
    estimatedMinutes: 10,
    allowedActionIds: ["import_google", "launch_bpi"],
    guidance: {
      purpose: "Import Google Business Profile data.",
      expectedOutcome: "Google import snapshot or confirmed listing match.",
      checksBeforeContinuing: ["Google listing URL or search completed", "Import snapshot stored"],
      typicalDuration: "5–15 minutes",
      commonProblems: ["Multiple listing candidates", "Listing not found"],
    },
  },
  business_profile_intelligence: {
    id: "business_profile_intelligence",
    label: "Business Profile Review",
    estimatedMinutes: 15,
    allowedActionIds: ["orchestrate_bpi", "open_business_profile_review", "save_business_profile_review", "approve_business_profile_review"],
    guidance: {
      purpose: "Review Website and Google intelligence together and approve one canonical Business Profile.",
      expectedOutcome: "Operator resolves conflicts and approves the canonical profile before Growth Intelligence.",
      checksBeforeContinuing: ["Website and Google imports complete", "All blocking fields resolved", "Business Profile approved"],
      typicalDuration: "15–30 minutes",
      commonProblems: ["Conflicting telephone or address", "Unconfirmed GPhC or Pharmacy First availability"],
    },
  },
  resolve_import_conflicts: {
    id: "resolve_import_conflicts",
    label: "Resolve Conflicts",
    estimatedMinutes: 15,
    allowedActionIds: ["orchestrate_resolve_conflicts"],
    guidance: {
      purpose: "Resolve conflicting or missing imported profile fields.",
      expectedOutcome: "No unresolved import conflicts remain.",
      checksBeforeContinuing: ["All required fields sourced", "Google match resolved"],
      typicalDuration: "10–20 minutes",
      commonProblems: ["Pending Google match", "Missing postcode or phone"],
    },
  },
  approve_business_profile: {
    id: "approve_business_profile",
    label: "Approve Business Profile",
    estimatedMinutes: 10,
    allowedActionIds: ["approve_profile"],
    guidance: {
      purpose: "Confirm the business profile is accurate and approved.",
      expectedOutcome: "Profile approved and ready for Competitor Analysis.",
      checksBeforeContinuing: ["Required profile fields complete", "Operator approval recorded"],
      typicalDuration: "5–15 minutes",
      commonProblems: ["Unconfirmed GPHC", "Missing services selection"],
    },
  },
  competitor_analysis: {
    id: "competitor_analysis",
    label: "Competitor Analysis",
    estimatedMinutes: 15,
    allowedActionIds: ["orchestrate_competitor_analysis"],
    guidance: {
      purpose: "Generate competitor intelligence automatically as part of the commercial intelligence pipeline.",
      expectedOutcome: "Competitor intelligence report stored for dashboard review.",
      checksBeforeContinuing: ["Business Profile approved", "Competitor discovery complete"],
      typicalDuration: "10–20 minutes",
      commonProblems: ["Insufficient Google Places data", "Missing branch location"],
    },
  },
  local_market_intelligence: {
    id: "local_market_intelligence",
    label: "Local Market Intelligence",
    estimatedMinutes: 15,
    allowedActionIds: ["orchestrate_local_market_intelligence"],
    guidance: {
      purpose: "Generate local market coverage intelligence automatically.",
      expectedOutcome: "Local market snapshot stored for dashboard review.",
      checksBeforeContinuing: ["Competitor Analysis generated", "Local market data generated"],
      typicalDuration: "10–20 minutes",
      commonProblems: ["Missing local areas", "Google Places unavailable"],
    },
  },
  generate_growth_intelligence: {
    id: "generate_growth_intelligence",
    label: "Growth Intelligence",
    estimatedMinutes: 15,
    allowedActionIds: ["orchestrate_growth_intelligence"],
    guidance: {
      purpose: "Generate growth opportunities automatically.",
      expectedOutcome: "Growth Intelligence report stored for dashboard review.",
      checksBeforeContinuing: ["Local Market Intelligence generated", "Opportunity report generated"],
      typicalDuration: "10–20 minutes",
      commonProblems: ["Incomplete market evidence", "Missing service context"],
    },
  },
  commercial_intelligence: {
    id: "commercial_intelligence",
    label: "Commercial Intelligence",
    estimatedMinutes: 20,
    allowedActionIds: ["open_commercial_intelligence_dashboard", "approve_commercial_intelligence"],
    guidance: {
      purpose: "Review competitor, local market and growth intelligence together and approve one commercial decision.",
      expectedOutcome: "Product Owner approves intelligence — only then may Generate Ecosystem run.",
      checksBeforeContinuing: [
        "All intelligence engines generated",
        "Commercial Intelligence Dashboard reviewed",
        "Approve Intelligence recorded",
      ],
      typicalDuration: "15–30 minutes",
      commonProblems: ["Incomplete intelligence evidence", "Skipped dashboard review"],
    },
  },
  generate_ecosystem: {
    id: "generate_ecosystem",
    label: "Generate Ecosystem",
    estimatedMinutes: 30,
    allowedActionIds: ["generate_ecosystem"],
    guidance: {
      purpose: "Generate the content ecosystem for the primary campaign.",
      expectedOutcome: "Content package generated for selected service.",
      checksBeforeContinuing: ["Campaign builder complete", "Generation job finished"],
      typicalDuration: "20–60 minutes",
      commonProblems: ["Generation in progress", "Missing campaign selection"],
    },
  },
  quality_review: {
    id: "quality_review",
    label: "Quality Review",
    estimatedMinutes: 20,
    allowedActionIds: ["orchestrate_quality_review"],
    guidance: {
      purpose: "Review generated assets before publishing.",
      expectedOutcome: "Content package reviewed and approved.",
      checksBeforeContinuing: ["Ecosystem generation complete", "Review centre complete", "No blocking QA failures"],
      typicalDuration: "15–45 minutes",
      commonProblems: ["Ecosystem not generated", "Unreviewed assets", "Outstanding review items"],
    },
  },
  publish: {
    id: "publish",
    label: "Publish",
    estimatedMinutes: 15,
    allowedActionIds: ["publish"],
    guidance: {
      purpose: "Publish approved content to the live website.",
      expectedOutcome: "FTP/static publish completed with timestamp recorded.",
      checksBeforeContinuing: ["Business profile approved", "Generation complete", "No blocking errors", "FTP configured"],
      typicalDuration: "10–30 minutes",
      commonProblems: ["FTP credentials missing", "Publish output not prepared"],
    },
  },
  request_indexing: {
    id: "request_indexing",
    label: "Indexing",
    estimatedMinutes: 10,
    allowedActionIds: ["request_indexing"],
    guidance: {
      purpose: "Submit published pages for search indexing.",
      expectedOutcome:
        "Ready for indexing — confirm published inventory, connect Search Console if required, then request indexing.",
      checksBeforeContinuing: ["Pages published", "Indexing registry populated"],
      typicalDuration: "5–15 minutes",
      commonProblems: ["Search Console not connected", "No pages registered"],
    },
  },
  initialise_rank_tracking: {
    id: "initialise_rank_tracking",
    label: "Performance Dashboard",
    estimatedMinutes: 10,
    allowedActionIds: ["init_rank_tracking"],
    guidance: {
      purpose: "Initialise rank tracking from stored Search Console data.",
      expectedOutcome: "Rank tracking file present with keywords.",
      checksBeforeContinuing: ["Published site live", "GSC data available"],
      typicalDuration: "5–20 minutes",
      commonProblems: ["No GSC data yet", "Rank file missing"],
    },
  },
  monitoring: {
    id: "monitoring",
    label: "Monitoring",
    estimatedMinutes: 0,
    allowedActionIds: ["open_customer_dashboard", "view_open_issues", "report_issue"],
    guidance: {
      purpose: "Monitor indexing and early ranking signals.",
      expectedOutcome: "Customer in active monitoring phase.",
      checksBeforeContinuing: ["Indexing submissions recorded", "Health dashboard reviewed"],
      typicalDuration: "Ongoing",
      commonProblems: ["Pages not indexed", "Low visibility"],
    },
  },
  live_customer: {
    id: "live_customer",
    label: "Live Customer",
    estimatedMinutes: 0,
    allowedActionIds: ["open_customer_dashboard", "view_open_issues", "report_issue"],
    guidance: {
      purpose: "Customer is live with rank tracking active.",
      expectedOutcome: "Full commercial lifecycle complete.",
      checksBeforeContinuing: ["Rank tracking active", "Customer dashboard healthy"],
      typicalDuration: "Ongoing",
      commonProblems: ["Ranking drops", "Support issues open"],
    },
  },
  suspended: {
    id: "suspended",
    label: "Suspended",
    estimatedMinutes: 0,
    allowedActionIds: ["unsuspend"],
    guidance: {
      purpose: "Customer temporarily suspended from operations.",
      expectedOutcome: "No operational actions until unsuspended.",
      checksBeforeContinuing: ["Suspension reason documented"],
      typicalDuration: "Varies",
      commonProblems: ["Billing or compliance hold"],
    },
  },
  archived: {
    id: "archived",
    label: "Archived",
    estimatedMinutes: 0,
    allowedActionIds: [],
    guidance: {
      purpose: "Customer archived and hidden from active portfolio.",
      expectedOutcome: "No further workflow actions.",
      checksBeforeContinuing: [],
      typicalDuration: "N/A",
      commonProblems: [],
    },
  },
};

export const WORKFLOW_ACTION_LABELS: Record<string, string> = {
  import_website: "Import Website",
  import_google: "Import Google",
  orchestrate_bpi: "Business Profile Intelligence",
  open_business_profile_review: "Open Business Profile Review",
  save_business_profile_review: "Save Business Profile Review",
  approve_business_profile_review: "Approve Business Profile",
  orchestrate_resolve_conflicts: "Resolve Conflicts",
  orchestrate_competitor_analysis: "Generate Competitor Analysis",
  orchestrate_local_market_intelligence: "Generate Local Market Intelligence",
  orchestrate_growth_intelligence: "Generate Growth Intelligence",
  open_commercial_intelligence_dashboard: "Open Commercial Intelligence Dashboard",
  approve_commercial_intelligence: "Approve Intelligence",
  orchestrate_quality_review: "Quality Review",
  approve_profile: "Approve Business Profile",
  generate_ecosystem: "Generate Approved Ecosystem",
  generate_local_cluster_pages: "Generate Cluster Pages",
  publish: "Publish",
  request_indexing: "Request Indexing",
  init_rank_tracking: "Initialise Performance Tracking",
  continue_workflow: "Continue Workflow",
  open_customer_dashboard: "Open Customer Dashboard",
  view_open_issues: "View Open Issues",
  report_issue: "Report Issue",
  unsuspend: "Unsuspend Customer",
};

/** Exactly one execution action per orchestrated stage. */
export const STAGE_EXECUTION_ACTION: Partial<Record<WorkflowStageId, string>> = {
  website_import: "import_website",
  google_import: "import_google",
  business_profile_intelligence: "orchestrate_bpi",
  resolve_import_conflicts: "orchestrate_resolve_conflicts",
  approve_business_profile: "approve_profile",
  competitor_analysis: "orchestrate_competitor_analysis",
  local_market_intelligence: "orchestrate_local_market_intelligence",
  generate_growth_intelligence: "orchestrate_growth_intelligence",
  generate_ecosystem: "generate_ecosystem",
  quality_review: "orchestrate_quality_review",
  publish: "publish",
  request_indexing: "request_indexing",
  initialise_rank_tracking: "init_rank_tracking",
};

export const LONG_RUNNING_STAGE_ACTIONS = new Set([
  "import_website",
  "import_google",
  "orchestrate_competitor_analysis",
  "orchestrate_local_market_intelligence",
  "orchestrate_growth_intelligence",
  "generate_ecosystem",
  "generate_local_cluster_pages",
  "publish",
  "request_indexing",
  "init_rank_tracking",
]);
