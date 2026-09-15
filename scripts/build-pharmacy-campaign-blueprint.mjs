#!/usr/bin/env node
/**
 * Phase 3 — Pharmacy Campaign Blueprint Generator
 * Combines business-intelligence.json + service-intelligence.json into campaign-ready blueprints.
 *
 * Usage:
 *   node scripts/build-pharmacy-campaign-blueprint.mjs
 *   node scripts/build-pharmacy-campaign-blueprint.mjs --service-key pharmacy-first --location Rotherham
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BI_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "business-intelligence.json");
const SI_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "service-intelligence.json");
const BLUEPRINT_DIR = path.join(ROOT, "output", "pharmacy-blueprint", "campaign-blueprints");
const REPORT_PATH = path.join(ROOT, "output", "pharmacy-blueprint", "pharmacy-campaign-blueprint-generator-report.json");

const DEFAULT_AREAS = [
  "Wickersley",
  "Rawmarsh",
  "Parkgate",
  "Maltby",
  "Dinnington",
  "Thurcroft",
  "Swallownest",
  "Aston",
  "Bramley",
  "Kimberworth",
];

const PHARMACY_FIRST_CONDITIONS = [
  "Earache",
  "Sore throat",
  "Urinary tract infection (UTI)",
  "Shingles",
  "Impetigo",
  "Insect bites and stings",
  "Sinusitis (where pathway applies)",
  "Infected insect bite",
];

const AREA_LOCAL_ANGLES = {
  Wickersley: "Serving Wickersley, Sunnyside and surrounding Rotherham suburbs with same-day minor illness access.",
  Rawmarsh: "Convenient Pharmacy First access for Rawmarsh, Parkgate corridor and Meadowhall-area residents.",
  Parkgate: "Local Pharmacy First support for Parkgate, Rawmarsh and Rotherham Valley communities.",
  Maltby: "Pharmacy First for Maltby, Tickhill Road corridor and eastern Rotherham families.",
  Dinnington: "Same-day NHS Pharmacy First for Dinnington, Anston and north Rotherham border communities.",
  Thurcroft: "Accessible minor illness care for Thurcroft, Laughton Common and nearby villages.",
  Swallownest: "Pharmacy First serving Swallownest, Aughton and south-east Rotherham neighbourhoods.",
  Aston: "Local pharmacist-led care for Aston, Swallownest and Crystal Peaks catchment.",
  Bramley: "Pharmacy First for Bramley, Ravenfield and communities between Rotherham and Maltby.",
  Kimberworth: "Serving Kimberworth, Greasbrough and north-west Rotherham with walk-in Pharmacy First.",
};

function parseArgs(argv) {
  const opts = {
    serviceKey: "pharmacy-first",
    serviceName: "Pharmacy First",
    location: "Rotherham",
    areas: [...DEFAULT_AREAS],
    pharmacyName: "{pharmacyName}",
    domain: "{domain}",
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--service-key" && argv[i + 1]) opts.serviceKey = argv[++i];
    else if (a === "--service-name" && argv[i + 1]) opts.serviceName = argv[++i];
    else if (a === "--location" && argv[i + 1]) opts.location = argv[++i];
    else if (a === "--areas" && argv[i + 1]) opts.areas = argv[++i].split(",").map((s) => s.trim());
    else if (a === "--pharmacy-name" && argv[i + 1]) opts.pharmacyName = argv[++i];
    else if (a === "--domain" && argv[i + 1]) opts.domain = argv[++i];
  }
  return opts;
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function areaSlug(area) {
  return slugify(area);
}

function loadJson(p) {
  if (!fs.existsSync(p)) throw new Error(`Missing required file: ${p}`);
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function resolveService(si, serviceKey, serviceName) {
  const byKey = si.services?.[serviceKey];
  if (byKey) return byKey;
  const entry = si.serviceIndex?.find(
    (s) => s.serviceKey === serviceKey || s.serviceName.toLowerCase() === serviceName.toLowerCase(),
  );
  if (entry && si.services[entry.serviceKey]) return si.services[entry.serviceKey];
  throw new Error(`Service not found: ${serviceKey} / ${serviceName}`);
}

function pick(arr, n) {
  return (arr ?? []).slice(0, n);
}

function localize(text, ctx) {
  return text
    .replace(/\{location\}/g, ctx.location)
    .replace(/\{area\}/g, ctx.area ?? ctx.location)
    .replace(/\[area\]/g, ctx.area ?? ctx.location)
    .replace(/\[town\]/g, ctx.location)
    .replace(/\{pharmacyName\}/g, ctx.pharmacyName)
    .replace(/\{domain\}/g, ctx.domain);
}

function buildCampaignIdentity(opts, serviceIntel) {
  const profile = serviceIntel.serviceProfile;
  const locSlug = slugify(opts.location);
  const campaignSlug = `${opts.serviceKey}-${locSlug}`;
  const primaryKeyword = `${profile.serviceName} ${opts.location}`;
  const secondaryKeywords = [
    `${profile.serviceName.toLowerCase()} ${opts.location}`,
    `pharmacy first near me ${opts.location}`,
    `NHS pharmacy first ${opts.location}`,
    ...pick(serviceIntel.localSearchIntent?.commercial ?? [], 4).map((k) => localize(k, opts)),
    ...pick(profile.customerIntent ?? [], 3).map((k) => `${k} ${opts.location}`),
  ];

  return {
    campaignName: `${profile.serviceName} — ${opts.location}`,
    campaignSlug,
    campaignId: campaignSlug,
    serviceName: profile.serviceName,
    serviceKey: profile.serviceKey,
    serviceCategory: profile.category,
    location: opts.location,
    locationSlug: locSlug,
    primaryKeyword,
    secondaryKeywords: [...new Set(secondaryKeywords)],
    customerIntent: profile.customerIntent ?? [],
    primaryAudience: profile.primaryAudience,
    secondaryAudience: profile.secondaryAudience ?? [],
    complianceLevel: profile.category === "nhs" ? "nhs-clinical-service" : profile.category === "private" ? "private-healthcare" : "standard-pharmacy",
    pharmacyName: opts.pharmacyName,
    domain: opts.domain,
  };
}

function buildHubBlueprint(identity, serviceIntel, bi, areas) {
  const sn = identity.serviceName;
  const loc = identity.location;
  const benefits = pick(serviceIntel.serviceBenefits, 8);
  const problems = pick(serviceIntel.problemsSolved, 8);
  const faqs = pick(serviceIntel.customerQuestions, 12).map((f) => ({
    id: f.id,
    question: f.question,
    answerHint: `Answer using NHS Pharmacy First eligibility, local access in ${loc}, and when to refer to GP/A&E. Do not guarantee outcomes.`,
  }));

  const trustFromBi = Object.values(bi.trustSignals ?? {}).flatMap((t) => t.indicators ?? []).slice(0, 6);
  const trustFromService = serviceIntel.trustSignals?.serviceSpecificTrustFactors ?? [];

  return {
    pageType: "service-hub",
    pageSlug: identity.campaignSlug,
    remotePath: `/${identity.campaignSlug}/`,
    urlPattern: `https://${identity.domain}/${identity.campaignSlug}/`,
    h1: `${sn} in ${loc}`,
    metaTitle: `${sn} ${loc} | Same-Day NHS Care | ${identity.pharmacyName}`,
    metaDescription: `Pharmacy First in ${loc} — NHS minor illness consultations for sore throat, UTI, earache and more. Walk in or book. Qualified pharmacists at ${identity.pharmacyName}.`,
    heroPositioning: `Get same-day NHS Pharmacy First care in ${loc} without waiting for a GP appointment. Our pharmacist team assesses common conditions, provides treatment where appropriate, and refers you safely when needed.`,
    keyBenefits: benefits,
    problemsSolved: problems,
    trustSignals: [...new Set([...trustFromService, ...trustFromBi])].slice(0, 10),
    serviceSections: [
      { id: "service-overview", title: "What is Pharmacy First?", purpose: "Explain NHS service scope and patient access" },
      { id: "conditions-covered", title: "Conditions We Can Help With", purpose: "List Pharmacy First clinical pathways", items: PHARMACY_FIRST_CONDITIONS },
      { id: "who-it-helps", title: "Who Pharmacy First Is For", purpose: "Primary and secondary audiences for Rotherham" },
      { id: "how-it-works", title: "How It Works", purpose: "Step-by-step: walk in, consultation, treatment, referral" },
      { id: "eligibility-cost", title: "Eligibility and Cost", purpose: "NHS free at point of use where eligible; private elements clarified" },
      { id: "why-choose-us", title: `Why Choose ${identity.pharmacyName}`, purpose: "Local trust, hours, consultation room, trained team" },
      { id: "areas-we-cover", title: "Areas We Cover", purpose: "Link to cluster pages for Rotherham neighbourhoods" },
      { id: "related-services", title: "Related Pharmacy Services", purpose: "Internal links to supporting NHS services" },
      { id: "faq", title: "Frequently Asked Questions", purpose: "FAQPage schema source" },
      { id: "book-cta", title: "Book or Visit Today", purpose: "Primary conversion section" },
    ],
    faqSet: faqs,
    ctaStrategy: {
      primary: { label: "Book Pharmacy First appointment", action: "book-consultation", placement: ["hero", "footer", "post-faq"] },
      secondary: { label: "Call the pharmacy", action: "phone", placement: ["header", "hero"] },
      tertiary: { label: "Walk in today", action: "visit", placement: ["hero", "how-it-works"] },
      messaging: "Emphasise same-day access, NHS eligibility, and pharmacist-led safety-netting — not GP replacement for all conditions.",
    },
    schemaRecommendations: [
      { type: "Pharmacy", reason: "Local business entity" },
      { type: "MedicalBusiness", reason: "Healthcare provider" },
      { type: "Service", reason: "Pharmacy First service offering" },
      { type: "FAQPage", reason: "FAQ section" },
      { type: "MedicalWebPage", reason: "Health content page" },
    ],
    internalLinkTargets: {
      clusters: areas.map((a) => ({
        area: a,
        pageSlug: `${identity.serviceKey}-${areaSlug(a)}`,
        anchorText: `Pharmacy First ${a}`,
      })),
      relatedServices: pick(serviceIntel.internalLinkingOpportunities?.relatedServices ?? [], 4),
      upsellServices: pick(serviceIntel.internalLinkingOpportunities?.upsellServices ?? [], 3),
      supportingServices: pick(serviceIntel.internalLinkingOpportunities?.supportingServices ?? [], 3),
    },
  };
}

function nearbyAreas(area, allAreas) {
  const idx = allAreas.indexOf(area);
  const out = [];
  if (idx > 0) out.push(allAreas[idx - 1]);
  if (idx >= 0 && idx < allAreas.length - 1) out.push(allAreas[idx + 1]);
  if (idx >= 0 && idx < allAreas.length - 2) out.push(allAreas[idx + 2]);
  return out.slice(0, 3);
}

function buildClusterBlueprints(identity, serviceIntel, areas) {
  const hubSlug = identity.campaignSlug;
  return areas.map((area) => {
    const slug = `${identity.serviceKey}-${areaSlug(area)}`;
    const keyword = `Pharmacy First ${area}`;
    const localAngle = AREA_LOCAL_ANGLES[area] ?? `Pharmacy First for ${area} and surrounding ${identity.location} communities.`;
    const faqVariants = [
      { question: `Is Pharmacy First available in ${area}?`, answerHint: `Confirm service at ${identity.pharmacyName} and travel from ${area}.` },
      { question: `Do I need a GP appointment before Pharmacy First in ${area}?`, answerHint: "Explain NHS walk-in eligibility; no GP referral required for eligible pathways." },
      { question: `Can I walk in for Pharmacy First near ${area}?`, answerHint: "Walk-in and booked appointments; advise checking opening hours." },
      { question: `What conditions can Pharmacy First treat for ${area} residents?`, answerHint: "List core pathways: sore throat, UTI, earache, shingles, impetigo, insect bites." },
      { question: `Is Pharmacy First free for patients in ${area}?`, answerHint: "NHS-funded where eligible; no charge at point of care for qualifying consultations." },
    ];

    return {
      area,
      pageSlug: slug,
      remotePath: `/${slug}/`,
      urlPattern: `https://${identity.domain}/${slug}/`,
      keyword,
      localKeyword: `${identity.serviceName.toLowerCase()} ${area}`,
      h1: `Pharmacy First ${area}`,
      metaTitle: `Pharmacy First ${area} | ${identity.location} | ${identity.pharmacyName}`,
      metaDescription: `NHS Pharmacy First for ${area} — same-day pharmacist consultations for minor illness. Serving ${area} and ${identity.location} from ${identity.pharmacyName}.`,
      localAngle,
      serviceRelevance: `Residents of ${area} benefit from local Pharmacy First access for common conditions without GP waits — especially useful for families, working adults and carers in the ${identity.location} area.`,
      localCta: {
        primary: `Book Pharmacy First — serving ${area}`,
        secondary: `Call us from ${area}`,
        walkIn: `Walk in from ${area} — check opening hours`,
      },
      faqVariants,
      internalLinks: {
        hub: { pageSlug: hubSlug, anchorText: `Pharmacy First ${identity.location}`, rel: "parent-hub" },
        nearbyAreas: nearbyAreas(area, areas).map((n) => ({
          area: n,
          pageSlug: `${identity.serviceKey}-${areaSlug(n)}`,
          anchorText: `Pharmacy First ${n}`,
        })),
        relatedServices: pick(serviceIntel.internalLinkingOpportunities?.relatedServices ?? [], 2).map((s) => ({
          serviceKey: s.serviceKey,
          anchorText: s.label,
          pageSlugPattern: `{${s.serviceKey}}-{locationSlug}`,
        })),
      },
    };
  });
}

function buildContentEngineBlueprint(identity, serviceIntel, bi) {
  const ctx = { location: identity.location, pharmacyName: identity.pharmacyName, domain: identity.domain };
  const topics = serviceIntel.contentTopics ?? {};
  return {
    campaignFocusKeyword: identity.primaryKeyword,
    linkedHubUrl: `https://${identity.domain}/${identity.campaignSlug}/`,
    assetPlan: {
      blogPosts: pick(topics.blog, 4).map((t, i) => ({
        id: `blog-${i + 1}`,
        topic: localize(t, ctx),
        angle: i === 0 ? "pillar-guide" : i === 1 ? "gp-vs-pharmacy" : i === 2 ? "patient-journey" : "local-rotherham",
        targetKeyword: i === 0 ? identity.primaryKeyword : `${identity.serviceName.toLowerCase()} ${identity.location}`,
      })),
      facebookPosts: pick(topics.facebook, 4).map((t, i) => ({
        id: `facebook-${i + 1}`,
        topic: localize(t, ctx),
        format: ["awareness", "faq", "walk-in-reminder", "community"][i],
      })),
      linkedinPosts: pick(topics.linkedin, 4).map((t, i) => ({
        id: `linkedin-${i + 1}`,
        topic: localize(t, ctx),
        format: ["thought-leadership", "workforce", "primary-care", "compliance"][i],
      })),
      gbpPosts: pick(topics.gbpPost, 4).map((t, i) => ({
        id: `gbp-${i + 1}`,
        topic: localize(t, ctx),
        ctaType: ["BOOK", "LEARN_MORE", "CALL", "BOOK"][i],
      })),
      redditPosts: [
        { id: "reddit-1", topic: `What to expect from Pharmacy First in ${identity.location} — patient perspective`, subredditHint: "CasualUK or local subreddit if appropriate" },
        { id: "reddit-2", topic: "When should you use Pharmacy First vs GP for a sore throat?", subredditHint: "AskUK" },
        { id: "reddit-3", topic: "Experiences with pharmacy UTI treatment without GP wait", subredditHint: "AskUK" },
        { id: "reddit-4", topic: `How community pharmacies in ${identity.location} are handling minor illness access`, subredditHint: "unitedkingdom" },
      ],
      youtubeTopics: pick(topics.youtube, 4).map((t, i) => ({
        id: `youtube-${i + 1}`,
        topic: localize(t, ctx),
        format: ["60s-explainer", "walkthrough", "faq-answers", "local-service"][i],
      })),
      emailSequence: {
        id: "email-sequence-1",
        sequenceName: `Pharmacy First — ${identity.location} patient nurture`,
        emailCount: 4,
        outline: [
          { email: 1, subject: `Introducing Pharmacy First at ${identity.pharmacyName}`, purpose: "Service awareness and eligibility", cta: "Learn about Pharmacy First" },
          { email: 2, subject: "When to visit us instead of waiting for your GP", purpose: "Conditions covered and safety-netting", cta: "See conditions we treat" },
          { email: 3, subject: "Book or walk in — Pharmacy First this week", purpose: "Conversion push with hours and booking link", cta: "Book appointment" },
          { email: 4, subject: "Your health questions answered", purpose: "FAQ recap and related services (NMS, BP checks)", cta: "Explore our services" },
        ],
      },
    },
    toneNotes: bi?.generationHints?.tone ?? serviceIntel.campaignInputs?.contentEngine?.toneNotes,
    forbiddenClaims: bi?.generationHints?.forbiddenClaims ?? [],
  };
}

function buildAiSearchBlueprint(identity, serviceIntel, areas) {
  const ai = serviceIntel.aiSearchTopics ?? {};
  const loc = identity.location;
  return {
    aiAnswerTopics: pick(ai.aiOverviewOpportunities ?? [], 6).map((t) => localize(t, { location: loc })),
    featuredSnippetTargets: (ai.featuredSnippetOpportunities ?? []).map((q) => ({
      query: q,
      answerFormat: "40–60 word direct answer + bullet list where appropriate",
      pageTarget: "hub",
    })),
    faqSchemaTargets: pick(serviceIntel.customerQuestions, 10).map((f) => ({
      question: f.question,
      schemaType: "FAQPage",
      pageTargets: ["hub", ...pick(areas, 2).map((a) => `${identity.serviceKey}-${areaSlug(a)}`)],
    })),
    speakableAnswerTargets: [
      {
        question: `What is Pharmacy First in ${loc}?`,
        speakableSummary: `${identity.pharmacyName} offers NHS Pharmacy First in ${loc}. Pharmacists assess and treat common minor illnesses such as sore throat, UTI and earache without a GP appointment where clinically appropriate.`,
        pageTarget: identity.campaignSlug,
      },
      {
        question: `Is Pharmacy First free in ${loc}?`,
        speakableSummary: `Pharmacy First is an NHS-funded service. Eligible patients in ${loc} receive consultations free at the point of care through participating pharmacies.`,
        pageTarget: identity.campaignSlug,
      },
      {
        question: `Do I need an appointment for Pharmacy First near ${loc}?`,
        speakableSummary: `Many pharmacies offering Pharmacy First in ${loc} accept walk-ins and booked appointments. Contact ${identity.pharmacyName} for today's availability.`,
        pageTarget: identity.campaignSlug,
      },
    ],
    localIntentQuestions: [
      ...areas.slice(0, 5).map((a) => `Pharmacy First ${a}`),
      `Pharmacy First ${loc} walk in`,
      `NHS pharmacy first ${loc}`,
      `pharmacy for sore throat ${loc}`,
      `UTI treatment pharmacy ${loc}`,
      `same day pharmacy appointment ${loc}`,
    ],
    commonQuestions: ai.commonQuestions ?? [],
  };
}

function buildComplianceGuardrails(identity, serviceIntel, bi) {
  const isPharmacyFirst = identity.serviceKey === "pharmacy-first";
  return {
    nhsClaimsGuidance: [
      "Only claim NHS funding/free at point of use where the service is NHS-commissioned and patient is eligible.",
      "Use NHS logo only in accordance with NHS Identity guidelines and only for commissioned services.",
      "Do not imply universal NHS entitlement — eligibility varies by service pathway and patient group.",
      "Reference Pharmacy First as an NHS Advanced Service under the Community Pharmacy Contractual Framework.",
      "Signpost to GP or NHS 111/A&E when symptoms exceed Pharmacy First scope.",
    ],
    pharmacyFirstWordingConstraints: isPharmacyFirst
      ? [
          "Use 'Pharmacy First' as the official NHS service name (capitalised).",
          "List only conditions within current Pharmacy First clinical pathways.",
          "Do not claim pharmacists can prescribe all antibiotics — supply is pathway-dependent via PGD/protocol.",
          "Avoid 'skip the GP entirely' — use 'for eligible minor illness' or 'without a GP appointment where appropriate'.",
          "Include safeguarding language for children, pregnancy and red-flag symptoms.",
          "Do not guarantee same-day treatment — say 'where clinically appropriate' and subject to availability.",
        ]
      : ["Apply official service naming from NHS service specifications where NHS-funded."],
    medicalAdviceDisclaimers: [
      "Content is for general information — not a substitute for personal medical advice.",
      "Patients with severe, worsening or emergency symptoms should call 999 or attend A&E.",
      "Pharmacists assess suitability individually — not all patients qualify for every pathway.",
      "Always read the patient information leaflet supplied with medicines.",
    ],
    pomAdvertisingRestrictions: [
      "Do not advertise Prescription-Only Medicines (POMs) to the public.",
      "Do not name POM products in promotional content unless legally permitted (e.g. within professional scope).",
      "Weight management and GLP-1 content must not promote off-label or unlicensed supply.",
      "No before/after clinical outcome imagery implying guaranteed results.",
    ],
    claimsToAvoid: [
      ...(bi.generationHints?.forbiddenClaims ?? []),
      "Guaranteed cure or instant recovery",
      "Cheapest pharmacy service in Rotherham without substantiation",
      "Replace your GP for all health needs",
      "Rank #1 or best pharmacy guaranteed",
      "Antibiotics always available without assessment",
      "Invented patient statistics or review counts",
    ],
    reviewTestimonialCaution: [
      "Do not fabricate patient reviews or testimonials.",
      "Health testimonials must not guarantee clinical outcomes.",
      "Avoid identifiable patient stories without documented consent.",
      "GPhC standards apply to testimonials used in pharmacy marketing.",
      "NHS reviews on NHS.uk should not be misrepresented as owned testimonials.",
    ],
    complianceLevel: identity.complianceLevel,
    serviceSpecificCompliance: serviceIntel.trustSignals?.complianceConsiderations ?? [],
  };
}

function buildInternalLinkMap(identity, serviceIntel, clusters, areas) {
  const hubSlug = identity.campaignSlug;
  const hubPath = `/${hubSlug}/`;

  const hubToClusters = clusters.map((c) => ({
    from: hubSlug,
    to: c.pageSlug,
    anchorText: c.internalLinks?.hub ? `Pharmacy First ${c.area}` : c.keyword,
    linkType: "hub-to-cluster",
  }));

  const clustersToHub = clusters.map((c) => ({
    from: c.pageSlug,
    to: hubSlug,
    anchorText: `Pharmacy First ${identity.location}`,
    linkType: "cluster-to-hub",
  }));

  const clusterToCluster = clusters.flatMap((c) =>
    (c.internalLinks?.nearbyAreas ?? []).map((n) => ({
      from: c.pageSlug,
      to: n.pageSlug,
      anchorText: n.anchorText,
      linkType: "cluster-to-nearby-cluster",
    })),
  );

  const related = (serviceIntel.internalLinkingOpportunities?.relatedServices ?? []).map((s) => ({
    serviceKey: s.serviceKey,
    label: s.label,
    pageSlugPattern: `${s.serviceKey}-${identity.locationSlug}`,
    linkFrom: [hubSlug, ...clusters.map((c) => c.pageSlug)],
    linkType: "related-service",
  }));

  const upsell = (serviceIntel.internalLinkingOpportunities?.upsellServices ?? []).map((s) => ({
    serviceKey: s.serviceKey,
    label: s.label,
    pageSlugPattern: `${s.serviceKey}-${identity.locationSlug}`,
    linkFrom: [hubSlug],
    linkType: "upsell-service",
  }));

  const supporting = (serviceIntel.internalLinkingOpportunities?.supportingServices ?? []).map((s) => ({
    serviceKey: s.serviceKey,
    label: s.label,
    pageSlugPattern: `${s.serviceKey}-${identity.locationSlug}`,
    linkFrom: [hubSlug],
    linkType: "supporting-service",
  }));

  return {
    hubSlug,
    hubPath,
    hubToClusters,
    clustersToHub,
    clusterToCluster,
    clustersToRelatedServices: clusters.flatMap((c) =>
      (c.internalLinks?.relatedServices ?? []).map((r) => ({
        from: c.pageSlug,
        serviceKey: r.serviceKey,
        anchorText: r.anchorText,
        pageSlugPattern: r.pageSlugPattern.replace("{locationSlug}", identity.locationSlug),
      })),
    ),
    relatedServices: related,
    upsellServices: upsell,
    supportingServices: supporting,
    moneyPageTargets: identity.serviceCategory === "nhs"
      ? []
      : [{ note: "No commercial money page mapped for NHS Pharmacy First campaign", pattern: null }],
    totalLinks: hubToClusters.length + clustersToHub.length + clusterToCluster.length + related.length + upsell.length,
  };
}

function validateBlueprint(blueprint, areas) {
  const checks = {
    campaignSlugExists: !!blueprint.campaignIdentity?.campaignSlug,
    hubBlueprintExists: !!blueprint.hubBlueprint?.pageSlug,
    clusterCount: blueprint.clusterBlueprints?.length ?? 0,
    clusterCountExpected: areas.length,
    contentEngineExists: !!blueprint.contentEngineBlueprint?.assetPlan,
    aiSearchExists: !!blueprint.aiSearchBlueprint,
    complianceExists: !!blueprint.complianceGuardrails,
    internalLinkMapExists: !!blueprint.internalLinkMap,
    noPagesGenerated: true,
    noRegistryChanges: true,
    noSitemapChanges: true,
  };

  const contentTopicsCount =
    (blueprint.contentEngineBlueprint?.assetPlan?.blogPosts?.length ?? 0)
    + (blueprint.contentEngineBlueprint?.assetPlan?.facebookPosts?.length ?? 0)
    + (blueprint.contentEngineBlueprint?.assetPlan?.linkedinPosts?.length ?? 0)
    + (blueprint.contentEngineBlueprint?.assetPlan?.gbpPosts?.length ?? 0)
    + (blueprint.contentEngineBlueprint?.assetPlan?.redditPosts?.length ?? 0)
    + (blueprint.contentEngineBlueprint?.assetPlan?.youtubeTopics?.length ?? 0)
    + (blueprint.contentEngineBlueprint?.assetPlan?.emailSequence ? 1 : 0);

  const pass =
    checks.campaignSlugExists
    && checks.hubBlueprintExists
    && checks.clusterCount === checks.clusterCountExpected
    && checks.contentEngineExists
    && checks.aiSearchExists
    && checks.complianceExists
    && checks.internalLinkMapExists
    && checks.noPagesGenerated
    && checks.noRegistryChanges
    && checks.noSitemapChanges;

  return { checks, contentTopicsCount, pass };
}

function main() {
  const opts = parseArgs(process.argv);
  const bi = loadJson(BI_PATH);
  const si = loadJson(SI_PATH);
  const serviceIntel = resolveService(si, opts.serviceKey, opts.serviceName);

  const identity = buildCampaignIdentity(opts, serviceIntel);
  const hubBlueprint = buildHubBlueprint(identity, serviceIntel, bi, opts.areas);
  const clusterBlueprints = buildClusterBlueprints(identity, serviceIntel, opts.areas);
  const contentEngineBlueprint = buildContentEngineBlueprint(identity, serviceIntel, bi);
  const aiSearchBlueprint = buildAiSearchBlueprint(identity, serviceIntel, opts.areas);
  const complianceGuardrails = buildComplianceGuardrails(identity, serviceIntel, bi);
  const internalLinkMap = buildInternalLinkMap(identity, serviceIntel, clusterBlueprints, opts.areas);

  const blueprint = {
    schemaVersion: "1.0",
    blueprintType: "pharmacy-campaign-blueprint",
    generatedAt: new Date().toISOString(),
    phase: "campaign-blueprint-generator-v1",
    sourceFiles: {
      businessIntelligence: "output/pharmacy-blueprint/business-intelligence.json",
      serviceIntelligence: "output/pharmacy-blueprint/service-intelligence.json",
    },
    intelligenceOnly: true,
    noPagesGenerated: true,
    noRegistryChanges: true,
    noSitemapChanges: true,
    campaignIdentity: identity,
    hubBlueprint,
    clusterBlueprints,
    contentEngineBlueprint,
    aiSearchBlueprint,
    complianceGuardrails,
    internalLinkMap,
  };

  const outFile = path.join(BLUEPRINT_DIR, `${identity.campaignSlug}.json`);
  fs.mkdirSync(BLUEPRINT_DIR, { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(blueprint, null, 2) + "\n", "utf8");

  const validation = validateBlueprint(blueprint, opts.areas);
  const report = {
    reportType: "pharmacy-campaign-blueprint-generator",
    verdict: validation.pass
      ? "PASS: Pharmacy Campaign Blueprint Generator Complete"
      : "FAIL: Pharmacy Campaign Blueprint Generator Requires Investigation",
    generatedAt: new Date().toISOString(),
    campaignCreated: outFile,
    serviceResolved: {
      serviceKey: identity.serviceKey,
      serviceName: identity.serviceName,
      category: identity.serviceCategory,
    },
    clusterCount: validation.checks.clusterCount,
    contentTopicsCount: validation.contentTopicsCount,
    complianceStatus: validation.checks.complianceExists ? "present" : "missing",
    internalLinkStatus: {
      present: validation.checks.internalLinkMapExists,
      totalLinks: internalLinkMap.totalLinks,
      hubToClusters: internalLinkMap.hubToClusters.length,
      clustersToHub: internalLinkMap.clustersToHub.length,
    },
    validation: validation.checks,
    readyForPageTemplateDesign: validation.pass,
    remainingBlockers: validation.pass ? [] : Object.entries(validation.checks).filter(([, v]) => v === false).map(([k]) => k),
    noPagesGenerated: true,
    noRegistryChanges: true,
    noSitemapChanges: true,
  };

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");

  console.log(report.verdict);
  console.log(`Campaign: ${outFile}`);
  console.log(`Report: ${REPORT_PATH}`);
  console.log(`Clusters: ${validation.checks.clusterCount} | Content topics: ${validation.contentTopicsCount} | Links: ${internalLinkMap.totalLinks}`);
  process.exit(validation.pass ? 0 : 1);
}

main();
