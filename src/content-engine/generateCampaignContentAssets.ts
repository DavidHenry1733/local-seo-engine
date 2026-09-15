import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { buildCampaignContentContext } from "./buildCampaignContentContext";
import type {
  AnchorTextSuggestion,
  AssetEnvelope,
  AssetType,
  BlogPostPayload,
  CampaignContentContext,
  CampaignContentManifest,
  EmailSequencePayload,
  GenerationResult,
  InternalLink,
  SourcePageRef,
  StatusCounts,
} from "./types";

const GENERATOR_VERSION = "content-engine-v1.1.0";

const DEFAULT_SETTINGS = {
  blogPostCount: 4,
  socialPostCountPerType: 4,
  youtubeCount: 4,
  emailSequenceCount: 1,
  emailsPerSequence: 4,
};

interface BlogSection {
  heading: string;
  paragraphs: string[];
}

interface BlogTopic {
  slug: string;
  title: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  intro: string;
  sections: BlogSection[];
  faqs: { question: string; answer: string }[];
  aiSummary: string;
  imagePrompt: string;
}

function emptyStatusCounts(): StatusCounts {
  return { draft: 0, generated: 0, reviewed: 0, approved: 0, published: 0, rejected: 0 };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function pickClusters(ctx: CampaignContentContext, index: number, count = 2): InternalLink[] {
  const clusters = ctx.internalLinkTargets.filter((l) => l.href !== ctx.hubUrl);
  if (clusters.length === 0) return [];
  const picked: InternalLink[] = [];
  for (let i = 0; i < count; i++) {
    picked.push(clusters[(index + i) % clusters.length]);
  }
  return picked;
}

function pickRelatedService(ctx: CampaignContentContext, index: number): InternalLink {
  return ctx.relatedServiceLinks[index % ctx.relatedServiceLinks.length];
}

function uniqueAnchors(label: string, href: string): string[] {
  const short = label.replace(/\s+Rotherham/i, "").trim();
  const areaMatch = label.match(/Web Hosting (\w+(?:\s+\w+)?)/i);
  const area = areaMatch?.[1];
  const anchors = [label, short];
  if (area && area !== "Rotherham") {
    anchors.push(`${area} hosting services`, `hosting for ${area} businesses`);
  } else if (href.includes("web-design")) {
    anchors.push("Rotherham web design services", "professional website design");
  } else if (href.includes("email-marketing")) {
    anchors.push("email marketing for local businesses", "Rotherham email campaigns");
  } else if (href.includes("local-seo")) {
    anchors.push("local SEO support", "Rotherham search visibility");
  } else if (href.includes("uk-website-hosting")) {
    anchors.push("UK website hosting plans", "managed UK hosting");
  } else {
    anchors.push(`${short.toLowerCase()} in Rotherham`, "reliable local hosting");
  }
  return [...new Set(anchors)].slice(0, 4);
}

function buildAnchorSuggestions(links: InternalLink[]): AnchorTextSuggestion[] {
  return links.map((link) => ({
    targetUrl: link.href,
    suggestedAnchors: uniqueAnchors(link.label, link.href),
  }));
}

function resolveImagePrompt(ctx: CampaignContentContext, index: number): string {
  const pane = ctx.paneImages[index % Math.max(ctx.paneImages.length, 1)];
  const raw = pane?.altText?.trim() ?? "";
  if (raw && !raw.includes("{{")) return raw;
  const slots = ["hero", "support", "trust", "conversion"];
  const slot = pane?.slot ?? slots[index % slots.length];
  return `Professional ${ctx.service} for ${ctx.location} — ${slot} visual, UK small business, clean modern marketing photography`;
}

function clusterAreaName(link: InternalLink): string {
  const match = link.label.match(/(?:Web Hosting|hosting)\s+(.+)/i);
  return match?.[1] ?? link.label;
}

function buildBlogTopics(ctx: CampaignContentContext): BlogTopic[] {
  const { service, location } = ctx;
  const loc = location;

  return [
    {
      slug: slugify(`reliable-${service}-for-${loc}-businesses`),
      title: `Reliable ${service} for ${loc} Businesses: What to Look For`,
      h1: `Reliable ${service} for ${loc} Businesses`,
      metaTitle: `${service} ${loc} — What Local Businesses Should Look For`,
      metaDescription: `Practical guide to choosing ${service.toLowerCase()} in ${loc}: uptime, UK support, security, backups and how hosting supports local enquiries.`,
      intro: `${loc} businesses depend on websites that load quickly, stay online and give customers confidence. Whether you run a trade firm in Maltby, a professional practice in Wickersley or a retail shop in the town centre, the hosting behind your site affects every enquiry path you publish.`,
      sections: [
        {
          heading: "Why Hosting Matters for Local Enquiries",
          paragraphs: [
            `When a customer searches for your services in ${loc}, slow or unreliable hosting can cost you the enquiry before they read your offer. Stable hosting keeps service pages, contact forms and neighbourhood landing pages available when demand is highest — including after local campaigns or seasonal peaks.`,
            `Your main [${service} ${loc}](HUB) hub should explain the offer clearly. Supporting content helps owners compare options without jargon, while area pages such as cluster targets give visitors proof you serve their neighbourhood.`,
            `Many owners treat hosting as a commodity purchase. In practice it is the layer that determines whether your web design, local SEO and email marketing investments actually convert when traffic arrives.`,
          ],
        },
        {
          heading: "Uptime, Support and Security Basics",
          paragraphs: [
            `Look for clear uptime commitments, UK-friendly support hours and sensible backup routines. Security patches, SSL certificates and malware monitoring are baseline expectations — not premium extras reserved for enterprise clients.`,
            `Ask how restores are tested. A backup you have never recovered from is only a label. For ${loc} businesses without in-house IT, response time matters as much as server specifications.`,
            `If you serve areas across ${loc}, neighbourhood pages should load as reliably as the hub. Consistent performance builds trust with visitors and gives search engines stable signals across your local page network.`,
          ],
        },
        {
          heading: "Performance for Mobile Customers",
          paragraphs: [
            `Most local searches happen on mobile. Hosting influences time-to-first-byte, caching behaviour and how quickly images load on service pages. A two-second delay on a quote form can be enough for a customer to call a competitor instead.`,
            `Test your homepage and primary service pages on mobile data — not only office Wi‑Fi. Compare results before and after caching changes or plugin updates to see whether the host or the site configuration is the bottleneck.`,
          ],
        },
        {
          heading: "Matching Hosting to Business Growth",
          paragraphs: [
            `A trades business launching its first site has different needs from a growing firm with multiple landing pages, booking forms and campaign traffic. Plan for spikes after promotions and leave room to add [email marketing](RELATED) or [local SEO](RELATED2) pages later without migrating again.`,
            `Related services work best when hosting, forms and tracking are configured together from the start. That avoids the common pattern of patching a slow site with marketing spend that never converts.`,
          ],
        },
        {
          heading: "Questions to Ask Before You Sign",
          paragraphs: [
            `Before committing, ask: What is included in support? Where are servers located? How are backups stored and restored? What happens at renewal — and can you export your site if you leave?`,
            `For ${loc} service businesses, clarity beats buzzwords. A host that explains limits honestly is often a better long-term partner than one promising unlimited everything on a £3 plan.`,
            `Ask for a trial migration or staging environment if you already have live pages. Testing before DNS cutover reveals form, SSL and plugin issues without risking Monday-morning downtime.`,
          ],
        },
        {
          heading: "Practical Next Steps This Week",
          paragraphs: [
            `Run mobile speed tests on your hub and busiest service page. Submit a test enquiry on each. Check SSL expiry dates and renewal terms in your current hosting account.`,
            `If two or more checks fail, schedule a review before your next marketing push. Fixing infrastructure first protects every pound you later put into ads, SEO or email campaigns.`,
            `Document what you find — response times, error messages, support ticket IDs. That evidence makes comparison shopping faster and helps any specialist you speak to recommend the right tier.`,
          ],
        },
      ],
      faqs: [
        {
          question: `What should a ${loc} business prioritise when choosing web hosting?`,
          answer: `Prioritise uptime, UK-friendly support hours, SSL, tested backups and capacity for local landing pages. Speed on mobile and reliable form delivery matter more than unlimited storage you will never use.`,
        },
        {
          question: `How much does business web hosting typically cost in ${loc}?`,
          answer: `Professional hosting for small businesses often falls between £120 and £350 per year depending on support, backups and migration help. Compare renewal pricing and what is included before choosing on headline cost alone.`,
        },
        {
          question: `Can I keep my existing website when switching hosts?`,
          answer: `Yes, with planning. A proper migration covers DNS, SSL, redirects, form testing and URL stability — especially important if you already rank for local service searches in ${loc}.`,
        },
      ],
      aiSummary: `Guide for ${loc} businesses choosing web hosting: uptime, UK support, mobile performance, security and growth planning, with links to local service and area pages.`,
      imagePrompt: `Professional web hosting concept for ${loc}: server rack with UK map overlay, clean blue tones, small business office context`,
    },
    {
      slug: slugify(`signs-your-${loc}-business-needs-better-hosting`),
      title: `7 Signs Your ${loc} Business Needs Better Web Hosting`,
      h1: `7 Signs Your ${loc} Business Needs Better Web Hosting`,
      metaTitle: `7 Signs You Need Better Web Hosting in ${loc}`,
      metaDescription: `Slow pages, form failures, SSL warnings and downtime — seven practical signs ${loc} businesses should upgrade web hosting before losing enquiries.`,
      intro: `Hosting problems rarely arrive as a single error message. They show up as friction in the customer journey: slow mobile pages, missed form submissions, renewal shocks and quiet downtime during business hours. If any of the seven signs below feel familiar, it may be time to review your setup before the next campaign.`,
      sections: [
        {
          heading: "1. Service Pages Load Slowly on Mobile",
          paragraphs: [
            `If core pages take more than a few seconds on mobile data, hosting or caching may be the bottleneck — not your content alone. ${loc} customers often compare several providers before calling; speed influences that decision within seconds.`,
            `Run PageSpeed or Lighthouse on your hub page and one area page. Persistent poor scores across both often point to server response time or resource limits on shared plans.`,
          ],
        },
        {
          heading: "2. Contact Forms Fail or Delay",
          paragraphs: [
            `Submit a test enquiry on Wi‑Fi and on mobile data. Timeouts, silent failures or messages landing in spam usually trace back to server limits, shared SMTP or misconfigured mail routing — not customer error.`,
            `For enquiry-led businesses, one broken form can cost more than a year of better hosting. Fix delivery before you spend on traffic.`,
          ],
        },
        {
          heading: "3. SSL Warnings or Certificate Expiry Scares",
          paragraphs: [
            `Browser warnings destroy trust instantly. Certificates should renew automatically; if yours expired or shows mixed-content errors, hosting or deployment workflow needs attention.`,
            `Check every domain and subdomain you use for campaigns, including staging environments linked from live pages.`,
          ],
        },
        {
          heading: "4. Downtime During Business Hours",
          paragraphs: [
            `Even brief outages during working hours can mean lost calls. Monitor uptime and ask whether your host publishes maintenance windows and incident reports.`,
            `Businesses in busy areas such as [Bramley](CLUSTER0) or [Wickersley](CLUSTER1) often see enquiry spikes after local promotions — hosting should absorb that without throttling legitimate visitors.`,
          ],
        },
        {
          heading: "5. You Cannot Add Local Pages Without Slowdown",
          paragraphs: [
            `Adding neighbourhood landing pages should not degrade the whole site. If each new area page increases load times site-wide, you may be on a plan with tight CPU or database limits.`,
            `A growing ${loc} campaign links a hub to multiple cluster pages. Infrastructure should serve that network comfortably.`,
          ],
        },
        {
          heading: "6. Renewal Price Jumps on Budget Plans",
          paragraphs: [
            `Introductory pricing is common on cheap shared hosting. If renewal more than doubles without added support or performance, total cost of ownership may exceed a business-grade plan.`,
            `Read renewal terms before migration deadlines force a rushed decision.`,
          ],
        },
        {
          heading: "7. Support Is Slow or Offshore-Only",
          paragraphs: [
            `When the site is down, waiting 24 hours for a ticket response is not acceptable for a business that relies on web enquiries. UK-friendly support hours and clear escalation paths matter for ${loc} owners without dedicated IT.`,
            `If you are rebuilding pages, adding local landing pages or connecting [email marketing campaigns](RELATED), treat hosting as part of the stack — not an afterthought. Align it with your hub, clusters and conversion paths.`,
          ],
        },
        {
          heading: "What to Do If You Recognise These Signs",
          paragraphs: [
            `Score your site against the seven signs above. Two or more usually means a review is overdue — not necessarily an immediate migration, but a structured look at uptime, forms, SSL and plan limits.`,
            `Start with fixes that do not require moving hosts: caching, image compression, plugin cleanup and form routing. If those do not improve mobile speed or delivery, plan a migration before peak season.`,
            `Keep URLs stable when you move. Indexed local area pages should stay on the same paths where possible so existing local search visibility is not disrupted.`,
          ],
        },
      ],
      faqs: [
        {
          question: `How do I know if slow speeds are hosting or my website build?`,
          answer: `Compare TTFB on a simple static file versus your homepage. High server response time with a lightweight test file suggests hosting limits. Poor scores only on heavy pages may indicate images, plugins or caching configuration.`,
        },
        {
          question: `Will upgrading hosting help my Google rankings in ${loc}?`,
          answer: `Hosting supports Core Web Vitals, crawl reliability and uptime — foundational signals. It will not replace local content, reviews or strong service pages, but poor infrastructure can hold them back.`,
        },
        {
          question: `Can I migrate hosting without losing local SEO pages?`,
          answer: `Yes. Keep URLs stable, plan DNS and SSL carefully, set 301 redirects where needed and verify forms after cutover. Area pages you already rank with should stay on the same paths.`,
        },
      ],
      aiSummary: `Seven warning signs ${loc} businesses should watch for: mobile speed, form failures, SSL issues, downtime, scaling limits, renewal pricing and weak support — with guidance on when to upgrade.`,
      imagePrompt: `Warning dashboard showing slow website metrics, ${loc} skyline subtle in background, modern flat illustration`,
    },
    {
      slug: slugify(`uk-hosting-vs-cheap-shared-hosting-${loc}`),
      title: `UK Hosting vs Cheap Shared Hosting for ${loc} Businesses`,
      h1: `UK Hosting vs Cheap Shared Hosting for ${loc} Businesses`,
      metaTitle: `UK Hosting vs Cheap Shared Hosting — ${loc} Guide`,
      metaDescription: `Compare UK web hosting and budget shared hosting for ${loc} businesses: support, speed, renewal pricing, compliance and total cost of ownership.`,
      intro: `Budget hosting looks attractive on price alone. For ${loc} service businesses, the real comparison includes support responsiveness, data location, backup quality, renewal pricing and how infrastructure affects local page performance when customers actually visit.`,
      sections: [
        {
          heading: "What Cheap Shared Hosting Gets You",
          paragraphs: [
            `Low-cost shared plans suit simple brochure sites with light traffic. They often include a control panel, one-click installs and enough storage for a five-page site.`,
            `They may struggle with multiple local landing pages, image-heavy hubs, concurrent form submissions or traffic spikes after Facebook campaigns. Resource limits can throttle CPU just when you need stability.`,
            `Read renewal pricing, inode limits, backup scope and support channels before moving production pages. The first-year price is rarely the full story.`,
          ],
        },
        {
          heading: "What UK-Focused Business Hosting Adds",
          paragraphs: [
            `UK-based or UK-optimised infrastructure can reduce latency for ${loc} visitors. Sensible caching, modern PHP versions and monitored uptime matter when your hub and area pages compete for local attention.`,
            `Business plans typically add tested backups, clearer support expectations and headroom for growth — landing pages, seasonal campaigns and integrated [web design](RELATED) updates without constant migration.`,
          ],
        },
        {
          heading: "Total Cost Comparison Framework",
          paragraphs: [
            `Compare three-year cost, not intro month one: renewal price, migration help, SSL, backups, email delivery and time you spend fixing issues yourself.`,
            `A plan that saves £80 per year but costs two days of owner time during an outage is often poor value for an enquiry-led business.`,
          ],
        },
        {
          heading: "When Budget Hosting Is Enough",
          paragraphs: [
            `A single-page brochure with low traffic, no forms and no SEO ambition may run fine on entry shared hosting. The breakpoint usually arrives when you add local pages, booking forms, analytics and marketing integrations.`,
            `Track where you are on that path before renewal locks you into another year. Moving before you depend on forms for daily enquiries is simpler and cheaper than an emergency migration.`,
          ],
        },
        {
          heading: "Making the Switch Without Losing Rankings",
          paragraphs: [
            `Plan DNS cutover, SSL, redirects and form testing before go-live. Keep URLs stable — especially for established pages targeting [Dinnington](CLUSTER0), [Kiveton Park](CLUSTER1) and nearby areas.`,
            `Verify sitemap entries and internal links after migration. When your [money page](MONEY) and local hub cross-link, both should stay fast and reachable throughout the move.`,
          ],
        },
        {
          heading: "Red Flags in Hosting Adverts",
          paragraphs: [
            `Unlimited everything on a very low monthly price usually means strict hidden limits. Look for CPU throttling, inode caps, paid backup restores and renewal multipliers in year two.`,
            `If support is ticket-only with no published hours, factor in the cost of your own time when the site fails during business hours.`,
          ],
        },
        {
          heading: `Decision Worksheet for ${loc} Owners`,
          paragraphs: [
            `List your must-haves: number of landing pages, form volume, email accounts, staging, support hours and acceptable downtime. Score each plan against that list — not against marketing adjectives.`,
            `Involve whoever maintains the site (agency, freelancer or internal) before signing. Migration complexity depends on plugins, DNS and integrations — not page count alone.`,
          ],
        },
      ],
      faqs: [
        {
          question: `Is UK server location essential for ${loc} businesses?`,
          answer: `It helps latency for local visitors and can simplify data considerations, but performance, uptime and support quality matter more than location alone. A well-configured UK-optimised host beats a poorly maintained local server.`,
        },
        {
          question: `What is the biggest hidden cost of cheap hosting?`,
          answer: `Renewal price increases, paid backups, premium support to fix issues, and lost enquiries from downtime or slow forms. Total cost of ownership often exceeds business hosting within two years.`,
        },
        {
          question: `How long does a typical hosting migration take?`,
          answer: `Simple sites may move in one to three days with preparation. Larger local campaigns with many area pages, forms and integrations often need a week including testing and DNS propagation.`,
        },
      ],
      aiSummary: `Honest comparison of budget shared hosting versus UK business hosting for ${loc}: features, renewal costs, migration risk and when each option makes sense.`,
      imagePrompt: `Split comparison infographic UK datacenter vs generic shared hosting, professional marketing style`,
    },
    {
      slug: slugify(`how-web-hosting-supports-local-seo-${loc}`),
      title: `How Web Hosting Supports Local SEO in ${loc}`,
      h1: `How Web Hosting Supports Local SEO in ${loc}`,
      metaTitle: `Web Hosting and Local SEO in ${loc} — Practical Guide`,
      metaDescription: `Speed, HTTPS, uptime and crawl efficiency: how web hosting supports Local SEO for ${loc} businesses with hub pages, clusters and conversion tracking.`,
      intro: `Local SEO is not only Google Business Profile and citations. Hosting shapes Core Web Vitals, crawl efficiency, HTTPS trust and whether neighbourhood landing pages stay fast enough to rank and convert when ${loc} customers find you in search.`,
      sections: [
        {
          heading: "Speed, HTTPS and Crawl Health",
          paragraphs: [
            `Search engines reward pages that load reliably on mobile. Hosting underpins time-to-first-byte, caching and SSL — foundational signals for hub pages and area clusters alike.`,
            `If bots hit timeouts or soft 500 errors, local URLs may not recrawl as often. Monitor server logs after publishing new pages in [Maltby](CLUSTER0), [Kiveton Park](CLUSTER1) or other priority areas.`,
            `Mixed content and expired certificates send negative trust signals to browsers and crawlers. Automate renewal and audit staging links that leak into production.`,
          ],
        },
        {
          heading: "Serving a Local Page Network",
          paragraphs: [
            `A strong ${loc} campaign links a [service hub](HUB) to area pages and related offers such as [local SEO](RELATED) or web design. Hosting should serve that entire network without bottlenecks when traffic lands on any entry page.`,
            `Use descriptive internal links so customers and crawlers understand relationships. Hosting stability ensures those paths stay fast end-to-end — not just on the homepage.`,
          ],
        },
        {
          heading: "Core Web Vitals in Plain Language",
          paragraphs: [
            `Largest Contentful Paint, Interaction to Next Paint and Cumulative Layout Shift are influenced by server response, image delivery and script loading. You can improve content and still fail targets if the host responds slowly.`,
            `Measure real URLs — not only the homepage. Area pages with maps, galleries or long FAQs often show different results than the hub.`,
            `Fix the worst URL first — usually the page you send paid traffic to or the template used across multiple area pages. One template fix can lift several cluster URLs at once.`,
          ],
        },
        {
          heading: "Forms, Calls and Conversion Tracking",
          paragraphs: [
            `Rankings without enquiries are vanity metrics. Reliable hosting keeps forms posting, thank-you pages loading and call-tracking scripts firing. Downtime during paid campaigns wastes budget twice.`,
            `Combine infrastructure stability with call tracking and form analytics. ${loc} owners need to know which pages create qualified enquiries — not just which keywords show impressions.`,
          ],
        },
        {
          heading: "When to Align Hosting With SEO Work",
          paragraphs: [
            `If you are publishing new local pages, running campaigns or recovering from a migration, review hosting before scaling content. Fixing speed after publishing ten area pages is slower than building on stable infrastructure first.`,
            `For broader UK positioning, your [UK website hosting](MONEY) offer and local hub should both perform consistently — especially when cross-linked from blog or social content.`,
          ],
        },
        {
          heading: "Hosting Review Checklist Before You Publish",
          paragraphs: [
            `Before launching new local pages, confirm: TTFB under control on hub and template cluster page, forms deliver to inbox, SSL valid on all paths, backups restorable, and monitoring alerts configured.`,
            `Run the same checks after each plugin or theme update. Regressions often appear on area pages first because they use heavier templates or additional scripts.`,
            `Share results with whoever manages SEO or ads — infrastructure fixes protect campaign ROI as much as keyword work.`,
          ],
        },
      ],
      faqs: [
        {
          question: `Does hosting directly affect Local SEO rankings in ${loc}?`,
          answer: `It affects speed, HTTPS, uptime and crawlability — all supporting signals. It does not replace reviews, relevant local content or a well-optimised Google Business Profile, but weak hosting can limit results from those efforts.`,
        },
        {
          question: `Which pages should I speed-test first?`,
          answer: `Start with your hub, top three area pages by traffic or priority, and any page you send paid or social traffic to. Fix bottlenecks there before optimising low-traffic legacy pages.`,
        },
        {
          question: `Should local SEO and hosting be managed together?`,
          answer: `Yes, when you run hub-and-cluster campaigns. Publishing area pages on overloaded hosting creates a poor user experience and wasted SEO work. Align both for sustainable local visibility.`,
        },
      ],
      aiSummary: `Explains how hosting affects Local SEO in ${loc}: Core Web Vitals, HTTPS, crawl health, hub-and-cluster performance and conversion tracking alongside GBP and citations.`,
      imagePrompt: `Local SEO map pins connected to server cloud, ${loc} region highlighted, clean tech marketing visual`,
    },
  ];
}

function injectInlineLinks(
  text: string,
  links: {
    HUB?: InternalLink;
    CLUSTER0?: InternalLink;
    CLUSTER1?: InternalLink;
    RELATED?: InternalLink;
    RELATED2?: InternalLink;
    MONEY?: InternalLink;
  },
): string {
  let out = text;
  if (links.HUB) {
    out = out.replace(/\[([^\]]+)\]\(HUB\)/g, `[$1](${links.HUB!.href})`);
  }
  if (links.CLUSTER0) {
    out = out.replace(/\[([^\]]+)\]\(CLUSTER0\)/g, `[$1](${links.CLUSTER0!.href})`);
  }
  if (links.CLUSTER1) {
    out = out.replace(/\[([^\]]+)\]\(CLUSTER1\)/g, `[$1](${links.CLUSTER1!.href})`);
  }
  if (links.RELATED) {
    out = out.replace(/\[([^\]]+)\]\(RELATED\)/g, `[$1](${links.RELATED!.href})`);
  }
  if (links.RELATED2) {
    out = out.replace(/\[([^\]]+)\]\(RELATED2\)/g, `[$1](${links.RELATED2!.href})`);
  }
  if (links.MONEY) {
    out = out.replace(/\[([^\]]+)\]\(MONEY\)/g, `[$1](${links.MONEY!.href})`);
  }
  return out;
}

function buildArticleSchema(
  ctx: CampaignContentContext,
  topic: BlogTopic,
  canonicalPath: string,
  generatedAt: string,
): Record<string, unknown> {
  const canonical = `${ctx.businessProfile.domain}${canonicalPath.startsWith("/") ? canonicalPath : `/${canonicalPath}`}`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: topic.title,
    name: topic.h1,
    description: topic.metaDescription,
    url: canonical,
    mainEntityOfPage: canonical,
    datePublished: generatedAt,
    dateModified: generatedAt,
    about: `${ctx.service} ${ctx.location}`,
    articleSection: ctx.service,
    author: { "@type": "Organization", name: ctx.businessProfile.businessName },
    publisher: { "@type": "Organization", name: ctx.businessProfile.businessName },
  };
}

function buildFaqSchema(faqs: { question: string; answer: string }[]): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

function buildBodyMarkdown(
  topic: BlogTopic,
  internalLinks: InternalLink[],
  ctx: CampaignContentContext,
  linkMap: {
    HUB: InternalLink;
    CLUSTER0: InternalLink;
    CLUSTER1: InternalLink;
    RELATED: InternalLink;
    RELATED2?: InternalLink;
    MONEY?: InternalLink;
  },
): string {
  const lines: string[] = [`# ${topic.h1}`, "", injectInlineLinks(topic.intro, linkMap), ""];

  for (const section of topic.sections) {
    lines.push(`## ${section.heading}`, "");
    for (const p of section.paragraphs) {
      lines.push(injectInlineLinks(p, linkMap), "");
    }
  }

  lines.push("## Frequently Asked Questions", "");
  for (const faq of topic.faqs) {
    lines.push(`### ${faq.question}`, "", faq.answer, "");
  }

  lines.push("## Related Local Pages", "");
  for (const link of internalLinks) {
    lines.push(`- [${link.label}](${link.href})`);
  }

  const cta =
    ctx.businessProfile.primaryCtaText ?? `Talk to ${ctx.businessProfile.businessName}`;
  lines.push(
    "",
    `Need help choosing ${ctx.service.toLowerCase()} in ${ctx.location}? [${cta}](${ctx.hubUrl}).`,
  );
  return lines.join("\n");
}

function makeEnvelope(
  assetId: string,
  assetType: AssetType,
  ctx: CampaignContentContext,
  runId: string,
  generatedAt: string,
  payload: Record<string, unknown>,
  parentAssetId?: string,
): AssetEnvelope {
  return {
    assetId,
    assetType,
    status: "generated",
    campaignId: ctx.campaignId,
    projectSlug: ctx.projectSlug,
    parentAssetId,
    service: ctx.service,
    location: ctx.location,
    targetKeyword: ctx.targetKeyword,
    relatedHubUrl: ctx.hubUrl,
    relatedClusterUrls: ctx.clusterUrls,
    sourceGeneration: { runId, generatorVersion: GENERATOR_VERSION, generatedAt },
    payload,
  };
}

function generateBlogAssets(
  ctx: CampaignContentContext,
  runId: string,
  generatedAt: string,
): AssetEnvelope[] {
  const topics = buildBlogTopics(ctx);
  return topics.map((topic, index) => {
    const clusters = pickClusters(ctx, index, 2);
    const related = pickRelatedService(ctx, index);
    const related2 = ctx.relatedServiceLinks[(index + 2) % ctx.relatedServiceLinks.length];
    const moneyLink = ctx.relatedServiceLinks.find((l) => l.href.includes("uk-website-hosting"));
    const internalLinks: InternalLink[] = [
      { label: `${ctx.service} ${ctx.location}`, href: ctx.hubUrl },
      ...clusters,
      related,
    ];
    if (moneyLink && index === 3 && !internalLinks.some((l) => l.href === moneyLink.href)) {
      internalLinks.push(moneyLink);
    }

    const linkMap = {
      HUB: internalLinks[0],
      CLUSTER0: clusters[0],
      CLUSTER1: clusters[1],
      RELATED: related,
      RELATED2: related2,
      MONEY: moneyLink,
    };

    const blogSlug = topic.slug;
    const payload: BlogPostPayload = {
      title: topic.title,
      slug: blogSlug,
      metaTitle: topic.metaTitle,
      metaDescription: topic.metaDescription,
      h1: topic.h1,
      bodyMarkdown: buildBodyMarkdown(topic, internalLinks, ctx, linkMap),
      aiSummary: topic.aiSummary,
      internalLinks,
      anchorTextSuggestions: buildAnchorSuggestions(internalLinks),
      faqBlock: topic.faqs,
      articleSchema: buildArticleSchema(ctx, topic, `/blog/${blogSlug}/`, generatedAt),
      faqSchema: buildFaqSchema(topic.faqs),
      suggestedImagePrompt: topic.imagePrompt,
      linkedHubUrl: ctx.hubUrl,
      linkedClusterUrls: clusters.map((c) => c.href),
      status: "generated",
    };
    return makeEnvelope(
      `asset-blog-${String(index + 1).padStart(3, "0")}`,
      "blog_post",
      ctx,
      runId,
      generatedAt,
      payload as unknown as Record<string, unknown>,
    );
  });
}

function generateFacebookAssets(ctx: CampaignContentContext, runId: string, generatedAt: string): AssetEnvelope[] {
  const clusters = pickClusters(ctx, 0, 2);
  const posts = [
    {
      text: `Quick question for ${ctx.location} business owners: when did you last load your website on mobile data?\n\nIf service pages take more than 3 seconds, hosting or caching may be costing you enquiries before customers read a single line.`,
      hashtags: ["#WebHosting", "#RotherhamBusiness", "#SmallBusinessUK"],
      linkedUrl: ctx.hubUrl,
      cta: "Check your hosting basics",
    },
    {
      text: `Cheap hosting renewals can jump sharply in year two.\n\nBefore you auto-renew, compare uptime, UK support hours and whether your plan handles local landing pages across ${ctx.location} without slowdown.`,
      hashtags: ["#WebsiteTips", "#Rotherham", "#BusinessHosting"],
      linkedUrl: ctx.hubUrl,
      cta: "Compare hosting options",
    },
    {
      text: `Launching pages for areas like ${clusterAreaName(clusters[0])} or ${clusterAreaName(clusters[1])}?\n\nMake sure your hosting can handle the extra traffic — not just the extra URLs.`,
      hashtags: ["#LocalMarketing", "#WebHosting", "#SouthYorkshire"],
      linkedUrl: clusters[0].href,
      cta: `See hosting in ${clusterAreaName(clusters[0])}`,
    },
    {
      text: `Google visibility is not just SEO content — it is pages that load fast on mobile, forms that deliver and SSL that stays current.\n\n${ctx.service} is the foundation. Worth a five-minute check this week.`,
      hashtags: ["#LocalSEO", "#Rotherham", "#DigitalMarketing"],
      linkedUrl: ctx.hubUrl,
      cta: ctx.businessProfile.primaryCtaText ?? "Request a quote",
    },
  ];
  return posts.map((p, i) =>
    makeEnvelope(
      `asset-fb-${String(i + 1).padStart(3, "0")}`,
      "facebook_post",
      ctx,
      runId,
      generatedAt,
      {
        postText: p.text,
        cta: p.cta,
        hashtags: p.hashtags,
        linkedUrl: p.linkedUrl,
        suggestedImagePrompt: resolveImagePrompt(ctx, i),
        status: "generated",
      },
    ),
  );
}

function generateLinkedInAssets(ctx: CampaignContentContext, runId: string, generatedAt: string): AssetEnvelope[] {
  const posts = [
    {
      text: `${ctx.location} service businesses rarely lose enquiries because of font choices.\n\nThey lose them when:\n→ pages load slowly on mobile\n→ contact forms fail silently\n→ SSL warnings appear mid-session\n\nInfrastructure is part of customer experience.`,
      angle: "Operational reliability and customer trust",
      cta: "Review hosting checklist",
      linkedUrl: ctx.hubUrl,
      hashtags: ["#WebHosting", "#CustomerExperience", "#Rotherham", "#SMB"],
    },
    {
      text: `Local SEO only works if infrastructure keeps pages online.\n\nHub pages, area clusters and conversion tracking should be planned together — not patched after a campaign launches.\n\nHosting is the layer everything else depends on.`,
      angle: "Marketing stack alignment",
      cta: "See local hosting services",
      linkedUrl: ctx.relatedServiceLinks[2]?.href ?? ctx.hubUrl,
      hashtags: ["#LocalSEO", "#MarTech", "#RotherhamBusiness", "#WebHosting"],
    },
    {
      text: `Migrating hosting without a checklist risks downtime and lost rankings.\n\nMinimum list:\n1. DNS export + TTL documented\n2. SSL staged before cutover\n3. Forms tested on mobile data\n4. URLs kept stable for indexed local pages\n5. Sitemap verified after go-live`,
      angle: "Risk-managed migration",
      cta: "Download migration checklist",
      linkedUrl: ctx.hubUrl,
      hashtags: ["#WebOps", "#DigitalMarketing", "#Rotherham", "#Hosting"],
    },
    {
      text: `Growing beyond a brochure site?\n\nCapacity for landing pages, email campaigns and analytics separates hobby hosting from business-grade setups.\n\nPlan headroom before traffic arrives — not during an outage.`,
      angle: "Growth readiness",
      cta: "Explore business hosting",
      linkedUrl: ctx.moneyPageUrl ?? ctx.hubUrl,
      hashtags: ["#ScaleUp", "#WebHosting", "#LocalBusiness", "#UKBusiness"],
    },
  ];
  return posts.map((item, i) =>
    makeEnvelope(
      `asset-li-${String(i + 1).padStart(3, "0")}`,
      "linkedin_post",
      ctx,
      runId,
      generatedAt,
      {
        postText: item.text,
        professionalAngle: item.angle,
        cta: item.cta,
        hashtags: item.hashtags,
        linkedUrl: item.linkedUrl,
        status: "generated",
      },
    ),
  );
}

function generateGbpAssets(ctx: CampaignContentContext, runId: string, generatedAt: string): AssetEnvelope[] {
  const posts = [
    {
      text: `Dependable web hosting for ${ctx.location} businesses — fast pages, secure SSL and UK-friendly support. Keep service pages and contact forms working when customers find you online.`,
      type: "whats_new",
      cta: "View web hosting",
    },
    {
      text: `Website loading slowly on mobile? It may be your hosting plan.\n\nWe review uptime, SSL, backups and form delivery for ${ctx.location} businesses — often the fix is simpler than a full redesign.`,
      type: "offer",
      cta: "Book a hosting review",
    },
    {
      text: `Adding local service pages across ${ctx.location}? We'll make sure your hosting supports growth in areas like Wickersley, Bramley and Maltby without slowdowns.`,
      type: "whats_new",
      cta: "Learn about local hosting",
    },
    {
      text: `Free hosting health check for ${ctx.location} businesses.\n\nIncludes: uptime review, SSL check, backup status and test form delivery. Response within one working day.`,
      type: "offer",
      cta: "Claim free check",
    },
  ];
  return posts.map((p, i) =>
    makeEnvelope(
      `asset-gbp-${String(i + 1).padStart(3, "0")}`,
      "gbp_post",
      ctx,
      runId,
      generatedAt,
      {
        postText: p.text,
        postType: p.type,
        cta: p.cta,
        linkedUrl: ctx.hubUrl,
        status: "generated",
      },
    ),
  );
}

function generateRedditAssets(ctx: CampaignContentContext, runId: string, generatedAt: string): AssetEnvelope[] {
  const posts = [
    {
      title: `[Guide] What ${ctx.location} small businesses should check before buying web hosting`,
      body: `Disclosure: I work with local businesses on websites in South Yorkshire — sharing this as a checklist, not a sales pitch.\n\nBefore buying or renewing hosting, I ask owners to check:\n\n- Mobile load time on service pages (not just the homepage)\n- Test enquiry delivery on Wi‑Fi AND mobile data\n- Renewal price in year two vs intro offer\n- Whether backups are restorable (not just "included")\n- Support hours if the site goes down on a Monday morning\n\nWhat would you add for a small business with 5–15 pages and a contact form?`,
      linkedUrlOptional: undefined,
    },
    {
      title: `Anyone else seeing form spam drop after moving off cheap shared hosting? (${ctx.location} area)`,
      body: `We migrated a few ${ctx.location}-area clients to better hosting with proper SMTP and saw fewer ghost submissions and fewer silent form failures.\n\nCurious what others in South Yorkshire use for small business WordPress or static sites — managed hosting, VPS, or still on budget shared?`,
      linkedUrlOptional: undefined,
    },
    {
      title: `Hosting migration checklist for local service businesses — anything missing?`,
      body: `Disclosure: affiliated with a local web company in ${ctx.location}.\n\nOur pre-migration list:\n1. Export DNS + document TTL\n2. Stage SSL before cutover\n3. Test forms with real mobile data\n4. Keep URLs stable for indexed local pages\n5. Verify sitemap + internal links after go-live\n\nWhat problems have you hit that are not on this list?`,
      linkedUrlOptional: undefined,
    },
    {
      title: `Does hosting location still matter for UK local SEO in 2026?`,
      body: `Debate in our office: latency vs crawl efficiency vs Core Web Vitals.\n\nFor ${ctx.location} trades and professional services — has moving to UK-based hosting (or better caching) actually moved the needle, or was content/GBP work more important?\n\nGenuinely interested in real experiences, not vendor pitches.`,
      linkedUrlOptional: undefined,
    },
  ];
  return posts.map((p, i) =>
    makeEnvelope(
      `asset-reddit-${String(i + 1).padStart(3, "0")}`,
      "reddit_post",
      ctx,
      runId,
      generatedAt,
      {
        title: p.title,
        body: p.body,
        communitySafeTone: "Helpful, non-promotional, disclose affiliation in body when relevant",
        disclosureNote: `Author may be affiliated with ${ctx.businessProfile.businessName} (${ctx.location}). Links optional — prefer community discussion.`,
        linkedUrlOptional: p.linkedUrlOptional,
        status: "generated",
      },
    ),
  );
}

function generateYoutubeScriptAssets(ctx: CampaignContentContext, runId: string, generatedAt: string): AssetEnvelope[] {
  const loc = ctx.location;
  const scripts = [
    {
      title: `${ctx.service} for ${loc} Businesses — What to Check First`,
      hook: `If your website looks fine but enquiries are flat, your hosting might be failing silently — and most owners never think to check it.`,
      script: `[HOOK — 0:00]
If your website looks fine but enquiries are flat, your hosting might be failing silently. Today I will walk through what ${loc} business owners should check first — no jargon, no sales pitch.

[INTRO — 0:15]
Welcome. Whether you run a trade firm, a clinic or a local shop, hosting is the layer behind every page, form and landing page you publish. When it is weak, marketing spend leaks.

[SECTION 1: MOBILE SPEED — 0:45]
Open your main service page on mobile data — not office Wi‑Fi. If it takes more than three seconds to become usable, customers may leave before they read your offer. Check your hub page and at least one area page. Persistent slowness across both often points to server response time or plan limits.

[VISUAL: Screen recording of PageSpeed on mobile]

[SECTION 2: FORM DELIVERY — 2:00]
Submit a test enquiry. Did it arrive in inbox within a minute? Did the thank-you page load cleanly? Silent failures often trace to shared SMTP or server mail limits — not the form plugin itself.

[SECTION 3: SSL AND TRUST — 3:00]
Look for padlock warnings or mixed-content errors. Trust breaks in one second. Certificates should renew automatically.

[SECTION 4: ROOM TO GROW — 3:45]
Planning local landing pages or campaigns? Ask whether your plan handles traffic spikes without throttling. Growing businesses outgrow brochure hosting faster than they expect.

[OUTRO — 4:30]
Start with speed, forms and SSL this week. If two or more checks fail, review your hosting before your next campaign. Link in description for our ${loc} hosting hub.

[CTA]
Visit ${ctx.hubUrl} or book a quick hosting review.`,
      chapters: ["0:00 Hook", "0:45 Mobile speed", "2:00 Form delivery", "3:00 SSL trust", "3:45 Room to grow", "4:30 CTA"],
      cta: `Book a hosting review — ${ctx.hubUrl}`,
    },
    {
      title: `5 Hosting Mistakes ${loc} Businesses Make`,
      hook: `These five hosting mistakes cost local businesses enquiries every week — and most are avoidable.`,
      script: `[HOOK — 0:00]
These five hosting mistakes cost local businesses enquiries every week. If you recognise two or more, it is worth a review before you spend on ads or SEO.

[MISTAKE 1 — 0:20]
Choosing on intro price alone. Year-two renewal can double. Compare three-year total cost, not month one.

[MISTAKE 2 — 1:00]
Never testing backup restores. Backups that have never been recovered are a hope, not a plan.

[VISUAL: Backup restore checklist on screen]

[MISTAKE 3 — 1:45]
Updating plugins on live without staging. One bad update during business hours can take your enquiry form offline.

[MISTAKE 4 — 2:30]
Using shared SMTP for customer enquiries. Form submissions land in spam or vanish. Dedicated mail routing matters.

[MISTAKE 5 — 3:15]
No monitoring during campaigns. You only discover downtime when a customer tells you — or when spend stops converting.

[OUTRO — 4:00]
Fix the mistakes that affect enquiries first: forms, SSL and mobile speed. Checklist link in description.

[CTA]
${ctx.hubUrl}`,
      chapters: ["0:00 Hook", "0:20 Price trap", "1:00 Backups", "1:45 Staging", "2:30 Email delivery", "3:15 Monitoring", "4:00 CTA"],
      cta: `Free checklist — ${ctx.hubUrl}`,
    },
    {
      title: `UK Hosting vs Budget Hosting — Honest Comparison`,
      hook: `Budget hosting is not always wrong — but here is when it becomes more expensive than business hosting.`,
      script: `[HOOK — 0:00]
Budget hosting is not always wrong. For a one-page brochure with no forms, it may be fine. But for ${loc} service businesses with local pages and enquiry forms, here is when cheap plans become expensive.

[WHAT BUDGET GETS — 0:30]
Low monthly price, shared resources, basic panel. Fine for low traffic. Struggles with multiple landing pages, image-heavy hubs and concurrent form use.

[WHAT BUSINESS HOSTING ADDS — 1:30]
Better uptime expectations, UK-friendly support, tested backups, headroom for campaigns. You are paying for time not lost during outages.

[VISUAL: Side-by-side comparison table]

[TOTAL COST — 2:30]
Add renewal jumps, paid backup add-ons and your time fixing issues. A plan that saves eighty pounds a year but costs a day of downtime is poor value.

[WHEN TO SWITCH — 3:30]
Switch when you add local pages, rely on forms for leads, or see mobile speed failing on real devices — not when everything is already broken during peak season.

[OUTRO — 4:15]
Compare three-year cost, support and form reliability — not headline price alone.

[CTA]
${ctx.hubUrl}`,
      chapters: ["0:00 Hook", "0:30 Budget plans", "1:30 Business hosting", "2:30 Total cost", "3:30 When to switch", "4:15 CTA"],
      cta: `Compare options — ${ctx.hubUrl}`,
    },
    {
      title: `How Hosting Supports Local SEO in ${loc}`,
      hook: `Local SEO is not just maps and reviews — your server affects whether local pages rank and convert.`,
      script: `[HOOK — 0:00]
Local SEO is not just Google Business Profile and reviews. Hosting affects Core Web Vitals, HTTPS, crawl reliability and whether neighbourhood pages stay fast enough to convert.

[SPEED AND CRAWL — 0:40]
Search engines notice slow responses and errors. If bots timeout on area pages, those URLs may not recrawl often. Fix server response before publishing ten near-duplicate pages.

[VISUAL: Search Console crawl stats]

[HUB AND CLUSTER NETWORK — 1:45]
A ${loc} campaign links a service hub to area pages — Wickersley, Bramley, Maltby and others. Hosting must serve that network when traffic lands on any entry page, not only the homepage.

[CORE WEB VITALS — 2:45]
LCP, INP and CLS depend on server speed, images and scripts. Improve content all you want — slow TTFB caps results.

[TRACKING — 3:45]
Rankings without enquiries are vanity. Reliable hosting keeps forms posting and tracking scripts firing during paid campaigns.

[OUTRO — 4:30]
Align hosting stability with local page publishing — especially before scaling content.

[CTA]
${ctx.hubUrl}`,
      chapters: ["0:00 Hook", "0:40 Crawl health", "1:45 Page network", "2:45 Core Web Vitals", "3:45 Tracking", "4:30 CTA"],
      cta: `Local hosting + SEO — ${ctx.hubUrl}`,
    },
  ];
  return scripts.map((s, i) =>
    makeEnvelope(
      `asset-yt-script-${String(i + 1).padStart(3, "0")}`,
      "youtube_script",
      ctx,
      runId,
      generatedAt,
      {
        title: s.title,
        hook: s.hook,
        script: s.script,
        chapters: s.chapters,
        cta: s.cta,
        description: `${s.hook}\n\n${s.chapters.join("\n")}\n\n${ctx.businessProfile.businessName} — ${ctx.service} ${loc}.\n${ctx.hubUrl}`,
        tags: [
          "web hosting",
          loc.toLowerCase(),
          "local seo",
          "small business uk",
          i === 1 ? "hosting mistakes" : i === 2 ? "uk hosting comparison" : "business hosting",
        ],
        linkedUrl: ctx.hubUrl,
        status: "generated",
      },
    ),
  );
}

function generateYoutubeMetadataAssets(ctx: CampaignContentContext, runId: string, generatedAt: string): AssetEnvelope[] {
  const loc = ctx.location;
  const meta = [
    {
      title: `${ctx.service} ${loc} — What Local Businesses Should Check First`,
      description: `Is your website losing enquiries because of hosting? This guide covers mobile speed, form delivery, SSL trust and growth headroom for ${loc} businesses.\n\nChapters:\n0:00 Hook\n0:45 Mobile speed\n2:00 Form delivery\n3:00 SSL trust\n3:45 Room to grow\n4:30 Next steps\n\n${ctx.hubUrl}`,
      tags: ["web hosting rotherham", "business hosting uk", "website speed", "small business tips", loc.toLowerCase()],
    },
    {
      title: `5 Hosting Mistakes Costing ${loc} Businesses Enquiries`,
      description: `Avoid these five hosting mistakes: intro-price trap, untested backups, live plugin updates, shared SMTP and no campaign monitoring.\n\nChapters:\n0:00 Intro\n0:20 Price trap\n1:00 Backups\n1:45 Staging\n2:30 Email delivery\n3:15 Monitoring\n\n${ctx.hubUrl}`,
      tags: ["hosting mistakes", "web hosting tips", "small business uk", loc.toLowerCase(), "website forms"],
    },
    {
      title: `UK Hosting vs Cheap Hosting — Honest Guide for ${loc}`,
      description: `When budget hosting works, when it fails, and how to compare total cost for ${loc} service businesses with local landing pages and enquiry forms.\n\n${ctx.hubUrl}`,
      tags: ["uk web hosting", "shared hosting", "business hosting", loc.toLowerCase(), "hosting comparison"],
    },
    {
      title: `Hosting & Local SEO in ${loc} — How Infrastructure Affects Rankings`,
      description: `Core Web Vitals, HTTPS, crawl health and hub-and-cluster page networks — how hosting supports Local SEO for ${loc} businesses.\n\n${ctx.hubUrl}`,
      tags: ["local seo", "web hosting", "core web vitals", loc.toLowerCase(), "google business profile"],
    },
  ];
  return meta.map((m, i) =>
    makeEnvelope(
      `asset-yt-meta-${String(i + 1).padStart(3, "0")}`,
      "youtube_metadata",
      ctx,
      runId,
      generatedAt,
      {
        title: m.title,
        description: m.description,
        tags: m.tags,
        category: "Science & Technology",
        linkedUrl: ctx.hubUrl,
        status: "generated",
      },
      `asset-yt-script-${String(i + 1).padStart(3, "0")}`,
    ),
  );
}

function generateEmailSequenceAsset(ctx: CampaignContentContext, runId: string, generatedAt: string): AssetEnvelope {
  const loc = ctx.location;
  const emails = [
    {
      subject: `Is your ${loc} website costing you enquiries?`,
      preheader: `Three hosting issues we see on local business sites`,
      body: `Hi there,

Many ${loc} business owners tell us their website "looks fine" — but enquiries stay flat.

Often the cause is not design. It is infrastructure: pages that load slowly on mobile, contact forms that fail quietly, or SSL warnings that break trust in seconds.

Over the next few emails I will share practical checks you can run this week — and how hosting connects to the local pages that actually convert visitors into calls and form submissions.

No jargon, no pressure — just what we look for when reviewing a site before a campaign goes live.`,
      cta: "Read our hosting hub",
      linkedUrl: ctx.hubUrl,
    },
    {
      subject: `3 hosting checks you can do in 10 minutes`,
      preheader: `Mobile speed, form test, SSL — quick self-audit`,
      body: `Hi,

Here are three checks worth doing before your next marketing push:

1. Load your homepage and main service page on mobile data (not office Wi‑Fi). If either takes more than 3 seconds to become usable, visitors may leave first.

2. Submit a test enquiry. Confirm it arrives within a minute and the thank-you page loads cleanly.

3. Check SSL — padlock present, certificate current, no mixed-content warnings in the browser bar.

If any check fails, it is worth a deeper review before you spend on traffic. Fixing delivery problems first protects every pound you put into SEO or ads.`,
      cta: "Book a free hosting review",
      linkedUrl: ctx.hubUrl,
    },
    {
      subject: `How hosting supports your ${loc} local pages`,
      preheader: `Hub pages and area clusters need stable infrastructure`,
      body: `Hi,

Local campaigns work best as a network: a service hub, neighbourhood pages for areas you serve, and clear paths to enquire.

That structure only converts if hosting keeps every page fast and forms working when traffic arrives — including after promotions or seasonal peaks.

We help ${loc} businesses align hosting with local SEO, web design and email marketing so the whole stack supports enquiries rather than fighting itself.

If you are adding area pages or rebuilding your hub, it is the right moment to review infrastructure too.`,
      cta: "See web hosting services",
      linkedUrl: ctx.hubUrl,
    },
    {
      subject: `Ready for dependable ${ctx.service.toLowerCase()}?`,
      preheader: `Practical review — uptime, backups, SSL, forms`,
      body: `Hi,

If you would like a practical hosting review, we can look at uptime history, backup status, SSL configuration and form delivery — then explain options in plain language.

We work with ${loc} businesses that depend on their website for enquiries, not just online brochures. No hard sell: you will get a clear picture of what is working and what to fix first.

When you are ready, request a quote or book a short call — whichever suits you.`,
      cta: ctx.businessProfile.primaryCtaText ?? "Request a quote",
      linkedUrl: ctx.moneyPageUrl ?? ctx.hubUrl,
    },
  ];
  const payload: EmailSequencePayload & { emails: Array<(typeof emails)[0] & { preheader?: string }> } = {
    sequenceName: `${loc} ${ctx.service} nurture sequence`,
    emailCount: emails.length,
    emails,
    status: "generated",
  };
  return makeEnvelope(
    "asset-email-seq-001",
    "email_sequence",
    ctx,
    runId,
    generatedAt,
    payload as unknown as Record<string, unknown>,
  );
}

function summariseAssets(assets: AssetEnvelope[]): {
  byStatus: StatusCounts;
  byType: Partial<Record<AssetType, number>>;
} {
  const byStatus = emptyStatusCounts();
  const byType: Partial<Record<AssetType, number>> = {};
  for (const asset of assets) {
    byStatus[asset.status]++;
    byType[asset.assetType] = (byType[asset.assetType] ?? 0) + 1;
  }
  return { byStatus, byType };
}

export function generateCampaignContentAssets(opts: {
  projectSlug: string;
  campaignId: string;
  outputDir?: string;
}): GenerationResult {
  const outputDir = opts.outputDir ?? "output";
  const ctx = buildCampaignContentContext(opts);
  const runId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();

  const assets: AssetEnvelope[] = [
    ...generateBlogAssets(ctx, runId, generatedAt),
    ...generateFacebookAssets(ctx, runId, generatedAt),
    ...generateLinkedInAssets(ctx, runId, generatedAt),
    ...generateGbpAssets(ctx, runId, generatedAt),
    ...generateRedditAssets(ctx, runId, generatedAt),
    ...generateYoutubeScriptAssets(ctx, runId, generatedAt),
    ...generateYoutubeMetadataAssets(ctx, runId, generatedAt),
    generateEmailSequenceAsset(ctx, runId, generatedAt),
  ];

  const campaignDir = path.join(process.cwd(), outputDir, opts.projectSlug, "campaign-content", opts.campaignId);
  const assetsDir = path.join(campaignDir, "assets");
  fs.mkdirSync(assetsDir, { recursive: true });

  for (const asset of assets) {
    fs.writeFileSync(path.join(assetsDir, `${asset.assetId}.json`), JSON.stringify(asset, null, 2) + "\n");
  }

  const { byStatus, byType } = summariseAssets(assets);
  const manifest: CampaignContentManifest = {
    schemaVersion: "1.0",
    campaignId: opts.campaignId,
    projectSlug: opts.projectSlug,
    service: ctx.service,
    serviceKey: ctx.serviceKey,
    location: ctx.location,
    targetKeyword: ctx.targetKeyword,
    hubUrl: ctx.hubUrl,
    generatedAt,
    updatedAt: generatedAt,
    generationRunId: runId,
    sourcePages: ctx.clusterPages as SourcePageRef[],
    generationSettings: { ...DEFAULT_SETTINGS },
    assetIndex: assets.map((a) => a.assetId),
    summary: { total: assets.length, byStatus, byType },
  };

  const manifestPath = path.join(campaignDir, "campaignContent.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  return {
    manifestPath,
    assetsDir,
    manifest,
    assetCount: assets.length,
    byType,
  };
}
