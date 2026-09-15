export type AssetStatus =
  | "draft"
  | "generated"
  | "reviewed"
  | "approved"
  | "published"
  | "rejected";

export type AssetType =
  | "blog_post"
  | "facebook_post"
  | "linkedin_post"
  | "gbp_post"
  | "reddit_post"
  | "youtube_script"
  | "youtube_metadata"
  | "email_sequence";

export interface InternalLink {
  label: string;
  href: string;
}

export interface AnchorTextSuggestion {
  targetUrl: string;
  suggestedAnchors: string[];
}

export interface SourcePageRef {
  areaDir: string;
  remotePath: string;
  liveUrl: string;
  tier: string;
  isHub: boolean;
}

export interface CampaignPaneImageMeta {
  slot: string;
  assignedFrom?: string;
  altText?: string;
  serviceKey?: string;
}

export interface BusinessProfile {
  businessName: string;
  legalName?: string;
  domain: string;
  phone?: string;
  email?: string;
  businessAddress?: string;
  primaryCtaText?: string;
  primaryCtaUrl?: string;
}

export interface CampaignContentContext {
  schemaVersion: "1.0";
  campaignId: string;
  projectSlug: string;
  service: string;
  serviceKey: string;
  location: string;
  targetKeyword: string;
  hubUrl: string;
  moneyPageUrl?: string;
  hubAreaDir: string;
  clusterPages: SourcePageRef[];
  clusterUrls: string[];
  internalLinkTargets: InternalLink[];
  relatedServiceLinks: InternalLink[];
  faqs: { question: string; answer: string }[];
  businessProfile: BusinessProfile;
  paneImages: CampaignPaneImageMeta[];
  contentSignals: Record<string, unknown>;
}

export interface StatusCounts {
  draft: number;
  generated: number;
  reviewed: number;
  approved: number;
  published: number;
  rejected: number;
}

export interface CampaignContentManifest {
  schemaVersion: "1.0";
  campaignId: string;
  projectSlug: string;
  service: string;
  serviceKey: string;
  location: string;
  targetKeyword: string;
  hubUrl: string;
  generatedAt: string;
  updatedAt: string;
  generationRunId: string;
  sourcePages: SourcePageRef[];
  generationSettings: {
    blogPostCount: number;
    socialPostCountPerType: number;
    youtubeCount: number;
    emailSequenceCount: number;
    emailsPerSequence: number;
  };
  assetIndex: string[];
  summary: {
    total: number;
    byStatus: StatusCounts;
    byType: Partial<Record<AssetType, number>>;
  };
}

export interface AssetEnvelope {
  assetId: string;
  assetType: AssetType;
  status: AssetStatus;
  campaignId: string;
  projectSlug: string;
  parentAssetId?: string;
  service: string;
  location: string;
  targetKeyword: string;
  relatedHubUrl: string;
  relatedClusterUrls: string[];
  sourceGeneration: {
    runId: string;
    generatorVersion: string;
    generatedAt: string;
  };
  payload: Record<string, unknown>;
  /** Workflow: last manual edit timestamp (ISO-8601) */
  editedAt?: string;
  /** Workflow: username or identifier of editor */
  editedBy?: string;
  /** Workflow: increments on each save */
  revision?: number;
  /** Workflow: publish export path relative to campaign dir */
  publishedExportPath?: string;
  publishedAt?: string;
}

export interface BlogPostPayload {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  bodyMarkdown: string;
  aiSummary: string;
  internalLinks: InternalLink[];
  anchorTextSuggestions: AnchorTextSuggestion[];
  faqBlock: { question: string; answer: string }[];
  articleSchema: Record<string, unknown>;
  faqSchema: Record<string, unknown>;
  suggestedImagePrompt: string;
  linkedHubUrl: string;
  linkedClusterUrls: string[];
  status: AssetStatus;
}

export interface EmailSequencePayload {
  sequenceName: string;
  emailCount: number;
  emails: {
    subject: string;
    body: string;
    cta: string;
    linkedUrl: string;
  }[];
  status: AssetStatus;
}

export interface GenerationResult {
  manifestPath: string;
  assetsDir: string;
  manifest: CampaignContentManifest;
  assetCount: number;
  byType: Partial<Record<AssetType, number>>;
}
