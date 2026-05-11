import { PagePlanItem, PagePayload, ProjectConfig, ServiceKey, AreaConfig, AreaCoverage, InternalLink } from "./types";
import { buildImageAssignments } from "../assets/buildImageAssignments";
import { buildMeta } from "../seo/buildMeta";
import { buildSchema } from "../seo/buildSchema";
import { buildInternalLinks } from "../seo/buildInternalLinks";
import { buildMapEmbed } from "../seo/buildMapEmbed";
import {
  buildAreaIntroVariant,
  buildSectionBodyVariant,
  buildFaqVariant,
  buildCtaBodyVariant,
  AreaProfile,
} from "../content/variants";

// ── Helpers ──────────────────────────────────────────────────────────────────

function areaIndex(location: string, areaConfig?: AreaConfig): number {
  if (!areaConfig) return 0;
  const idx = areaConfig.coreAreas.indexOf(location);
  return idx >= 0 ? idx : 0;
}

function areaProfile(location: string, areaConfig?: AreaConfig): AreaProfile | undefined {
  return areaConfig?.areaProfiles?.[location];
}

// ── Intro builders ────────────────────────────────────────────────────────────

function buildHubIntro(serviceLabel: string, location: string, areaNames: string[]): string {
  const topAreas = areaNames.slice(0, 4).join(", ");
  return `We work with businesses across ${location} and the surrounding area — from the city centre to ${topAreas} and beyond. A professionally designed website is one of the most effective tools a local business has for generating consistent enquiries, and we build every site with that goal at its core. Fast-loading, mobile-friendly and structured to rank in local search results, every website we deliver is built to work for your business every day — not just to look good at launch.`;
}

function buildStandaloneIntro(serviceLabel: string, location: string): string {
  return `If your business is based in ${location} and your website isn't generating consistent enquiries, the issue usually isn't the service you offer — it's how your business is presented online. A professional ${serviceLabel.toLowerCase()} solution builds immediate credibility, communicates your value clearly, and gives potential customers the confidence to get in touch. For businesses in ${location}, that difference can have a real and lasting impact on growth.`;
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildSections(
  serviceLabel: string,
  location: string,
  serviceKey: ServiceKey,
  isHub: boolean,
  areaIdx: number,
  profile?: AreaProfile,
  areaConfig?: import("./types").AreaConfig
) {
  if (serviceKey === "web_design") {
    const base = [
      {
        id: "overview",
        heading: `Professional ${serviceLabel} in ${location}`,
        body: buildSectionBodyVariant("overview", serviceLabel, location, areaIdx, profile),
      },
      {
        id: "benefits",
        heading: `Why businesses in ${location} invest in ${serviceLabel}`,
        body: buildSectionBodyVariant("benefits", serviceLabel, location, areaIdx, profile),
      },
      {
        id: "local-relevance",
        heading: `${serviceLabel} built for businesses in ${location}`,
        body: buildSectionBodyVariant("local-relevance", serviceLabel, location, areaIdx, profile),
      },
      {
        id: "process",
        heading: `Our web design process`,
        body: buildSectionBodyVariant("process", serviceLabel, location, areaIdx, profile),
      },
    ];

    if (isHub && areaConfig) {
      const topAreas = areaConfig.coreAreas.slice(0, 4).join(", ");
      base.push({
        id: "authority",
        heading: `${location} web design — the wider area`,
        body: `As a business serving the wider ${location} area, we understand that the communities across the region each have their own character and customer base. Businesses in ${topAreas} and the other areas surrounding ${location} all have distinct local audiences, and web design that speaks to those audiences performs significantly better than a one-size-fits-all approach.\n\nWe build and manage web design projects across the full ${location} catchment area — from the town centre to those operating in outlying communities. Every project follows the same structured approach: clear discovery, purposeful design, well-structured content and a build process focused on performance and longevity. Whether you are in the heart of ${location} or in one of the surrounding areas, the goal is the same — a website that generates consistent enquiries from the customers most likely to become clients.`,
      });
    }

    return base;
  }

  if (serviceKey === "local_seo") {
    return [
      {
        id: "overview",
        heading: `Local SEO for businesses in ${location}`,
        body: `Local SEO is the process of improving how your business appears in search results when customers in ${location} are looking for the services you offer. Unlike broad SEO strategies, local SEO focuses specifically on the searches that happen close to your business — searches with local intent, map searches and "near me" queries that have a high likelihood of converting into real enquiries.\n\nFor businesses in ${location}, strong local SEO means showing up consistently when it matters most. Whether a potential customer searches from their phone while out locally or from a desktop at home, a well-optimised local presence ensures your business is visible, credible and easy to contact. With more customers than ever using search to find local services before making a decision, investing in local SEO is one of the most practical and measurable ways to grow a local business online.`,
      },
      {
        id: "benefits",
        heading: `Why ${location} businesses invest in Local SEO`,
        body: `The benefits of Local SEO for businesses in ${location} are practical and measurable. The most immediate benefit is improved visibility — appearing consistently in local search results and on Google Maps means more people discover your business before they find a competitor. This visibility is not paid advertising; it is earned through a well-structured, well-optimised online presence that builds over time.\n\nTrust follows visibility. Businesses that appear prominently in local search results with positive reviews and complete profiles are perceived as more established and more credible. Customers are more likely to contact a business that looks settled and well-regarded online. Finally, there is the direct impact on enquiries — local SEO brings in customers who are actively searching for what you offer, in the area where you operate. These are high-intent visitors. Converting them into enquiries is significantly easier than converting cold traffic from broad advertising.`,
      },
      {
        id: "local-relevance",
        heading: `Local SEO tailored for ${location}`,
        body: `Effective local SEO in ${location} requires more than keyword placement. It requires a thorough understanding of how local customers search, what terms they use, which areas they search from and how Google's local algorithms interpret relevance and proximity. A local SEO strategy built specifically for ${location} takes all of this into account — from the structure of your website to the content on each page to the way your business is listed across the web.\n\nLocal citations, Google Business Profile optimisation, locally relevant content and technical on-page signals all work together to improve how your business ranks in ${location} searches. Businesses in surrounding areas are also competing for these same searches, which means a targeted, thorough approach matters more than a generic one. Pages and content that clearly address ${location} and nearby communities consistently outperform pages that take a broad, unfocused approach.`,
      },
      {
        id: "process",
        heading: `How we approach Local SEO`,
        body: `Our Local SEO process begins with a detailed audit of your current online presence. We review your website structure, existing content, local listings, Google Business Profile and any technical issues that may be holding back your rankings. This gives us a clear picture of where improvements will have the greatest impact.\n\nFrom there, we build a focused strategy that prioritises the changes most likely to improve your visibility in ${location} search results. This typically includes on-page optimisation, local content development, citation building and profile management. Implementation is structured and methodical — we track progress against clear benchmarks and adjust the strategy as search conditions change. Local SEO is not a one-time task; it is an ongoing process of improvement. We work with businesses in ${location} to build a consistent, growing presence that delivers more enquiries over time.`,
      },
    ];
  }

  // website_hosting fallback
  return [
    {
      id: "overview",
      heading: `Website Hosting for businesses in ${location}`,
      body: `Reliable website hosting is the foundation that every online business depends on. For businesses in ${location}, choosing a hosting solution that is fast, secure and consistently available is not a technical detail — it is a business requirement. Visitors who encounter slow-loading pages or downtime simply leave, and slow websites are penalised in search rankings, which affects how easily potential customers can find you.\n\nA properly configured hosting environment ensures your website loads quickly for visitors in ${location} and beyond, remains secure against common threats and stays online when you need it most. For growing businesses, the right hosting setup also provides the headroom to scale — handling increased traffic, supporting additional functionality and maintaining performance as your online presence develops.`,
    },
    {
      id: "benefits",
      heading: `Why ${location} businesses choose managed hosting`,
      body: `Managed hosting removes the technical burden of keeping a website running from business owners who have more pressing things to focus on. For businesses in ${location}, the key benefits are reliability, speed and security — three factors that directly affect both customer experience and search performance.\n\nA fast website reduces bounce rates and keeps visitors engaged long enough to find what they need and make an enquiry. A secure website protects your business and your customers, reducing the risk of data breaches, malware and downtime. A reliably available website means customers can reach you whenever they are ready to make contact. Together, these factors make managed hosting a practical investment that supports everything else your website is trying to achieve.`,
    },
    {
      id: "local-relevance",
      heading: `Hosting built around your business in ${location}`,
      body: `Website performance matters particularly for businesses targeting local customers in ${location}. Search engines assess page speed and reliability when determining local rankings, meaning a slow or unreliable website can undermine all other SEO efforts. Hosting that delivers consistent speed and uptime supports your visibility in local search results as well as the experience visitors have when they arrive.\n\nFor businesses in ${location} that rely on their website to generate enquiries, even short periods of downtime or poor performance can have a real impact on revenue. A properly managed hosting environment minimises these risks, keeping your website performing at its best and ensuring that the investment made in design and content continues to deliver results.`,
    },
    {
      id: "process",
      heading: `Our hosting setup and management process`,
      body: `Our hosting setup begins with understanding the requirements of your website — traffic levels, functionality, security needs and performance expectations. From there, we configure an environment that is appropriately sized and secured for your business, with monitoring in place to catch and address issues before they affect your visitors.\n\nMigrations from existing hosting are handled carefully, with thorough testing before and after to ensure nothing is lost or broken in the process. Ongoing management includes regular security checks, software updates, uptime monitoring and performance reviews. If something goes wrong, we address it promptly. For businesses in ${location}, this means peace of mind that your website is in capable hands and consistently available to the customers you are trying to reach.`,
    },
  ];
}

// ── Areas We Cover builder ────────────────────────────────────────────────────

function buildAreaCoverage(
  page: PagePlanItem,
  internalLinks: InternalLink[]
): AreaCoverage | undefined {
  if (!page.areaConfig) return undefined;

  const { primaryCity, priorityAreas } = page.areaConfig;

  if (page.pageRole === "hub") {
    const topAreas = priorityAreas.slice(0, 4).join(", ");
    return {
      heading: "Areas We Cover",
      body: `We provide ${page.serviceLabel.toLowerCase()} services across ${primaryCity} and all surrounding areas. Whether your business is based in the city centre or in communities like ${topAreas} and beyond, we work with local businesses to deliver websites that attract customers and generate consistent enquiries. Every area page below covers the specific needs of businesses in that community.`,
      links: internalLinks,
    };
  }

  const nearbyAreas = priorityAreas
    .filter((a) => a !== page.location)
    .slice(0, 3)
    .join(", ");

  return {
    heading: "Areas We Cover",
    body: `In addition to ${page.serviceLabel.toLowerCase()} in ${page.location}, we work with businesses across the wider ${primaryCity} area including ${nearbyAreas} and other surrounding communities. If you are based nearby, you can find out more about our services in your area below.`,
    links: internalLinks,
  };
}

// ── Main payload builder ──────────────────────────────────────────────────────

export function buildPagePayload(
  project: ProjectConfig,
  page: PagePlanItem,
  allPages: PagePlanItem[]
): PagePayload {
  const isHub   = page.pageRole === "hub";
  const h1      = `${page.serviceLabel} ${page.location}`;
  const meta    = buildMeta(project, page);
  const images  = buildImageAssignments(page.serviceKey);

  const internalLinks = buildInternalLinks(page, allPages, project);
  const mapEmbed      = buildMapEmbed(project.businessAddress);
  const schema        = buildSchema(project, page, meta);

  const idx     = areaIndex(page.location, page.areaConfig);
  const profile = areaProfile(page.location, page.areaConfig);

  const sections = buildSections(
    page.serviceLabel,
    page.location,
    page.serviceKey,
    isHub,
    idx,
    profile,
    page.areaConfig
  );

  const faq = buildFaqVariant(page.serviceLabel, page.location, page.serviceKey, idx);

  // Intro: hub gets stronger copy; area pages rotate through 5 variants; standalone is fixed
  let intro: string;
  if (isHub && page.areaConfig) {
    intro = buildHubIntro(page.serviceLabel, page.location, page.areaConfig.coreAreas);
  } else if (!isHub && page.areaConfig) {
    intro = buildAreaIntroVariant(
      page.serviceLabel,
      page.location,
      page.areaConfig.primaryCity,
      idx,
      profile
    );
  } else {
    intro = buildStandaloneIntro(page.serviceLabel, page.location);
  }

  const ctaBody = isHub
    ? `If your current online presence isn't delivering the results your business deserves, a professionally delivered ${page.serviceLabel.toLowerCase()} solution in ${page.location} can change that. Whether you are starting from scratch or looking to improve what you already have, the right foundation makes everything else more effective — more visibility, more trust and more enquiries from customers who are actively looking for what you offer. This is a practical investment with a real return, and the sooner it is in place, the sooner it starts working for you.`
    : buildCtaBodyVariant(page.serviceLabel, page.location, idx);

  const areaCoverage = buildAreaCoverage(page, internalLinks);

  return {
    title:           h1,
    metaTitle:       meta.metaTitle,
    metaDescription: meta.metaDescription,
    canonicalUrl:    meta.canonicalUrl,
    h1,
    intro,
    sections,
    faq,
    cta: {
      heading:    `Ready to improve your ${page.serviceLabel.toLowerCase()} in ${page.location}?`,
      body:       ctaBody,
      buttonText: project.primaryCtaText,
      buttonUrl:  project.primaryCtaUrl,
    },
    images,
    internalLinks,
    areaCoverage,
    mapEmbed,
    schema,
  };
}
