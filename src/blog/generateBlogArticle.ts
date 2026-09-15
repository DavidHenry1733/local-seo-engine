import type { BlogBrief, BlogImage, BlogLink } from "./buildBlogBrief";

export interface BlogSection {
  heading: string;
  body: string[];
}

export interface BlogFaq {
  question: string;
  answer: string;
}

export interface BlogSocialDrafts {
  facebook: string;
  linkedin: string;
  x: string;
}

export interface BlogArticle {
  title: string;
  slug: string;
  h1: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  intro: string[];
  image?: BlogImage;
  sections: BlogSection[];
  localRelevance: BlogSection;
  faq: BlogFaq[];
  cta: {
    heading: string;
    body: string;
    buttonText: string;
    href: string;
  };
  internalLinkPlan: {
    parentHub: BlogLink;
    clusterLinks: BlogLink[];
    relatedServiceLinks: BlogLink[];
  };
  schema: Record<string, unknown>;
  aiSummary: string;
  gbpPostDraft: string;
  socialPostDrafts: BlogSocialDrafts;
  youtubeScriptDraft: string;
}

function cleanSentence(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function linkList(links: BlogLink[]): string {
  if (links.length === 0) return "the most relevant local service pages";
  if (links.length === 1) return links[0].label;
  return `${links.slice(0, -1).map((link) => link.label).join(", ")} and ${links[links.length - 1].label}`;
}

function buildSections(brief: BlogBrief): BlogSection[] {
  if (brief.serviceKey === "web-design") {
    return [
      {
        heading: "Start With Trust Before Design Details",
        body: [
          `A better website has to earn confidence before it can generate enquiries. For Sheffield businesses, that means showing clear services, credible proof, useful local context and an easy route to contact before visitors start comparing other nearby providers.`,
          `Strong visuals help, but trust usually comes from practical details: what you do, who you help, where you work, what makes you credible and what the visitor should do next. The parent ${brief.parentHub.label} page should act as the main service hub, while this article supports the same decision with a more educational angle.`,
        ],
      },
      {
        heading: "Make The Enquiry Path Obvious",
        body: [
          `A visitor should not have to hunt for the next step. Calls to action, quote prompts, phone links and contact forms need to appear where the reader has enough confidence to act, especially on service pages and mobile screens.`,
          `For a Sheffield service business, this is often the difference between a website that looks good and a website that creates opportunities. If someone arrives after searching for a local provider, the page should quickly answer whether the business serves them, whether it looks credible and how to start a conversation.`,
        ],
      },
      {
        heading: "What To Fix First",
        body: [
          `Start with the pages that influence enquiries most: the home page, core service pages, location pages and contact routes. Check whether the headline explains the offer, whether the proof is current and whether the page works smoothly on mobile.`,
          `Then look for friction. Common problems include unclear service wording, weak proof, slow loading, hidden contact options and pages that describe features without explaining why they matter to the customer. Fixing those issues usually creates more value than cosmetic changes alone.`,
        ],
      },
      {
        heading: "A Practical Website Checklist",
        body: [
          `Use this checklist before investing in a redesign: the website explains the service in plain language, loads well on mobile, includes trust signals, answers common buyer questions, links to relevant local pages and gives visitors more than one clear way to enquire.`,
          `The supporting pages matter too. Links to areas such as ${linkList(brief.clusterLinks.slice(0, 3))} help customers see local relevance, while related services such as ${linkList(brief.relatedServiceLinks)} can support the wider journey from first visit to qualified enquiry.`,
        ],
      },
      {
        heading: "How To Measure Whether It Is Working",
        body: [
          `A publishable website strategy should be judged by useful actions, not just appearance. Track form submissions, phone calls, click-throughs from service pages, mobile engagement and which pages assist enquiries.`,
          `That evidence helps decide what to improve next. If visitors read the page but do not act, the issue may be trust, CTA placement or unclear service value. If they leave quickly, mobile usability, page speed or headline clarity may need attention first.`,
        ],
      },
    ];
  }

  return [
    {
      heading: "Start With The Searches That Create Customers",
      body: [
        `Local SEO should start with the searches that can become calls, bookings, quote requests or visits. For Sheffield businesses, that usually means mapping priority services to the places customers actually search from, then making sure the website and Google Business Profile support the same message.`,
        `The ${brief.parentHub.label} hub should cover the main service offer. This article supports it by explaining how Google Business Profile visibility, local landing pages, reviews and tracking work together to build a stronger local customer pipeline.`,
      ],
    },
    {
      heading: "Strengthen Google Business Profile And Map Visibility",
      body: [
        `Google Business Profile is often the first place a local customer sees the business. Categories, services, photos, reviews, opening hours and service areas should all match the work the business wants to win.`,
        `Map visibility also depends on consistency. If the profile says one thing, citations say another and the website is vague about services or areas, customers and search engines get weaker signals. Clear alignment helps Sheffield customers compare nearby options with more confidence.`,
      ],
    },
    {
      heading: "What To Fix First",
      body: [
        `Start with the basics that affect trust and measurement: Google Business Profile categories, service descriptions, review responses, citation consistency, phone tracking, form tracking and clear links from local pages to the main service hub.`,
        `Then review whether the website has useful local landing pages for priority areas. Pages such as ${linkList(brief.clusterLinks.slice(0, 3))} should help real customers understand availability and relevance, not just repeat the same generic SEO text with a different place name.`,
      ],
    },
    {
      heading: "A Practical Local SEO Checklist",
      body: [
        `A useful checklist includes: Google Business Profile optimisation, service-area wording, review generation, citation cleanup, local landing pages, internal links, call tracking, form tracking and monthly review of which searches create qualified enquiries.`,
        `Reviews deserve special attention. Sheffield customers often compare several nearby businesses before making contact, and recent reviews can be the proof that moves someone from search result to phone call.`,
      ],
    },
    {
      heading: "How To Measure Whether It Is Working",
      body: [
        `Rankings matter, but they are not the whole story. Track calls, forms, direction requests, profile interactions, landing-page visits and the services that generate the best enquiries.`,
        `That data helps separate visibility from value. If map views rise but enquiries do not, the next fix may be reviews, offer clarity, photos, service wording or the conversion path from the website rather than more content volume.`,
      ],
    },
  ];
}

function buildFaq(brief: BlogBrief): BlogFaq[] {
  if (brief.serviceKey === "web-design") {
    return [
      {
        question: `What should a ${brief.city} business fix first on its website?`,
        answer: `Start with the pages and elements most likely to affect enquiries: the headline, service page clarity, mobile layout, trust signals, contact options and calls to action. These usually matter before visual polish.`,
      },
      {
        question: "How does web design support more enquiries?",
        answer: `It gives visitors the information and confidence they need to act. Clear service pages, proof, mobile usability and visible contact routes reduce hesitation and make the next step easier.`,
      },
      {
        question: "Why does local relevance matter on a website?",
        answer: `Local relevance helps visitors understand whether the business serves their area and understands their market. Linking to pages such as ${linkList(brief.clusterLinks.slice(0, 2))} also gives readers a clearer route to specific local information.`,
      },
    ];
  }

  return [
    {
      question: `What should a ${brief.city} business fix first for Local SEO?`,
      answer: `Start with Google Business Profile accuracy, service categories, reviews, citation consistency, service-area signals and tracking for calls and forms. These give the campaign a stronger base before adding more content.`,
    },
    {
      question: "How does Google Business Profile affect local enquiries?",
      answer: `It can influence whether customers call, request directions or compare another provider. Strong categories, services, reviews, photos and current information make the business easier to trust in map results.`,
    },
    {
      question: "Why are local landing pages useful?",
      answer: `Good local landing pages explain service relevance for specific areas and connect those pages back to the main service hub. They should help customers, not simply swap place names into repeated copy.`,
    },
  ];
}

function buildSchema(
  brief: BlogBrief,
  article: Omit<BlogArticle, "schema" | "gbpPostDraft" | "socialPostDrafts" | "youtubeScriptDraft">,
): Record<string, unknown> {
  const canonical = `https://local.inboxingproweb.com/blog/${article.slug}/`;
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: article.title,
    name: article.h1,
    description: article.metaDescription,
    url: canonical,
    mainEntityOfPage: canonical,
    about: brief.parentHub.label,
    articleSection: brief.serviceName,
    author: {
      "@type": "Organization",
      name: "InboxingProWeb",
    },
    publisher: {
      "@type": "Organization",
      name: "InboxingProWeb",
    },
  };
}

function buildGbpPost(
  brief: BlogBrief,
  article: Omit<BlogArticle, "schema" | "gbpPostDraft" | "socialPostDrafts" | "youtubeScriptDraft">,
): string {
  if (brief.serviceKey === "web-design") {
    return `Is your website helping Sheffield customers trust you and make contact?\n\nThis guide covers practical fixes for better enquiries: clearer service pages, stronger credibility signals, mobile usability and simpler contact paths.\n\nRead the guide: https://local.inboxingproweb.com/blog/${article.slug}/`;
  }

  return `Local SEO should turn Sheffield visibility into real customer opportunities.\n\nThis guide explains what to improve first: Google Business Profile, reviews, citations, service-area signals, local landing pages and call/form tracking.\n\nRead the guide: https://local.inboxingproweb.com/blog/${article.slug}/`;
}

function buildSocialDrafts(
  brief: BlogBrief,
  article: Omit<BlogArticle, "schema" | "gbpPostDraft" | "socialPostDrafts" | "youtubeScriptDraft">,
): BlogSocialDrafts {
  const url = `https://local.inboxingproweb.com/blog/${article.slug}/`;
  if (brief.serviceKey === "web-design") {
    return {
      facebook: `If your website looks fine but enquiries are slow, the issue may be clarity, trust or the route to contact.\n\nThis Sheffield guide covers what to fix first: service page wording, mobile usability, proof, calls to action and local links.\n\n${url}`,
      linkedin: `A website redesign should not start with colours and layouts alone. For Sheffield businesses, the stronger question is: does the site create trust and make the enquiry path obvious?\n\nThis guide looks at the practical fixes that improve website performance: clearer service pages, mobile usability, credibility signals, conversion paths and local relevance.\n\n${url}`,
      x: `Sheffield website not generating enough enquiries? Start with trust, mobile usability, service clarity and clear CTAs. ${url}`,
    };
  }

  return {
    facebook: `Want more local enquiries from Google without guessing what to fix next?\n\nThis Sheffield Local SEO guide covers Google Business Profile, reviews, citations, service-area signals, landing pages and tracking.\n\n${url}`,
    linkedin: `Local SEO works best when visibility is connected to measurable customer action.\n\nFor Sheffield businesses, that means aligning Google Business Profile, reviews, citations, local landing pages and call/form tracking around the services that matter most.\n\nThis guide breaks down what to fix first.\n\n${url}`,
    x: `Sheffield Local SEO checklist: GBP, reviews, citations, local pages, service-area signals and call/form tracking. ${url}`,
  };
}

function buildYoutubeScript(brief: BlogBrief, article: Omit<BlogArticle, "schema" | "gbpPostDraft" | "socialPostDrafts" | "youtubeScriptDraft">): string {
  if (brief.serviceKey === "web-design") {
    return `Title: ${article.title}

Hook:
If your website gets visitors but not enough enquiries, the problem may not be the design style. It may be trust, clarity or the path to contact.

3 key points:
1. Make the service offer clear on mobile and desktop.
2. Add credibility signals, local proof and simple contact routes.
3. Track calls and forms so you know which pages create opportunities.

CTA:
Read the full Sheffield guide at https://local.inboxingproweb.com/blog/${article.slug}/ or start with ${brief.parentHub.label}.`;
  }

  return `Title: ${article.title}

Hook:
If your business appears in local searches but enquiries are inconsistent, the next fix may be your Google Business Profile, reviews, local pages or tracking.

3 key points:
1. Make Google Business Profile accurate and service-specific.
2. Strengthen reviews, citations and service-area signals.
3. Track calls and forms so visibility turns into measurable opportunities.

CTA:
Read the full guide at https://local.inboxingproweb.com/blog/${article.slug}/ or start with ${brief.parentHub.label}.`;
}

export function generateBlogArticle(brief: BlogBrief): BlogArticle {
  const excerpt = brief.serviceKey === "web-design"
    ? `A practical guide to improving website trust, mobile usability, service clarity and enquiry paths for Sheffield businesses.`
    : `A practical guide to improving Google Business Profile visibility, local signals, reviews and tracked enquiries for Sheffield businesses.`;
  const sections = buildSections(brief);
  const faq = buildFaq(brief);
  const slug = brief.sourceSlug;
  const localRelevance: BlogSection = {
    heading: `Why this matters locally in ${brief.city}`,
    body: [
      brief.serviceKey === "web-design"
        ? `Customers in Sheffield often compare several nearby businesses before making contact. A website that clearly explains the service, shows credible proof and works well on mobile gives the business a better chance of turning that comparison into an enquiry.`
        : `Local search behaviour in Sheffield is practical: people compare map results, reviews, proximity, service pages and proof before they call. Local SEO should make those signals consistent so the business is easier to trust and easier to contact.`,
      `The article keeps the reader connected to the wider ecosystem by linking back to ${brief.parentHub.label}, useful local pages such as ${linkList(brief.clusterLinks.slice(0, 3))}, and related services where they support the same buying decision.`,
    ],
  };
  const intro = [
    brief.serviceKey === "web-design"
      ? `A website can look professional and still fail to create enough enquiries. For Sheffield businesses, the real test is whether the site builds trust quickly, explains the service clearly and gives visitors a simple route to make contact.`
      : `Local SEO is not just about appearing more often in search results. For Sheffield businesses, the goal is to turn local visibility into measurable calls, forms, bookings and better-fit customer opportunities.`,
    `This guide focuses on practical improvements to make first, then connects readers to the main ${brief.parentHub.label} hub and relevant local service pages for the next step.`,
  ];
  const articleWithoutSchema = {
    title: brief.title,
    slug,
    h1: brief.h1,
    metaTitle: brief.metaTitle,
    metaDescription: brief.metaDescription,
    excerpt,
    intro,
    image: brief.image,
    sections,
    localRelevance,
    faq,
    cta: {
      heading: brief.serviceKey === "web-design"
        ? `Turn your Sheffield website into a clearer enquiry path`
        : `Strengthen your Local SEO pipeline in Sheffield`,
      body: brief.serviceKey === "web-design"
        ? `Use the parent hub to review how your website can improve trust, service clarity, mobile usability and enquiry generation.`
        : `Use the parent hub to review how Google Business Profile, local landing pages, reviews and tracking can support better customer acquisition.`,
      buttonText: `View ${brief.parentHub.label}`,
      href: brief.parentHub.href,
    },
    internalLinkPlan: {
      parentHub: brief.parentHub,
      clusterLinks: brief.clusterLinks.slice(0, 4),
      relatedServiceLinks: brief.relatedServiceLinks.slice(0, 2),
    },
    aiSummary: `${brief.title}: ${excerpt} The article supports the ${brief.narrative.profile} narrative, links to ${brief.parentHub.label}, and gives readers practical next steps through ${linkList(brief.clusterLinks.slice(0, 3))}.`,
  };
  return {
    ...articleWithoutSchema,
    schema: buildSchema(brief, articleWithoutSchema),
    gbpPostDraft: buildGbpPost(brief, articleWithoutSchema),
    socialPostDrafts: buildSocialDrafts(brief, articleWithoutSchema),
    youtubeScriptDraft: buildYoutubeScript(brief, articleWithoutSchema),
  };
}
