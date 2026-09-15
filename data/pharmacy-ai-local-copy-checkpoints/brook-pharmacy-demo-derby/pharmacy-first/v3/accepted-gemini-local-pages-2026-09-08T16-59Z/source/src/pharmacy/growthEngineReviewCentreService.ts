/**
 * Review Centre V2 — builds customer review view and handles approve / improve actions.
 */
import fs from "node:fs";
import path from "node:path";
import {
  REVIEW_CENTRE_ASSET_TYPE_TO_GROUP,
  REVIEW_CENTRE_CUSTOMER_TYPE_LABELS,
  REVIEW_CENTRE_GROUPS,
  REVIEW_CENTRE_IMPROVE_MESSAGE,
  REVIEW_CENTRE_OPTIONAL_DEFERRED_LABEL,
  REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT,
  REVIEW_CENTRE_VERSION,
  reviewCentreStatusLabel,
  type ReviewCentreAsset,
  type ReviewCentreAssetStatus,
  type ReviewCentreGroup,
  type ReviewCentreNextAction,
  type ReviewCentrePendingGeneration,
  type ReviewCentreSession,
  type ReviewCentreView,
} from "./growthEngineReviewCentreModel.ts";
import {
  approveCampaignBuilderAsset,
  buildCampaignBuilderList,
  campaignBuilderPublishUrl,
  loadCampaignBuilderSession,
  resolveCampaignBuilderAssetSelection,
  resolveCampaignBuilderServiceName,
  saveCampaignBuilderSession,
} from "./growthEngineCampaignBuilderService.ts";
import {
  contentPackageGenerated,
  discoverGeneratedReviewOutputs,
  getContentPackageReviewSections,
  isCampaignReviewAssetRequired,
  loadContentPackage,
  resolveCampaignReviewScope,
  verifyContentPackageReviewSources,
  type ContentPackageAsset,
} from "./pharmacyContentPackageService.ts";
import { currentRunPreviewQuery } from "./pharmacyApprovedBankRunProvenance.ts";
import { loadCampaignImagePlan } from "./growthEngineCampaignBuilderImagePlanService.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import {
  isLockedCampaignApprovedForStaging,
  lockedCampaignStagingPublishApiPath,
} from "./pharmacyLockedCampaignStagingPublishService.ts";
import {
  describeAcceptedCandidatePublication,
  ACCEPTED_SERVICE_PAGE_PUBLICATION_AREA,
} from "./pharmacyAcceptedCandidateDemonstrationPublishService.ts";
import {
  AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
  BROOK_DERBY_DEMO_SLUG,
  isAuthorisedAiLocalPilotV3Area,
} from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { loadAiLocalCopyPilotV3 } from "./contentEngine/pharmacyAiLocalNarrativeEngineV3.ts";
import { loadEditorialEvidencePack } from "./contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import { SALES_DEMO_BROOK_SERVICE_PAGE_ASSET } from "./pharmacySalesDemoBrookServicePreview.ts";
import { ACCEPTED_SERVICE_PAGE_ASSET } from "./pharmacyAcceptedPageRouteResolverV1.ts";

export const SERVICE_PAGE_DEMO_REFERENCE_KEY = "sales-demo-brook-service-page-reference";
export const SERVICE_PAGE_DEMO_REFERENCE_TITLE = "Service-page demo reference — unpublished";
const SERVICE_PAGE_DEMO_HOST_SLUG = "yorkshire-pharmacy-and-health-clinic";

const SOURCE_FINDING_CATEGORY_LABELS: Record<string, string> = {
  "area-identity": "Area identity",
  community: "Community",
  healthcare: "Healthcare",
  "pharmacy-relationship": "Pharmacy relationship",
};

function sentenceFromSlug(value: string): string {
  const text = String(value || "")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Customer-facing distance line from saved evidence. Coordinates and internal source ids stay out of the Review Centre. */
export function customerFacingSavedSourceSentence(sentence: string): string {
  const text = String(sentence || "").trim();
  if (!text) return "";
  const distance = text.match(
    /^(.*?)\s+is approximately\s+(\d+(?:\.\d+)?)\s+km in a straight line from\s+(.+)$/i,
  );
  if (distance) {
    const pharmacy = distance[1].trim();
    const km = distance[2];
    const area = distance[3]
      .replace(/,?\s*measured from[\s\S]*$/i, "")
      .replace(/[.,;:\s]+$/g, "")
      .trim();
    if (pharmacy && km && area) {
      return `${pharmacy} is approximately ${km} km in a straight line from ${area}.`;
    }
  }
  return text
    .replace(/\b-?\d{1,3}\.\d{4,}\b/g, "")
    .replace(/\bplaces-area-reference\b/gi, "")
    .replace(/\bprofile:coordinates\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+,/g, ",")
    .replace(/[,\s]+([.!?])$/g, "$1")
    .trim();
}

function sourceLineHasTechnicalDisplay(text: string): boolean {
  return (
    /(?:^|\s)[a-z0-9-]+:[a-z0-9-]+:[a-z0-9-]+/.test(text) ||
    /\bplaces-area-reference\b/i.test(text) ||
    /\bprofile:coordinates\b/i.test(text) ||
    /\b-?\d{1,3}\.\d{4,}\b/.test(text)
  );
}

/** Customer-facing source labels. Technical IDs stay out of the Review Centre main view. */
export function readableReviewSourceFinding(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const kind = /^Editorial fact\b/i.test(text)
    ? "Editorial source"
    : /^Local evidence\b/i.test(text)
      ? "Local evidence"
      : "Saved source";
  const rest = text.replace(/^(Editorial fact|Local evidence)\s+/i, "").trim();
  const parts = rest.split(":").filter(Boolean);
  const last = parts[parts.length - 1] || rest;
  const categoryKey = parts.length >= 2 ? parts[parts.length - 2] : "";
  const category = SOURCE_FINDING_CATEGORY_LABELS[categoryKey] || sentenceFromSlug(categoryKey);
  const label = sentenceFromSlug(last);
  const body =
    category && label && category.toLowerCase() !== label.toLowerCase()
      ? `${category}: ${label}`
      : label || rest;
  return `${kind} — ${body}`;
}

function readableFindingsFromSavedPilot(
  record: {
    editorialFactIdsUsed?: string[];
    outputCopy?: {
      evidenceEntityIdsUsed?: string[];
      evidenceClaims?: Array<{ entityId?: string; sentence?: string }>;
    };
    claimMap?: Array<{ supportingCanonicalFieldOrEntity?: string; exactSentence?: string }>;
  },
  savedFacts: Array<{ factId?: string; category?: string; normalizedStatement?: string }> = [],
): string[] {
  const sentenceById = new Map<string, string>();
  const categoryById = new Map<string, string>();
  for (const fact of savedFacts) {
    const id = String(fact.factId || "").trim();
    const text = String(fact.normalizedStatement || "").trim();
    const category = SOURCE_FINDING_CATEGORY_LABELS[String(fact.category || "")] || "";
    if (id && text) sentenceById.set(id, text);
    if (id && category) categoryById.set(id, category);
  }
  for (const claim of record.outputCopy?.evidenceClaims || []) {
    const id = String(claim.entityId || "").trim();
    const sentence = String(claim.sentence || "").trim();
    if (id && sentence && !sentenceById.has(id)) sentenceById.set(id, sentence);
  }
  for (const row of record.claimMap || []) {
    const id = String(row.supportingCanonicalFieldOrEntity || "").trim();
    const sentence = String(row.exactSentence || "").trim();
    if (id.includes(":") && sentence && !sentenceById.has(id)) sentenceById.set(id, sentence);
  }
  const ids = [...new Set([...(record.editorialFactIdsUsed || []), ...(record.outputCopy?.evidenceEntityIdsUsed || [])])];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    const categoryKey = String(id).split(":")[1] || "";
    const category =
      categoryById.get(id) || SOURCE_FINDING_CATEGORY_LABELS[categoryKey] || sentenceFromSlug(categoryKey);
    const sentence = customerFacingSavedSourceSentence(sentenceById.get(id) || "");
    const line = sentence
      ? `Saved source — ${category}: ${sentence}`
      : customerFacingSavedSourceSentence(readableReviewSourceFinding(`Editorial fact ${id}`));
    if (!line || seen.has(line) || sourceLineHasTechnicalDisplay(line)) continue;
    seen.add(line);
    out.push(line);
  }
  return out.slice(0, 8);
}

const CUSTOMER_VISIBLE_TYPES = new Set(Object.keys(REVIEW_CENTRE_ASSET_TYPE_TO_GROUP));

function sessionPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-review-centre.json`);
}

function emptySession(slug: string): ReviewCentreSession {
  return {
    version: REVIEW_CENTRE_VERSION,
    slug,
    updatedAt: new Date().toISOString(),
    campaigns: {},
  };
}

export function loadReviewCentreSession(slug: string): ReviewCentreSession {
  const file = sessionPath(slug);
  if (!fs.existsSync(file)) return emptySession(slug);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as ReviewCentreSession;
    return {
      ...emptySession(slug),
      ...raw,
      campaigns: raw.campaigns || {},
    };
  } catch {
    return emptySession(slug);
  }
}

export function saveReviewCentreSession(session: ReviewCentreSession): ReviewCentreSession {
  const next = { ...session, updatedAt: new Date().toISOString() };
  fs.mkdirSync(path.dirname(sessionPath(session.slug)), { recursive: true });
  fs.writeFileSync(sessionPath(session.slug), JSON.stringify(next, null, 2));
  return next;
}

function campaignState(session: ReviewCentreSession, campaignId: string) {
  return session.campaigns[campaignId] || { improvements: {} };
}

export function reviewCentreUrl(slug: string, campaignId: string): string {
  return `/api/growth-engine/review-centre?slug=${encodeURIComponent(slug)}&campaign=${encodeURIComponent(campaignId)}`;
}

export function resolveReviewCentreCampaign(
  slug: string,
  campaignParam: string | null | undefined,
): { serviceId: string; campaignName: string } | null {
  const session = loadCampaignBuilderSession(slug);
  const serviceId = String(campaignParam || session.selectedServiceId || "").trim();
  if (!serviceId) return null;

  const fromList = buildCampaignBuilderList(slug).find((c) => c.serviceId === serviceId);
  const campaignName = fromList?.serviceName || resolveCampaignBuilderServiceName(serviceId);
  return { serviceId, campaignName };
}

function isNeedsImprovement(session: ReviewCentreSession, campaignId: string, assetKey: string): boolean {
  return Boolean(campaignState(session, campaignId).improvements[assetKey]);
}

function assetStatus(
  builderApproved: boolean,
  needsImprovement: boolean,
): ReviewCentreAssetStatus {
  if (needsImprovement) return "needs-improvement";
  if (builderApproved) return "approved";
  return "ready";
}

function customerTitle(sec: ContentPackageAsset, campaignName: string): string {
  const titles: Record<string, string> = {
    "service-page": `${campaignName} service page`,
    "local-area-pages": `${campaignName} local area pages`,
    faq: `${campaignName} FAQs`,
    guides: `${campaignName} patient guide`,
    blog: `${campaignName} blog articles`,
    gbp: `${campaignName} Google posts`,
    social: `${campaignName} social posts`,
    email: `${campaignName} email sequence`,
    video: `${campaignName} video`,
    "landing-page": `${campaignName} landing page`,
    images: `${campaignName} images`,
  };
  return titles[sec.type] || sec.title || REVIEW_CENTRE_CUSTOMER_TYPE_LABELS[sec.type] || sec.type;
}

function customerTypeLabel(sec: ContentPackageAsset): string {
  return REVIEW_CENTRE_CUSTOMER_TYPE_LABELS[sec.type] || sec.title || sec.type;
}

function customerSummary(sec: ContentPackageAsset, campaignName: string): string {
  const count = sec.count > 1 ? `${sec.count} items` : "1 item";
  const summaries: Record<string, string> = {
    "service-page": `Main ${campaignName} landing page for customer review.`,
    "local-area-pages":
      sec.selectedCount && sec.selectedCount > sec.count
        ? `${sec.count} of ${sec.selectedCount} selected local ${campaignName} pages are ready for review.`
        : `Local ${campaignName} pages for the selected service areas.`,
    faq: `Customer questions and answers for ${campaignName}.`,
    guides: `Patient guide explaining ${campaignName} before booking.`,
    blog: `${count} supporting article previews for ${campaignName}.`,
    gbp: `${count} concise Google Business Profile post drafts.`,
    social: `${count} short social post drafts ready for review.`,
    email: `${count} email drafts for the ${campaignName} campaign.`,
    video: `Video script for the ${campaignName} campaign.`,
    "landing-page": `Campaign landing page for ${campaignName}.`,
    images: `Image slots for the ${campaignName} campaign.`,
  };
  return summaries[sec.type] || sec.notes || `${count} ready for review.`;
}

function packPreviewItems(
  outputPath: string | null | undefined,
  type: "gbp" | "social" | "email",
  previewUrl: string,
): Array<{ id: string; title: string; generated: boolean; previewUrl: string | null }> {
  if (!outputPath || !fs.existsSync(outputPath)) return [];
  try {
    const raw = JSON.parse(fs.readFileSync(outputPath, "utf8")) as {
      posts?: Array<{ id?: string | number; title?: string; text?: string }>;
      emails?: Array<{ id?: string | number; subject?: string }>;
    };
    if (type === "email") {
      return (raw.emails || []).map((email, index) => {
        const id = String(email.id || index + 1);
        return {
          id,
          title: email.subject || `Email ${index + 1}`,
          generated: true,
          previewUrl: `${previewUrl}#review-item-${encodeURIComponent(id)}`,
        };
      });
    }
    return (raw.posts || []).map((post, index) => {
      const id = String(post.id || index + 1);
      const title =
        type === "gbp"
          ? post.title || `Google Business Profile post ${index + 1}`
          : `Social post ${index + 1}`;
      return {
        id,
        title,
        generated: true,
        previewUrl: `${previewUrl}#review-item-${encodeURIComponent(id)}`,
      };
    });
  } catch {
    return [];
  }
}

function imagePlacementPreviewItems(
  slug: string,
  campaignId: string,
  previewUrl: string,
): Array<{ id: string; title: string; generated: boolean; previewUrl: string | null }> {
  const plan = loadCampaignImagePlan(slug, campaignId);
  return (plan?.slots || []).map((slot) => ({
    id: slot.slot,
    title: slot.label,
    generated: Boolean(slot.previewUrl),
    previewUrl: slot.previewUrl
      ? `${previewUrl}&slot=${encodeURIComponent(slot.slot)}#placement-${encodeURIComponent(slot.slot)}`
      : null,
  }));
}

function buildAiLocalPilotV3ReviewAssets(slug: string, campaignId: string, campaignName: string): ReviewCentreAsset[] {
  const session = loadCampaignBuilderSession(slug);
  const names = session.selectedServiceId === campaignId ? session.targetAreaNames || [] : [];
  const assets: ReviewCentreAsset[] = [];
  for (const areaName of names) {
    const areaSlug = slugifyArea(String(areaName || ""));
    if (!areaSlug || !isAuthorisedAiLocalPilotV3Area(slug, areaSlug)) continue;
    const record = loadAiLocalCopyPilotV3(slug, campaignId, areaSlug);
    if (!record) continue;
    const previewUrl = `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET)}&area=${encodeURIComponent(areaSlug)}`;
    const validationOk = Boolean(record.validationResult?.ok);
    const failures = record.validationResult?.failures || [];
    const savedFacts = loadEditorialEvidencePack(slug, campaignId, areaSlug)?.facts || [];
    const findings = readableFindingsFromSavedPilot(record, savedFacts);
    assets.push({
      key: `${AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET}:${areaSlug}`,
      title: `Pharmacy First in ${record.areaName || areaName}`,
      summary: "Unpublished local page candidate. Open Preview to review this page. It is not a generated campaign asset.",
      typeLabel: "Local page candidate",
      groupId: "local-pages",
      groupLabel: "Local Pages",
      status: validationOk ? "ready" : "needs-improvement",
      statusLabel: validationOk ? "Ready for Review" : "Needs Improvement",
      previewUrl,
      count: 1,
      items: [{ id: areaSlug, title: record.areaName || areaName, generated: true, previewUrl }],
      improveMessage: null,
      required: false,
      optionalDeferred: false,
      candidateOnly: true,
      copyExcerpt: record.outputCopy?.heroIntroduction || record.outputCopy?.localIntroduction || null,
      sourceFindings: findings,
      validationLabel: validationOk
        ? "Checks passed"
        : `Checks need attention${failures.length ? `: ${failures.join("; ")}` : ""}`,
      currentCandidateVersion: record.generatedAt || null,
      demonstrationPublish: describeAcceptedCandidatePublication({
        tenantSlug: slug,
        campaignId,
        campaignName,
        asset: AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET,
        area: areaSlug,
      }),
    });
  }
  return assets;
}

function buildServicePageDemoReferenceAsset(slug: string, campaignId: string, campaignName: string): ReviewCentreAsset[] {
  if (slug !== BROOK_DERBY_DEMO_SLUG || campaignId !== "pharmacy-first") return [];
  const previewUrl = `/api/growth-engine/${encodeURIComponent(SERVICE_PAGE_DEMO_HOST_SLUG)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(SALES_DEMO_BROOK_SERVICE_PAGE_ASSET)}`;
  return [
    {
      key: SERVICE_PAGE_DEMO_REFERENCE_KEY,
      title: SERVICE_PAGE_DEMO_REFERENCE_TITLE,
      summary:
        "Accepted unpublished Brook service-page demo. Hosted on the Yorkshire Preview route. This is a reference only and is not a generated Brook campaign asset.",
      typeLabel: "Demo reference",
      groupId: "service-page",
      groupLabel: "Service Page",
      status: "ready",
      statusLabel: "Unpublished reference",
      previewUrl,
      count: 1,
      improveMessage: null,
      required: false,
      optionalDeferred: false,
      candidateOnly: true,
      validationLabel: "Reference only — not generated for Brook Derby",
      demonstrationPublish: describeAcceptedCandidatePublication({
        tenantSlug: slug,
        campaignId,
        campaignName,
        asset: ACCEPTED_SERVICE_PAGE_ASSET,
        area: ACCEPTED_SERVICE_PAGE_PUBLICATION_AREA,
      }),
    },
  ];
}

function isNonApprovableReviewAsset(assetKey: string): boolean {
  return (
    assetKey === SERVICE_PAGE_DEMO_REFERENCE_KEY ||
    assetKey.startsWith(`${AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET}:`)
  );
}

function buildAssets(slug: string, campaignId: string, campaignName: string): ReviewCentreAsset[] {
  const sections = getContentPackageReviewSections(slug, campaignId);
  const builderSession = loadCampaignBuilderSession(slug);
  const rcSession = loadReviewCentreSession(slug);
  const pkg = loadContentPackage(slug, campaignId);
  const scope = resolveCampaignReviewScope(slug, campaignId);
  const runId = pkg?.currentRunInventory?.runId || pkg?.generationStamp?.runId || null;
  const bankHash = pkg?.currentRunInventory?.approvedBankHash || pkg?.approvedBankHash || null;

  const assets: ReviewCentreAsset[] = [];
  for (const sec of sections) {
    if (!CUSTOMER_VISIBLE_TYPES.has(sec.type)) continue;
    if (!sec.included && !sec.required) continue;
    if (sec.count <= 0 && sec.status !== "included") continue;

    const groupId = REVIEW_CENTRE_ASSET_TYPE_TO_GROUP[sec.type];
    const groupLabel = REVIEW_CENTRE_GROUPS.find((g) => g.id === groupId)?.label || groupId;
    const required = isCampaignReviewAssetRequired(scope, sec.type);
    const needsImprovement = isNeedsImprovement(rcSession, campaignId, sec.type);
    const status = assetStatus(Boolean(builderSession.approvedAssets[sec.type]), needsImprovement);

    const reviewPreviewTypes = new Set([
      "service-page",
      "local-area-pages",
      "faq",
      "guides",
      "blog",
      "gbp",
      "social",
      "email",
      "video",
      "landing-page",
      "images",
    ]);
    const previewUrl = reviewPreviewTypes.has(sec.type)
      ? `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(sec.type)}${currentRunPreviewQuery(runId, bankHash)}`
      : sec.previewUrl;
    const items = (sec.reviewItems || []).map((item) => ({
      id: item.id,
      title: item.title,
      generated: item.generated,
      previewUrl:
        item.generated && reviewPreviewTypes.has(sec.type)
          ? sec.type === "local-area-pages"
            ? `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(sec.type)}&area=${encodeURIComponent(item.id)}${currentRunPreviewQuery(runId, bankHash)}`
            : sec.type === "blog"
              ? `/api/growth-engine/${encodeURIComponent(slug)}/review-preview?campaign=${encodeURIComponent(campaignId)}&asset=${encodeURIComponent(sec.type)}&page=${encodeURIComponent(item.id)}${currentRunPreviewQuery(runId, bankHash)}`
              : previewUrl
          : null,
    }));
    if (!items.length && previewUrl) {
      if (sec.type === "gbp" || sec.type === "social" || sec.type === "email") {
        items.push(...packPreviewItems(sec.outputPath, sec.type, previewUrl));
      }
      if (sec.type === "images") {
        items.push(...imagePlacementPreviewItems(slug, campaignId, previewUrl));
      }
    }

    assets.push({
      key: sec.type,
      title: customerTitle(sec, campaignName),
      summary: customerSummary(sec, campaignName),
      typeLabel: customerTypeLabel(sec),
      groupId,
      groupLabel,
      status,
      statusLabel: required ? reviewCentreStatusLabel(status) : REVIEW_CENTRE_OPTIONAL_DEFERRED_LABEL,
      previewUrl,
      count: sec.count,
      selectedCount: sec.selectedCount || sec.count,
      items: items.length ? items : undefined,
      improveMessage: required && needsImprovement ? REVIEW_CENTRE_IMPROVE_MESSAGE : null,
      required,
      optionalDeferred: !required,
    });
  }

  return assets;
}

function buildGroups(assets: ReviewCentreAsset[]): ReviewCentreGroup[] {
  const groups: ReviewCentreGroup[] = [];
  for (const def of REVIEW_CENTRE_GROUPS) {
    const groupAssets = assets.filter((a) => a.groupId === def.id);
    if (!groupAssets.length) continue;
    const required = groupAssets.every((asset) => asset.required);
    const pendingNames = groupAssets
      .flatMap((asset) => (asset.items || []).filter((item) => !item.generated).map((item) => item.title))
      .filter(Boolean);
    groups.push({
      id: def.id,
      label: def.label,
      assets: groupAssets,
      required,
      optionalDeferred: !required,
      pendingNote:
        pendingNames.length === 1
          ? `${pendingNames[0]} still needs to be created.`
          : pendingNames.length > 1
            ? `${pendingNames.join(", ")} still need to be created.`
            : null,
    });
  }
  return groups;
}

function buildNextAction(
  generated: boolean,
  requiredAssets: ReviewCentreAsset[],
  allRequiredApproved: boolean,
  pendingRequired: ReviewCentrePendingGeneration[],
  candidateAssets: ReviewCentreAsset[] = [],
): ReviewCentreNextAction {
  if (!generated && candidateAssets.length) {
    const localCount = candidateAssets.filter((asset) => asset.groupId === "local-pages").length;
    const demoCount = candidateAssets.filter((asset) => asset.key === SERVICE_PAGE_DEMO_REFERENCE_KEY).length;
    if (localCount && demoCount) {
      return {
        title: "Preview the pages that exist today",
        detail:
          "Allestree is a reviewable local page candidate. The service-page demo is an unpublished reference. Campaign pages have not been generated.",
      };
    }
    return {
      title: "Review your local page candidate",
      detail: "Open the unpublished Preview. This does not publish the page or the rest of the campaign.",
    };
  }
  if (!generated) {
    return {
      title: "Build your campaign first",
      detail: "Your content will appear here once your campaign has been built.",
    };
  }

  if (pendingRequired.length) {
    const names = pendingRequired.flatMap((item) => item.names);
    const label =
      names.length > 0
        ? names.join(", ")
        : pendingRequired.map((item) => item.typeLabel).join(", ");
    return {
      title: "Some selected pages still need to be created",
      detail: `${label} ${names.length === 1 ? "is" : "are"} not ready for review yet. Publish stays locked until those pages exist and every required section is approved.`,
    };
  }

  const needsImprovement = requiredAssets.some((a) => a.status === "needs-improvement");
  const pendingReview = requiredAssets.some((a) => a.status === "ready");

  if (allRequiredApproved) {
    return {
      title: "Required campaign pages are approved",
      detail: "Service page, locality pages, and required images are approved. Optional supporting assets are deferred and do not block campaign lock.",
    };
  }

  if (needsImprovement && pendingReview) {
    return {
      title: "Review your content and approve each section",
      detail: "Some sections need improvement — we'll update those before publishing. Please review and approve the rest.",
    };
  }

  if (needsImprovement) {
    return {
      title: "Regenerate the sections that need improvement",
      detail: "Use Regenerate Improvements to rebuild the flagged locality pages with the corrected engine. Publish stays locked until you approve the new run.",
    };
  }

  return {
    title: "Review and approve each section below",
    detail: "Open a preview, then approve each required section when you're happy with it.",
  };
}

export function buildReviewCentreView(slug: string, campaignParam: string | null | undefined): ReviewCentreView | null {
  const resolved = resolveReviewCentreCampaign(slug, campaignParam);
  if (!resolved) return null;

  const { serviceId: campaignId, campaignName } = resolved;
  const generated = contentPackageGenerated(slug, campaignId);
  if (generated) {
    const sourceCheck = verifyContentPackageReviewSources(slug, campaignId);
    if (!sourceCheck.ok) {
      throw new Error(`Review Centre source mismatch: ${sourceCheck.errors.join("; ")}`);
    }
  }
  const assets = buildAssets(slug, campaignId, campaignName);
  const candidateAssets = [
    ...buildServicePageDemoReferenceAsset(slug, campaignId, campaignName),
    ...buildAiLocalPilotV3ReviewAssets(slug, campaignId, campaignName),
  ];
  const discovery = discoverGeneratedReviewOutputs(slug, campaignId);
  const builderSession = loadCampaignBuilderSession(slug);
  const selection = resolveCampaignBuilderAssetSelection(builderSession);
  const selectionApplies = builderSession.selectedServiceId === campaignId;
  const campaignScope = resolveCampaignReviewScope(slug, campaignId);
  const localGenerated = discovery.localPages.filter((page) => page.outputPath).length;
  const localSelected = discovery.localPages.length;
  const packageContentGenerated =
    (discovery.servicePagePath ? 1 : 0) +
    localGenerated +
    (discovery.guidePath ? 1 : 0) +
    discovery.blogPages.length +
    (discovery.faqPath ? 1 : 0) +
    discovery.gbpCount +
    discovery.socialCount +
    discovery.emailCount +
    (discovery.videoPath ? 1 : 0) +
    (discovery.landingPath ? 1 : 0);
  const packageContentSelected =
    (discovery.servicePagePath || selectionApplies ? 1 : 0) +
    (localSelected || localGenerated) +
    (discovery.guidePath || (selectionApplies && selection.guides) ? 1 : 0) +
    (discovery.blogPages.length || (selectionApplies && selection.blogs ? 3 : 0)) +
    (discovery.faqPath || (selectionApplies && selection.faqs) ? 1 : 0) +
    (discovery.gbpCount || (selectionApplies && selection.gbp ? 10 : 0)) +
    (discovery.socialCount || (selectionApplies && selection.social ? 20 : 0)) +
    (discovery.emailCount || (selectionApplies && selection.emails ? 5 : 0)) +
    (discovery.videoPath || (selectionApplies && selection.videos) ? 1 : 0) +
    (discovery.landingPath || (selectionApplies && selection.landingPage) ? 1 : 0);
  const pendingGeneration: ReviewCentrePendingGeneration[] = [];
  const reviewableCandidateAreas = new Set(
    candidateAssets
      .filter((asset) => asset.groupId === "local-pages")
      .flatMap((asset) => (asset.items || []).map((item) => item.id).filter(Boolean)),
  );
  const missingLocal = discovery.localPages.filter(
    (page) => !page.outputPath && !reviewableCandidateAreas.has(page.areaSlug),
  );
  if (missingLocal.length) {
    pendingGeneration.push({
      typeLabel: "Local area pages",
      names: missingLocal.map((page) => page.areaName),
      count: missingLocal.length,
    });
  }
  if (selectionApplies && selection.guides && !discovery.guidePath) {
    pendingGeneration.push({ typeLabel: "Patient guide", names: ["Patient guide"], count: 1 });
  }
  if (selectionApplies && selection.blogs && discovery.blogPages.length === 0) {
    pendingGeneration.push({ typeLabel: "Blogs", names: ["Blogs"], count: 3 });
  }
  if (selectionApplies && selection.faqs && !discovery.faqPath) {
    pendingGeneration.push({ typeLabel: "FAQ", names: ["FAQ"], count: 1 });
  }
  if (selectionApplies && selection.videos && !discovery.videoPath) {
    pendingGeneration.push({ typeLabel: "Video", names: ["Video"], count: 1 });
  }
  if (selectionApplies && selection.landingPage && !discovery.landingPath) {
    pendingGeneration.push({ typeLabel: "Landing page", names: ["Landing page"], count: 1 });
  }
  const requiredAssets = assets.filter((asset) => asset.required);
  const optionalAssets = assets.filter((asset) => asset.optionalDeferred);
  const candidateGroups = buildGroups(candidateAssets);
  const requiredGroups = buildGroups(requiredAssets);
  const groups = [...candidateGroups, ...requiredGroups];
  const optionalGroups = buildGroups(optionalAssets);
  const requiredGenerationIncomplete =
    missingLocal.length > 0 && isCampaignReviewAssetRequired(campaignScope, "local-area-pages");
  const requiredGroupCount = requiredGroups.length;
  const campaignAssetCount = requiredAssets.length;
  const localCandidateCount = candidateAssets.filter((asset) => asset.groupId === "local-pages").length;
  const demoReferenceCount = candidateAssets.filter((asset) => asset.key === SERVICE_PAGE_DEMO_REFERENCE_KEY).length;
  const approvedCount = requiredAssets.filter((a) => a.status === "approved").length;
  const needsImprovementCount = requiredAssets.filter((a) => a.status === "needs-improvement").length;
  const readyCount = requiredAssets.filter((a) => a.status === "ready").length;
  const allApproved =
    requiredAssets.length > 0 &&
    requiredAssets.every((a) => a.status === "approved") &&
    !requiredGenerationIncomplete;
  const campaignLockReady =
    generated && allApproved && readyCount === 0 && needsImprovementCount === 0 && !requiredGenerationIncomplete;
  const canPublish = generated && allApproved && !requiredGenerationIncomplete;
  const pendingRequired = requiredGenerationIncomplete
    ? pendingGeneration.filter((item) => item.typeLabel === "Local area pages")
    : [];

  return {
    slug,
    campaignId,
    campaignName,
    campaignScope,
    totalAssets: requiredGroupCount,
    requiredGroupCount,
    approvedCount,
    needsImprovementCount,
    readyCount,
    generated,
    allApproved,
    campaignLockReady,
    canPublish,
    canPublishToStaging: isLockedCampaignApprovedForStaging(slug, campaignId),
    stagingPublishApiPath: lockedCampaignStagingPublishApiPath(slug),
    nextAction: buildNextAction(generated, requiredAssets, allApproved, pendingRequired, candidateAssets),
    groups,
    optionalGroups,
    packageContentSelected,
    packageContentGenerated,
    campaignAssetCount,
    localCandidateCount,
    demoReferenceCount,
    pendingGeneration,
    requiredGenerationIncomplete,
    hasLocalPageCandidate: candidateAssets.some((asset) => asset.groupId === "local-pages"),
    publishUrl: campaignBuilderPublishUrl(slug, campaignId),
    regenerateImprovementsVisible: generated && needsImprovementCount > 0,
    regenerateImprovementsIntent: REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT,
    regenerateImprovementsApiPath: `/api/growth-engine/${encodeURIComponent(slug)}/generate-next-campaign`,
  };
}

export function approveReviewCentreAsset(slug: string, campaignId: string, assetKey: string): void {
  if (isNonApprovableReviewAsset(assetKey)) {
    throw new Error("This unpublished reference cannot be approved or published.");
  }
  const rcSession = loadReviewCentreSession(slug);
  const state = campaignState(rcSession, campaignId);
  const improvements = { ...state.improvements };
  delete improvements[assetKey];
  saveReviewCentreSession({
    ...rcSession,
    campaigns: {
      ...rcSession.campaigns,
      [campaignId]: { improvements },
    },
  });
  approveCampaignBuilderAsset(slug, assetKey);
}

export function clearReviewCentreAssetImprovement(slug: string, campaignId: string, assetKey: string): void {
  const rcSession = loadReviewCentreSession(slug);
  const state = campaignState(rcSession, campaignId);
  if (!state.improvements[assetKey]) return;
  const improvements = { ...state.improvements };
  delete improvements[assetKey];
  saveReviewCentreSession({
    ...rcSession,
    campaigns: {
      ...rcSession.campaigns,
      [campaignId]: { improvements },
    },
  });
}

export function improveReviewCentreAsset(slug: string, campaignId: string, assetKey: string): {
  improved: boolean;
  message: string;
} {
  if (isNonApprovableReviewAsset(assetKey)) {
    return { improved: false, message: "This unpublished reference cannot be approved or published." };
  }
  const rcSession = loadReviewCentreSession(slug);
  const state = campaignState(rcSession, campaignId);
  saveReviewCentreSession({
    ...rcSession,
    campaigns: {
      ...rcSession.campaigns,
      [campaignId]: {
        improvements: { ...state.improvements, [assetKey]: new Date().toISOString() },
      },
    },
  });

  const builderSession = loadCampaignBuilderSession(slug);
  if (builderSession.approvedAssets[assetKey]) {
    const approvedAssets = { ...builderSession.approvedAssets };
    delete approvedAssets[assetKey];
    saveCampaignBuilderSession({ ...builderSession, approvedAssets });
  }

  return { improved: true, message: REVIEW_CENTRE_IMPROVE_MESSAGE };
}

export function evaluateRequiredReviewScope(input: {
  required: Array<{ key: string; status: ReviewCentreAssetStatus }>;
  optional?: Array<{ key: string; status: ReviewCentreAssetStatus }>;
}): {
  requiredGroupCount: number;
  approvedCount: number;
  readyCount: number;
  needsImprovementCount: number;
  campaignLockReady: boolean;
  optionalCounted: boolean;
} {
  const required = input.required || [];
  const approvedCount = required.filter((asset) => asset.status === "approved").length;
  const readyCount = required.filter((asset) => asset.status === "ready").length;
  const needsImprovementCount = required.filter((asset) => asset.status === "needs-improvement").length;
  return {
    requiredGroupCount: required.length,
    approvedCount,
    readyCount,
    needsImprovementCount,
    campaignLockReady:
      required.length > 0 && approvedCount === required.length && readyCount === 0 && needsImprovementCount === 0,
    optionalCounted: false,
  };
}

export function reviewCentreAllAssetsApproved(slug: string, campaignId: string): boolean {
  const view = buildReviewCentreView(slug, campaignId);
  return Boolean(view?.allApproved);
}

export function reviewCentreCanPublish(slug: string, campaignId: string): boolean {
  const view = buildReviewCentreView(slug, campaignId);
  return Boolean(view?.canPublish);
}
