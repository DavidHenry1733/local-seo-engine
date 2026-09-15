export type ServiceKey = string;
export type AffluenceTier = "premium" | "professional" | "mixed" | "community";
export type CompetitionLevel = "high" | "medium" | "low";
export type SearchDemandLevel = "high" | "medium" | "low";
export type AreaTier = "priority" | "secondary" | "tertiary" | "hub" | "cluster";

export interface NavItem {
  label: string;
  href: string;
}

export interface DeployConfig {
  enabled: boolean;
  protocol: "ftp";
  host: string;
  port: number;
  remoteRoot: string;
  username?: string;
  password?: string;
}

export interface NarrativeEngineConfig {
  enabled: boolean;
  serviceKeys: string[];
  areas?: string[];
}

export interface BrandingConfig {
  primaryColor: string;
  accentColor: string;
}

export interface ServiceConfig {
  key: ServiceKey;
  name: string;
}

export interface IntegrationsConfig {
  ideogramApiKey?: string;
  openaiApiKey?: string;
}

export interface ProjectConfig {
  clientSlug: string;
  businessName: string;
  legalName?: string;
  companyNumber?: string;
  domain: string;
  phone: string;
  email: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  businessAddress: string;
  logoUrl?: string;
  skipLogo?: boolean;
  strapline?: string;
  brandColour?: string;
  privacyUrl?: string;
  termsUrl?: string;
  footerCompanyName?: string;
  footerCompanyNumber?: string;
  footerStrapline?: string;
  footerLinks?: NavItem[];
  footerServiceLinks?: NavItem[];
  navItems: NavItem[];
  branding: BrandingConfig;
  services: ServiceConfig[];
  locations: string[];
  deploy: DeployConfig & { username?: string; password?: string };
  narrativeEngine?: NarrativeEngineConfig;
  /** Template to use when generating pages for this project. */
  templateId?: string;
  // Extended profile
  businessType?: string;
  mainService?: string;
  additionalServices?: string[];
  primaryLocation?: string;
  serviceAreas?: string[];
  toneOfVoice?: string;
  description?: string;
  brandStyle?: string;
  fontPreference?: string;
  brandNotes?: string;
  imageMode?: "ai" | "own" | "mixed" | "skip";
  integrations?: IntegrationsConfig;
  aiCitationOptimisation?: {
    enabled: boolean;
  };
  whiteLabelPoweredBy?: boolean;
  brandStyleVariant?: string;
  shortDescription?: string;
  uspStatements?: string[];
  trustStatements?: string[];
  toneNotes?: string;
  prohibitedWords?: string[];
  industryType?: string;
  buyerType?: "household" | "business" | "landlord-property" | "mixed";
  /**
   * Service sub-type. Used to apply service-context-specific rules during
   * generation and validation (e.g. "emergency-plumbing", "emergency-electrician").
   * When the value starts with "emergency", the prompt adds urgent-callout framing
   * (call-now CTAs, rapid-response tone) and the publish gate checks for
   * non-call-based CTAs.
   */
  serviceType?: string;
  /**
   * Human-readable description of the service provider type.
   * Used in the prompt to establish who is writing the page.
   * Example: "local plumber", "local boiler repair engineer", "landscape gardener"
   */
  providerType?: string;
  /**
   * Explicit list of service deliverables for this campaign.
   * Injected into the prompt so the AI writes about real deliverables
   * rather than inferring from the keyword alone.
   * Example: ["burst pipe repairs", "leak detection", "blocked toilet help"]
   */
  serviceDeliverables?: string[];
  /**
   * Explicit list of customer problems this service solves.
   * Injected into the prompt to ground content in real buyer pain points.
   * Example: ["water leak", "burst pipe", "blocked toilet", "no hot water"]
   */
  campaignCustomerProblems?: string[];
  /**
   * The primary conversion action this page should drive.
   * Overrides generic CTA guidance with a service-specific action.
   * Example: "Call an Emergency Plumber", "Book a Boiler Repair Visit"
   */
  conversionAction?: string;
}

export interface CreateProjectBody {
  clientSlug: string;
  businessName: string;
  legalName?: string;
  companyNumber?: string;
  domain: string;
  phone: string;
  email: string;
  primaryCtaText: string;
  primaryCtaUrl: string;
  businessAddress: string;
  logoUrl?: string;
  skipLogo?: boolean;
  strapline?: string;
  brandColour?: string;
  privacyUrl?: string;
  termsUrl?: string;
  footerCompanyName?: string;
  footerCompanyNumber?: string;
  footerStrapline?: string;
  footerLinks?: NavItem[];
  footerServiceLinks?: NavItem[];
  navItems?: NavItem[];
  branding: BrandingConfig;
  deploy: { host: string; port: number; remoteRoot: string; username?: string; password?: string };
  /** Template to use when generating pages for this project. */
  templateId?: string;
  // Extended profile
  businessType?: string;
  mainService?: string;
  additionalServices?: string[];
  primaryLocation?: string;
  serviceAreas?: string[];
  toneOfVoice?: string;
  description?: string;
  brandStyle?: string;
  fontPreference?: string;
  brandNotes?: string;
  imageMode?: string;
  integrations?: { ideogramApiKey?: string; openaiApiKey?: string };
}

export interface AreaProfile {
  name: string;
  postcode: string;
  priority: number;
  searchDemand: SearchDemandLevel;
  competition: CompetitionLevel;
  affluenceTier: AffluenceTier;
  character: string;
  knownFor: string;
  businessType: string;
  landmark?: string;
  nearbyAreas?: string[];
  keywordModifier?: string;
}

export interface CityAreaData {
  city: string;
  country: string;
  areas: AreaProfile[];
}

export interface AreaScore {
  area: string;
  score: number;
  rank: number;
  tier: AreaTier;
  postcode: string;
  searchDemand: SearchDemandLevel;
  competition: CompetitionLevel;
  affluenceTier: AffluenceTier;
}

export interface AreaContentSignals {
  area: string;
  city: string;
  serviceName: string;
  primaryKeyword: string;
  /** Business-type descriptor for the area — used by deriveKeywords() as fallback modifier */
  businessType: string;
  keywordModifier?: string;
  localContext: string;
  demandNote: string;
  competitionNote: string;
  competitorAngle: string;
  messagingRegister: string;
  landmarks: string[];
  nearbyAreas: string[];
}

export interface AreaEngineOutput {
  city: string;
  serviceName: string;
  rankedAreas: AreaScore[];
  contentSignals: Record<string, AreaContentSignals>;
  relatedAreaMap: Record<string, string[]>;
}

export interface AreaEngineQuery {
  city: string;
  service: string;
  maxP?: string;
  maxS?: string;
}

export interface SelectedAreaKeywords {
  area: string;
  tier: AreaTier;
  score: number;
  rank: number;
  postcode: string;
  primaryKeyword: string;
  supportingKeywords: string[];
  remotePath: string;
  configPath: string;
  signals: AreaContentSignals;
  keywordsCustomised: boolean;
}

export interface SelectedAreasBody {
  cityName: string;
  serviceName: string;
  serviceKey: string;
  selectedAreaNames: string[];
  projectDomain: string;
  clientSlug: string;
  maxPriorityAreas: number;
  maxSecondaryAreas: number;
}

export interface KeywordOverride {
  primaryKeyword: string;
  supportingKeywords: string[];
  keywordsCustomised: boolean;
}

export interface RolloutBody {
  clientSlug: string;
  campaignId?: string;
  selectedAreaDefs?: unknown[];
  options: {
    includeSecondary: boolean;
    dryRun: boolean;
    deferTertiary: boolean;
    concurrency?: number;
  };
}

export interface RolloutProgressEvent {
  type: "progress" | "done" | "error" | "complete";
  area?: string;
  tier?: AreaTier;
  step?: string;
  status?: "success" | "failed" | "deferred" | "cancelled" | "warning";
  durationMs?: number;
  message?: string;
  log?: unknown;
}

export interface AiReadinessSubscoreResult {
  key:         string;
  label:       string;
  score:       number;
  maxScore:    number;
  pct:         number;
  status:      string;
  suggestions: string[];
}

export interface AiReadinessSummary {
  masterScore:       number;
  label:             string;
  status:            string;
  subscores:         AiReadinessSubscoreResult[];
  strengths:         string[];
  suggestions:       string[];
  duplicateWarnings: string[];
}

export interface PageValidationResult {
  area: string;
  areaDir: string;
  liveUrl?: string;
  tier?: string;
  overallScore: number;
  readiness: "ready" | "review" | "blocked";
  categories: Record<string, number>;
  qaIssues: string[];
  aiReadiness?: AiReadinessSummary;
}

export interface ValidationSummary {
  ready: PageValidationResult[];
  review: PageValidationResult[];
  blocked: PageValidationResult[];
  deferred: string[];
}

// ── Preflight ──────────────────────────────────────────────────────────────────

export interface PreflightCheckItem {
  id: string;
  label: string;
  passed: boolean;
  detail?: string;
}

export interface PreflightReport {
  passed: boolean;
  checks: PreflightCheckItem[];
  summary: string;
}

export interface IndexingStatus {
  projectSlug:         string;
  sitemapUrl:          string;
  robotsUrl:           string;
  sitemapAccessible?:  boolean;
  sitemapCheckedAt?:   string;
  sitemapSubmittedAt?: string;
  updatedAt:           string;
}

export interface SetupSession {
  stage: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  clientSlug: string;
  projectPath?: string;
  campaign?: {
    cityName: string;
    serviceName: string;
    serviceKey: string;
    maxPriorityAreas: number;
    maxSecondaryAreas: number;
    includeSecondary: boolean;
    hubUrl: string;
    industryType?: string;
    buyerType?: "household" | "business" | "landlord-property" | "mixed";
  };
  engineOutput?: AreaEngineOutput;
  selectedAreaDefs?: SelectedAreaKeywords[];
  keywordOverrides?: Record<string, KeywordOverride>;
  rolloutOptions?: RolloutBody["options"];
  rolloutLog?: unknown;
  validation?: ValidationSummary;
  updatedAt: string;
}
