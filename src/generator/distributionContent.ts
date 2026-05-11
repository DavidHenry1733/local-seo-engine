/**
 * distributionContent.ts
 *
 * Generates platform-specific social content drafts for a given SEO page.
 * Calls OpenAI (gpt-4.1) and returns structured JSON for Facebook, LinkedIn,
 * Reddit and YouTube.  No posting occurs here — outputs are for review only.
 *
 * Key design rules (from spec):
 * - Each platform gets completely different copy
 * - Reddit body NEVER contains a direct link (link goes in suggestedFollowUpComment)
 * - Content angles rotate to avoid repetition
 * - No guaranteed-ranking claims, no superlatives, no hard selling
 */

import OpenAI from "openai";

// ── Post angles ───────────────────────────────────────────────────────────────

export const POST_ANGLES = [
  "common-mistake",
  "quick-tip",
  "local-observation",
  "question-discussion",
  "myth-busting",
  "checklist",
  "before-after-insight",
  "cost-value-explanation",
  "trust-speed-conversion",
  "service-area-relevance",
] as const;

export type PostAngle = (typeof POST_ANGLES)[number];

const ANGLE_GUIDE: Record<PostAngle, string> = {
  "common-mistake":
    "Highlight a common mistake local businesses make that the service addresses. Educational tone. Do not blame the reader.",
  "quick-tip":
    "Share one concrete, actionable tip related to the service. Immediately useful. No fluff.",
  "local-observation":
    "Make an observation about local businesses or the area that naturally connects to the service. Feels written by someone who knows the place.",
  "question-discussion":
    "Pose a genuine, curious question that invites real community discussion. Curiosity-driven, not rhetorical.",
  "myth-busting":
    "Challenge a common myth or misconception about the service. Surprising opening. Evidence-based tone.",
  "checklist":
    "Provide 3–5 practical things to check or consider related to the service. Scannable, concrete.",
  "before-after-insight":
    "Contrast a realistic before/after scenario. No exaggeration. Relatable transformation.",
  "cost-value-explanation":
    "Explain the cost vs value trade-off honestly and helpfully. No hard sell. Helps readers make an informed decision.",
  "trust-speed-conversion":
    "Focus on trust signals, response speed, or how to evaluate quality providers. Practical and credible.",
  "service-area-relevance":
    "Connect the service specifically to local area needs, trends, or context. Hyper-local feel.",
};

/** Pick an angle deterministically from a page slug so the same page always gets the same angle. */
export function pickAngle(pageSlug: string): PostAngle {
  let hash = 0;
  for (let i = 0; i < pageSlug.length; i++) {
    hash = ((hash * 31) + pageSlug.charCodeAt(i)) & 0x7fffffff;
  }
  return POST_ANGLES[hash % POST_ANGLES.length];
}

// ── Context ───────────────────────────────────────────────────────────────────

export interface DistributionContext {
  clientSlug:      string;
  campaignId:      string;
  pageSlug:        string;
  pageTitle:       string;
  primaryKeyword:  string;
  service:         string;
  location:        string;
  businessName:    string;
  pageUrl:         string;
  moneyPageUrl?:   string;
  aiSummary?:      string;
  keyBenefits?:    string[];
  targetAudience?: string;
  nearbyAreas?:    string[];
  approvedClaims?: string[];
  imageUrl?:       string;
  toneOfVoice?:    string;
  postAngle?:      PostAngle;
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface SuggestedImage {
  src:        string;
  alt:        string;
  libraryId:  string;
  slot:       string;
  previewUrl: string;
}

export interface DistributionLink {
  url:                 string;
  suggestedAnchorText: string;
  displayText:         string;
}

export interface CopyBlocks {
  postOnly:                  string;
  postWithUrl:               string;
  imageCaption:              string;
  manualPostingInstructions: string;
}

export interface FacebookContent {
  postText:        string;
  hashtags:        string[];
  imageSuggestion: string;
  linkUrl:         string;
  link?:           DistributionLink;
  suggestedImage?: SuggestedImage;
  copyBlocks?:     CopyBlocks;
}

export interface LinkedInContent {
  headline:        string;
  postText:        string;
  hashtags:        string[];
  linkUrl:         string;
  link?:           DistributionLink;
  suggestedImage?: SuggestedImage;
  copyBlocks?:     CopyBlocks;
}

export interface RedditContent {
  title:                    string;
  body:                     string;
  suggestedFollowUpComment: string;
  suggestedSubreddits:      string[];
  disclosureNote:           string;
  moderationRisk:           "low" | "medium" | "high";
  linkUrl:                  string;
  link?:                    DistributionLink;
  copyBlocks?:              CopyBlocks;
}

export interface YouTubeContent {
  title:           string;
  description:     string;
  script:          string;
  chapters:        YouTubeChapter[];
  tags:            string[];
  thumbnailPrompt: string;
  videoPrompt:     string;
  linkUrl:         string;
  link?:           DistributionLink;
  copyBlocks?:     CopyBlocks;
}

export interface YouTubeChapter {
  timestamp: string;
  title:     string;
}

export interface DistributionContent {
  facebook:  FacebookContent;
  linkedin:  LinkedInContent;
  reddit:    RedditContent;
  youtube:   YouTubeContent;
  postAngle?: string;
}

// ── OpenAI client ─────────────────────────────────────────────────────────────

function makeClient(): OpenAI {
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey  = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new Error("Missing AI_INTEGRATIONS_OPENAI_BASE_URL or AI_INTEGRATIONS_OPENAI_API_KEY");
  }
  return new OpenAI({ baseURL, apiKey });
}

// ── Generator ─────────────────────────────────────────────────────────────────

export async function generateDistributionContent(
  ctx: DistributionContext,
): Promise<DistributionContent> {
  const client = makeClient();

  const angle     = ctx.postAngle ?? pickAngle(ctx.pageSlug);
  const angleDesc = ANGLE_GUIDE[angle];

  const nearby   = ctx.nearbyAreas?.length ? ctx.nearbyAreas.slice(0, 6).join(", ") : "";
  const benefits = ctx.keyBenefits?.length ? ctx.keyBenefits.join("; ") : "";
  const claims   = ctx.approvedClaims?.length ? ctx.approvedClaims.join("; ") : "";
  const tone     = ctx.toneOfVoice ?? "friendly and professional";

  const contextBlock = [
    `Page Title: ${ctx.pageTitle}`,
    `Primary Keyword: ${ctx.primaryKeyword}`,
    `Service: ${ctx.service}`,
    `Location: ${ctx.location}`,
    `Business Name: ${ctx.businessName}`,
    `Page URL: ${ctx.pageUrl}`,
    ctx.moneyPageUrl   ? `Money Page URL: ${ctx.moneyPageUrl}` : null,
    ctx.aiSummary      ? `Page Summary: ${ctx.aiSummary}` : null,
    benefits           ? `Key Benefits: ${benefits}` : null,
    ctx.targetAudience ? `Target Audience: ${ctx.targetAudience}` : null,
    nearby             ? `Nearby Areas Also Served: ${nearby}` : null,
    claims             ? `Approved Claims: ${claims}` : null,
    `Tone of Voice: ${tone}`,
  ].filter(Boolean).join("\n");

  const systemPrompt = `You are a specialist social media content writer for UK local and trades businesses.
You create platform-specific content that is helpful, honest, and appropriate for small business owners.

UNIVERSAL RULES — apply to ALL platforms without exception:
1. Each platform section must have COMPLETELY different copy. No reusing sentences or paragraphs.
2. NEVER claim guaranteed rankings, results, or income.
3. NEVER say "we are the best", "number one", "#1", or similar superlatives unless in Approved Claims.
4. NEVER invent statistics or third-party endorsements.
5. NEVER use spammy or over-promotional language.
6. NEVER use repeated exact-match keyword stuffing.
7. Do NOT auto-suggest posting — this is for human review only.
8. Match the service and location naturally in all content — do not force them in unnaturally.
9. Return only valid JSON matching the exact schema provided.

CONTENT ANGLE for this generation: "${angle}"
Angle instruction: ${angleDesc}
Apply this angle as the creative direction across all platforms, adapting it to each platform's style.`;

  const userPrompt = `Generate platform-specific distribution content for the following SEO page:

${contextBlock}

FACEBOOK RULES:
- Friendly, conversational, community-aware tone
- Suitable for small business owners and local residents
- 80–150 words maximum
- 2–4 hashtags only (not in postText — separate field)
- Light, optional CTA at the end
- No corporate wording, no aggressive sales language
- Do NOT include the URL in postText

LINKEDIN RULES:
- Professional, insight-led, written for business owners and decision-makers
- Open with a business problem or observation
- 120–220 words
- 3–5 professional hashtags (not in postText)
- End with a soft CTA (not a hard sell)
- No casual language, no clickbait, no emoji overuse
- Do NOT include the URL in postText

REDDIT RULES:
- Discussion-first. Must sound like a genuine question or observation from a real person.
- NO direct sales, NO CTA in the body, NO "our service", NO "request a quote"
- NO link in the body text — the link goes only in suggestedFollowUpComment
- Body: 150–250 words, invite community input, share useful context
- suggestedFollowUpComment: a natural follow-up comment the author can post AFTER the discussion starts, which includes the link naturally with a disclosure
- moderationRisk: assess as "low" (discussion-only), "medium" (mentions business), or "high" (self-promotional risk)
- disclosureNote: one short sentence if the poster has a business interest

YOUTUBE RULES:
- Short video script for a 60–90 second video (spoken words only, no stage directions)
- Title under 70 characters including the primary keyword
- Description 150–300 words, SEO-friendly, includes page URL on its own line
- 8–12 tags
- Detailed thumbnail prompt for an AI image tool
- Detailed text-to-video prompt for a 60–90 second animation

Return a single JSON object with exactly this structure:

{
  "facebook": {
    "postText": "80–150 word friendly post. Mention ${ctx.location}. Apply the content angle. No hashtags or URL in this field.",
    "hashtags": ["2 to 4 hashtags WITHOUT the # symbol"],
    "imageSuggestion": "One sentence describing the ideal image for this post",
    "linkUrl": "${ctx.pageUrl}",
    "link": {
      "suggestedAnchorText": "3–6 word link text, e.g. '${ctx.service} in ${ctx.location}'"
    }
  },
  "linkedin": {
    "headline": "Professional hook under 100 characters",
    "postText": "120–220 word professional post. Apply the content angle. No URL in this field.",
    "hashtags": ["3 to 5 professional hashtags WITHOUT the # symbol"],
    "linkUrl": "${ctx.pageUrl}",
    "link": {
      "suggestedAnchorText": "3–6 word anchor text for LinkedIn"
    }
  },
  "reddit": {
    "title": "Genuine question or observation that invites discussion. NOT promotional. Under 100 characters.",
    "body": "150–250 word discussion body. No link. No sales CTA. Invite real input. Apply the content angle.",
    "suggestedFollowUpComment": "A natural comment to post after the discussion starts. Include the link here with disclosure. Example: 'Worth mentioning — I work in this space and put together a page on this: [anchor text](url). Happy to answer questions.'",
    "suggestedSubreddits": ["4 to 6 relevant subreddit names WITHOUT the r/ prefix"],
    "disclosureNote": "One short disclosure if the poster has a business connection, e.g. 'I work at a local ${ctx.service} agency'",
    "moderationRisk": "low",
    "linkUrl": "${ctx.pageUrl}",
    "link": {
      "suggestedAnchorText": "3–6 word markdown anchor text for the follow-up comment"
    }
  },
  "youtube": {
    "title": "Video title under 70 chars. Include '${ctx.primaryKeyword}' naturally.",
    "description": "150–300 word YouTube description. Include page URL on its own line. Naturally SEO-optimised.",
    "script": "60–90 second spoken script. Hook (10s) → Problem (20s) → Solution with 2–3 points (40s) → CTA (10s). Spoken words only.",
    "chapters": [
      {"timestamp": "0:00", "title": "Intro"},
      {"timestamp": "0:15", "title": "The Challenge"},
      {"timestamp": "0:40", "title": "The Solution"},
      {"timestamp": "1:10", "title": "Next Steps"}
    ],
    "tags": ["8 to 12 YouTube tags for ${ctx.service} and ${ctx.location}"],
    "thumbnailPrompt": "Detailed AI image generator prompt for a YouTube thumbnail",
    "videoPrompt": "Detailed text-to-video prompt for a 60–90 second explainer about ${ctx.service} in ${ctx.location}",
    "linkUrl": "${ctx.pageUrl}",
    "link": {
      "suggestedAnchorText": "3–6 word anchor text for the YouTube description"
    }
  }
}`;

  const response = await client.chat.completions.create({
    model:           "gpt-4.1",
    max_tokens:      4500,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: userPrompt   },
    ],
  });

  const raw    = response.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as DistributionContent;
  parsed.postAngle = angle;
  return parsed;
}
