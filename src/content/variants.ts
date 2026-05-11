import { ServiceKey } from "../generator/types";

export type AreaProfile = {
  character: string;
  knownFor: string;
  businessType: string;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

/**
 * Name-based hash so that section variants are distributed independently
 * of coreAreas order — two areas that share the same areaIndex % n will
 * still get different section combinations.
 */
function nameHash(name: string, salt: string): number {
  let h = 5381;
  for (const c of name + "|" + salt) {
    h = (((h << 5) + h) ^ c.charCodeAt(0)) & 0x7fffffff;
  }
  return h;
}

function pickByName<T>(arr: T[], name: string, salt: string): T {
  return arr[nameHash(name, salt) % arr.length];
}

// ── Intro variants (area pages) ──────────────────────────────────────────────

type IntroFn = (serviceLabel: string, location: string, primaryCity: string, profile?: AreaProfile) => string;

const areaIntroVariants: IntroFn[] = [
  // 0
  (serviceLabel, location, primaryCity) =>
    `If your business is based in ${location} and your website isn't generating consistent enquiries, the issue usually isn't the service you offer — it's how your business is presented online. A professional ${serviceLabel.toLowerCase()} solution builds immediate credibility, communicates your value clearly, and gives potential customers the confidence to get in touch. For ${location} businesses in the wider ${primaryCity} area, that difference can have a real and lasting impact on growth.`,

  // 1
  (serviceLabel, location, primaryCity) =>
    `For businesses in ${location}, a professionally built website is one of the most effective tools available for generating consistent local enquiries. Most potential customers search online before they make contact with anyone — and what they find in those first moments determines whether they reach out to you or move on to someone else. A well-built ${serviceLabel.toLowerCase()} solution puts your business in front of the right people at exactly the right moment, and keeps working for you every day without additional spend.`,

  // 2
  (serviceLabel, location, primaryCity) =>
    `In ${location}, the businesses that generate a steady flow of online enquiries are rarely those with the biggest marketing budgets — they are the ones with a website that has been built to work properly. Fast, mobile-friendly and structured for local search, a professional ${serviceLabel.toLowerCase()} solution does more than look good: it builds trust immediately, communicates your value clearly, and gives visitors a clear reason to choose you over anyone else in the ${primaryCity} area.`,

  // 3
  (serviceLabel, location, primaryCity) =>
    `Running a business in ${location} means competing for the attention of local customers who are searching online before they make contact with anyone. A professionally delivered ${serviceLabel.toLowerCase()} solution ensures your business is visible when those searches happen, credible when customers arrive on your site, and structured to turn visits into real enquiries. For businesses in the wider ${primaryCity} area, getting this foundation right is the difference between a website that works and one that simply exists.`,

  // 4
  (serviceLabel, location, primaryCity) =>
    `Most businesses in ${location} rely on reputation and referrals to grow — but increasingly, the first place a potential customer checks is your website. If what they find doesn't immediately build confidence, they will move on. A professional ${serviceLabel.toLowerCase()} solution gives your business the online presence it deserves: clear, credible and structured to bring in enquiries from customers across ${location} and the wider ${primaryCity} area who are actively looking for what you offer.`,
];

export function buildAreaIntroVariant(
  serviceLabel: string,
  location: string,
  primaryCity: string,
  areaIndex: number,
  profile?: AreaProfile
): string {
  const fn = pick(areaIntroVariants, areaIndex);
  return fn(serviceLabel, location, primaryCity, profile);
}

// ── Section body variants ────────────────────────────────────────────────────

type SectionBodyFn = (serviceLabel: string, location: string, profile?: AreaProfile) => string;

const overviewBodyVariants: SectionBodyFn[] = [
  // 0 — credibility + searchability angle
  (serviceLabel, location) =>
    `Having a professionally designed website in ${location} is one of the most impactful investments a local business can make. Most customers now look a business up online before they ever make contact — and what they find in those first few seconds shapes whether they stay or move on to a competitor. A well-structured, fast-loading and mobile-friendly website tells visitors that your business is credible, established and worth their time.\n\nBeyond first impressions, good web design directly affects how easily your website appears in local search results. Google rewards websites that are well-structured, load quickly and are clearly relevant to the search query. For businesses in ${location}, this means a professionally built website can improve your visibility in local searches, drive consistent organic traffic, and bring in more enquiries — without relying entirely on paid advertising. The combination of credibility and searchability is what makes professional web design such a strong long-term investment.`,

  // 1 — gap between good and bad websites
  (serviceLabel, location) =>
    `For local businesses in ${location}, the gap between a website that generates enquiries and one that doesn't is often less obvious than it appears. It is rarely about having the best-looking site on the internet. It is about having a site that loads quickly, presents your offer clearly, works properly on every device and gives search engines what they need to rank it for the right searches. When all of those elements work together, a website stops being a cost and becomes a consistent source of new business.\n\nFor businesses in ${location} competing with similar services across the wider area, this foundation matters. Customers searching locally make fast decisions based on what they see. A poorly performing website — one that loads slowly, looks dated or doesn't work well on mobile — loses those customers to a competitor before you even know they visited. A professionally built website closes that gap and keeps your business in the running.`,

  // 2 — consistent performance angle
  (serviceLabel, location) =>
    `The businesses in ${location} that consistently attract new customers online tend to share the same underlying asset: a website that has been built to perform — not just at launch, but month after month. Professional web design is not simply about aesthetics. It is about creating a platform that loads quickly, ranks in local searches, communicates clearly and gives visitors a reason to get in touch rather than leave.\n\nFor businesses in ${location}, this kind of consistent performance is achievable regardless of business size or sector. A professional ${serviceLabel.toLowerCase()} build ensures your website is technically sound, clearly structured and written with your local audience in mind. Once that foundation is in place, every other marketing effort — from social media to local advertising — lands on a platform that converts interest into enquiries.`,
];

const benefitsBodyVariants: SectionBodyFn[] = [
  // 0 — three areas: visibility, trust, conversion
  (serviceLabel, location) =>
    `Businesses in ${location} that invest in professional web design typically see improvements across three key areas. First, visibility — a well-built website is structured to be found in local search results, giving you a consistent presence when potential customers search for services in your area. Without this foundation, even excellent businesses can be invisible online.\n\nSecond, trust — a professional, modern design tells visitors that your business takes itself seriously. This directly influences whether someone makes an enquiry or looks elsewhere. Customers make split-second judgements based on what they see, and a well-designed site reassures them that you are the right choice. Third, conversion — a good website guides visitors towards taking action through clear messaging, logical layout and strong calls to action. For businesses in ${location} looking to grow, these three factors form the foundation of a website that genuinely works for you every day.`,

  // 1 — customer decision-making angle
  (serviceLabel, location) =>
    `The return on professional web design for businesses in ${location} is most visible in three areas that directly affect growth. Visibility comes first: a well-structured website built around local search signals gives your business a consistent presence for customers searching in the area. This is not paid traffic — it is earned visibility that compounds over time and doesn't disappear when a budget runs out.\n\nFrom there, trust plays a critical role. A professionally designed website immediately communicates that your business is established, competent and serious. Visitors make this assessment in seconds, often before they have read a single word. Finally, the right design drives conversion — moving visitors from interest to action through clear layout, focused messaging and calls to action placed where they have the most impact. For businesses in ${location}, improving across all three of these areas is what turns a website from a passive presence into an active growth tool.`,

  // 2 — competitive differentiation angle
  (serviceLabel, location) =>
    `When a business in ${location} invests in professional web design, the impact is felt across several areas that are easy to measure. The most immediate is competitive differentiation: in any local market, the businesses with a clearly superior online presence capture a disproportionate share of online enquiries. A website that looks credible and loads quickly will consistently outperform one that doesn't, regardless of which business has the better underlying service.\n\nLonger term, the benefits compound. A well-built website improves in search rankings as it ages, builds authority through consistent content, and becomes an increasingly effective platform for every other form of marketing. For businesses in ${location} looking to grow without an ever-increasing advertising spend, this compounding effect is one of the strongest arguments for investing in professional web design as early as possible.`,
];

const localRelevanceBodyVariants: SectionBodyFn[] = [
  // 0 — local audience, local signals
  (serviceLabel, location) =>
    `Web design for businesses in ${location} works best when it speaks directly to a local audience. Customers searching online in the area are looking for a service they can trust, delivered by someone who understands their local market. A page that clearly signals local relevance — through its content, structure and focus — is far more likely to hold attention and generate an enquiry than a generic website that could belong to any business anywhere.\n\n${location} businesses operate in a competitive environment alongside businesses from nearby areas across the region. Whether you are a trades business, a professional service provider or a local retailer, the way your website communicates locally makes a real difference. Pages structured around the areas you serve, addressing the kinds of questions local customers actually ask, and clearly aligned with the ${location} community are consistently stronger performers. This is why locally relevant web design matters — it is not just about looking good, it is about being found and trusted by the right people.`,

  // 1 — area character angle (uses profile if available)
  (serviceLabel, location, profile) => {
    const characterLine = profile
      ? `In ${location} — ${profile.character} known for ${profile.knownFor} — customers searching online have specific expectations of the businesses they contact.`
      : `In ${location}, customers searching for local services have specific expectations of the businesses they contact.`;
    return `${characterLine} They want to see a business that looks the part, communicates clearly and gives them confidence before they pick up the phone or send an enquiry. A website that achieves this isn't just a marketing asset — it is a direct driver of new business from the local area.\n\nFor ${profile?.businessType ?? "local businesses"} in ${location}, this means building a web presence that reflects the local market: structured for the searches customers in this area actually make, written in a way that speaks to their specific concerns, and designed to convert a local visitor into a real enquiry. Generic, unfocused web design misses this opportunity. Web design built with ${location} in mind captures it consistently.`;
  },

  // 2 — competition from outside the area
  (serviceLabel, location) =>
    `Businesses in ${location} face a challenge that is easy to underestimate: competition doesn't just come from within the area. Regional and national service providers with large marketing budgets and well-optimised websites compete for the same local customers. A professionally built website levels that playing field by ensuring your business appears in local searches with the same credibility and presence as much larger organisations.\n\nLocal relevance built into the structure of a website — through targeted content, location-specific pages and signals that search engines understand — gives ${location} businesses a genuine advantage in their own backyard. Customers searching for services in the area are far more likely to choose a business that clearly serves the local community than one that appears generic or geographically vague. Web design built with local relevance at its core ensures your business captures that preference consistently.`,
];

const processBodyVariants: SectionBodyFn[] = [
  // 0 — discovery to launch
  (serviceLabel, location) =>
    `Every website we build starts with a structured discovery process. We begin by understanding your business, your service offer, your target customers and what you need the website to achieve. From there we define the structure — what pages are needed, how they connect and what each one must do to move a visitor closer to making an enquiry.\n\nDesign is developed with two priorities in mind: credibility and conversion. We want visitors to trust what they see immediately, and we want the layout to guide them naturally towards taking action. Content is written to be clear, relevant and structured for both search engines and real readers. Build and launch follow a structured process with quality checks at every stage — we test across devices, check load performance and verify all technical elements before anything goes live. After launch, the site is built to be maintained and built upon over time, giving your ${location} business a platform that keeps working as you grow.`,

  // 1 — principles-first angle
  (serviceLabel, location) =>
    `The process we follow with every website project is built around two principles: clarity of purpose and attention at every stage. Before any design work begins, we establish a clear picture of what the website must achieve — who it needs to reach, what it needs to communicate and how it should move visitors towards making an enquiry. This clarity shapes every subsequent decision.\n\nDesign follows structure, and structure follows strategy. Once we understand what each page must do, we design it to do exactly that — no unnecessary complexity, no features included for their own sake. Content is developed to serve both the reader and the search engine, balancing clear communication with the signals needed for local visibility. Build, test and launch follow a rigorous checklist, and the final handover includes everything your ${location} business needs to maintain, update and build on the site over time.`,

  // 2 — output-first angle
  (serviceLabel, location) =>
    `Before a single design is produced, we define what a successful outcome looks like for your ${location} business. That means understanding the type of customers you want to attract, the service enquiries you most want to generate and the impression you need to make in the first few seconds of a visit. Everything that follows — structure, design, content and build — is shaped by those answers.\n\nWe work in clear stages with defined milestones at each point, so you always know where the project stands and what comes next. Design is reviewed and refined before build begins. Content is developed alongside design rather than bolted on afterwards. Testing happens throughout — on real devices, across different browsers and against the performance benchmarks that matter for local search visibility in ${location}. The result is a website that is ready to generate enquiries from the moment it goes live.`,
];

export function buildSectionBodyVariant(
  sectionId: "overview" | "benefits" | "local-relevance" | "process",
  serviceLabel: string,
  location: string,
  areaIndex: number,
  profile?: AreaProfile
): string {
  // Local-relevance: if a profile exists, always use the profile-injection variant
  // (variant index 1). This guarantees area-specific content in this section
  // regardless of hash collisions, since each area's profile is unique.
  if (sectionId === "local-relevance" && profile) {
    return localRelevanceBodyVariants[1](serviceLabel, location, profile);
  }

  let variants: SectionBodyFn[];
  if (sectionId === "overview") variants = overviewBodyVariants;
  else if (sectionId === "benefits") variants = benefitsBodyVariants;
  else if (sectionId === "local-relevance") variants = localRelevanceBodyVariants;
  else variants = processBodyVariants;

  // Use name-based hash so areas that share the same (areaIndex % n)
  // still get independent section variant choices across sections.
  const fn = pickByName(variants, location, sectionId);
  return fn(serviceLabel, location, profile);
}

// ── FAQ pool ─────────────────────────────────────────────────────────────────

type FaqEntry = (serviceLabel: string, location: string) => { question: string; answer: string };

const webDesignFaqPool: FaqEntry[] = [
  // 0 — cost (location-specific)
  (serviceLabel, location) => ({
    question: `How much does professional web design cost in ${location}?`,
    answer: `The cost of web design in ${location} depends on the scope of the project — the number of pages, the level of custom design, the functionality required and whether you need additional services such as copywriting, SEO or ongoing maintenance. Most professional web design projects are priced based on what the business actually needs, so the best approach is to request a clear quote based on your specific requirements rather than comparing headline prices.`,
  }),

  // 1 — timescales (generic)
  () => ({
    question: `How long does a web design project take to complete?`,
    answer: `Timescales vary depending on project complexity, but a straightforward business website can typically be planned, designed, built and launched within a few weeks when both parties are responsive and organised. Larger or more complex projects take longer. What makes the biggest difference to timescale is having clear content, a defined scope and prompt feedback at each stage. A structured process helps avoid the delays that most web design projects encounter.`,
  }),

  // 2 — enquiries (location-specific)
  (serviceLabel, location) => ({
    question: `Will a new website help my ${location} business get more enquiries?`,
    answer: `Yes — provided the website is well-structured, clearly communicates your offer and is built with conversion in mind. A professionally designed website that loads quickly, works on mobile and is optimised for local search can make a significant difference to the number of enquiries a business receives online. Simply having a website is not enough; it needs to be built to a standard that supports both discoverability and trust.`,
  }),

  // 3 — content help (generic)
  (serviceLabel, location) => ({
    question: `Can you help with content as well as design?`,
    answer: `Yes. Many businesses find the content side of a website project the most time-consuming part. We can work with you to develop clear, well-structured page content that communicates your service effectively, supports search visibility and is written for the kind of customers you are trying to attract in ${location}. Good content and good design work together — one without the other rarely delivers the best results.`,
  }),

  // 4 — choosing an agency (location-specific)
  (serviceLabel, location) => ({
    question: `What should I look for when choosing a web design agency in ${location}?`,
    answer: `The most important factors are a clear process, demonstrable results and honest communication. Look for an agency that asks the right questions before quoting — understanding your business, your customers and what you need the site to achieve. Be cautious of vague proposals or those focused entirely on aesthetics without discussing performance, local search visibility and conversion. A good web design partner in ${location} treats your website as a business tool, not just a design exercise.`,
  }),

  // 5 — content ready (generic)
  () => ({
    question: `Do I need to have all my content ready before work can start?`,
    answer: `Not necessarily. While having content ready speeds the process up, most businesses don't have everything prepared at the start of a project, and that is entirely normal. We can work with placeholder structure initially and fill in content as it is developed. For businesses that need help with content, we can assist with copywriting — developing page text that is clear, well-structured and written for both real readers and search visibility. The important thing is to have a clear idea of your service offer and your target customers.`,
  }),

  // 6 — mobile performance (location-specific)
  (serviceLabel, location) => ({
    question: `How important is mobile performance for a website targeting customers in ${location}?`,
    answer: `Extremely important. The majority of local searches — particularly for trades, professional services and local retailers in ${location} — now happen on mobile devices. A website that performs poorly on mobile loses a significant share of potential enquiries before the visitor has even read your content. Google also uses mobile performance as a ranking factor, meaning a slow or poorly formatted mobile experience affects your visibility in local search results as well as the experience of visitors who do arrive. Mobile performance is not optional; it is a baseline requirement.`,
  }),
];

const localSeoFaqPool: FaqEntry[] = [
  () => ({
    question: `How long does Local SEO take to show results?`,
    answer: `Local SEO is a medium-term investment. Most businesses start to see measurable improvements in local search visibility within two to four months of implementing a structured strategy, though this depends on the competitiveness of the market, the current state of the website and how consistently the strategy is executed. Results compound over time — the longer a well-managed local SEO strategy is in place, the stronger and more stable the visibility becomes.`,
  }),
  () => ({
    question: `Do I need a Google Business Profile for Local SEO to work?`,
    answer: `A Google Business Profile is one of the most important elements of any local SEO strategy. It is what powers your appearance in Google Maps results and the local pack — the three-business listing that appears prominently in local search results. Without a well-optimised profile, your business is significantly less visible in local searches. Setting up and maintaining a strong Google Business Profile is typically one of the first and most impactful steps in any local SEO programme.`,
  }),
  (s, location) => ({
    question: `Can Local SEO work alongside paid advertising in ${location}?`,
    answer: `Yes — and combining both is often the most effective approach, particularly for businesses that need enquiries quickly while their organic visibility builds. Paid advertising delivers immediate visibility at a cost, while local SEO builds a free, sustained presence over time. Many businesses use paid advertising to generate leads in the short term and invest in local SEO to reduce their long-term dependence on paid traffic. The two strategies complement each other well when managed together.`,
  }),
  (s, location) => ({
    question: `What makes local SEO different from general SEO?`,
    answer: `General SEO focuses on improving search visibility across broad topics and audiences, while local SEO is specifically focused on improving visibility for geographically relevant searches — people in or near ${location} looking for services you offer. Local SEO involves different signals, including Google Business Profile management, local citations, location-specific content and proximity-based ranking factors. For businesses that serve a specific geographic area, local SEO is almost always the more relevant and cost-effective strategy.`,
  }),
];

export function buildFaqVariant(
  serviceLabel: string,
  location: string,
  serviceKey: ServiceKey,
  areaIndex: number
): Array<{ question: string; answer: string }> {
  if (serviceKey === "web_design") {
    const pool = webDesignFaqPool;
    const start = (areaIndex * 2) % pool.length;
    const selected: typeof pool = [];
    for (let i = 0; i < 4; i++) {
      selected.push(pool[(start + i) % pool.length]);
    }
    return selected.map((fn) => fn(serviceLabel, location));
  }

  if (serviceKey === "local_seo") {
    return localSeoFaqPool.map((fn) => fn(serviceLabel, location));
  }

  // website_hosting fallback — single set, no rotation needed
  return [
    {
      question: `What is included in a managed hosting plan?`,
      answer: `A managed hosting plan typically includes server setup and configuration, security monitoring and updates, regular software maintenance, uptime monitoring and technical support when issues arise. The exact inclusions vary depending on the plan, but the core principle is that the technical management of the hosting environment is handled for you, so you can focus on running your business rather than maintaining infrastructure.`,
    },
    {
      question: `How does hosting affect my website's search ranking in ${location}?`,
      answer: `Hosting directly affects two factors that search engines use when ranking websites: page speed and uptime. A slow website loads poorly for users and is penalised in search rankings. A website that experiences frequent downtime is less reliable in the eyes of both search engines and visitors. Choosing fast, reliable hosting is a foundational requirement for any business that wants to perform well in local search results.`,
    },
    {
      question: `Can you migrate my existing website to new hosting?`,
      answer: `Yes. Website migrations require careful handling to ensure that no content, functionality or search equity is lost in the process. We manage the full migration process, including pre-migration testing, data transfer, DNS updates and post-migration checks to confirm everything is working correctly. Most migrations can be completed with minimal or no downtime when planned properly.`,
    },
  ];
}

// ── CTA body variants ────────────────────────────────────────────────────────

type CtaFn = (serviceLabel: string, location: string) => string;

const ctaBodyVariants: CtaFn[] = [
  // 0
  (serviceLabel, location) =>
    `If your current online presence isn't delivering the results your business deserves, a professionally delivered ${serviceLabel.toLowerCase()} solution in ${location} can change that. Whether you are starting from scratch or looking to improve what you already have, the right foundation makes everything else more effective — more visibility, more trust and more enquiries from customers who are actively looking for what you offer. This is a practical investment with a real return, and the sooner it is in place, the sooner it starts working for you.`,

  // 1
  (serviceLabel, location) =>
    `For businesses in ${location} that are ready to treat their website as a growth asset rather than a static page, the difference a well-built ${serviceLabel.toLowerCase()} solution makes is both immediate and compounding. Immediate, because a better website starts generating more qualified enquiries from day one. Compounding, because a well-structured site builds search authority over time, reducing dependence on paid traffic and delivering increasing returns with every passing month.`,

  // 2
  (serviceLabel, location) =>
    `Whether you are launching a new business in ${location} or replacing a website that has stopped performing, getting the foundation right from the start saves time and cost later. A professionally delivered ${serviceLabel.toLowerCase()} solution built for your specific market gives you a platform that generates enquiries consistently, builds credibility with every visitor and positions your business ahead of competitors who are settling for less. When you're ready to move forward, we're ready to start.`,
];

export function buildCtaBodyVariant(
  serviceLabel: string,
  location: string,
  areaIndex: number
): string {
  return pick(ctaBodyVariants, areaIndex)(serviceLabel, location);
}
