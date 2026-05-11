// ─── Scene Library ────────────────────────────────────────────────────────────
// Central source of truth for all industry scene maps, slot preference rules,
// scene-specific AI prompts, and the diversity enforcement engine.

export type ImageSourceMode = "library" | "upload" | "ai" | "hybrid" | "disabled";

export const IMAGE_SOURCE_MODE_DEFAULT: ImageSourceMode = "library";

// ─── Industry scene IDs ───────────────────────────────────────────────────────

export type PlumbingScene =
  | "emergency-callout-arrival"
  | "under-sink-leak-repair"
  | "blocked-toilet-repair"
  | "pipework-closeup"
  | "bathroom-water-leak"
  | "water-shutoff-advice"
  | "van-outside-home"
  | "completed-repair"
  | "homeowner-consultation";

export type RoofingScene =
  | "roofer-arriving-at-home"
  | "roof-tile-repair"
  | "flat-roof-inspection"
  | "gutter-repair"
  | "chimney-flashing"
  | "roof-leak-inspection"
  | "ladder-safety"
  | "completed-roof-repair"
  | "homeowner-roof-consultation";

export type ElectricalScene =
  | "electrician-arriving-at-home"
  | "consumer-unit-check"
  | "socket-repair"
  | "lighting-installation"
  | "circuit-testing-closeup"
  | "safety-inspection"
  | "landlord-eicr-check"
  | "completed-electrical-work"
  | "homeowner-electrician-consultation";

export type LandscapingScene =
  | "garden-consultation"
  | "patio-installation"
  | "fencing-installation"
  | "turfing-lawn"
  | "planting-borders"
  | "drainage-preparation"
  | "raised-bed-build"
  | "completed-garden"
  | "landscaper-tools-closeup";

export type ClinicsScene =
  | "clinic-consultation"
  | "treatment-room"
  | "practitioner-preparation"
  | "skincare-treatment-setup"
  | "client-discussion"
  | "clinic-reception"
  | "aftercare-advice"
  | "clean-equipment-closeup"
  | "calm-premium-room";

export type WebDesignScene =
  | "website-planning"
  | "laptop-site-preview"
  | "mobile-responsive-preview"
  | "enquiry-form-design"
  | "analytics-review"
  | "brand-layout-design"
  | "developer-workflow"
  | "client-consultation"
  | "finished-website-showcase";

export type SceneId =
  | PlumbingScene
  | RoofingScene
  | ElectricalScene
  | LandscapingScene
  | ClinicsScene
  | WebDesignScene;

export type IndustryKey =
  | "plumbing"
  | "roofing"
  | "electrical"
  | "landscaping"
  | "clinics-aesthetics"
  | "web-design"
  | "heating";

// ─── Industry → scene IDs ─────────────────────────────────────────────────────

export const INDUSTRY_SCENES: Record<IndustryKey, readonly SceneId[]> = {
  plumbing: [
    "emergency-callout-arrival",
    "under-sink-leak-repair",
    "blocked-toilet-repair",
    "pipework-closeup",
    "bathroom-water-leak",
    "water-shutoff-advice",
    "van-outside-home",
    "completed-repair",
    "homeowner-consultation",
  ],
  roofing: [
    "roofer-arriving-at-home",
    "roof-tile-repair",
    "flat-roof-inspection",
    "gutter-repair",
    "chimney-flashing",
    "roof-leak-inspection",
    "ladder-safety",
    "completed-roof-repair",
    "homeowner-roof-consultation",
  ],
  electrical: [
    "electrician-arriving-at-home",
    "consumer-unit-check",
    "socket-repair",
    "lighting-installation",
    "circuit-testing-closeup",
    "safety-inspection",
    "landlord-eicr-check",
    "completed-electrical-work",
    "homeowner-electrician-consultation",
  ],
  landscaping: [
    "garden-consultation",
    "patio-installation",
    "fencing-installation",
    "turfing-lawn",
    "planting-borders",
    "drainage-preparation",
    "raised-bed-build",
    "completed-garden",
    "landscaper-tools-closeup",
  ],
  "clinics-aesthetics": [
    "clinic-consultation",
    "treatment-room",
    "practitioner-preparation",
    "skincare-treatment-setup",
    "client-discussion",
    "clinic-reception",
    "aftercare-advice",
    "clean-equipment-closeup",
    "calm-premium-room",
  ],
  "web-design": [
    "website-planning",
    "laptop-site-preview",
    "mobile-responsive-preview",
    "enquiry-form-design",
    "analytics-review",
    "brand-layout-design",
    "developer-workflow",
    "client-consultation",
    "finished-website-showcase",
  ],
  heating: [
    "emergency-callout-arrival",
    "under-sink-leak-repair",
    "pipework-closeup",
    "water-shutoff-advice",
    "van-outside-home",
    "completed-repair",
    "homeowner-consultation",
    "bathroom-water-leak",
    "blocked-toilet-repair",
  ],
};

// ─── Slot preference rules ────────────────────────────────────────────────────
// Ordered preference: first match that isn't already used wins.

export const SLOT_PREFERENCES: Record<"hero" | "support" | "conversion", Partial<Record<IndustryKey, readonly SceneId[]>>> = {
  hero: {
    plumbing:           ["emergency-callout-arrival", "van-outside-home", "under-sink-leak-repair"],
    roofing:            ["roofer-arriving-at-home", "roof-tile-repair", "flat-roof-inspection"],
    electrical:         ["electrician-arriving-at-home", "consumer-unit-check", "lighting-installation"],
    landscaping:        ["patio-installation", "completed-garden", "garden-consultation"],
    "clinics-aesthetics": ["clinic-consultation", "treatment-room", "calm-premium-room"],
    "web-design":       ["laptop-site-preview", "finished-website-showcase", "website-planning"],
    heating:            ["emergency-callout-arrival", "van-outside-home", "under-sink-leak-repair"],
  },
  support: {
    plumbing:           ["under-sink-leak-repair", "pipework-closeup", "bathroom-water-leak", "blocked-toilet-repair"],
    roofing:            ["roof-tile-repair", "chimney-flashing", "gutter-repair", "roof-leak-inspection"],
    electrical:         ["consumer-unit-check", "circuit-testing-closeup", "socket-repair", "safety-inspection"],
    landscaping:        ["planting-borders", "turfing-lawn", "fencing-installation", "drainage-preparation"],
    "clinics-aesthetics": ["skincare-treatment-setup", "practitioner-preparation", "clean-equipment-closeup"],
    "web-design":       ["mobile-responsive-preview", "brand-layout-design", "developer-workflow"],
    heating:            ["pipework-closeup", "water-shutoff-advice", "bathroom-water-leak"],
  },
  conversion: {
    plumbing:           ["homeowner-consultation", "completed-repair", "water-shutoff-advice"],
    roofing:            ["homeowner-roof-consultation", "completed-roof-repair", "ladder-safety"],
    electrical:         ["homeowner-electrician-consultation", "completed-electrical-work", "landlord-eicr-check"],
    landscaping:        ["garden-consultation", "completed-garden", "raised-bed-build", "landscaper-tools-closeup"],
    "clinics-aesthetics": ["client-discussion", "aftercare-advice", "clinic-reception"],
    "web-design":       ["client-consultation", "enquiry-form-design", "analytics-review"],
    heating:            ["homeowner-consultation", "completed-repair", "water-shutoff-advice"],
  },
};

// ─── Scene-specific AI prompts (9 per industry) ───────────────────────────────

const NEG = "No office, no laptop, no computer, no business meeting, no suits, no corporate scene, no text, no logo, no web design, no marketing, no dashboard, no cartoon, no illustration, no vector art, no staged studio backdrop.";

export const SCENE_PROMPTS: Record<IndustryKey, Partial<Record<SceneId, { prompt: string; negativePrompt: string }>>> = {
  plumbing: {
    "emergency-callout-arrival": {
      prompt: "A professional emergency plumber arriving at a UK residential home with toolbox for an urgent callout, homeowner opening the front door, realistic documentary-style photo, workwear, natural daylight, 16:9 landscape, no text.",
      negativePrompt: NEG,
    },
    "under-sink-leak-repair": {
      prompt: "A professional plumber repairing a leaking pipe under a kitchen sink in a real UK home, visible copper pipework and tools, realistic photo, working position, bright kitchen interior, no text.",
      negativePrompt: NEG,
    },
    "blocked-toilet-repair": {
      prompt: "A professional plumber working on a blocked toilet in a domestic bathroom, tools visible, white tiled bathroom, clean realistic repair scene, proper workwear, no text.",
      negativePrompt: NEG,
    },
    "pipework-closeup": {
      prompt: "Close-up of a plumber's hands using tools to repair domestic copper pipework, visible brass fittings and joints, realistic trade work, soft natural lighting, no text.",
      negativePrompt: NEG,
    },
    "bathroom-water-leak": {
      prompt: "A plumber investigating a water leak near bathroom basin pipework in a realistic UK home bathroom, white tiles, visible pipes, professional posture, no text.",
      negativePrompt: NEG,
    },
    "water-shutoff-advice": {
      prompt: "A plumber pointing out the stop tap or water shut-off valve to a homeowner in a domestic utility area, reassuring practical scene, workwear, natural light, no text.",
      negativePrompt: NEG,
    },
    "van-outside-home": {
      prompt: "A local plumbing van parked outside a UK residential home on a residential street, plumber carrying toolbox from van, no readable branding on van, overcast British daylight, no text.",
      negativePrompt: NEG,
    },
    "completed-repair": {
      prompt: "A clean completed plumbing repair under a kitchen sink with tools being packed away, tidy pipe joints and fittings visible, realistic home setting, no text.",
      negativePrompt: NEG,
    },
    "homeowner-consultation": {
      prompt: "A homeowner speaking with a plumber in a kitchen about an urgent plumbing issue, both standing, reassuring professional interaction, realistic domestic interior, no text.",
      negativePrompt: NEG,
    },
  },

  roofing: {
    "roofer-arriving-at-home": {
      prompt: "A professional roofer arriving at a UK residential home, standing at the property with a ladder, hi-vis workwear, British suburban street, overcast sky, realistic documentary-style photo, no text.",
      negativePrompt: NEG,
    },
    "roof-tile-repair": {
      prompt: "A professional roofer repairing clay roof tiles on a residential house roofline, gloved hands lifting tile, tools on roof, blue sky background, realistic trade photography, no text.",
      negativePrompt: NEG,
    },
    "flat-roof-inspection": {
      prompt: "A roofer inspecting a flat roof on a UK residential property, crouching on felt surface, tools nearby, overcast British daylight, realistic documentary photo, no text.",
      negativePrompt: NEG,
    },
    "gutter-repair": {
      prompt: "A roofer on a ladder repairing guttering on a UK semi-detached house, close-up of hands securing fascia, realistic trade photography, no text.",
      negativePrompt: NEG,
    },
    "chimney-flashing": {
      prompt: "A roofer repairing lead flashing around a chimney stack on a UK residential roof, close-up of hands working, ridge tiles visible, realistic documentary photo, no text.",
      negativePrompt: NEG,
    },
    "roof-leak-inspection": {
      prompt: "A roofer investigating a roof leak from inside a loft space, torch in hand, exposed rafters and roof structure visible, realistic indoor loft scene, no text.",
      negativePrompt: NEG,
    },
    "ladder-safety": {
      prompt: "A roofer safely secured on a ladder at the eaves of a residential house, hi-vis jacket, proper safety posture, suburban UK setting, realistic photo, no text.",
      negativePrompt: NEG,
    },
    "completed-roof-repair": {
      prompt: "A completed roof tile repair on a UK residential house, neatly replaced tiles on a clean roofline, overcast daylight, realistic documentary photo, no text.",
      negativePrompt: NEG,
    },
    "homeowner-roof-consultation": {
      prompt: "A homeowner and roofer standing outside a residential property discussing a roof issue, roofer pointing upward, professional interaction, realistic UK suburban setting, no text.",
      negativePrompt: NEG,
    },
  },

  electrical: {
    "electrician-arriving-at-home": {
      prompt: "A professional electrician arriving at a UK residential home, tool bag in hand, homeowner at door, realistic documentary-style photo, workwear, natural daylight, no text.",
      negativePrompt: NEG,
    },
    "consumer-unit-check": {
      prompt: "An electrician checking and wiring a consumer unit mounted on a wall in a residential property, hands working with cables, torch visible, realistic trade photography, no text.",
      negativePrompt: NEG,
    },
    "socket-repair": {
      prompt: "An electrician repairing a wall socket in a UK home, screwdriver in hand, exposed cables in socket back, realistic domestic scene, no text.",
      negativePrompt: NEG,
    },
    "lighting-installation": {
      prompt: "An electrician installing a ceiling light fitting in a UK home, up on stepladder, wiring visible, realistic interior, proper workwear, no text.",
      negativePrompt: NEG,
    },
    "circuit-testing-closeup": {
      prompt: "Close-up of an electrician's hands testing a circuit with a multimeter in a residential hallway, probe contacts visible, professional tool use, no text.",
      negativePrompt: NEG,
    },
    "safety-inspection": {
      prompt: "An electrician carrying out an electrical safety inspection in a UK home, clipboard and test equipment, methodical and professional, realistic photo, no text.",
      negativePrompt: NEG,
    },
    "landlord-eicr-check": {
      prompt: "An electrician conducting an EICR electrical installation condition report in a UK rental property, testing sockets and consumer unit, clipboard, realistic photo, no text.",
      negativePrompt: NEG,
    },
    "completed-electrical-work": {
      prompt: "A completed electrical job — a new consumer unit neatly installed on a UK home wall, cables tidy and labelled, door closed, realistic photo, no text.",
      negativePrompt: NEG,
    },
    "homeowner-electrician-consultation": {
      prompt: "A homeowner speaking with an electrician in a domestic hallway about an electrical issue, professional reassuring interaction, realistic UK interior, no text.",
      negativePrompt: NEG,
    },
  },

  landscaping: {
    "garden-consultation": {
      prompt: "A landscape gardener consulting with a homeowner in a UK residential garden, both looking at the garden layout, realistic outdoor setting, natural light, no text.",
      negativePrompt: NEG,
    },
    "patio-installation": {
      prompt: "A landscape gardener laying large patio slabs in a UK residential garden, spirit level and rubber mallet visible, realistic trade work, no text.",
      negativePrompt: NEG,
    },
    "fencing-installation": {
      prompt: "A landscaper installing a new wooden fence panel in a UK garden, post-hole digger nearby, realistic trade photography, natural daylight, no text.",
      negativePrompt: NEG,
    },
    "turfing-lawn": {
      prompt: "A landscaper rolling out new turf on a freshly prepared lawn in a UK residential garden, realistic hands pressing turf down on soil, natural light, no text.",
      negativePrompt: NEG,
    },
    "planting-borders": {
      prompt: "A landscape gardener planting shrubs and perennials in a garden border, trowel and gloves visible, realistic domestic garden, natural daylight, no text.",
      negativePrompt: NEG,
    },
    "drainage-preparation": {
      prompt: "A landscaper preparing ground drainage in a UK garden, laying pipes or gravel in a trench, realistic trade work, muddy hands and tools, no text.",
      negativePrompt: NEG,
    },
    "raised-bed-build": {
      prompt: "A landscape gardener building a timber raised bed in a UK residential garden, drill in hand, realistic construction scene, natural light, no text.",
      negativePrompt: NEG,
    },
    "completed-garden": {
      prompt: "A completed residential garden transformation — neat patio, planting borders, and lawn, tools packed away, realistic UK garden, natural daylight, no text.",
      negativePrompt: NEG,
    },
    "landscaper-tools-closeup": {
      prompt: "Close-up of landscape gardening tools — trowel, fork, secateurs and gloves — resting on garden soil, realistic outdoor scene, natural light, no text.",
      negativePrompt: NEG,
    },
  },

  "clinics-aesthetics": {
    "clinic-consultation": {
      prompt: "An aesthetics practitioner consulting with a client in a clean, calm UK aesthetics clinic room, both seated, professional and reassuring, realistic photo, no text.",
      negativePrompt: NEG,
    },
    "treatment-room": {
      prompt: "A clean, premium aesthetics treatment room in a UK clinic, white and neutral tones, treatment bed, soft lighting, professional setting, no patient present, no text.",
      negativePrompt: NEG,
    },
    "practitioner-preparation": {
      prompt: "An aesthetics nurse or practitioner preparing equipment and supplies before a treatment in a clinic room, professional attire, sterile environment, realistic photo, no text.",
      negativePrompt: NEG,
    },
    "skincare-treatment-setup": {
      prompt: "Close-up of skincare treatment products and equipment arranged on a clinical tray, premium aesthetics setting, clean and professional, no text.",
      negativePrompt: NEG,
    },
    "client-discussion": {
      prompt: "A practitioner and client discussing a skincare or aesthetics treatment plan at a desk in a UK clinic, professional interaction, calm lighting, no text.",
      negativePrompt: NEG,
    },
    "clinic-reception": {
      prompt: "A clean, welcoming aesthetics clinic reception area in the UK, neutral décor, plants, professional signage area (no text), calm and premium feel, no text.",
      negativePrompt: NEG,
    },
    "aftercare-advice": {
      prompt: "An aesthetics practitioner giving aftercare advice to a client after a treatment, both sitting, calm and professional interaction, realistic clinic setting, no text.",
      negativePrompt: NEG,
    },
    "clean-equipment-closeup": {
      prompt: "Close-up of clean, sterile aesthetics treatment equipment — syringes, swabs, professional tools — on a white clinical surface, premium close-up shot, no text.",
      negativePrompt: NEG,
    },
    "calm-premium-room": {
      prompt: "A calm, premium aesthetics clinic treatment room with soft lighting, neutral tones, treatment bed, small plants, peaceful atmosphere, wide shot, no text.",
      negativePrompt: NEG,
    },
  },

  "web-design": {
    "website-planning": {
      prompt: "A web designer sketching a website layout wireframe on paper at a clean desk, realistic creative workspace, natural light, no text on the sketch.",
      negativePrompt: "No corporate meeting, no suits, no office crowd, no text on screen.",
    },
    "laptop-site-preview": {
      prompt: "A modern laptop on a clean desk showing a professional business website homepage on screen, realistic product photography, soft natural light, no text visible on screen.",
      negativePrompt: "No text, no stock photo backgrounds, no cluttered desk.",
    },
    "mobile-responsive-preview": {
      prompt: "A smartphone and tablet showing the same business website in responsive mobile and tablet layouts, flat lay or propped, clean neutral background, realistic product photography, no text.",
      negativePrompt: "No text, no corporate setting.",
    },
    "enquiry-form-design": {
      prompt: "A web designer's laptop screen showing a clean contact/enquiry form design for a local business website, realistic close-up, neutral desk, no text readable on screen.",
      negativePrompt: "No text, no people.",
    },
    "analytics-review": {
      prompt: "A web professional looking at a website analytics dashboard on a large monitor, realistic working scene, clean office desk, no text or data readable on screen.",
      negativePrompt: "No readable data, no text.",
    },
    "brand-layout-design": {
      prompt: "A designer reviewing a brand colour palette and typography layout on a large monitor, realistic creative workspace, brand swatches visible but no text, no text.",
      negativePrompt: "No text, no crowded workspace.",
    },
    "developer-workflow": {
      prompt: "A web developer typing at a dual-monitor setup showing a website codebase and live preview, realistic creative workspace, soft indoor lighting, no text or code readable.",
      negativePrompt: "No readable code, no text.",
    },
    "client-consultation": {
      prompt: "A web designer presenting a website concept on a laptop to a local business owner at a desk, professional and relaxed interaction, realistic setting, no text.",
      negativePrompt: "No text, no corporate suits.",
    },
    "finished-website-showcase": {
      prompt: "A finished professional business website displayed on a desktop monitor and mobile phone side by side, realistic product photography, soft neutral background, no text visible on screens.",
      negativePrompt: "No text, no stock photo clichés.",
    },
  },

  heating: {
    "emergency-callout-arrival": {
      prompt: "A professional heating engineer arriving at a UK residential home with toolbox for a boiler callout, homeowner opening the door, realistic documentary-style photo, workwear, natural daylight, no text.",
      negativePrompt: NEG,
    },
    "under-sink-leak-repair": {
      prompt: "A heating engineer repairing a leaking pipe connection near a boiler in a UK utility room, visible copper pipework and tools, realistic trade photo, no text.",
      negativePrompt: NEG,
    },
    "pipework-closeup": {
      prompt: "Close-up of a heating engineer's hands using tools to repair domestic boiler pipework, visible copper fittings and pressure valves, realistic trade work, no text.",
      negativePrompt: NEG,
    },
    "water-shutoff-advice": {
      prompt: "A heating engineer showing a homeowner how to use a radiator bleed valve in a domestic property, reassuring professional instruction, realistic interior, no text.",
      negativePrompt: NEG,
    },
    "van-outside-home": {
      prompt: "A local heating engineer's van parked outside a UK residential home, engineer carrying toolbox from van, no readable branding, overcast British daylight, no text.",
      negativePrompt: NEG,
    },
    "completed-repair": {
      prompt: "A neatly completed boiler service or repair in a UK utility room, tools being packed away, boiler controls clearly visible, tidy realistic scene, no text.",
      negativePrompt: NEG,
    },
    "homeowner-consultation": {
      prompt: "A homeowner speaking with a heating engineer in a kitchen about their boiler or heating issue, both standing, professional interaction, realistic domestic interior, no text.",
      negativePrompt: NEG,
    },
    "bathroom-water-leak": {
      prompt: "A heating engineer investigating a water leak from a radiator in a domestic bedroom or bathroom, tools visible, professional posture, realistic UK home, no text.",
      negativePrompt: NEG,
    },
    "blocked-toilet-repair": {
      prompt: "A heating engineer servicing a gas combi boiler in a domestic utility room, panels open, tools on worktop, realistic trade photography, no text.",
      negativePrompt: NEG,
    },
  },
};

// ─── Scene diversity engine ───────────────────────────────────────────────────

/**
 * Given an industry, slot, and set of already-used scene IDs on this page,
 * return the best available scene ID that:
 * 1. Matches the slot preference order for this industry
 * 2. Has not been used yet on the page
 * Fallback: any unused scene for the industry.
 */
export function selectScene(
  industry: IndustryKey,
  slot: "hero" | "support" | "conversion",
  usedScenes: Set<SceneId>,
): SceneId {
  const preferences = SLOT_PREFERENCES[slot][industry] ?? [];
  const allScenes   = INDUSTRY_SCENES[industry] ?? [];

  // Try preferred scenes first (in order)
  for (const sceneId of preferences) {
    if (!usedScenes.has(sceneId)) return sceneId;
  }

  // Fall back to any unused scene for this industry
  for (const sceneId of allScenes) {
    if (!usedScenes.has(sceneId)) return sceneId;
  }

  // All scenes used (very rare) — return first preference anyway
  return preferences[0] ?? allScenes[0];
}

/**
 * Select diverse scenes for all 3 slots in one call.
 * Returns { hero, support, conversion } each with a distinct sceneId.
 */
export function selectDiverseScenes(industry: IndustryKey): {
  hero: SceneId;
  support: SceneId;
  conversion: SceneId;
} {
  const used = new Set<SceneId>();
  const hero       = selectScene(industry, "hero",       used); used.add(hero);
  const support    = selectScene(industry, "support",    used); used.add(support);
  const conversion = selectScene(industry, "conversion", used);
  return { hero, support, conversion };
}

/**
 * Validate that no two slots share the same sceneId.
 */
export function checkSceneDiversity(scenes: Record<string, string | undefined>): {
  valid: boolean;
  duplicates: string[];
} {
  const seen = new Map<string, string>();
  const duplicates: string[] = [];

  for (const [slot, sceneId] of Object.entries(scenes)) {
    if (!sceneId) continue;
    if (seen.has(sceneId)) {
      duplicates.push(`${slot} and ${seen.get(sceneId)} both use "${sceneId}"`);
    } else {
      seen.set(sceneId, slot);
    }
  }
  return { valid: duplicates.length === 0, duplicates };
}

/**
 * Resolve the IndustryKey from service name / industryType strings.
 * Returns null for digital services (web-design, local-seo, hosting).
 */
export function resolveIndustryKey(service: string, industryType?: string): IndustryKey | null {
  const s = (service ?? "").toLowerCase();
  const i = (industryType ?? "").toLowerCase();

  if (i === "plumbing"            || s.includes("plumb")    || s.includes("drain")   || s.includes("pipe"))    return "plumbing";
  if (i === "electrical"          || s.includes("electr")   || s.includes("wiring")  || s.includes("fuse"))    return "electrical";
  if (i === "landscaping"         || s.includes("landscap")  || s.includes("garden")  || s.includes("patio") ||
      s.includes("turf")          || s.includes("lawn"))                                                        return "landscaping";
  if (i === "roofing"             || s.includes("roof")     || s.includes("gutter")  || s.includes("fascia"))  return "roofing";
  if (i === "heating"             || s.includes("heat")     || s.includes("boiler")  || s.includes("hvac"))    return "heating";
  if (i === "clinics-aesthetics"  || s.includes("clinic")   || s.includes("aesthet") || s.includes("skin") ||
      s.includes("beauty")        || s.includes("botox")    || s.includes("dermal"))                            return "clinics-aesthetics";
  if (i === "web-design"          || s.includes("web")      || s.includes("design"))                           return "web-design";
  return null;
}

/**
 * Get the detailed AI prompt for a specific scene.
 * Falls back to a generic prompt if the sceneId isn't found.
 */
export function getScenePrompt(
  industry: IndustryKey,
  sceneId: SceneId,
  location: string,
): { prompt: string; negativePrompt: string } {
  const entry = SCENE_PROMPTS[industry]?.[sceneId];
  if (entry) {
    return {
      prompt:         entry.prompt.replace(/\bUK\b/g, location || "UK"),
      negativePrompt: entry.negativePrompt,
    };
  }
  // Generic fallback
  return {
    prompt:         `A professional ${industry} specialist at work in ${location}. Realistic documentary-style photography, proper workwear, residential setting, natural light, 16:9 landscape, no text.`,
    negativePrompt: NEG,
  };
}

/**
 * Get a human-readable label for a scene ID.
 */
export function sceneLabel(sceneId: SceneId): string {
  return sceneId
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Return the library file path for a scene image.
 * Callers should check this path exists before using it.
 */
export function libraryImagePath(
  baseDir: string,
  industry: IndustryKey,
  slot: "hero" | "support" | "conversion",
  sceneId: SceneId,
): string {
  return `${baseDir}/assets/image-packs/${industry}/${slot}/${sceneId}.jpg`;
}
