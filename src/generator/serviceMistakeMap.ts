type MistakeItem = { mistake: string; impact: string };

type CommonMistakes = { items: MistakeItem[] };

type ServiceMistakeMap = Record<string, MistakeItem[]>;

const BASE_MAP: ServiceMistakeMap = {

  "web-design": [
    {
      mistake: "Outdated or dated design",
      impact: "An outdated design can damage trust within seconds. Visitors often judge whether a business feels professional before they read the full page, and a dated website can push potential enquiries toward competitors with a more polished online presence.",
    },
    {
      mistake: "Poor mobile experience",
      impact: "More than half of local searches happen on mobile devices. A site that is difficult to navigate on a phone will lose the majority of its visitors before they ever read a word about the service.",
    },
    {
      mistake: "Slow page loading",
      impact: "Pages that take more than three seconds to load see significant drop-off rates. Slow loading also directly harms search rankings, reducing the chances of appearing where local customers are looking.",
    },
    {
      mistake: "No clear calls to action",
      impact: "Visitors who cannot immediately see how to get in touch will leave without enquiring. Every page needs a prominent, specific CTA — vague prompts like 'learn more' do not convert.",
    },
    {
      mistake: "Weak trust signals",
      impact: "Without reviews, accreditations, testimonials or relevant examples, visitors have fewer reasons to trust the business over a competitor. Clear trust signals can be the difference between an enquiry and a lost visitor.",
    },
    {
      mistake: "Generic non-local content",
      impact: "Content that could belong to any business in any location performs poorly for local searches. Google and AI tools favour pages that demonstrate genuine local relevance and specificity.",
    },
    {
      mistake: "No Google Business Profile",
      impact: "Without a verified Google Business Profile, a business will not appear in map pack results — the most clicked section for local searches. This alone can eliminate a significant source of enquiries.",
    },
    {
      mistake: "Confusing navigation",
      impact: "If visitors cannot quickly find what they need, they leave. Poor navigation structure increases bounce rates and prevents the site from converting traffic into enquiries or calls.",
    },
  ],

  "local-seo": [
    {
      mistake: "Inconsistent business information",
      impact: "When a business name, address or phone number differs across directories and listings, Google loses confidence in the data and ranks the business lower. Consistent NAP information is a fundamental ranking signal.",
    },
    {
      mistake: "No verified Google Business Profile",
      impact: "Without a verified listing, a business cannot appear in the map pack — the most visible section of local search results. This is one of the most damaging oversights for any local service business.",
    },
    {
      mistake: "Targeting too many areas poorly",
      impact: "Trying to rank for every town and suburb with thin, generic pages dilutes authority. Focused, high-quality content for fewer areas consistently outperforms a scattergun approach.",
    },
    {
      mistake: "Ignoring customer reviews",
      impact: "Reviews are one of the strongest local ranking signals and the first thing customers read. Businesses that do not actively request and respond to reviews lose ground to competitors who do.",
    },
    {
      mistake: "Weak local content",
      impact: "Pages without location-specific references, local landmarks or area-relevant language fail to signal relevance to Google or to local customers who want to know you understand their area.",
    },
    {
      mistake: "No local link building",
      impact: "Links from local directories, trade associations and community websites pass authority directly to local rankings. Without them, even well-optimised pages struggle to compete in competitive areas.",
    },
    {
      mistake: "Ignoring map pack optimisation",
      impact: "The map pack drives a disproportionate share of local clicks. Businesses that do not optimise their Google Business Profile with photos, categories, posts and Q&A lose out on the most visible placement.",
    },
    {
      mistake: "No structured data or schema",
      impact: "Structured data helps Google and AI search tools understand exactly what the business is, where it operates and what it offers. Without it, pages are less likely to appear in rich results and AI-generated summaries.",
    },
  ],

  "seo": [
    {
      mistake: "Keyword stuffing",
      impact: "Overusing target keywords reads as unnatural to both visitors and search engines. Google penalises keyword stuffing and AI tools are trained to favour natural, authoritative writing over repetitive phrasing.",
    },
    {
      mistake: "Ignoring search intent",
      impact: "Writing for keywords without understanding what searchers actually want leads to high bounce rates. Pages that satisfy the real intent behind a query consistently outrank those that simply match the words.",
    },
    {
      mistake: "Thin or duplicate content",
      impact: "Pages with little unique value are filtered from results. Duplicate content across multiple pages confuses search engines and can result in none of the pages ranking well.",
    },
    {
      mistake: "Ignoring technical SEO",
      impact: "Broken links, slow load times, crawl errors and poor mobile performance directly suppress rankings regardless of how good the content is. Technical health is the foundation everything else is built on.",
    },
    {
      mistake: "No internal linking strategy",
      impact: "Without internal links, authority cannot flow between pages effectively. A clear internal linking structure helps search engines understand site hierarchy and improves the ranking potential of every page.",
    },
    {
      mistake: "Neglecting backlink quality",
      impact: "A handful of authoritative backlinks is worth far more than hundreds of low-quality ones. Pursuing irrelevant or spammy links can actively harm rankings and takes significant effort to recover from.",
    },
    {
      mistake: "Skipping meta descriptions",
      impact: "Meta descriptions do not directly affect ranking but strongly influence click-through rates. An unoptimised or missing description means Google will auto-generate one — often picking an unhelpful excerpt.",
    },
    {
      mistake: "No analytics or tracking",
      impact: "Without data on which pages, keywords and channels drive results, SEO decisions are guesswork. Proper tracking is essential to identify what is working and where to focus improvement efforts.",
    },
  ],

  "email-marketing": [
    {
      mistake: "Sending inconsistent campaigns",
      impact: "Businesses that email irregularly struggle to build engagement or stay front of mind. Consistency is what turns a list into a reliable source of repeat enquiries — sporadic sending undermines trust and open rates over time.",
    },
    {
      mistake: "Generic, untargeted content",
      impact: "Emails that feel broad or impersonal are ignored or unsubscribed from. Subscribers are far more likely to engage with campaigns that feel relevant to their interests, location and stage in the buying journey.",
    },
    {
      mistake: "Poor subject lines",
      impact: "The subject line determines whether an email gets opened or deleted. Vague, uninspiring or misleading subject lines significantly reduce open rates, limiting the reach of every campaign sent.",
    },
    {
      mistake: "No audience segmentation",
      impact: "Sending the same message to every subscriber treats all contacts as identical. Segmenting by purchase history, interest or location allows for targeted campaigns that generate significantly higher engagement and conversion rates.",
    },
    {
      mistake: "Over-emailing subscribers",
      impact: "Sending too frequently erodes trust and drives unsubscribes. Once a subscriber opts out, re-engagement is extremely difficult — getting the frequency right from the start protects the long-term value of the list.",
    },
    {
      mistake: "No mobile optimisation",
      impact: "The majority of emails are now opened on mobile devices. Campaigns not designed for smaller screens — with poor font sizes, broken layouts or tiny buttons — deliver a poor experience that reduces clicks and conversions.",
    },
    {
      mistake: "Weak calls to action",
      impact: "An email without a clear, compelling call to action rarely converts. The reader needs to know exactly what step to take next — vague or buried CTAs result in high open rates but poor conversion.",
    },
    {
      mistake: "Ignoring open and click data",
      impact: "Email analytics reveal exactly what is working and what is not. Businesses that do not review campaign performance miss the opportunity to improve subject lines, send times and content — repeating the same underperforming patterns indefinitely.",
    },
  ],

  "web-hosting": [
    {
      mistake: "Choosing the cheapest shared hosting",
      impact: "Low-cost shared hosting places hundreds of sites on the same server. Slow performance, frequent downtime and noisy-neighbour resource contention directly affect user experience and search rankings.",
    },
    {
      mistake: "No automated backups",
      impact: "Without regular automated backups, a server failure, malware attack or accidental deletion can cause permanent data loss. Recovering a site from scratch is expensive and disruptive — reliable backups make recovery fast.",
    },
    {
      mistake: "Ignoring server response time",
      impact: "A slow server adds latency to every page load regardless of how well-optimised the site is. Google uses server response time as a ranking signal — consistently slow hosting pulls rankings down over time.",
    },
    {
      mistake: "No SSL certificate",
      impact: "Sites without HTTPS are flagged as 'Not Secure' by browsers, which immediately undermines visitor trust. Google also uses HTTPS as a ranking factor, so unencrypted sites are disadvantaged in search results.",
    },
    {
      mistake: "No uptime monitoring",
      impact: "Without monitoring, a site can be down for hours before anyone notices. Downtime costs enquiries directly and, if it occurs frequently enough, starts to affect search rankings and crawlability.",
    },
    {
      mistake: "Outdated server software",
      impact: "Running on outdated PHP versions, server stacks or CMS installations leaves the site exposed to known security vulnerabilities. Attackers specifically target sites on outdated environments that have not been patched.",
    },
    {
      mistake: "No scalability plan",
      impact: "Hosting that cannot handle traffic spikes will crash under demand — exactly the wrong moment to become unavailable. A scalable hosting environment ensures the site stays available during high-traffic campaigns or seasonal peaks.",
    },
    {
      mistake: "Poor customer support access",
      impact: "When a site goes down, slow or unhelpful hosting support turns a minor issue into an extended outage. Around-the-clock support access is essential for any business that relies on its site for enquiries.",
    },
  ],

  "website-hosting": [], // alias resolved below

  "digital-marketing": [
    {
      mistake: "No clear strategy or goals",
      impact: "Running campaigns without defined objectives means it is impossible to measure success. A digital marketing strategy without clear goals wastes budget and produces results that are difficult to justify or improve.",
    },
    {
      mistake: "Spreading budget too thin",
      impact: "Trying to be active across every channel with a limited budget results in weak performance everywhere. Concentrating spend on the channels that reach the right audience produces far better returns.",
    },
    {
      mistake: "Ignoring the customer journey",
      impact: "Most customers do not buy on first contact. Campaigns that focus only on immediate conversion miss the majority of their audience. Nurturing content at every stage of the journey significantly improves overall conversion rates.",
    },
    {
      mistake: "No remarketing or retargeting",
      impact: "Visitors who leave without converting are already warm leads. Without remarketing campaigns, that audience is lost — retargeting brings them back at a fraction of the cost of acquiring a new visitor.",
    },
    {
      mistake: "Inconsistent brand messaging",
      impact: "Messaging that varies across channels confuses potential customers and dilutes brand recognition. A consistent voice, offer and visual identity across all touchpoints builds trust and familiarity far faster.",
    },
    {
      mistake: "Not tracking attribution properly",
      impact: "Without knowing which campaigns, channels or creatives are driving results, budget allocation is guesswork. Proper attribution tracking makes it possible to scale what works and cut what does not.",
    },
    {
      mistake: "Prioritising impressions over conversions",
      impact: "High impression counts look impressive but do not pay the bills. Campaigns should be optimised for meaningful actions — clicks, calls, form fills and purchases — not vanity metrics that do not drive revenue.",
    },
    {
      mistake: "Neglecting organic alongside paid",
      impact: "Over-reliance on paid traffic creates a business that stops growing the moment the budget stops. Combining paid and organic strategies builds sustainable visibility that continues to deliver results long-term.",
    },
  ],

  "ppc": [
    {
      mistake: "Bidding on broad, irrelevant keywords",
      impact: "Broad match keywords with no negative keyword lists waste large portions of ad spend on irrelevant clicks. Every irrelevant click is wasted budget that could have reached a customer who actually needs the service.",
    },
    {
      mistake: "No negative keyword list",
      impact: "Without negative keywords, ads appear for searches that will never convert — competitor names, unrelated services, and informational queries that are nowhere near purchase intent. Negative keyword management is essential from day one.",
    },
    {
      mistake: "Weak or generic ad copy",
      impact: "Ad copy that does not speak to the searcher's specific problem or location drives lower click-through rates and higher cost-per-click. Specific, compelling copy aligned to the search query dramatically improves performance.",
    },
    {
      mistake: "Sending all traffic to the homepage",
      impact: "A homepage is designed for general visitors, not people mid-search with a specific need. Dedicated landing pages tailored to each campaign consistently convert at a much higher rate than generic homepages.",
    },
    {
      mistake: "Ignoring quality score",
      impact: "Google rewards ads with high relevance scores with lower cost-per-click and better ad positions. Ignoring quality score means paying more for worse placement compared to better-optimised competitors.",
    },
    {
      mistake: "No conversion tracking",
      impact: "Without tracking which clicks lead to actual enquiries or sales, it is impossible to know if the campaign is profitable. Conversion tracking is the foundation of any data-driven PPC improvement.",
    },
    {
      mistake: "Setting and forgetting campaigns",
      impact: "PPC campaigns require regular review and adjustment. Bids, keywords, ad copy and landing pages all need ongoing optimisation — campaigns left unmanaged typically drift toward wasted spend and poor performance.",
    },
    {
      mistake: "Ignoring ad scheduling",
      impact: "Running ads at times when the target audience is unlikely to convert — late nights, weekends if the business is closed — wastes budget. Ad scheduling ensures spend is concentrated during the hours that actually generate enquiries.",
    },
  ],

  "social-media-marketing": [
    {
      mistake: "Posting without a content strategy",
      impact: "Random, sporadic posting produces inconsistent results and makes it difficult to build a following. A clear content calendar aligned to business goals produces far better engagement and reach.",
    },
    {
      mistake: "Using the wrong platforms",
      impact: "Different platforms attract different audiences. Investing time and budget in a platform where the target audience is not active wastes resources that would produce much better returns elsewhere.",
    },
    {
      mistake: "Ignoring engagement and replies",
      impact: "Social media is a two-way channel. Brands that post but do not respond to comments or messages appear distant and unresponsive — exactly the opposite of what builds trust and loyalty.",
    },
    {
      mistake: "Prioritising follower count over engagement",
      impact: "A large following with low engagement is a vanity metric. Algorithms reward posts that generate genuine interaction — a smaller, highly engaged audience consistently outperforms a large passive one.",
    },
    {
      mistake: "Inconsistent posting frequency",
      impact: "Platforms reward accounts that post consistently. Bursts of activity followed by silence cause algorithmic reach to drop, making it harder to get posts seen even by existing followers.",
    },
    {
      mistake: "No paid amplification",
      impact: "Organic reach on most platforms has declined significantly. Without occasional paid promotion to reach new audiences, growth from organic-only strategies is increasingly slow and difficult to sustain.",
    },
    {
      mistake: "Using only text-heavy posts",
      impact: "Visual content — images, short videos and reels — consistently outperforms text-heavy posts on every major platform. Brands that rely on text alone miss the formats that generate the highest organic reach.",
    },
    {
      mistake: "No measurement or reporting",
      impact: "Without tracking reach, engagement, clicks and conversions, there is no way to know what is working. Regular reporting allows the strategy to be refined based on actual performance rather than guesswork.",
    },
  ],
};

// Resolve alias
BASE_MAP["website-hosting"] = BASE_MAP["web-hosting"];

/**
 * Normalise a service name or industryType string to a canonical key
 * in BASE_MAP. Falls back to "web-design" for unrecognised digital services.
 */
function resolveServiceKey(
  industryType?: string,
  serviceName?: string
): string {
  const candidates = [industryType, serviceName]
    .filter(Boolean)
    .map((s) => s!.toLowerCase().trim().replace(/[\s_]+/g, "-"));

  for (const c of candidates) {
    if (BASE_MAP[c]) return c;
    // Partial matches (e.g. "email-marketing-sheffield" → "email-marketing")
    for (const key of Object.keys(BASE_MAP)) {
      if (c.includes(key) || key.includes(c)) return key;
    }
  }

  return "web-design"; // safe fallback for unknown digital services
}

/**
 * Return 8 service-specific mistakes for the given service, with optional
 * location injection where natural.
 *
 * Always returns exactly 8 items — falls back to the web-design map if
 * the resolved key has an empty list.
 */
export function getServiceMistakes(
  industryType: string | undefined,
  serviceName: string | undefined,
  location: string | undefined
): CommonMistakes {
  const key   = resolveServiceKey(industryType, serviceName);
  const items = BASE_MAP[key]?.length ? BASE_MAP[key] : BASE_MAP["web-design"];
  const loc   = (location ?? "").trim();

  // Inject location into 1–2 items where it feels natural (items 0 and 4)
  const enriched = items.map((item, i) => {
    if (!loc || (i !== 0 && i !== 4)) return item;
    const impact = item.impact.replace(
      /^([A-Z])/,
      loc ? `${loc} businesses that ${i === 0 ? "fall into this pattern often lose " : "overlook this miss "}` : "$1"
    );
    // Only use the replacement if it actually produced a useful sentence
    const useEnriched =
      loc.length > 0 &&
      !item.impact.toLowerCase().includes(loc.toLowerCase()) &&
      impact !== item.impact;
    return useEnriched ? { ...item, impact } : item;
  });

  return { items: enriched };
}
