type BrandStyle = {
  visualStyle?: string;
  colourTone?: string;
  backgroundStyle?: string;
};

type ImageConfig = {
  brandStyles?: Record<string, BrandStyle>;
  placement?: string;
};

export type SceneType =
  | "hero"
  | "support"
  | "conversion"
  | "rankings"
  | "gmb"
  | "performance"
  | "reliability";

export type Placement = "below_h1" | "beside_intro" | "after_section" | "above_cta";

export type ImageAsset = {
  id: string;
  section: string;
  pageKeyword: string;
  location: string;
  service: string;
  sceneType: SceneType;
  fileName: string;
  altText: string;
  titleText: string;
  caption: string;
  placement: Placement;
  prompt: string;
  negativePrompt?: string;
};

type ImagePromptInput = {
  pageType: "hub" | "area";
  brand: string;
  service: string;
  city: string;
  area?: string;
  imageConfig: ImageConfig;
  section?: string;
  sceneType?: SceneType;
  industryType?: string;
};

// ─── Trade industry system ────────────────────────────────────────────────────

type TradeScene = "hero" | "support" | "conversion";
type TradeIndustryKey = "plumbing" | "electrical" | "landscaping" | "roofing" | "heating";

interface TradeIndustryConfig {
  role: string;
  actions: Record<TradeScene, string>;
  environments: Record<TradeScene, string>;
}

const TRADE_INDUSTRIES: Record<TradeIndustryKey, TradeIndustryConfig> = {
  plumbing: {
    role: "emergency plumber",
    actions: {
      hero:       "repairing a burst pipe under a kitchen sink",
      support:    "fixing a leaking joint in a bathroom",
      conversion: "tightening a pipe fitting with a wrench close to the leak",
    },
    environments: {
      hero:       "kitchen interior with visible plumbing, water stain, and realistic surroundings",
      support:    "bathroom interior showing sink unit, exposed pipework, and tiled walls",
      conversion: "under-sink cabinet showing copper pipes, connectors, and plumber's hands",
    },
  },
  electrical: {
    role: "electrician",
    actions: {
      hero:       "wiring a consumer unit in a residential property",
      support:    "testing a circuit with a multimeter in a home hallway",
      conversion: "connecting cables inside a junction box",
    },
    environments: {
      hero:       "residential hallway or garage with a consumer unit mounted on the wall",
      support:    "home interior hallway with standard domestic fittings",
      conversion: "electrical panel close-up showing cables, terminals, and tools",
    },
  },
  landscaping: {
    role: "landscape gardener",
    actions: {
      hero:       "laying a new patio in a residential garden",
      support:    "planting shrubs and plants in a garden border",
      conversion: "bedding turf onto a freshly prepared lawn area",
    },
    environments: {
      hero:       "residential garden with patio slabs, tools, and a house visible in the background",
      support:    "garden border with soil, plants, trowel, and gloves",
      conversion: "turf roll being pressed down on prepared soil",
    },
  },
  roofing: {
    role: "roofer",
    actions: {
      hero:       "replacing roof tiles on a residential house",
      support:    "inspecting and repairing flashing on a house roof",
      conversion: "carefully lifting and re-securing a loose roof tile",
    },
    environments: {
      hero:       "house exterior roofline with visible roof tiles, sky background, and safety equipment",
      support:    "roof surface showing ridge tiles, flashing, and chimney stack",
      conversion: "close-up of roof tiles with a roofer's gloved hands and tools",
    },
  },
  heating: {
    role: "heating engineer",
    actions: {
      hero:       "servicing a gas boiler in a utility room",
      support:    "checking boiler pressure and pipework in a kitchen",
      conversion: "adjusting boiler controls and inspecting a pressure gauge",
    },
    environments: {
      hero:       "utility room or kitchen with a wall-mounted boiler, pipework, and tools on a workbench",
      support:    "boiler cupboard showing pipes, valves, and heating controls",
      conversion: "close-up of boiler controls and pressure dial with an engineer's hand",
    },
  },
};

const TRADE_NEGATIVE_PROMPT =
  "office, desk, laptop, suit, meeting room, call centre, digital screens, generic people posing, " +
  "corporate environment, text overlays, logos, watermarks, cartoon, illustration, vector art, " +
  "web design, digital marketing, agency, computer, whiteboard, staged studio backdrop";

function detectTradeIndustry(service: string, industryType?: string): TradeIndustryKey | null {
  const s = service.toLowerCase();
  const i = (industryType ?? "").toLowerCase();

  if (i === "plumbing"    || s.includes("plumb")    || s.includes("drain")    || s.includes("pipe"))    return "plumbing";
  if (i === "electrical"  || s.includes("electr")   || s.includes("wiring")   || s.includes("fuse"))    return "electrical";
  if (i === "landscaping" || s.includes("landscap")  || s.includes("garden")   || s.includes("patio") ||
      s.includes("turf")  || s.includes("lawn"))                                                         return "landscaping";
  if (i === "roofing"     || s.includes("roof")     || s.includes("gutter")   || s.includes("fascia"))  return "roofing";
  if (i === "heating"     || s.includes("heat")     || s.includes("boiler")   || s.includes("hvac"))    return "heating";
  return null;
}

function sceneTypeToTradeScene(sceneType: SceneType): TradeScene {
  if (sceneType === "conversion") return "conversion";
  if (sceneType === "support")    return "support";
  return "hero";
}

function buildTradePrompt(
  industry: TradeIndustryKey,
  location: string,
  sceneType: SceneType
): { prompt: string; negativePrompt: string } {
  const cfg   = TRADE_INDUSTRIES[industry];
  const scene = sceneTypeToTradeScene(sceneType);
  const role   = cfg.role;
  const action = cfg.actions[scene];
  const env    = cfg.environments[scene];

  let prompt: string;
  if (scene === "hero") {
    prompt =
      `A professional ${role} in ${location} ${action} inside a real residential home. ` +
      `The scene shows ${env}. ` +
      `The tradesperson is wearing appropriate workwear and is focused on completing the job. ` +
      `Natural lighting, wide shot showing full room context. ` +
      `High-quality, realistic, documentary-style photography. 16:9 landscape format.`;
  } else if (scene === "support") {
    prompt =
      `A professional ${role} in ${location} ${action}. ` +
      `Mid-range shot: ${env}. ` +
      `Realistic tools, proper workwear, focused on the task. Natural indoor lighting. ` +
      `High-quality, realistic, documentary-style photography.`;
  } else {
    prompt =
      `Close-up detail shot of a ${role} in ${location} ${action}. ` +
      `Tight focus on ${env}. ` +
      `Hands and tools clearly visible, showing professional technique. ` +
      `High-quality, realistic, documentary-style photography.`;
  }

  return { prompt, negativePrompt: TRADE_NEGATIVE_PROMPT };
}

// ─── Trade alt text ───────────────────────────────────────────────────────────

function buildTradeAltText(industry: TradeIndustryKey, sceneType: SceneType, location: string): string {
  const cfg   = TRADE_INDUSTRIES[industry];
  const scene = sceneTypeToTradeScene(sceneType);
  const label: Record<TradeScene, string> = {
    hero:       `${cfg.role} at work in a ${location} home`,
    support:    `${cfg.role} carrying out a repair in ${location}`,
    conversion: `close-up of a ${cfg.role}'s hands and tools in ${location}`,
  };
  return `Professional ${label[scene]} — realistic documentary-style photography.`;
}

function buildTradeCaption(industry: TradeIndustryKey, sceneType: SceneType, location: string): string {
  const cfg   = TRADE_INDUSTRIES[industry];
  const scene = sceneTypeToTradeScene(sceneType);
  const captions: Record<TradeScene, string> = {
    hero:       `Local ${cfg.role} serving ${location} — fast, reliable, professional.`,
    support:    `Expert ${cfg.role} completing a job in ${location}.`,
    conversion: `Skilled workmanship from a trusted ${cfg.role} in ${location}.`,
  };
  return captions[scene];
}

function buildTradeFileNameContext(industry: TradeIndustryKey, sceneType: SceneType): string {
  const scene = sceneTypeToTradeScene(sceneType);
  return `${industry}-${scene}`;
}

// ─── Layer 3: Master style preamble — per service (digital industries only) ──

const PROMPT_PREAMBLE_DEFAULT =
  `Create a clean flat vector illustration designed for a professional local business website. ` +
  `Modern flat vector illustration, clean minimal high clarity, subtle depth, consistent line thickness, slightly rounded elements, ` +
  `strict brand colours #005EB8 #1CA9C9 #003A6D #F4F6F8 and white. ` +
  `No background colour, transparent PNG, no text, no labels, no boxed frame, no watermark, no photorealistic style. ` +
  `Ensure the illustration matches a consistent visual identity across a full business website image system.`;

const PROMPT_PREAMBLE_WEB_DESIGN =
  `High-quality premium UI mockup illustration for a professional web design sales page. ` +
  `Realistic website interface quality — not flat vector, not cartoon, not placeholder clip art. ` +
  `Premium SaaS-style presentation with clean typography hierarchy, realistic layout sections, subtle gradients, soft drop shadows, and gentle depth. ` +
  `Website elements must look real and usable: believable content structure with a navigation bar, hero section, content rows, card layouts, and call-to-action areas — not abstract coloured rectangles. ` +
  `Transparent background or very light neutral background only — no bright, saturated, or off-brand background colours. ` +
  `Brand accent colours where used: #005EB8 #1CA9C9 #003A6D. ` +
  `No text in image. No labels. No watermarks. No flat vector cartoon style. No childish illustration style. No placeholder coloured blocks. No random bright background colours.`;

function getPromptPreamble(service: string): string {
  const svc = normaliseService(service);
  if (!svc.includes("seo") && !svc.includes("host")) return PROMPT_PREAMBLE_WEB_DESIGN;
  return PROMPT_PREAMBLE_DEFAULT;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function normaliseService(service: string): string {
  return service.toLowerCase().trim();
}

function slugify(value: string): string {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function resolveDefaultSceneType(service: string): SceneType {
  const svc = normaliseService(service);
  if (svc.includes("host")) return "performance";
  return "hero";
}

// ─── Layer 1: Scene type → placement lock ────────────────────────────────────

const SCENE_PLACEMENT: Record<SceneType, Placement> = {
  hero:        "below_h1",
  support:     "beside_intro",
  rankings:    "after_section",
  gmb:         "after_section",
  conversion:  "above_cta",
  performance: "beside_intro",
  reliability: "after_section",
};

// ─── Layer 2a: Unique filename context per scene ──────────────────────────────

function buildFileNameContext(service: string, sceneType: SceneType): string {
  const svc = normaliseService(service);

  if (svc.includes("seo")) {
    const map: Record<SceneType, string> = {
      hero:        "local-search-visibility",
      rankings:    "search-rankings-improvement",
      gmb:         "google-business-profile",
      conversion:  "local-search-leads",
      support:     "local-seo-results",
      performance: "local-seo-results",
      reliability: "local-seo-results",
    };
    return map[sceneType];
  }

  if (svc.includes("host")) {
    const map: Record<SceneType, string> = {
      performance: "fast-reliable-hosting",
      reliability: "secure-business-hosting",
      hero:        "website-hosting",
      support:     "website-hosting",
      rankings:    "website-hosting",
      gmb:         "website-hosting",
      conversion:  "website-hosting",
    };
    return map[sceneType];
  }

  const map: Record<SceneType, string> = {
    hero:        "professional-business-website",
    support:     "trusted-local-web-design",
    conversion:  "local-business-enquiries",
    rankings:    "professional-business-website",
    gmb:         "professional-business-website",
    performance: "professional-business-website",
    reliability: "professional-business-website",
  };
  return map[sceneType];
}

// ─── Layer 2b: Unique alt text per scene ──────────────────────────────────────

const seoAltMap: Record<SceneType, (location: string) => string> = {
  hero: (location) =>
    `Local SEO illustration showing a business in ${location} appearing in local search results and attracting nearby customers.`,
  rankings: (location) =>
    `Local SEO ranking improvement illustration for a business targeting customers in ${location}.`,
  gmb: (location) =>
    `Google Business Profile optimisation illustration for a local business in ${location}, showing reviews, calls, and map directions.`,
  conversion: (location) =>
    `Local SEO conversion illustration showing enquiries and leads flowing to a business in ${location} from local search traffic.`,
  support:     (location) => `Local SEO credibility illustration for a business building trust with customers in ${location}.`,
  performance: (location) => `Local SEO performance illustration for a business improving its online presence in ${location}.`,
  reliability: (location) => `Local SEO reliability illustration for a business maintaining consistent rankings in ${location}.`,
};

const webDesignAltMap: Record<SceneType, (location: string) => string> = {
  hero: (location) =>
    `Professional web design illustration for businesses in ${location} looking to improve their online presence and win more enquiries.`,
  support: (location) =>
    `Professional web design illustration representing trust and credibility for a local business in ${location}.`,
  conversion: (location) =>
    `Web design illustration representing online enquiries and leads for a local business in ${location}.`,
  rankings:    (location) => `Web design illustration helping a business in ${location} improve its online visibility.`,
  gmb:         (location) => `Web design illustration for a business in ${location} building a stronger online presence.`,
  performance: (location) => `Web design illustration representing fast, high-performing websites for businesses in ${location}.`,
  reliability: (location) => `Web design illustration representing a reliable, professional online presence in ${location}.`,
};

const hostingAltMap: Record<SceneType, (location: string) => string> = {
  performance: (location) =>
    `Fast and reliable website hosting illustration for a business in ${location}, representing speed, uptime, and security.`,
  reliability: (location) =>
    `Secure website hosting illustration for a business in ${location}, representing backups, protection, and business continuity.`,
  hero:        (location) => `Reliable website hosting illustration for a business in ${location}, representing speed, uptime, and security.`,
  support:     (location) => `Trusted website hosting illustration for a business in ${location} representing professional infrastructure.`,
  rankings:    (location) => `Hosting performance illustration for a business in ${location} with fast load times and reliable uptime.`,
  gmb:         (location) => `Hosting reliability illustration for a business in ${location} keeping their online presence live.`,
  conversion:  (location) => `Website hosting illustration for a business in ${location} ensuring customers can always reach them online.`,
};

function buildAltText(service: string, sceneType: SceneType, location: string): string {
  const svc = normaliseService(service);
  if (svc.includes("seo"))  return seoAltMap[sceneType](location);
  if (svc.includes("host")) return hostingAltMap[sceneType](location);
  return webDesignAltMap[sceneType](location);
}

// ─── Layer 2c: Unique caption per scene ───────────────────────────────────────

const seoCaptionMap: Record<SceneType, (location: string) => string> = {
  hero: (location) =>
    `Improving your visibility in ${location} starts with a strong local SEO foundation.`,
  rankings: (location) =>
    `Higher rankings in local search help businesses in ${location} attract more customers.`,
  gmb: (location) =>
    `An optimised Google Business Profile can increase calls, clicks, and trust in ${location}.`,
  conversion: (location) =>
    `Turning local search visibility into real enquiries is key to business growth in ${location}.`,
  support:     (location) => `Local SEO helping ${location} businesses build credibility where customers are searching.`,
  performance: (location) => `Local SEO helping ${location} businesses appear where their customers are already searching.`,
  reliability: (location) => `Local SEO helping ${location} businesses maintain consistent visibility in search results.`,
};

const webDesignCaptionMap: Record<SceneType, (location: string) => string> = {
  hero: (location) =>
    `Modern web design helping ${location} businesses build trust and generate enquiries online.`,
  support: (location) =>
    `Quality web design building trust and credibility for ${location} businesses online.`,
  conversion: (location) =>
    `A well-designed website turning ${location} visitors into real enquiries and customers.`,
  rankings:    (location) => `Professional web design giving ${location} businesses a stronger digital presence.`,
  gmb:         (location) => `Web design helping ${location} businesses stand out and attract more local customers.`,
  performance: (location) => `Fast, well-built websites helping ${location} businesses perform better online.`,
  reliability: (location) => `Reliable web design giving ${location} businesses a professional, always-available online presence.`,
};

const hostingCaptionMap: Record<SceneType, (location: string) => string> = {
  performance: (location) =>
    `Fast, reliable website hosting keeping ${location} businesses online and always available.`,
  reliability: (location) =>
    `Secure hosting with built-in backups giving ${location} businesses peace of mind.`,
  hero:        (location) => `Reliable website hosting keeping ${location} businesses online, fast, and secure.`,
  support:     (location) => `Trusted hosting infrastructure giving ${location} businesses a professional online foundation.`,
  rankings:    (location) => `High-performance hosting helping ${location} businesses load faster and rank better.`,
  gmb:         (location) => `Reliable hosting ensuring ${location} businesses are always reachable by local customers.`,
  conversion:  (location) => `Dependable hosting ensuring ${location} businesses never miss an enquiry due to downtime.`,
};

function buildCaption(service: string, sceneType: SceneType, location: string): string {
  const svc = normaliseService(service);
  if (svc.includes("seo"))  return seoCaptionMap[sceneType](location);
  if (svc.includes("host")) return hostingCaptionMap[sceneType](location);
  return webDesignCaptionMap[sceneType](location);
}

// ─── Layer 3: Scene-specific composition (digital industries) ─────────────────

function getSceneDescription(service: string, sceneType: SceneType, location: string): string {
  const svc = normaliseService(service);

  if (svc.includes("seo")) {
    const scenes: Record<SceneType, string> = {
      hero:        `The scene represents local search visibility, showing a business appearing prominently in search results and on a map for ${location}. Clean professional flat vector style showing digital local visibility.`,
      rankings:    `The scene shows an upward trending local search ranking improvement for a business in ${location}, with clear visual indicators of better search performance and more online visibility.`,
      gmb:         `The scene represents a Google Business Profile with star reviews, call icons, and map directions — showing a well-optimised local business presence in ${location}.`,
      conversion:  `The scene shows leads, calls, and enquiries flowing from local search to a business in ${location}, representing strong conversion from local search traffic.`,
      support:     `The scene conveys trust and reliability in local search for a business in ${location}, with visual cues of consistent online presence and credibility.`,
      performance: `The scene shows a well-optimised local business in ${location} performing strongly across digital channels.`,
      reliability: `The scene represents consistent local search presence and reliable visibility for a business in ${location}.`,
    };
    return scenes[sceneType];
  }

  if (svc.includes("host")) {
    const scenes: Record<SceneType, string> = {
      performance: `The scene conveys website speed, uptime, and secure reliable hosting for a business in ${location} — a fast-loading, stable, always-on business website.`,
      reliability: `The scene shows server strength, backups, and business continuity protection for a business website in ${location}.`,
      hero:        `The scene represents professional, reliable hosting infrastructure supporting a business website in ${location}.`,
      support:     `The scene represents trusted, professional hosting keeping a business in ${location} online and protected.`,
      rankings:    `The scene shows fast hosting improving website performance for a business in ${location}.`,
      gmb:         `The scene represents hosting reliability keeping a ${location} business always reachable online.`,
      conversion:  `The scene represents always-on hosting ensuring a business in ${location} never misses an enquiry.`,
    };
    return scenes[sceneType];
  }

  const scenes: Record<SceneType, string> = {
    hero:        `Show a premium business website open on a desktop monitor and a mobile phone displayed side by side. The desktop shows a fully rendered homepage: a clean navigation bar at the top with a logo area and menu items, a bold hero section below it with a headline area and a call-to-action button, and two or three content section rows beneath with realistic card or column layouts. The mobile phone beside it shows the same website adapted to a responsive mobile layout with the same visual quality. Both screens show believable, realistic-quality web design — professional interface, strong visual hierarchy, subtle gradients and drop shadows. A very subtle building or shopfront silhouette sits in the lower background as a small contextual element anchoring the local business context for ${location}. Do not include: handshake, badge, star, shield, tick, arrow, notification bell, speech bubble, envelope, flat vector cartoon style, abstract coloured placeholder rectangles.`,
    support:     `Show a premium business website open on a desktop monitor — this is the dominant element and must occupy the majority of the canvas. The website displays a realistic professionally designed homepage: a clean navigation bar, a polished hero section with subtle gradient, content block rows below with realistic depth and shadow. The website interface looks real and usable, not a cartoon. Overlaid as a small badge at the upper-right corner of the monitor screen: a shield icon with a checkmark inside it. Below or beside the shield: a compact five-star row as a second small annotation. Both badge overlays are significantly smaller than the website and are clearly annotating the website screen — they are not standalone objects. The overall image reads as: a professionally designed website that earns trust and credibility for a local business in ${location}. Do not include: arrows, phone icons, notification bells, speech bubbles, message bubbles, handshake, mobile phone as a second device, storefront as main element, flat vector cartoon style, abstract coloured placeholder rectangles.`,
    conversion:  `Show a left-to-right flow composition. On the left: a premium business website on a desktop monitor or screen panel — displaying a realistic homepage with a navigation bar, hero section, and a clearly visible contact form or enquiry button section in a polished card layout. The website looks professionally designed with realistic interface quality, subtle gradients and depth. In the centre: a single clean directional arrow pointing right. On the right: a smartphone showing a notification badge on its screen, and beside it a speech bubble representing an incoming enquiry or message. An envelope icon may appear as an optional secondary outcome element to the right of the bubble. The website on the left is the origin; the phone and message on the right are the result. The image reads as: a professionally designed website generating real enquiries for a local business in ${location}. Do not include: handshake, shield as main element, storefront, star ratings, tick badges, flat vector cartoon style, abstract coloured placeholder rectangles.`,
    rankings:    `The scene shows a professional website helping a business in ${location} improve its visibility and rank better in search results.`,
    gmb:         `The scene shows a business in ${location} with a strong digital presence attracting local customers through their website.`,
    performance: `The scene represents a fast-loading, high-performance website for a business in ${location} delivering a seamless user experience.`,
    reliability: `The scene conveys a dependable, always-available website for a business in ${location} with a professional and trustworthy online presence.`,
  };
  return scenes[sceneType];
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateImagePrompt(input: ImagePromptInput): ImageAsset {
  const { service, city, area, imageConfig, section = "hero", industryType } = input;

  const location  = area ? `${area}, ${city}` : city;
  const sceneType = input.sceneType ?? resolveDefaultSceneType(service);

  const pageKeyword = `${service.toLowerCase()} ${location.toLowerCase()}`;
  const placement   = SCENE_PLACEMENT[sceneType];

  // ─── Trade industry: documentary photography path ─────────────────────────
  const tradeIndustry = detectTradeIndustry(service, industryType);
  if (tradeIndustry) {
    const { prompt, negativePrompt } = buildTradePrompt(tradeIndustry, location, sceneType);
    const fileNameContext = buildTradeFileNameContext(tradeIndustry, sceneType);
    const fileName  = `${slugify(service)}-${slugify(location)}-${fileNameContext}.jpg`;
    const altText   = buildTradeAltText(tradeIndustry, sceneType, location);
    const caption   = buildTradeCaption(tradeIndustry, sceneType, location);
    const titleText = `${service} ${location}`;

    return {
      id: section,
      section,
      pageKeyword,
      location,
      service,
      sceneType,
      fileName,
      altText,
      titleText,
      caption,
      placement,
      prompt,
      negativePrompt,
    };
  }

  // ─── Digital/default: vector illustration path ────────────────────────────
  const fileNameContext = buildFileNameContext(service, sceneType);
  const fileName  = `${slugify(service)}-${slugify(location)}-${fileNameContext}.png`;
  const sceneDescription = getSceneDescription(service, sceneType, location);
  const prompt    = `${getPromptPreamble(service)} ${sceneDescription}`;
  const altText   = buildAltText(service, sceneType, location);
  const titleText = `${service} ${location}`;
  const caption   = buildCaption(service, sceneType, location);

  return {
    id: section,
    section,
    pageKeyword,
    location,
    service,
    sceneType,
    fileName,
    altText,
    titleText,
    caption,
    placement,
    prompt,
  };
}

// ─── Public helpers (used by images.ts API server) ────────────────────────────

export { detectTradeIndustry, buildTradePrompt, TRADE_NEGATIVE_PROMPT };
export type { TradeIndustryKey };
