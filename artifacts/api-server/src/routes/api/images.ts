
import { Router, Request, Response, NextFunction } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import { logUsage, checkServerKeyLimit, COST_PER_IMAGE } from "./usage.js";
import {
  assignImageRoles,
  getPackEntries,
  ALL_ROLES,
  ROLE_LABELS,
  mapToPackIndustry,
  type ImageRole,
} from "../../../../../src/local-seo/imageRoleAssigner.js";
import {
  resolveIndustryKey,
  selectScene,
  getScenePrompt,
  libraryImagePath,
  sceneLabel,
  type ImageSourceMode,
  type SceneId,
  type IndustryKey,
} from "../../../../../src/local-seo/sceneLibrary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const OUTPUT_DIR     = path.join(WORKSPACE_ROOT, "output");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

const router = Router();

// ─── Image processing constants ───────────────────────────────────────────────

const SLOT_SPECS: Record<string, { width: number; height: number }> = {
  hero:       { width: 1600, height: 900 },
  support:    { width: 1200, height: 800 },
  trust:      { width: 1200, height: 800 },
  conversion: { width: 1200, height: 800 },
  thumb:      { width: 400,  height: 300 },
};

const SLOT_SUITABILITY: Record<string, { ideal: number; warn: number }> = {
  hero:       { ideal: 1600, warn: 1200 },
  support:    { ideal: 1200, warn: 800 },
  trust:      { ideal: 1200, warn: 800 },
  conversion: { ideal: 1200, warn: 800 },
};

const ALLOWED_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const HARD_LIMIT_BYTES = 20 * 1024 * 1024;  // 20MB

// ─── Multer — save uploads to output/{slug}/uploads/ ──────────────────────
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const slug = (req.body?.slug as string) || "unknown";
    const dir = path.join(OUTPUT_DIR, slug, "uploads");
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: HARD_LIMIT_BYTES },
  fileFilter: (_req, file, cb) => {
    // Accept obvious MIME types; magic-byte check happens after save
    const accepted = [...ALLOWED_MIMES, "image/jpeg", "application/octet-stream"];
    // Reject SVG/GIF immediately
    if (file.mimetype === "image/svg+xml" || file.mimetype === "image/gif") {
      cb(new Error("Unsupported image format. Please upload JPG, PNG, or WebP."));
    } else {
      cb(null, true);
    }
  },
});

/** Wrap multer so we can return JSON errors instead of HTML. */
function uploadMiddleware(req: Request, res: Response, next: NextFunction) {
  upload.single("file")(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Image exceeds 20MB limit. Please upload a smaller file." });
      return;
    }
    if (err instanceof Error) {
      res.status(422).json({ error: err.message });
      return;
    }
    next();
  });
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Detect real MIME type from file magic bytes — don't trust the extension. */
function detectMimeType(filePath: string): string {
  try {
    const buf = Buffer.alloc(12);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    if (buf[0] === 0xFF && buf[1] === 0xD8) return "image/jpeg";
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) return "image/png";
    if (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a") return "image/gif";
    if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  } catch { /* fallback */ }
  return "image/jpeg";
}

/** Map MIME type to canonical file extension. */
function mimeToExt(mime: string): string {
  if (mime === "image/webp") return ".webp";
  if (mime === "image/png")  return ".png";
  return ".jpg";
}

/** Find the first existing file for a slot across all allowed extensions. */
function findSlotFile(assetDir: string, slot: string): string | null {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const p = path.join(assetDir, `${slot}${ext}`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/** Check whether an uploaded image is suitable for a given slot. */
function checkSuitability(
  width: number | undefined,
  slot: string
): { warning?: string } {
  if (!width || !SLOT_SUITABILITY[slot]) return {};
  const t = SLOT_SUITABILITY[slot];
  if (width < t.warn) {
    return { warning: `Image may appear low quality in this slot (${width}px width — minimum is ${t.warn}px)` };
  }
  if (width < t.ideal) {
    return { warning: `Image may appear low quality in this slot (${width}px — ideal is ${t.ideal}px)` };
  }
  return {};
}

/** Process an uploaded image through Sharp — generate hero/support/conversion/thumb versions. */
async function processImage(
  filePath: string,
  uploadDir: string,
  imageId: string,
  mime: string
): Promise<{
  original: { width: number; height: number; size: number; mime: string };
  processedPaths: Record<string, string>;
  warnings: string[];
}> {
  const sharp = (await import("sharp")).default;
  const meta  = await sharp(filePath).metadata();
  const origWidth  = meta.width  ?? 0;
  const origHeight = meta.height ?? 0;
  const origSize   = fs.statSync(filePath).size;
  const ext        = mimeToExt(mime);

  const processedDir = path.join(uploadDir, "processed", imageId);
  fs.mkdirSync(processedDir, { recursive: true });

  const warnings: string[] = [];
  const processedPaths: Record<string, string> = {};

  for (const [slot, spec] of Object.entries(SLOT_SPECS)) {
    const destFile = path.join(processedDir, `${slot}${ext}`);

    let pipeline = sharp(filePath).resize({
      width:             spec.width,
      height:            spec.height,
      fit:               "cover",
      position:          "centre",
      withoutEnlargement: true,
    });

    if (mime === "image/webp") {
      pipeline = pipeline.webp({ quality: 82 });
    } else if (mime === "image/png") {
      pipeline = pipeline.png({ compressionLevel: 8 });
    } else {
      pipeline = pipeline.jpeg({ quality: 82, progressive: true });
    }

    await pipeline.toFile(destFile);
    processedPaths[slot] = path.join("processed", imageId, `${slot}${ext}`);
  }

  // Size-suitability warnings (once per slot with thresholds)
  for (const [slot, thresholds] of Object.entries(SLOT_SUITABILITY)) {
    if (origWidth < thresholds.warn) {
      warnings.push(
        `Image width (${origWidth}px) is below the minimum recommended for ${slot} slot ` +
        `(${thresholds.warn}px) — it may appear low quality`
      );
    }
  }

  return {
    original:      { width: origWidth, height: origHeight, size: origSize, mime },
    processedPaths,
    warnings,
  };
}

function loadProject(slug: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, `${slug}.json`), "utf8"));
  } catch { return null; }
}

function saveProject(slug: string, data: Record<string, unknown>): void {
  fs.writeFileSync(path.join(PROJECTS_DIR, `${slug}.json`), JSON.stringify(data, null, 2));
}

function resolveIdeogramKey(slug?: string): { key: string; source: "server" | "project" } | null {
  if (slug) {
    const cfg = loadProject(slug);
    if (cfg?.integrations && typeof cfg.integrations === "object") {
      const k = (cfg.integrations as Record<string, unknown>).ideogramApiKey;
      if (typeof k === "string" && k) return { key: k, source: "project" };
    }
  }
  const envKey = process.env.IDEOGRAM_API_KEY;
  if (envKey) return { key: envKey, source: "server" };
  return null;
}

// ─── Structured Prompt Builder ─────────────────────────────────────────────

interface PromptParams {
  businessType?: string;
  mainService?: string;
  serviceKey?: string;
  serviceName?: string;
  location?: string;
  imageSlot: string;
  imageRole?: ExtendedImageRole;
  primaryKeyword?: string;
  shortPageDescription?: string;
  style?: string;
  brandColors?: string[];
  toneOfVoice?: string;
  industryType?: string;
}

type ExtendedImageRole = "heroImage" | "earlySupportImage" | "problemImage" | "trustImage" | "conversionImage";
type TradeScene = "hero" | "support" | "conversion";
type TradeIndustryKey = "plumbing" | "electrical" | "landscaping" | "roofing" | "heating";

interface TradeIndustryConfig {
  role: string;
  actions: Record<TradeScene, string>;
  environments: Record<TradeScene, string>;
}

const TRADE_INDUSTRIES_API: Record<TradeIndustryKey, TradeIndustryConfig> = {
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

const TRADE_NEGATIVE_PROMPT_API =
  "office, desk, laptop, suit, meeting room, call centre, digital screens, generic people posing, " +
  "corporate environment, text overlays, logos, watermarks, cartoon, illustration, vector art, " +
  "web design, digital marketing, agency, computer, whiteboard, staged studio backdrop";

const STRUCTURED_NEGATIVE_PROMPT =
  "text, watermarks, logos, branding, signage, words, letters, numbers, cartoon, illustration, " +
  "painting, digital art, distorted faces, extra limbs, horror, explicit content, stock photo style, " +
  "generic office setting, staged studio backdrop";

const SLOT_DEFAULT_ROLE: Record<string, ImageRole> = {
  hero:       "heroImage",
  support:    "earlySupportImage",
  conversion: "conversionImage",
};

// ── Business-type scene map ───────────────────────────────────────────────────
type BusinessTypeSceneMap = Record<string, Record<ExtendedImageRole, string>>;

const businessTypeSceneMap: BusinessTypeSceneMap = {
  plumber: {
    heroImage:        "a professional plumber repairing or installing pipework or a boiler in a clean UK home kitchen or utility room",
    earlySupportImage:"a plumber working on pipes, radiators or drainage systems using tools in a domestic setting",
    problemImage:     "a leaking pipe, blocked drain or water issue inside a clean UK home, realistic but controlled",
    trustImage:       "a plumber explaining completed work to a homeowner in a kitchen or home setting",
    conversionImage:  "a clean finished plumbing installation with polished pipework or a modern bathroom or kitchen sink area",
  },
  electrician: {
    heroImage:        "a professional electrician working on a consumer unit or wiring in a modern UK home",
    earlySupportImage:"an electrician installing lighting, sockets or electrical components using tools",
    problemImage:     "a faulty socket or electrical issue being inspected safely in a domestic setting",
    trustImage:       "an electrician discussing work with a homeowner in a living space",
    conversionImage:  "a clean finished electrical installation with modern lighting and sockets",
  },
  builder: {
    heroImage:        "a builder working on a home renovation or extension project in a UK property",
    earlySupportImage:"builders installing brickwork, plastering or interior renovation work",
    problemImage:     "a worn or damaged room needing renovation, clean but clearly outdated",
    trustImage:       "a builder reviewing plans with a homeowner inside a property",
    conversionImage:  "a fully renovated modern room or home interior with clean finishes",
  },
  roofer: {
    heroImage:        "a roofer working on a residential roof in the UK with tiles and tools visible",
    earlySupportImage:"roof repair or tile replacement work in progress on a house",
    problemImage:     "damaged or missing roof tiles on a UK home",
    trustImage:       "a roofer discussing roofing work with a homeowner outside the property",
    conversionImage:  "a clean finished roof with new tiles on a residential property",
  },
  gardener: {
    heroImage:        "a gardener maintaining a clean UK garden with lawn and plants",
    earlySupportImage:"garden maintenance such as trimming hedges or mowing a lawn",
    problemImage:     "an overgrown or untidy garden needing maintenance",
    trustImage:       "a gardener discussing garden work with a homeowner outdoors",
    conversionImage:  "a beautifully maintained garden with clean lawn and planted borders",
  },
  hairdresser: {
    heroImage:        "a hairdresser styling a client's hair in a modern UK salon",
    earlySupportImage:"hair cutting or colouring in progress with tools and styling station",
    problemImage:     "a person with unstyled or messy hair before treatment in a salon setting",
    trustImage:       "a consultation between hairdresser and client in front of a mirror",
    conversionImage:  "a finished hairstyle with clean styling and healthy glossy hair",
  },
  accountant: {
    heroImage:        "an accountant working with a client in a modern UK office setting",
    earlySupportImage:"accounting work with laptop, calculator and organised documents",
    problemImage:     "messy financial paperwork or receipts on a desk",
    trustImage:       "a professional meeting between accountant and business owner",
    conversionImage:  "a clean organised desk with financial success visuals and tidy documents",
  },
  restaurant: {
    heroImage:        "a modern UK restaurant interior with warm lighting and dining tables",
    earlySupportImage:"a chef preparing food in a clean kitchen environment",
    problemImage:     "an empty or poorly presented dining setup",
    trustImage:       "staff serving customers in a friendly restaurant environment",
    conversionImage:  "a beautifully plated meal served in a restaurant setting",
  },
  cleaner: {
    heroImage:        "a professional cleaner working in a modern UK home or office",
    earlySupportImage:"cleaning surfaces, vacuuming or sanitising a room",
    problemImage:     "a messy or dirty room before cleaning",
    trustImage:       "a cleaner interacting with a client or preparing equipment",
    conversionImage:  "a spotless clean room with polished surfaces",
  },
  mechanic: {
    heroImage:        "a mechanic working on a car engine in a clean UK garage",
    earlySupportImage:"vehicle repair or maintenance in progress with tools",
    problemImage:     "a car with visible issue being inspected in a garage",
    trustImage:       "a mechanic explaining vehicle work to a customer",
    conversionImage:  "a clean repaired car ready for collection",
  },
  florist: {
    heroImage:        "a florist arranging fresh flowers in a modern shop",
    earlySupportImage:"flower arrangement being created with tools and stems",
    problemImage:     "wilted or unarranged flowers",
    trustImage:       "a florist helping a customer choose flowers",
    conversionImage:  "a beautiful finished bouquet arrangement",
  },
  coffeeShop: {
    heroImage:        "a modern UK coffee shop interior with seating and warm lighting",
    earlySupportImage:"barista preparing coffee with espresso machine",
    problemImage:     "an empty or uninviting cafe space",
    trustImage:       "friendly barista serving a customer",
    conversionImage:  "a well-presented coffee and pastry on a table",
  },
  paving: {
    heroImage:        "a paving specialist installing a driveway or patio in a UK home",
    earlySupportImage:"laying paving stones or blocks in progress",
    problemImage:     "damaged or uneven driveway or patio",
    trustImage:       "a contractor discussing paving work with a homeowner",
    conversionImage:  "a clean finished driveway or patio area",
  },
  interiorDesign: {
    heroImage:        "a modern interior designed living space in a UK home",
    earlySupportImage:"interior designer working with samples or plans",
    problemImage:     "an outdated or poorly styled room",
    trustImage:       "designer consulting with a client in a home setting",
    conversionImage:  "a beautifully styled modern interior space",
  },
  painter: {
    heroImage:        "a painter decorating a room in a UK home",
    earlySupportImage:"painting walls or surfaces with tools",
    problemImage:     "peeling paint or damaged walls",
    trustImage:       "a decorator discussing work with a homeowner",
    conversionImage:  "freshly painted clean interior walls",
  },
  beautySalon: {
    heroImage:        "a modern beauty salon treatment room",
    earlySupportImage:"beauty treatment in progress such as facial or skincare",
    problemImage:     "skin concerns before treatment in a professional setting",
    trustImage:       "consultation between therapist and client",
    conversionImage:  "a clean glowing skin result after treatment",
  },
  windowCleaner: {
    heroImage:        "a window cleaner working on a residential property in the UK",
    earlySupportImage:"cleaning windows using professional tools",
    problemImage:     "dirty or streaked windows on a house",
    trustImage:       "window cleaner interacting with homeowner",
    conversionImage:  "clean clear windows reflecting light",
  },
  nailClinic: {
    heroImage:        "a nail technician working in a modern salon",
    earlySupportImage:"nail treatment in progress with tools",
    problemImage:     "untreated nails before service",
    trustImage:       "consultation between technician and client",
    conversionImage:  "clean finished nails with polished result",
  },
  childcare: {
    heroImage:        "a safe modern childcare environment with children playing",
    earlySupportImage:"staff supervising children activities",
    problemImage:     "a parent looking concerned about childcare arrangements",
    trustImage:       "childcare staff interacting positively with children",
    conversionImage:  "happy children in a clean safe environment",
  },
  petGrooming: {
    heroImage:        "a pet groomer working on a dog in a clean salon",
    earlySupportImage:"grooming process such as brushing or trimming",
    problemImage:     "a dog with messy or untrimmed fur",
    trustImage:       "groomer interacting calmly with pet and owner",
    conversionImage:  "a clean well-groomed pet",
  },
  landscaping: {
    heroImage:        "a landscaping project in progress in a UK garden",
    earlySupportImage:"laying turf, planting or garden construction",
    problemImage:     "a bare or poorly maintained outdoor space",
    trustImage:       "landscaper discussing plans with homeowner",
    conversionImage:  "a fully landscaped modern garden",
  },
  locksmith: {
    heroImage:        "a locksmith working on a door lock at a UK property",
    earlySupportImage:"lock repair or installation in progress",
    problemImage:     "a door lock issue being inspected",
    trustImage:       "locksmith assisting a customer at their property",
    conversionImage:  "a secure modern lock installed on a door",
  },
  travelAgent: {
    heroImage:        "a travel consultant working with a client in a modern office",
    earlySupportImage:"planning travel on a laptop with maps and brochures",
    problemImage:     "a person confused by travel planning options",
    trustImage:       "a friendly consultation about holiday plans",
    conversionImage:  "a relaxing travel destination scene",
  },
  personalTrainer: {
    heroImage:        "a personal trainer coaching a client in a gym",
    earlySupportImage:"training session in progress with equipment",
    problemImage:     "a person struggling with fitness goals",
    trustImage:       "trainer discussing goals with client",
    conversionImage:  "a fit healthy result after training",
  },
  communityPharmacy: {
    heroImage:        "a modern UK pharmacy interior with staff assisting customers",
    earlySupportImage:"pharmacist preparing prescriptions or assisting a customer",
    problemImage:     "a person seeking help for a health concern",
    trustImage:       "a pharmacist consulting with a patient at the counter",
    conversionImage:  "a clean professional pharmacy service interaction",
  },
};

const GENERIC_ROLE_SCENES: Record<ExtendedImageRole, string> = {
  heroImage:        "a professional local business carrying out its main service in a clean, trustworthy UK setting",
  earlySupportImage:"a clear service-in-action scene showing tools, equipment or process related to the service",
  problemImage:     "a realistic customer problem or service issue being solved professionally",
  trustImage:       "a friendly professional consultation or workmanship scene that builds confidence",
  conversionImage:  "a clean finished result showing the successful outcome of the service",
};

/**
 * Normalise a free-text businessType string to the camelCase keys used in
 * businessTypeSceneMap.  Handles spaces, hyphens, common variants.
 */
function normaliseBusinessType(raw: string): string {
  const s = raw.toLowerCase().trim().replace(/[-_]/g, " ");
  // Multi-word mappings first (most-specific)
  if (s.includes("coffee") || s.includes("cafe") || s.includes("café"))   return "coffeeShop";
  if (s.includes("beauty salon") || s.includes("beauty therapist"))        return "beautySalon";
  if (s.includes("nail"))                                                   return "nailClinic";
  if (s.includes("window clean"))                                           return "windowCleaner";
  if (s.includes("personal train"))                                         return "personalTrainer";
  if (s.includes("community pharmacy") || s.includes("pharmacy"))          return "communityPharmacy";
  if (s.includes("interior design"))                                        return "interiorDesign";
  if (s.includes("pet groom") || s.includes("dog groom"))                  return "petGrooming";
  if (s.includes("travel agent") || s.includes("travel consult"))          return "travelAgent";
  if (s.includes("landscape") || (s.includes("garden") && s.includes("design"))) return "landscaping";
  if (s.includes("pav") || s.includes("driveway") || s.includes("patio"))  return "paving";
  // Single-word / partial mappings
  if (s.includes("plumb") || s.includes("drain") || s.includes("pipe"))    return "plumber";
  if (s.includes("electr") || s.includes("wiring"))                        return "electrician";
  if (s.includes("roof") || s.includes("gutter") || s.includes("fascia"))  return "roofer";
  if (s.includes("garden") || s.includes("lawn") || s.includes("hedge"))   return "gardener";
  if (s.includes("hair") || s.includes("barber") || s.includes("salon"))   return "hairdresser";
  if (s.includes("account") || s.includes("bookkeep") || s.includes("tax")) return "accountant";
  if (s.includes("restaurant") || s.includes("takeaway") || s.includes("bistro")) return "restaurant";
  if (s.includes("clean") || s.includes("maid") || s.includes("housekeep")) return "cleaner";
  if (s.includes("mechanic") || s.includes("garage") || s.includes("car repair")) return "mechanic";
  if (s.includes("florist") || s.includes("flower"))                        return "florist";
  if (s.includes("paint") || s.includes("decorat"))                         return "painter";
  if (s.includes("lock"))                                                    return "locksmith";
  if (s.includes("build") || s.includes("construct") || s.includes("renovat")) return "builder";
  if (s.includes("childcare") || s.includes("nursery") || s.includes("childmind")) return "childcare";
  // Return the normalised string as-is; map lookup will miss and use generic fallback
  return s.replace(/\s+(.)/g, (_, c: string) => c.toUpperCase()); // basic camelCase
}

function buildRoleScene(role: ExtendedImageRole, businessType: string, primaryKeyword: string): string {
  const normKey = normaliseBusinessType(businessType);
  const sceneEntry = businessTypeSceneMap[normKey];
  const scene = sceneEntry?.[role] ?? GENERIC_ROLE_SCENES[role];

  console.log(`[promptBuilder] businessType="${businessType}" → normKey="${normKey}" | role="${role}" | scene="${scene}"`);

  return scene;
}

// ─── Service Visual Context Layer ──────────────────────────────────────────
// Injects MANDATORY visual anchors and explicit exclusions into the AI prompt.
// Keyed by normalised service identifier (camelCase).
//
// Role → pool mapping:
//   heroImage / earlySupportImage / trustImage → coreMust
//   problemImage                               → problemMust
//   conversionImage                            → resultMust
//
// mustNot applies across all roles for that service.
// A shared global exclusion list is added in buildPrompt() regardless of service.

interface VisualContextEntry {
  coreMust:    string[];  // mandatory visual anchor items (bullet list)
  problemMust: string[];  // mandatory visuals for the problem-framing role
  resultMust:  string[];  // mandatory visuals for the conversion/result role
  mustNot:     string[];  // service-specific images/scenes to explicitly exclude
}

// Shared global exclusions applied to every non-trade prompt
const SHARED_VISUAL_EXCLUSIONS: string[] = [
  "generic office scenes without clear service-specific context",
  "blank or dark screens on any device",
  "laptops or monitors showing unrelated or empty content",
  "abstract business imagery with no service relevance",
  "distorted hands, unrealistic faces, or warped text on screens",
  "any visible brand names, logos, watermarks, or readable text",
];

const SERVICE_VISUAL_CONTEXT: Record<string, VisualContextEntry> = {
  emailMarketing: {
    coreMust: [
      "an email campaign dashboard clearly showing open rates and click-rate charts on screen",
      "a visible email interface or inbox with marketing campaign emails and subject lines visible",
      "email marketing performance graphs or subscriber analytics clearly displayed on screen",
    ],
    problemMust: [
      "an email analytics dashboard with flat or declining open-rate graphs clearly visible",
      "an inbox full of unread or ignored marketing emails with no engagement",
      "campaign metrics on screen showing near-zero clicks or high unsubscribe rates",
    ],
    resultMust: [
      "an email campaign dashboard with clearly rising open-rate and click-rate graphs on screen",
      "subscriber growth chart or conversion analytics showing strong upward trend",
      "email performance report with positive campaign results clearly displayed",
    ],
    mustNot: [
      "generic laptops without a clearly visible email or analytics interface",
      "people at desks without clear email marketing context on their screens",
      "smartphones or computers with blank or unrelated screen content",
    ],
  },

  webDesign: {
    coreMust: [
      "a professional website interface clearly displayed on a large desktop monitor",
      "a visible website homepage with navigation header and hero section on screen",
      "design wireframes, mockups, or website layouts clearly visible on screen or board",
    ],
    problemMust: [
      "an outdated or cluttered website with poor layout clearly visible on a monitor",
      "a website displaying incorrectly or broken on a smartphone screen",
      "confusing navigation or broken page layout visible on a device screen",
    ],
    resultMust: [
      "a modern clean business website homepage clearly visible on a large monitor",
      "responsive website design shown beautifully on desktop and smartphone side by side",
      "professional website with clear call-to-action button and polished layout on screen",
    ],
    mustNot: [
      "generic laptops without a visible website or design interface on screen",
      "coding environments or terminals without website design context",
      "abstract desk scenes without clearly visible website or UI content",
    ],
  },

  webHosting: {
    coreMust: [
      "physical server racks in a modern data centre with LED status indicators clearly visible",
      "a server monitoring dashboard showing uptime metrics and performance graphs on screen",
      "hosting control panel or infrastructure dashboard with measurable server stats clearly shown",
    ],
    problemMust: [
      "a browser displaying a website error page such as a 500 or 503 error message",
      "a server monitoring dashboard with red alert indicators or downtime warnings visible",
      "a loading spinner frozen on a laptop screen suggesting a slow or unavailable website",
    ],
    resultMust: [
      "a server dashboard with all-green status indicators and 99.9% uptime clearly displayed",
      "a website speed test result on screen showing an excellent fast load time",
      "a clean hosting control panel with stable green-status performance metrics",
    ],
    mustNot: [
      "generic office workers without server or infrastructure context visible on screen",
      "stock images of people typing without visible server dashboards or hosting panels",
      "abstract data visualisations without clear hosting or server infrastructure context",
    ],
  },

  localSeo: {
    coreMust: [
      "a Google search results page with a local business clearly shown in position one or the map pack",
      "an SEO analytics dashboard showing keyword rankings and organic traffic graphs on screen",
      "a Google Maps view with a local business prominently featured at the top of the listing",
    ],
    problemMust: [
      "a Google search results page showing a business clearly buried on page two or three",
      "an SEO analytics dashboard with a flat or declining organic traffic graph on screen",
      "a Google Maps view showing competitor businesses ranked above the subject business",
    ],
    resultMust: [
      "a Google search results page showing the business at position one with star ratings visible",
      "an SEO dashboard with a clearly rising traffic graph and ranking improvement data on screen",
      "a Google Maps local pack showing the business at the top with strong positive reviews",
    ],
    mustNot: [
      "generic office scenes without visible search results or SEO dashboards on screens",
      "social media or unrelated digital channels instead of search engine context",
      "abstract marketing visuals without clear Google search or ranking content",
    ],
  },

  seo: {
    coreMust: [
      "an SEO analytics dashboard showing keyword positions and organic traffic growth on screen",
      "a Google search results page with a website ranked clearly in the top positions",
      "a keyword ranking report with position data and traffic metrics clearly visible on screen",
    ],
    problemMust: [
      "a Google search results page showing low organic rankings or page two results",
      "an SEO analytics dashboard with a flat or declining traffic graph clearly on screen",
    ],
    resultMust: [
      "an SEO dashboard showing clear ranking improvements and significant traffic growth",
      "a Google search results page with the website in position one with a featured snippet",
    ],
    mustNot: [
      "generic laptops without visible search analytics or ranking data on screen",
      "social media dashboards or unrelated digital marketing channels",
      "office scenes without clearly visible SEO or search engine data",
    ],
  },

  socialMedia: {
    coreMust: [
      "a social media management dashboard showing scheduled posts and platform analytics on screen",
      "a smartphone or monitor displaying a business social media profile with visible engagement metrics",
      "follower growth or post engagement analytics clearly visible on a social media dashboard",
    ],
    problemMust: [
      "a business social media profile with very low follower count and zero engagement clearly visible",
      "an empty social media feed with no posts or audience interactions shown on screen",
    ],
    resultMust: [
      "a social media analytics dashboard showing strong follower growth and high engagement rates",
      "a business social media profile with high like, comment, and share counts clearly visible",
    ],
    mustNot: [
      "generic people using phones without a visible social media interface on screen",
      "blank screens or laptops without visible social media content or profiles",
      "abstract social icons or generic branding without dashboard or profile context",
    ],
  },

  ppc: {
    coreMust: [
      "a Google Ads campaign dashboard showing impressions, clicks, and conversions clearly on screen",
      "a browser showing a search results page with a paid advertisement in the top sponsored position",
      "campaign performance metrics including ROAS, cost-per-click, or conversion data clearly visible",
    ],
    problemMust: [
      "a Google Ads dashboard showing high cost-per-click and low conversion rate on screen",
      "a campaign reporting screen showing high wasted ad spend with minimal results visible",
    ],
    resultMust: [
      "a Google Ads dashboard showing strong ROAS and high conversion volume clearly on screen",
      "a paid search analytics report with improved click-through rate and reduced acquisition cost",
    ],
    mustNot: [
      "generic office scenes without visible Google Ads or PPC campaign dashboards",
      "social media advertising instead of Google search or PPC campaign context",
      "laptops with blank or unrelated screens without ad campaign data",
    ],
  },

  contentMarketing: {
    coreMust: [
      "a clean professional blog article or editorial content displayed on a website on screen",
      "a content calendar or editorial planning tool clearly visible on a monitor",
      "an analytics dashboard showing blog article traffic and content performance metrics on screen",
    ],
    problemMust: [
      "a business website with an empty blog or content section clearly visible on a monitor",
      "an analytics dashboard showing zero or very low organic traffic from content",
    ],
    resultMust: [
      "a blog post displayed prominently in Google search results at position one on screen",
      "a content analytics dashboard showing significant organic traffic driven by published articles",
    ],
    mustNot: [
      "generic writers at desks without visible article or content interface on their screens",
      "abstract creative scenes without clear content, editorial, or publishing context",
      "social media content instead of blog or article publishing context",
    ],
  },

  digitalMarketing: {
    coreMust: [
      "a multi-channel marketing dashboard showing SEO, social media, and email performance panels on screen",
      "multiple monitors in a marketing office displaying campaign analytics dashboards",
      "a marketing analytics report with performance data across digital channels clearly on screen",
    ],
    problemMust: [
      "a business with no online presence or an empty marketing dashboard showing zero activity",
      "a marketing analytics screen showing poor performance metrics across all channels",
    ],
    resultMust: [
      "a comprehensive marketing dashboard with positive results across multiple digital channels on screen",
      "a marketing professional presenting growth analytics with clearly rising graphs to a client",
    ],
    mustNot: [
      "single-channel imagery such as only email or only social media without multi-channel dashboard context",
      "generic office meetings without clearly visible digital marketing dashboards or campaign data",
      "abstract technology imagery without clear marketing performance or analytics context",
    ],
  },
};

/**
 * Map a raw service key or service name to a SERVICE_VISUAL_CONTEXT entry key.
 * Returns null if no match is found.
 */
function detectVisualContextKey(raw: string): string | null {
  const s = (raw ?? "").toLowerCase().replace(/[-_\s]/g, "");
  if (s.includes("emailmarket") || (s.includes("email") && s.includes("market"))) return "emailMarketing";
  if (s.includes("webdesign")   || s.includes("websitedesign"))                   return "webDesign";
  if (s.includes("webhost")     || s.includes("hosting"))                          return "webHosting";
  if (s.includes("localseo")    || s.includes("localsearch"))                      return "localSeo";
  if (s.includes("socialmedia") || s.includes("social"))                           return "socialMedia";
  if (s.includes("googleads")   || s.includes("ppc") || s.includes("adwords"))    return "ppc";
  if (s.includes("contentmark") || s.includes("blogcontent"))                      return "contentMarketing";
  if (s.includes("seo")         || s.includes("searchengine"))                     return "seo";
  if (s.includes("digital")     || s.includes("agency") || s.includes("online"))  return "digitalMarketing";
  return null;
}

/**
 * Returns the mandatory visual anchors and exclusions for the given service and image role.
 * heroImage / earlySupportImage / trustImage → coreMust
 * problemImage → problemMust
 * conversionImage → resultMust
 * Returns null if no service context is available.
 */
function selectVisualContext(
  serviceKey:  string | undefined,
  serviceName: string | undefined,
  imageRole:   ExtendedImageRole,
): { must: string[]; mustNot: string[] } | null {
  const normKey =
    detectVisualContextKey(serviceKey  ?? "") ??
    detectVisualContextKey(serviceName ?? "");
  if (!normKey) return null;

  const entry = SERVICE_VISUAL_CONTEXT[normKey];
  if (!entry)   return null;

  let must: string[];
  if      (imageRole === "problemImage")    must = entry.problemMust;
  else if (imageRole === "conversionImage") must = entry.resultMust;
  else                                      must = entry.coreMust;

  return { must, mustNot: entry.mustNot };
}

// ─── Email Marketing Hard-Coded Override ───────────────────────────────────
// Email marketing images MUST use visual metaphors (envelope icons, campaign
// cards, automation arrows, subscriber panels, arc graphs) because "no text"
// conflicts with trying to show readable dashboard screens.
// Each image role gets its own scene so the imagery is contextually correct.

const EMAIL_MARKETING_OVERRIDE_PROMPTS: Record<ExtendedImageRole, string> = {
  heroImage:
    `wide angle composition, subject centred, designed for website layout with space around subject, ` +
    `create a photorealistic modern commercial website image for an email marketing service. ` +
    `Show a small business owner or marketing professional at a clean modern desk surrounded by ` +
    `large semi-transparent abstract email envelope icons, campaign workflow cards, ` +
    `automation flow lines connecting campaign stages, and subscriber contact-list panels ` +
    `integrated into the environment as soft physical overlays. ` +
    `Analytics-style arc graphs and engagement bar shapes appear in the background. ` +
    `Stylised envelope silhouettes, segmented list blocks, message bubble shapes, ` +
    `and curved automation arrows are woven into the scene as visual metaphors. ` +
    `Realistic human subject, warm professional studio lighting, clean modern workspace, 16:9 format.`,

  earlySupportImage:
    `wide angle composition, subject centred, designed for website layout with space around subject, ` +
    `create a photorealistic modern commercial website image for an email marketing service. ` +
    `Show a campaign workflow scene built from abstract visual metaphors: ` +
    `large stylised email envelope icons arranged in a send sequence, ` +
    `campaign sequence cards connected by automation arrows, ` +
    `subscriber segment panels and audience group blocks, ` +
    `open-rate arc graphs and click-engagement bar shapes. ` +
    `A marketing professional in the mid-ground provides human scale. ` +
    `Clean modern environment, UI-inspired visual language, professional studio lighting, 16:9 format.`,

  trustImage:
    `wide angle composition, subject centred, designed for website layout with space around subject, ` +
    `create a photorealistic modern commercial website image for an email marketing service. ` +
    `Show a friendly consultation between a marketing professional and a small business client, ` +
    `with large abstract email envelope icons, campaign cards, subscriber list panels, ` +
    `and open-rate arc graphs softly integrated into the scene as environmental overlays. ` +
    `Warm professional lighting, modern bright meeting space, genuine human interaction moment, 16:9 format.`,

  problemImage:
    `wide angle composition, subject centred, designed for website layout with space around subject, ` +
    `create a photorealistic modern commercial website image representing email marketing problems. ` +
    `Show a frustrated small business owner surrounded by visual metaphors of campaign failure: ` +
    `stacked ignored envelope icons with downward arc graphs, ` +
    `flat campaign cards showing no open-rate engagement, ` +
    `fragmented broken automation arrows that fail to connect. ` +
    `Muted cool tones, subdued lighting suggesting poor results and lost opportunity, 16:9 format.`,

  conversionImage:
    `wide angle composition, subject centred, designed for website layout with space around subject, ` +
    `create a photorealistic modern commercial website image representing email marketing success. ` +
    `Show a confident marketing professional surrounded by abstract visual metaphors of campaign success: ` +
    `multiple open envelope icons arranged in an upward arc, ` +
    `rising engagement bar graph shapes, organised subscriber segment panels, ` +
    `flowing automation arrows connecting campaign stages, campaign success cards. ` +
    `Warm confident lighting, clean modern workspace, strong positive atmosphere, 16:9 format.`,
};

const EMAIL_MARKETING_NEGATIVE_PROMPT =
  `generic laptop scene, plain office meeting, random business people at desks without email marketing context, ` +
  `unrelated web design, coding, ecommerce, finance, or social media scenes, ` +
  `readable text, logos, brand names, watermarks, signage, captions, overlays, ` +
  `distorted hands, unrealistic faces, stock photo clichés, blurry or dark composition`;

/**
 * Returns true if any of the service identifiers indicate email marketing.
 */
function isEmailMarketingService(
  serviceKey:   string | undefined,
  serviceName:  string | undefined,
  mainService:  string | undefined,
  businessType: string | undefined,
): boolean {
  const targets = [serviceKey, serviceName, mainService, businessType].map(
    v => (v ?? "").toLowerCase().replace(/[-_\s]/g, ""),
  );
  return targets.some(t => t.includes("emailmarket") || (t.includes("email") && t.includes("market")));
}

function detectTradeIndustryApi(service: string, industryType?: string): TradeIndustryKey | null {
  const s = (service ?? "").toLowerCase();
  const i = (industryType ?? "").toLowerCase();
  if (i === "plumbing"    || s.includes("plumb")    || s.includes("drain")   || s.includes("pipe"))    return "plumbing";
  if (i === "electrical"  || s.includes("electr")   || s.includes("wiring")  || s.includes("fuse"))    return "electrical";
  if (i === "landscaping" || s.includes("landscap")  || s.includes("garden")  || s.includes("patio") ||
      s.includes("turf")  || s.includes("lawn"))                                                        return "landscaping";
  if (i === "roofing"     || s.includes("roof")     || s.includes("gutter")  || s.includes("fascia"))  return "roofing";
  if (i === "heating"     || s.includes("heat")     || s.includes("boiler")  || s.includes("hvac"))    return "heating";
  return null;
}

function buildPrompt(p: PromptParams): { prompt: string; negativePrompt?: string } {
  const slot = p.imageSlot;
  const loc  = p.location || "the local area";

  // ── Email marketing hard-coded override ────────────────────────────────────
  // Uses visual metaphors (envelope icons, automation arrows, arc graphs)
  // rather than relying on readable screen text, which conflicts with "no text".
  if (isEmailMarketingService(p.serviceKey, p.serviceName, undefined, undefined)) {
    const imageRole = p.imageRole ?? (SLOT_DEFAULT_ROLE[slot] as ExtendedImageRole) ?? "heroImage";
    const prompt    = EMAIL_MARKETING_OVERRIDE_PROMPTS[imageRole] ?? EMAIL_MARKETING_OVERRIDE_PROMPTS.heroImage;
    console.log(
      `[promptBuilder] EMAIL_MARKETING_OVERRIDE | businessType="${p.businessType}" | serviceKey="${p.serviceKey}" | ` +
      `serviceName="${p.serviceName}" | imageRole="${imageRole}" | finalPrompt="${prompt}"`,
    );
    return { prompt, negativePrompt: EMAIL_MARKETING_NEGATIVE_PROMPT };
  }

  const tradeScene: TradeScene =
    slot === "conversion" ? "conversion" : (slot === "support" || slot === "trust") ? "support" : "hero";

  // serviceKey and serviceName from the request take priority over project-level mainService/industryType
  // This ensures trade campaigns on a web-design project still get trade prompts
  const tradeKey =
    detectTradeIndustryApi(p.serviceKey ?? "", p.industryType) ||
    detectTradeIndustryApi(p.serviceName ?? "", p.industryType) ||
    detectTradeIndustryApi(p.mainService ?? "", p.industryType);

  const svc = p.mainService || "services";
  if (tradeKey) {
    const cfg    = TRADE_INDUSTRIES_API[tradeKey];
    const role   = cfg.role;
    const action = cfg.actions[tradeScene];
    const env    = cfg.environments[tradeScene];

    let prompt: string;
    if (tradeScene === "hero") {
      prompt =
        `A professional ${role} in ${loc} ${action} inside a real residential home. ` +
        `The scene shows ${env}. ` +
        `The tradesperson is wearing appropriate workwear and is focused on completing the job. ` +
        `Natural lighting, wide shot showing full room context. ` +
        `High-quality, realistic, documentary-style photography. 16:9 landscape format.`;
    } else if (tradeScene === "support") {
      prompt =
        `A professional ${role} in ${loc} ${action}. ` +
        `Mid-range shot: ${env}. ` +
        `Realistic tools, proper workwear, focused on the task. Natural indoor lighting. ` +
        `High-quality, realistic, documentary-style photography.`;
    } else {
      prompt =
        `Close-up detail shot of a ${role} in ${loc} ${action}. ` +
        `Tight focus on ${env}. ` +
        `Hands and tools clearly visible, showing professional technique. ` +
        `High-quality, realistic, documentary-style photography.`;
    }
    return { prompt, negativePrompt: TRADE_NEGATIVE_PROMPT_API };
  }

  // ── Structured role-based prompt ─────────────────────────────────────────
  const biz       = p.businessType || "professional business";
  const keyword   = p.primaryKeyword || svc;
  const pageDesc  = p.shortPageDescription || keyword;
  const imageRole = p.imageRole ?? (SLOT_DEFAULT_ROLE[slot] as ExtendedImageRole) ?? "heroImage";
  const roleScene = buildRoleScene(imageRole, biz, keyword);

  // ── Mandatory visual context injection ───────────────────────────────────
  // Builds strong "MUST clearly show" bullet anchors and "Do NOT generate"
  // exclusions so the AI renders service-specific imagery, not generic scenes.
  const visualCtx = selectVisualContext(p.serviceKey, p.serviceName ?? p.mainService, imageRole);

  // Combine service-specific mustNot items with shared global exclusions
  const allMustNot = [
    ...(visualCtx?.mustNot ?? []),
    ...SHARED_VISUAL_EXCLUSIONS,
  ];

  // Add trust-role addendum to the must-show list
  const mustItems = visualCtx ? [...visualCtx.must] : [];
  if (visualCtx && imageRole === "trustImage") {
    mustItems.push("a human consultation, team interaction, or client-facing moment");
  }

  const mustClause = mustItems.length
    ? `\nThe image MUST clearly show:\n${mustItems.map(i => `- ${i}`).join("\n")}\n`
    : "";

  const mustNotClause =
    `\nDo NOT generate:\n${allMustNot.map(i => `- ${i}`).join("\n")}\n` +
    `\nAny screen or device shown MUST clearly display relevant service-specific content — not blank or generic screens.`;

  const prompt =
    `wide angle composition, subject centred, designed for website layout with space around subject, ` +
    `create a photorealistic modern commercial website image for a ${biz} business. ` +
    `The image is for the ${imageRole} section of a local SEO landing page targeting ${keyword} in ${loc}. ` +
    `Show ${roleScene}. ` +
    `The image should feel relevant to ${pageDesc}.` +
    mustClause +
    mustNotClause +
    `\nRealistic UK setting, clean professional composition, natural lighting, high detail, ` +
    `premium local business website style, 16:9 format, no text, no logos, no watermarks, ` +
    `no brand names, no writing, no signage, no captions, no overlays, ` +
    `no distorted hands, no unrealistic faces.`;

  console.log(`[promptBuilder] imageRole="${imageRole}" | visualCtx=${visualCtx ? "matched" : "none"} | mustItems=${mustItems.length} | finalPrompt="${prompt}"`);

  return { prompt, negativePrompt: STRUCTURED_NEGATIVE_PROMPT };
}

// ─── POST /api/images/test-key ─────────────────────────────────────────────
router.post("/images/test-key", async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  const key = apiKey || process.env.IDEOGRAM_API_KEY;
  if (!key) {
    res.status(200).json({ ok: false, error: "No API key configured" });
    return;
  }
  try {
    const testRes = await fetch("https://api.ideogram.ai/describe", {
      method: "POST",
      headers: { "Api-Key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ image_url: "https://ideogram.ai/api/images/direct/abc" }),
    });
    if (testRes.status === 401) {
      res.status(200).json({ ok: false, error: "API key rejected (401 Unauthorized)" });
    } else {
      res.status(200).json({ ok: true });
    }
  } catch (e) {
    res.status(200).json({ ok: false, error: `Network error: ${(e as Error).message}` });
  }
});

// ─── POST /api/images/test-openai ──────────────────────────────────────────
router.post("/images/test-openai", async (req, res) => {
  const { apiKey } = req.body as { apiKey?: string };
  const key = apiKey || process.env.OPENAI_API_KEY;
  if (!key) {
    res.status(200).json({ ok: false, error: "No OpenAI API key configured" });
    return;
  }
  try {
    const testRes = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (testRes.status === 401) {
      res.status(200).json({ ok: false, error: "API key rejected (401 Unauthorized)" });
    } else if (!testRes.ok) {
      res.status(200).json({ ok: false, error: `OpenAI returned ${testRes.status}` });
    } else {
      res.status(200).json({ ok: true });
    }
  } catch (e) {
    res.status(200).json({ ok: false, error: `Network error: ${(e as Error).message}` });
  }
});

// ─── PUT /api/images/source-mode ───────────────────────────────────────────
router.put("/images/source-mode", (req, res) => {
  const { slug, mode } = req.body as { slug?: string; mode?: string };
  if (!slug || !mode) {
    res.status(400).json({ error: "slug and mode are required" });
    return;
  }
  const validModes: ImageSourceMode[] = ["library", "upload", "ai", "hybrid", "disabled"];
  if (!validModes.includes(mode as ImageSourceMode)) {
    res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(", ")}` });
    return;
  }
  const projectPath = path.join(PROJECTS_DIR, `${slug}.json`);
  if (!fs.existsSync(projectPath)) {
    res.status(404).json({ error: "Project not found" });
    return;
  }
  try {
    const project = JSON.parse(fs.readFileSync(projectPath, "utf8")) as Record<string, unknown>;
    project.imageSourceMode = mode;
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));
    res.json({ ok: true, mode });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/images/preview-prompt ──────────────────────────────────────
// Returns the exact prompt that would be sent to Ideogram WITHOUT generating.
// Used by the dashboard to show the full prompt before clicking Generate.
router.post("/images/preview-prompt", (req, res) => {
  const {
    slug,
    campaignId = "",
    serviceKey: reqServiceKey = "",
    serviceName: reqServiceName = "",
    slot = "hero",
    imageRole: reqImageRole,
    primaryKeyword: reqPrimaryKeyword,
    shortPageDescription: reqShortDesc,
  } = req.body as {
    slug?: string;
    campaignId?: string;
    serviceKey?: string;
    serviceName?: string;
    slot?: string;
    imageRole?: string;
    primaryKeyword?: string;
    shortPageDescription?: string;
  };

  if (!slug) { res.status(400).json({ error: "slug required" }); return; }

  let serviceKey  = reqServiceKey;
  let serviceName = reqServiceName;

  if ((!serviceKey || !serviceName) && campaignId) {
    try {
      const sessionPath = path.join(WORKSPACE_ROOT, "output", slug, "sessions", `${campaignId}.json`);
      if (fs.existsSync(sessionPath)) {
        const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as {
          campaign?: { serviceKey?: string; serviceName?: string };
        };
        if (!serviceKey  && session.campaign?.serviceKey)  serviceKey  = session.campaign.serviceKey;
        if (!serviceName && session.campaign?.serviceName) serviceName = session.campaign.serviceName;
      }
    } catch { /* non-fatal */ }
  }

  const project   = loadProject(slug);
  const validSlot = (slot === "hero" || slot === "support" || slot === "trust" || slot === "conversion") ? slot : "hero";
  const imageRole = (reqImageRole as ExtendedImageRole | undefined) ?? (SLOT_DEFAULT_ROLE[validSlot] as ExtendedImageRole) ?? "heroImage";

  const debugInfo = {
    slug,
    slot:                validSlot,
    imageRole,
    serviceKey,
    serviceName,
    reqPrimaryKeyword,
    reqShortDesc,
    projectBusinessType: project?.businessType as string | undefined,
    projectMainService:  project?.mainService  as string | undefined,
    projectIndustryType: project?.industryType as string | undefined,
    imageSourceMode:     project?.imageSourceMode as string | undefined,
  };

  // ── Email marketing override ──────────────────────────────────────────────
  const emailMktgOverride =
    isEmailMarketingService(serviceKey, serviceName, undefined, undefined) ||
    isEmailMarketingService(reqPrimaryKeyword, reqShortDesc, undefined, undefined);

  if (emailMktgOverride) {
    const prompt = EMAIL_MARKETING_OVERRIDE_PROMPTS[imageRole] ?? EMAIL_MARKETING_OVERRIDE_PROMPTS.heroImage;
    res.json({
      path:           "email_marketing_override",
      prompt,
      negativePrompt: EMAIL_MARKETING_NEGATIVE_PROMPT,
      debug:          { ...debugInfo, emailMktgOverride: true },
    });
    return;
  }

  // ── Industry/scene path ───────────────────────────────────────────────────
  const industry: IndustryKey | null =
    resolveIndustryKey(serviceKey, project?.industryType as string | undefined) ??
    resolveIndustryKey(serviceName, project?.industryType as string | undefined) ??
    resolveIndustryKey(project?.mainService as string ?? "", project?.industryType as string | undefined);

  const sceneSlot = (validSlot === "trust" ? "support" : validSlot) as "hero" | "support" | "conversion";
  const sceneId: SceneId | undefined = industry
    ? selectScene(industry, sceneSlot, new Set())
    : undefined;

  if (industry && sceneId) {
    const location = (project?.primaryLocation as string) || "the local area";
    const built    = getScenePrompt(industry, sceneId, location);
    res.json({
      path:           "scene_library",
      prompt:         built.prompt,
      negativePrompt: built.negativePrompt,
      debug:          { ...debugInfo, industry, sceneId, emailMktgOverride: false },
    });
    return;
  }

  // ── Structured role-based prompt ──────────────────────────────────────────
  const built = buildPrompt({
    businessType:         project?.businessType        as string,
    mainService:          project?.mainService         as string,
    serviceKey,
    serviceName,
    location:             project?.primaryLocation     as string,
    imageSlot:            validSlot,
    imageRole,
    primaryKeyword:       reqPrimaryKeyword || (project?.primaryKeyword as string | undefined),
    shortPageDescription: reqShortDesc,
    style:                project?.brandStyle          as string,
    brandColors:          [
      (project?.branding as Record<string, string>)?.primaryColor,
      (project?.branding as Record<string, string>)?.accentColor,
    ].filter(Boolean) as string[],
    toneOfVoice:          project?.toneOfVoice         as string,
    industryType:         project?.industryType        as string,
  });

  res.json({
    path:           "structured_prompt",
    prompt:         built.prompt,
    negativePrompt: built.negativePrompt,
    debug:          { ...debugInfo, emailMktgOverride: false },
  });
});

router.post("/images/generate", async (req, res) => {
  const {
    slug,
    campaignId = "",
    serviceKey: reqServiceKey = "",
    serviceName: reqServiceName = "",
    slot,
    sceneId: reqSceneId,
    prompt: customPrompt,
    imageRole: reqImageRole,
    primaryKeyword: reqPrimaryKeyword,
    shortPageDescription: reqShortDesc,
  } = req.body as {
    slug: string;
    campaignId?: string;
    serviceKey?: string;
    serviceName?: string;
    slot: string;
    sceneId?: string;
    prompt?: string;
    imageRole?: string;
    primaryKeyword?: string;
    shortPageDescription?: string;
  };

  if (!slug || !slot) {
    res.status(400).json({ error: "slug and slot are required" });
    return;
  }

  const validSlot = (slot === "hero" || slot === "support" || slot === "trust" || slot === "conversion") ? slot : "hero";

  // ── Resolve serviceKey / serviceName ──────────────────────────────────────
  // Priority: request body → campaign session file → project config
  let serviceKey  = reqServiceKey;
  let serviceName = reqServiceName;

  if ((!serviceKey || !serviceName) && campaignId) {
    try {
      const sessionPath = path.join(WORKSPACE_ROOT, "output", slug, "sessions", `${campaignId}.json`);
      if (fs.existsSync(sessionPath)) {
        const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as {
          campaign?: { serviceKey?: string; serviceName?: string };
        };
        if (!serviceKey  && session.campaign?.serviceKey)  serviceKey  = session.campaign.serviceKey;
        if (!serviceName && session.campaign?.serviceName) serviceName = session.campaign.serviceName;
      }
    } catch { /* non-fatal — fall through to project config */ }
  }

  const project = loadProject(slug);
  const imageSourceMode = (project?.imageSourceMode as ImageSourceMode | undefined) ?? "library";

  // Disabled mode — skip generation entirely
  if (imageSourceMode === "disabled") {
    res.json({ ok: false, skipped: true, reason: "Image generation is disabled for this project" });
    return;
  }

  // ── Email marketing detection — MUST run before resolveIndustryKey ──────────
  // BUG EXPLAINED: sceneLibrary.ts resolveIndustryKey() returns "web-design" for
  // ANY call when project.industryType="web-design" (line 572: i==="web-design").
  // This causes getScenePrompt() to always run, bypassing buildPrompt() entirely
  // and making the EMAIL_MARKETING_OVERRIDE_PROMPTS unreachable.
  // Fix: detect email marketing first and suppress industry resolution for it.
  const emailMktgOverride =
    isEmailMarketingService(serviceKey, serviceName, undefined, undefined) ||
    isEmailMarketingService(reqPrimaryKeyword, reqShortDesc, undefined, undefined);

  req.log.info({
    msg:                 "[imageGen] pre-resolution debug",
    slug,
    slot:                validSlot,
    serviceKey,
    serviceName,
    reqPrimaryKeyword,
    reqShortDesc,
    projectBusinessType: project?.businessType,
    projectMainService:  project?.mainService,
    projectIndustryType: project?.industryType,
    imageSourceMode,
    emailMktgOverride,
  });

  // ── Resolve industry + scene ───────────────────────────────────────────────
  // Industry resolution is SUPPRESSED for email marketing so the scene library
  // cannot intercept the request and bypass the override prompt.
  const industry: IndustryKey | null = emailMktgOverride ? null : (
    resolveIndustryKey(serviceKey, project?.industryType as string | undefined) ??
    resolveIndustryKey(serviceName, project?.industryType as string | undefined) ??
    resolveIndustryKey(project?.mainService as string ?? "", project?.industryType as string | undefined)
  );

  // Auto-select sceneId if not provided: use diversity rules (avoid scenes already used on this page)
  let sceneId: SceneId | undefined = reqSceneId as SceneId | undefined;
  if (!sceneId && industry) {
    const metaPath  = path.join(OUTPUT_DIR, slug, "assets", "image-meta.json");
    const existingMeta: Record<string, { sceneId?: string }> = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
      : {};
    const usedScenes = new Set<SceneId>(
      Object.values(existingMeta)
        .map((m) => m?.sceneId)
        .filter((s): s is SceneId => !!s)
    );
    // "trust" is not a scene slot — treat it as "support" for scene diversity
    const sceneSlot = (validSlot === "trust" ? "support" : validSlot) as "hero" | "support" | "conversion";
    sceneId = selectScene(industry, sceneSlot, usedScenes);
  }

  // ── Library mode — try serving from image-packs first ─────────────────────
  if ((imageSourceMode === "library" || imageSourceMode === "hybrid") && industry && sceneId) {
    const libSlot = (validSlot === "trust" ? "support" : validSlot) as "hero" | "support" | "conversion";
    const libPath = libraryImagePath(WORKSPACE_ROOT, industry, libSlot, sceneId);
    if (fs.existsSync(libPath)) {
      // Copy library image into the slug's asset dir
      const assetDir  = path.join(OUTPUT_DIR, slug, "assets");
      fs.mkdirSync(assetDir, { recursive: true });
      const destPath  = path.join(assetDir, `${validSlot}.jpg`);
      fs.copyFileSync(libPath, destPath);

      const metaPath  = path.join(assetDir, "image-meta.json");
      const meta: Record<string, unknown> = fs.existsSync(metaPath)
        ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
      meta[validSlot] = {
        status: "generated", source: "library",
        sceneId, sceneLabel: sceneLabel(sceneId),
        industryType: industry,
        generatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

      res.json({
        ok: true, slot: validSlot,
        serveUrl: `/api/images/serve/${slug}/${validSlot}`,
        sceneId, sceneLabel: sceneLabel(sceneId),
        source: "library",
      });
      return;
    }
    // Library file missing — hybrid falls through to AI; pure library returns a clear message
    if (imageSourceMode === "library") {
      res.status(422).json({
        ok: false, slot: validSlot,
        error: `Library image not found for ${industry}/${validSlot}/${sceneId}. Switch to AI or Hybrid image mode to generate one.`,
        sceneId,
      });
      return;
    }
  }

  // ── AI generation (mode: ai | hybrid fallback) ────────────────────────────
  const resolved = resolveIdeogramKey(slug);
  if (!resolved) {
    res.status(500).json({ error: "No Ideogram API key — set one in the project config (Stage 1 → API Connections) or set IDEOGRAM_API_KEY on the server" });
    return;
  }

  if (resolved.source === "server") {
    const limitError = checkServerKeyLimit(slug);
    if (limitError) {
      res.status(429).json({ error: limitError });
      return;
    }
  }

  let finalPrompt: string;
  let finalNegativePrompt: string | undefined;

  if (customPrompt) {
    finalPrompt = customPrompt;
  } else if (industry && sceneId) {
    // Scene-specific prompt from the library
    const location = (project?.primaryLocation as string) || "the local area";
    const built    = getScenePrompt(industry, sceneId, location);
    finalPrompt         = built.prompt;
    finalNegativePrompt = built.negativePrompt;
  } else {
    // Structured role-based prompt for digital/non-trade industries
    const built = buildPrompt({
      businessType:
        req.body.businessType ||
        project?.businessType ||
        serviceName ||
        serviceKey,

      mainService:
        req.body.mainService ||
        serviceName ||
        project?.mainService ||
        serviceKey,

      serviceKey,

      serviceName:
        serviceName ||
        req.body.mainService ||
        project?.mainService ||
        serviceKey,
      location:            project?.primaryLocation as string,
      imageSlot:           slot,
      imageRole:           reqImageRole as ExtendedImageRole | undefined,
      primaryKeyword:      reqPrimaryKeyword || (project?.primaryKeyword as string | undefined),
      shortPageDescription: reqShortDesc,
      style:               project?.brandStyle as string,
      brandColors:         [
        (project?.branding as Record<string, string>)?.primaryColor,
        (project?.branding as Record<string, string>)?.accentColor,
      ].filter(Boolean) as string[],
      toneOfVoice:         project?.toneOfVoice  as string,
      industryType:        project?.industryType as string,
    });
    finalPrompt         = built.prompt;
    finalNegativePrompt = built.negativePrompt;
  }

  // Force strong GBP context
  if (serviceKey === "google-business-profile") {
    finalPrompt += `
Professional Google Business Profile optimisation scene.
Google Maps rankings.
Local business visibility.
Customer reviews.
Calls and direction requests.
Google Business dashboard analytics.
Local SEO consultant improving map visibility.

Avoid:
email marketing,
email inboxes,
newsletters,
mailchimp dashboards,
generic office laptops.
`;
  }

  // ── Call Ideogram v3 API ──────────────────────────────────────────────────
  const v3Body: Record<string, unknown> = {
    prompt:          finalPrompt,
    rendering_speed: "QUALITY",
    aspect_ratio:    "16x9",
  };
  if (finalNegativePrompt) {
    v3Body.negative_prompt = finalNegativePrompt;
  }

  // ── Debug: log full generation context before sending to Ideogram ──────────
  req.log.info({
    msg:          "[imageGen] Sending to Ideogram",
    businessType: project?.businessType,
    serviceKey,
    serviceName,
    imageRole:    reqImageRole,
    slot,
    keyword:      reqPrimaryKeyword,
    promptLength: finalPrompt.length,
    finalPrompt,
    negativePrompt: finalNegativePrompt,
    ideogramPayload: { ...v3Body, prompt: finalPrompt.slice(0, 200) + (finalPrompt.length > 200 ? "…" : "") },
  });

  try {
    const ideogramRes = await fetch("https://api.ideogram.ai/v1/ideogram-v3/generate", {
      method: "POST",
      headers: { "Api-Key": resolved.key, "Content-Type": "application/json" },
      body: JSON.stringify(v3Body),
    });

    if (!ideogramRes.ok) {
      const errText = await ideogramRes.text();
      res.status(502).json({ error: `Ideogram API error: ${errText}` });
      return;
    }

    const ideogramData = await ideogramRes.json() as { data: { url: string }[] };
    const imageUrl = ideogramData.data?.[0]?.url;
    if (!imageUrl) {
      res.status(502).json({ error: "No image returned from Ideogram" });
      return;
    }

    // Save to a service-specific subdir so different campaigns never share files.
    // e.g. assets/email-marketing/hero.jpg vs assets/web-design/hero.jpg
    const assetDir    = path.join(OUTPUT_DIR, slug, "assets");
    const normSvcKey  = serviceKey
      ? serviceKey.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "")
      : "";
    const svcSaveDir  = normSvcKey ? path.join(assetDir, normSvcKey) : assetDir;
    fs.mkdirSync(svcSaveDir, { recursive: true });

    const imgRes = await fetch(imageUrl);
    const imgBuf = Buffer.from(await imgRes.arrayBuffer());
    const localPath = path.join(svcSaveDir, `${validSlot}.jpg`);
    fs.writeFileSync(localPath, imgBuf);

    // Store serviceKey in meta so serve/status endpoints resolve the right subdir
    const metaPath = path.join(assetDir, "image-meta.json");
    const meta: Record<string, unknown> = fs.existsSync(metaPath)
      ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
      : {};
    meta[validSlot] = {
      status:      "generated",
      source:      "ai",
      serviceKey:  normSvcKey || null,
      sceneId:     sceneId ?? null,
      sceneLabel:  sceneId ? sceneLabel(sceneId) : null,
      industryType: industry ?? null,
      prompt:      finalPrompt,
      generatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

    logUsage({
      ts:        new Date().toISOString(),
      slug,
      keySource: resolved.source,
      model:     "V_3",
      cost:      COST_PER_IMAGE["V_3"] ?? 0.08,
      slot:      validSlot,
    });

    res.json({
      ok: true, slot: validSlot,
      serveUrl: `/api/images/serve/${slug}/${validSlot}`,
      sceneId: sceneId ?? null,
      sceneLabel: sceneId ? sceneLabel(sceneId) : null,
      prompt: finalPrompt,
      keySource: resolved.source,
      source: "ai",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

// ─── POST /api/images/upload ───────────────────────────────────────────────
router.post("/images/upload", uploadMiddleware, async (req, res) => {
  const { slug, category = "general", altText = "", caption = "", serviceKey: rawUploadServiceKey = "" } = req.body as {
    slug: string; category?: string; altText?: string; caption?: string; serviceKey?: string;
  };
  const uploadServiceKey = rawUploadServiceKey.trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");

  if (!slug || !req.file) {
    res.status(400).json({ error: "slug and file are required" });
    return;
  }

  const filePath = req.file.path;

  // Hard-limit guard (belt-and-suspenders in case multer limit fires late)
  const rawSize = fs.statSync(filePath).size;
  if (rawSize > HARD_LIMIT_BYTES) {
    fs.unlinkSync(filePath);
    res.status(413).json({ error: "Image exceeds 20MB limit. Please upload a smaller file." });
    return;
  }

  // Validate actual MIME type via magic bytes (not browser-supplied Content-Type)
  const mime = detectMimeType(filePath);
  if (!ALLOWED_MIMES.includes(mime)) {
    fs.unlinkSync(filePath);
    res.status(422).json({ error: "Unsupported image format. Please upload JPG, PNG, or WebP." });
    return;
  }

  // Process all slot sizes with Sharp
  const uploadDir = path.join(OUTPUT_DIR, slug, "uploads");
  const imageId   = path.basename(req.file.filename, path.extname(req.file.filename));

  let processed: Awaited<ReturnType<typeof processImage>>;
  try {
    processed = await processImage(filePath, uploadDir, imageId, mime);
  } catch (err) {
    res.status(500).json({ error: `Image processing failed: ${(err as Error).message}` });
    return;
  }

  const formatLabel = mime === "image/webp" ? "WebP" : mime === "image/png" ? "PNG" : "JPG";
  const relPath     = `/api/images/uploaded/${slug}/${req.file.filename}`;
  const thumbRelPath = `/api/images/uploaded-thumb/${slug}/${imageId}`;

  const entry = {
    filename:       req.file.filename,
    originalName:   req.file.originalname,
    category,
    altText,
    caption,
    serviceKey:     uploadServiceKey || undefined,
    serveUrl:       relPath,
    thumbnailUrl:   thumbRelPath,
    uploadedAt:     new Date().toISOString(),
    size:           processed.original.size,
    width:          processed.original.width,
    height:         processed.original.height,
    format:         formatLabel,
    mime:           processed.original.mime,
    processedPaths: processed.processedPaths,
    warnings:       processed.warnings,
  };

  const libPath = path.join(uploadDir, "library.json");
  const lib: unknown[] = fs.existsSync(libPath)
    ? JSON.parse(fs.readFileSync(libPath, "utf8"))
    : [];
  lib.push(entry);
  fs.writeFileSync(libPath, JSON.stringify(lib, null, 2));

  res.json({ ok: true, image: entry });
});

// ─── GET /api/images/uploaded/:slug/:filename ──────────────────────────────
router.get("/images/uploaded/:slug/:filename", (req, res) => {
  const { slug, filename } = req.params;
  const filePath = path.join(OUTPUT_DIR, slug, "uploads", filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Not found" }); return; }
  res.setHeader("Content-Type", detectMimeType(filePath));
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.sendFile(filePath);
});

// ─── GET /api/images/uploaded-thumb/:slug/:imageId ────────────────────────
// Serves the thumbnail version of a processed uploaded image.
router.get("/images/uploaded-thumb/:slug/:imageId", (req, res) => {
  const { slug, imageId } = req.params;
  const processedDir = path.join(OUTPUT_DIR, slug, "uploads", "processed", imageId);
  if (!fs.existsSync(processedDir)) { res.status(404).json({ error: "Thumbnail not found" }); return; }
  for (const ext of [".jpg", ".png", ".webp"]) {
    const p = path.join(processedDir, `thumb${ext}`);
    if (fs.existsSync(p)) {
      res.setHeader("Content-Type", detectMimeType(p));
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.sendFile(p);
      return;
    }
  }
  res.status(404).json({ error: "Thumbnail not found" });
});

// ─── GET /api/images/library/:slug ────────────────────────────────────────
// ── Service key alias map — handles legacy/merged/typo forms ─────────────────
const SERVICE_KEY_ALIASES: Record<string, string> = {
  emailmarketing:  "email-marketing",
  email_marketing: "email-marketing",
  webhosting:      "web-hosting",
  web_hosting:     "web-hosting",
  webhoting:       "web-hosting",   // typo: webho_ting → webhoting
  webho_ting:      "web-hosting",
  websitehosting:  "website-hosting",
  website_hosting: "website-hosting",
  localseo:        "local-seo",
  local_seo:       "local-seo",
  webdesign:       "web-design",
  web_design:      "web-design",
};

export function normaliseServiceKey(value: string): string {
  const raw = String(value || "")
    .trim()
    .toLowerCase();

  const v = raw
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const compact = v.replace(/[^a-z0-9]/g, "");

  // Repair corrupted Local Business Visibility service slugs seen from dashboard sanitisation.
  if (
    v.includes("local-business-visibility") ||
    v.includes("local-bu-ine-vi-ibility") ||
    compact.includes("localbusinessvisibility") ||
    compact.includes("localbuineviibility") ||
    (compact.includes("local") && compact.includes("bu") && compact.includes("vi"))
  ) return "local-business-visibility";

  if (
    v.includes("web-design") ||
    v.includes("website-design") ||
    compact.includes("webdesign") ||
    compact.includes("websitedesign") ||
    (compact.includes("web") && compact.includes("design"))
  ) return "web-design";

  if (
    v.includes("web-hosting") ||
    v.includes("website-hosting") ||
    compact.includes("webhosting") ||
    compact.includes("websitehosting") ||
    (compact.includes("web") && compact.includes("hosting"))
  ) return "web-hosting";

  if (
    v.includes("local-seo") ||
    compact.includes("localseo") ||
    compact.includes("seo")
  ) return "local-seo";

  if (
    v.includes("email-marketing") ||
    compact.includes("emailmarketing") ||
    compact.includes("email")
  ) return "email-marketing";

  return v;
}

router.get("/images/library/:slug", (req, res) => {
  const { slug } = req.params;
  // Optional ?service= filter — normalise to hyphen-form with alias resolution
  let filterService = typeof req.query.service === "string" && req.query.service
    ? normaliseServiceKey(req.query.service)
    : null;

  // Always resolve service filter from campaign ID when available.
  // This is required for semantic-intent campaigns before a session file exists.
  if (typeof req.query.cid === "string" && req.query.cid) {
    try {
      const campaignFile = path.join(WORKSPACE_ROOT, "config", "campaigns", `${slug}.json`);
      if (fs.existsSync(campaignFile)) {
        const campaigns = JSON.parse(fs.readFileSync(campaignFile, "utf8")) as Array<{ id: string; serviceKey?: string; serviceName?: string }>;
        const match = campaigns.find(c => c.id === req.query.cid);
        const resolved = match?.serviceKey || match?.serviceName || "";
        if (resolved) filterService = normaliseServiceKey(resolved);
      }
    } catch { /* non-fatal */ }
  }

  // 1. Uploaded images (from library.json — scoped by serviceKey when filter is active)
  const libPath = path.join(OUTPUT_DIR, slug, "uploads", "library.json");
  const rawUploads: Array<Record<string, unknown>> = fs.existsSync(libPath)
    ? (JSON.parse(fs.readFileSync(libPath, "utf8")) as Array<Record<string, unknown>>)
    : [];
  const uploadImages = rawUploads
    .filter((u) => {
      if (!filterService) return true;
      const uSvc = String(u.serviceKey ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
      // Strict match — only show images explicitly tagged to this service
      return uSvc === filterService;
    })
    .map((u) => ({
      ...u,
      imageId:      u.filename as string,
      source:       "uploaded",
      imageUrl:     u.serveUrl,
      thumbnailUrl: u.thumbnailUrl ?? u.serveUrl,
      fileName:     u.originalName ?? u.filename,
      createdAt:    u.uploadedAt,
      approvalStatus: "approved",
      width:   u.width,
      height:  u.height,
      format:  u.format,
      size:    u.size,
      warnings: u.warnings,
    }));

  // 2. AI-generated slot images (scoped by serviceKey when filter is active)
  const metaPath = path.join(OUTPUT_DIR, slug, "assets", "image-meta.json");
  const meta: Record<string, Record<string, unknown>> = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, "utf8")) as Record<string, Record<string, unknown>>)
    : {};
  const aiImages: Array<Record<string, unknown>> = [];
  for (const [slot, info] of Object.entries(meta)) {
    // Check serviceKey match when filter is active
    if (filterService) {
      const metaSvc = String(info.serviceKey ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
      if (metaSvc && metaSvc !== filterService) continue;
    }
    // Find slot file — check service-specific subdir first, then root assets
    const svcKey = String(info.serviceKey ?? "");
    let imgPath: string | null = null;
    if (svcKey) imgPath = findSlotFile(path.join(OUTPUT_DIR, slug, "assets", svcKey), slot);
    if (!imgPath) imgPath = findSlotFile(path.join(OUTPUT_DIR, slug, "assets"), slot);
    if (!imgPath) continue;
    if (info.source === "uploaded") continue; // don't double-list uploaded assets
    aiImages.push({
      imageId:       `ai-${slot}`,
      source:        "ai_generated",
      imageUrl:      `/api/images/serve/${slug}/${slot}`,
      thumbnailUrl:  `/api/images/serve/${slug}/${slot}`,
      fileName:      `${slot}.jpg`,
      originalName:  `${slot} (AI)`,
      altText:       `${slot} image`,
      category:      slot,
      serviceKey:    info.serviceKey ?? null,
      approvalStatus: info.status ?? "generated",
      prompt:        info.prompt,
      createdAt:     info.generatedAt ?? info.assignedAt,
    });
  }

  // 3. New controlled Image Library images (approved only, optionally filtered by service)
  const libManifestPath = path.join(WORKSPACE_ROOT, "assets", "image-library", "image-library.json");
  const libImages: Array<Record<string, unknown>> = [];
  if (fs.existsSync(libManifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(libManifestPath, "utf8")) as { images?: Array<Record<string, unknown>> };
      for (const img of (manifest.images ?? [])) {
        if (!img.approved) continue;
        // Service isolation: only return images matching the requested service
        const imgService = String(img.service ?? "").toLowerCase().replace(/_/g, "-");
        if (filterService && imgService !== filterService) continue;
        libImages.push({
          imageId:       img.id,
          source:        "image_library",
          imageUrl:      `/api/image-library/serve/${img.service}/${img.slot}/${img.filename}`,
          thumbnailUrl:  `/api/image-library/serve/${img.service}/${img.slot}/${img.filename}`,
          fileName:      img.filename,
          originalName:  img.description || img.filename,
          altText:       img.altTemplate ?? "",
          category:      img.slot,
          service:       img.service,
          slot:          img.slot,
          approvalStatus: "approved",
          createdAt:     img.uploadedAt,
        });
      }
    } catch { /* ignore parse errors */ }
  }

  // 4. Image Pack images (from config/imagePacks.json — uploaded in Templates > Image Library Packs)
  //    When a ?service= filter is provided, map it to a pack industry and include those images.
  const packImages: Array<Record<string, unknown>> = [];
  try {
    const packsPath = path.join(WORKSPACE_ROOT, "config", "imagePacks.json");
    if (fs.existsSync(packsPath)) {
      const packManifest = JSON.parse(fs.readFileSync(packsPath, "utf8")) as { images?: Array<{ id: string; industryType: string; slot: string; path: string; approved: boolean }> };
      const packEntries = packManifest.images ?? [];
      // Determine which pack industry to show based on the service filter
      const packIndustry = filterService ? mapToPackIndustry(filterService) : null;
      const entriesToShow = packIndustry
        ? packEntries.filter(e => e.industryType === packIndustry && fs.existsSync(path.join(WORKSPACE_ROOT, e.path)))
        : [];
      for (const entry of entriesToShow) {
        packImages.push({
          imageId:       entry.id,
          source:        "image_pack",
          imageUrl:      `/api/image-library/pack-serve/${entry.id}`,
          thumbnailUrl:  `/api/image-library/pack-serve/${entry.id}`,
          fileName:      entry.slot + ".jpg",
          originalName:  `Pack image ${entry.slot}`,
          altText:       "",
          category:      entry.industryType,
          packIndustry:  entry.industryType,
          slot:          entry.slot,
          approvalStatus: "approved",
        });
      }
    }
  } catch { /* non-fatal */ }

  // Pack images first (most relevant for trade campaigns), then AI, uploads, library
  const all = [...packImages, ...aiImages, ...uploadImages, ...libImages];

  console.log("[images/library debug]", {
    slug,
    cid: req.query.cid,
    service: req.query.service,
    filterService,
    uploadImages: uploadImages.length,
    aiImages: aiImages.length,
    libImages: libImages.length,
    packImages: packImages.length,
    total: all.length
  });

  res.json({ images: all });
});

// ─── POST /api/images/assign-to-slot ──────────────────────────────────────
router.post("/images/assign-to-slot", (req, res) => {
  const { slug, slot, source, imageId, altText, serviceKey: rawServiceKey } = req.body as {
    slug: string; slot: string; source: string; imageId: string; altText?: string; serviceKey?: string;
  };
  const svcKey = (rawServiceKey ?? "").toString().trim().toLowerCase()
    .replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug || !slot || !source || !imageId) {
    res.status(400).json({ error: "slug, slot, source, imageId are required" });
    return;
  }

  let sourceFile: string;
  let destExt = ".jpg";

  if (source === "ai_generated") {
    const aiSlot = imageId.replace(/^ai-/, "");
    const found = findSlotFile(path.join(OUTPUT_DIR, slug, "assets"), aiSlot);
    if (!found) { res.status(404).json({ error: `AI image not found: ${imageId}` }); return; }
    sourceFile = found;
    destExt    = path.extname(found) || ".jpg";
  } else if (source === "image_pack") {
    // Image Pack images — find by ID in config/imagePacks.json
    const packsPath = path.join(WORKSPACE_ROOT, "config", "imagePacks.json");
    if (!fs.existsSync(packsPath)) {
      res.status(404).json({ error: "Image packs manifest not found" });
      return;
    }
    const packManifest = JSON.parse(fs.readFileSync(packsPath, "utf8")) as { images?: Array<{ id: string; industryType: string; slot: string; path: string }> };
    const packEntry = (packManifest.images ?? []).find(e => e.id === imageId);
    if (!packEntry) {
      res.status(404).json({ error: `Image pack entry not found: ${imageId}` });
      return;
    }
    sourceFile = path.join(WORKSPACE_ROOT, packEntry.path);
    destExt    = ".jpg";
  } else if (source === "image_library") {
    // Controlled Image Library — find by ID in manifest and resolve file robustly.
    const manifestPath = path.join(WORKSPACE_ROOT, "assets", "image-library", "image-library.json");

    if (!fs.existsSync(manifestPath)) {
      res.status(404).json({ error: "Image Library manifest not found" });
      return;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { images?: Array<Record<string, unknown>> };
    const libImg = (manifest.images ?? []).find((i) => i.id === imageId);

    if (!libImg) {
      res.status(404).json({ error: `Image Library image not found: ${imageId}` });
      return;
    }

    const service = String(libImg.service || "").trim();
    const slotName = String(libImg.slot || "").trim();
    const filename = String(libImg.filename || "").trim();
    const manifestPathValue = String(libImg.path || libImg.file || "").trim();

    const candidates = [
      manifestPathValue && path.isAbsolute(manifestPathValue) ? manifestPathValue : "",
      manifestPathValue ? path.join(WORKSPACE_ROOT, manifestPathValue) : "",
      path.join(WORKSPACE_ROOT, "assets", "image-library", service, slotName, filename),
      path.join(WORKSPACE_ROOT, "assets", "image-library", service, filename),
      path.join(WORKSPACE_ROOT, "assets", "image-library", filename),
    ].filter(Boolean);

    const found = candidates.find((candidate) => fs.existsSync(candidate));

    console.log("[assign image_library debug]", {
      imageId,
      service,
      slotName,
      filename,
      manifestPathValue,
      candidates,
      found
    });

    if (!found) {
      res.status(404).json({
        error: `Image Library source file not found: ${imageId}`,
        tried: candidates
      });
      return;
    }

    sourceFile = found;
    destExt = path.extname(sourceFile) || ".jpg";
  } else {
    // Uploaded — use the pre-processed slot-specific version if available
    const uploadDir = path.join(OUTPUT_DIR, slug, "uploads");
    const libPath   = path.join(uploadDir, "library.json");
    const lib: Array<Record<string, unknown>> = fs.existsSync(libPath)
      ? JSON.parse(fs.readFileSync(libPath, "utf8"))
      : [];
    const entry = lib.find((e) => e.filename === imageId);

    const processedPaths = entry?.processedPaths as Record<string, string> | undefined;
    if (processedPaths?.[slot]) {
      const processedFile = path.join(uploadDir, processedPaths[slot]);
      if (fs.existsSync(processedFile)) {
        sourceFile = processedFile;
        destExt    = path.extname(processedFile) || ".jpg";
      } else {
        // Processed file missing — fall back to raw upload
        sourceFile = path.join(uploadDir, imageId);
        destExt    = mimeToExt(detectMimeType(sourceFile));
      }
    } else {
      sourceFile = path.join(uploadDir, imageId);
      if (fs.existsSync(sourceFile)) {
        destExt = mimeToExt(detectMimeType(sourceFile));
      }
    }
  }

  if (!fs.existsSync(sourceFile)) {
    res.status(404).json({ error: `Source image not found: ${imageId}` });
    return;
  }

  // Use service-specific subdir when serviceKey provided (prevents campaigns overwriting each other)
  const projectAssetsDir = path.join(OUTPUT_DIR, slug, "assets");
  const assetDir = svcKey
    ? path.join(OUTPUT_DIR, slug, "assets", svcKey)
    : projectAssetsDir;
  fs.mkdirSync(assetDir, { recursive: true });
  fs.mkdirSync(projectAssetsDir, { recursive: true });

  // Remove any existing slot files with a different extension to avoid stale files
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const old = path.join(assetDir, `${slot}${ext}`);
    if (fs.existsSync(old) && ext !== destExt) fs.unlinkSync(old);
  }

  const destFile = path.join(assetDir, `${slot}${destExt}`);
  fs.copyFileSync(sourceFile, destFile);

  // Update image-meta.json (always at project level for discoverability)
  const metaPath = path.join(projectAssetsDir, "image-meta.json");
  const meta: Record<string, unknown> = fs.existsSync(metaPath)
    ? (JSON.parse(fs.readFileSync(metaPath, "utf8")) as Record<string, unknown>)
    : {};
  meta[slot] = {
    status:       "approved",
    source:       source === "ai_generated" ? "ai" : "uploaded",
    assignedFrom: imageId,
    ...(svcKey ? { serviceKey: svcKey } : {}),
    ext:          destExt,
    altText:      altText ?? "",
    assignedAt:   new Date().toISOString(),
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));

  res.json({ ok: true, slot, serveUrl: `/api/images/serve/${slug}/${slot}`, ext: destExt });
});

// ─── DELETE /api/images/uploaded/:slug/:filename ──────────────────────────
router.delete("/images/uploaded/:slug/:filename", (req, res) => {
  const { slug, filename } = req.params;
  const dir = path.join(OUTPUT_DIR, slug, "uploads");
  const filePath = path.join(dir, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  // Remove processed versions
  const imageId = path.basename(filename, path.extname(filename));
  const processedDir = path.join(dir, "processed", imageId);
  if (fs.existsSync(processedDir)) fs.rmSync(processedDir, { recursive: true, force: true });

  const libPath = path.join(dir, "library.json");
  if (fs.existsSync(libPath)) {
    const lib = (JSON.parse(fs.readFileSync(libPath, "utf8")) as Array<{filename: string}>)
      .filter(e => e.filename !== filename);
    fs.writeFileSync(libPath, JSON.stringify(lib, null, 2));
  }
  res.json({ ok: true });
});

// ─── POST /api/images/approve ─────────────────────────────────────────────
router.post("/images/approve", (req, res) => {
  const { slug, slot, status } = req.body as { slug: string; slot: string; status: "approved" | "rejected" | "needs_review" };
  if (!slug || !slot || !status) { res.status(400).json({ error: "slug, slot and status required" }); return; }
  const metaPath = path.join(OUTPUT_DIR, slug, "assets", "image-meta.json");
  const meta: Record<string, unknown> = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf8"))
    : {};
  if (!meta[slot]) meta[slot] = {};
  (meta[slot] as Record<string, unknown>).status     = status;
  (meta[slot] as Record<string, unknown>).reviewedAt = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  res.json({ ok: true, slot, status });
});

// ─── GET /api/images/meta/:slug ────────────────────────────────────────────
router.get("/images/meta/:slug", (req, res) => {
  const slug = path.basename(req.params.slug);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }
  const metaPath = path.join(OUTPUT_DIR, slug, "assets", "image-meta.json");
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
  res.json({ meta });
});

// ─── GET /api/images/serve/:slug/:slot ────────────────────────────────────
router.get("/images/serve/:slug/:slot", (req, res) => {
  const slug = path.basename(req.params.slug);
  const slot = path.basename(req.params.slot);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(slug)) { res.status(400).json({ error: "Invalid slug" }); return; }
  if (!/^[a-z0-9][a-z0-9_.-]*$/.test(slot))  { res.status(400).json({ error: "Invalid slot" });  return; }

  const projectAssetsDir = path.join(OUTPUT_DIR, slug, "assets");

  // Check meta for a service-specific assignment — look in that subdir first
  const metaPath = path.join(projectAssetsDir, "image-meta.json");
  const meta: Record<string, Record<string, unknown>> = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
  const svcKey = (meta[slot]?.serviceKey as string | undefined) ?? "";

  let filePath: string | null = null;
  if (svcKey) {
    filePath = findSlotFile(path.join(projectAssetsDir, svcKey), slot);
  }
  if (!filePath) {
    filePath = findSlotFile(projectAssetsDir, slot);
  }

  if (!filePath) {
    res.status(404).json({ error: "Image not found" });
    return;
  }
  res.setHeader("Content-Type", detectMimeType(filePath));
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.sendFile(filePath);
});

// ─── GET /api/images/status/:slug ─────────────────────────────────────────
// Optional ?service= param filters slot resolution to a specific service subdir
// so different campaigns never bleed images across each other.
router.get("/images/status/:slug", (req, res) => {
  const { slug } = req.params;
  let filterSvc = typeof req.query.service === "string" && req.query.service
    ? normaliseServiceKey(req.query.service)
    : "";

  // If no ?service= but a ?cid= was passed, self-resolve the serviceKey from the campaign file
  // (mirrors the same fallback in the library endpoint for consistency)
  if (!filterSvc && typeof req.query.cid === "string" && req.query.cid) {
    try {
      const campaignFile = path.join(WORKSPACE_ROOT, "config", "campaigns", `${slug}.json`);
      if (fs.existsSync(campaignFile)) {
        const campaigns = JSON.parse(fs.readFileSync(campaignFile, "utf8")) as Array<{ id: string; serviceKey?: string }>;
        const match = campaigns.find(c => c.id === req.query.cid);
        if (match?.serviceKey) {
          filterSvc = normaliseServiceKey(match.serviceKey);
        }
      }
    } catch { /* non-fatal */ }
  }

  const assetDir = path.join(OUTPUT_DIR, slug, "assets");
  const metaPath = path.join(assetDir, "image-meta.json");
  const meta: Record<string, Record<string, unknown>> = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};

  const slots = ["hero", "support", "trust", "conversion"];
  const status: Record<string, unknown> = {};

  for (const slot of slots) {
    const slotMeta = meta[slot] || {};
    const metaSvc  = String(slotMeta.serviceKey ?? "").trim().toLowerCase().replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");

    // When a service filter is active, only report the slot as existing if the
    // stored image belongs to that service — never leak another service's image.
    let filePath: string | null = null;
    if (filterSvc) {
      // Only look in the requested service's subdir
      filePath = findSlotFile(path.join(assetDir, filterSvc), slot);
      // If no image for this service yet, report empty — don't fall back to shared root
    } else if (metaSvc) {
      // No filter but meta has a serviceKey — resolve from that subdir
      filePath = findSlotFile(path.join(assetDir, metaSvc), slot);
      if (!filePath) filePath = findSlotFile(assetDir, slot);
    } else {
      filePath = findSlotFile(assetDir, slot);
    }

    // When filtering, only include meta that matches this service
    const metaForSlot = (filterSvc && metaSvc && metaSvc !== filterSvc) ? {} : slotMeta;
    status[slot] = { exists: !!filePath, ...metaForSlot };
  }

  res.json({ slug, status });
});

// ─── DELETE /api/images/:slug/:slot ───────────────────────────────────────
router.delete("/images/:slug/:slot", (req, res) => {
  const { slug, slot } = req.params;
  const projectAssetsDir = path.join(OUTPUT_DIR, slug, "assets");

  // Read meta to find service-specific subdir, then delete from both locations
  const metaPath = path.join(projectAssetsDir, "image-meta.json");
  const meta: Record<string, Record<string, unknown>> = fs.existsSync(metaPath)
    ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : {};
  const svcKey = (meta[slot]?.serviceKey as string | undefined) ?? "";

  const dirsToClean = svcKey
    ? [path.join(projectAssetsDir, svcKey), projectAssetsDir]
    : [projectAssetsDir];

  for (const dir of dirsToClean) {
    for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
      const filePath = path.join(dir, `${slot}${ext}`);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
  }

  if (fs.existsSync(metaPath)) {
    delete meta[slot];
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }
  res.json({ ok: true });
});

// ─── GET /api/projects/:slug/completion ───────────────────────────────────
router.get("/projects/:slug/completion", (req, res) => {
  const p = loadProject(req.params.slug);
  if (!p) { res.status(404).json({ error: "Project not found" }); return; }

  const proj = p as Record<string, unknown>;
  const integrations = (proj.integrations ?? {}) as Record<string, unknown>;
  const navItems      = Array.isArray(proj.navItems) ? proj.navItems as unknown[] : [];
  const serviceAreas  = Array.isArray(proj.serviceAreas) ? proj.serviceAreas as unknown[] : [];
  const footerLinks   = Array.isArray(proj.footerLinks) ? proj.footerLinks as unknown[] : [];
  const imageMode     = (proj.imageMode as string) || "";

  const items: { label: string; done: boolean; key: string; required: boolean }[] = [
    { key: "businessName",      label: "Business name",              done: !!proj.businessName,   required: true  },
    { key: "domain",            label: "Website URL (https://)",     done: !!(proj.domain && (proj.domain as string).startsWith("https://")), required: true },
    { key: "phone",             label: "Phone number",               done: !!proj.phone,          required: true  },
    { key: "email",             label: "Email address",              done: !!proj.email,          required: true  },
    { key: "businessAddress",   label: "Business address",           done: !!proj.businessAddress, required: true },
    { key: "logoUrl",           label: "Logo URL (or skipped)",      done: !!(proj.logoUrl) || proj.skipLogo === true, required: true },
    { key: "mainService",       label: "Main service",               done: !!proj.mainService,    required: true  },
    { key: "primaryLocation",   label: "Primary location",           done: !!proj.primaryLocation, required: true },
    { key: "serviceAreas",      label: "At least one service area",  done: serviceAreas.length > 0, required: true },
    { key: "businessType",      label: "Business type / industry",   done: !!proj.businessType,   required: false },
    { key: "description",       label: "Business description",       done: !!(proj.description && (proj.description as string).length > 20), required: false },
    { key: "navItems",          label: "Header navigation (≥1 item)", done: navItems.length > 0,  required: true  },
    { key: "footerCompanyName", label: "Footer business name",        done: !!proj.footerCompanyName, required: true },
    { key: "footerLinks",       label: "Footer links added",          done: footerLinks.length > 0 || !!(proj.privacyUrl), required: false },
    { key: "imageMode",         label: "Image mode selected",        done: !!imageMode,           required: true  },
    { key: "brandStyle",        label: "Brand style set",            done: !!proj.brandStyle,     required: false },
    {
      key: "openaiKey",
      label: "OpenAI API key",
      done: !!(integrations.openaiApiKey) || !!process.env.OPENAI_API_KEY,
      required: false,
    },
    {
      key: "ideogramKey",
      label: "Ideogram API key (AI images)",
      done: imageMode === "own" || imageMode === "skip"
        ? true
        : !!(integrations.ideogramApiKey) || !!process.env.IDEOGRAM_API_KEY,
      required: false,
    },
  ];

  const requiredItems  = items.filter(i => i.required);
  const requiredScore  = requiredItems.filter(i => i.done).length;
  const requiredTotal  = requiredItems.length;
  const overallScore   = items.filter(i => i.done).length;
  const overallTotal   = items.length;
  const canGenerate    = requiredScore === requiredTotal;

  res.json({ items, requiredScore, requiredTotal, overallScore, overallTotal, canGenerate });
});

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN IMAGE PACKS  (/api/image-library/*)
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_PACKS_JSON = path.join(WORKSPACE_ROOT, "config", "imagePacks.json");

interface PackEntry {
  id: string;
  industryType: string;
  slot: string;
  sceneType: string;
  path: string;
  altTemplate: string;
  tags?: string[];
  buyerTypes?: string[];
  approved: boolean;
  notes?: string;
}

function loadPackManifest(): PackEntry[] {
  try {
    const raw = JSON.parse(fs.readFileSync(IMAGE_PACKS_JSON, "utf8")) as { images: PackEntry[] };
    return raw.images || [];
  } catch { return []; }
}

function savePackManifest(images: PackEntry[]): void {
  const current = JSON.parse(fs.readFileSync(IMAGE_PACKS_JSON, "utf8")) as Record<string, unknown>;
  current.images = images;
  fs.writeFileSync(IMAGE_PACKS_JSON, JSON.stringify(current, null, 2));
}

// ─── GET /api/image-library/packs ────────────────────────────────────────────
router.get("/image-library/packs", (_req, res) => {
  const images = loadPackManifest();
  const enriched = images.map(e => ({
    ...e,
    hasFile: fs.existsSync(path.join(WORKSPACE_ROOT, e.path)),
  }));
  res.json({ images: enriched });
});

// ─── GET /api/image-library/pack-serve/:packId ───────────────────────────────
router.get("/image-library/pack-serve/:packId", (req, res) => {
  const { packId } = req.params;
  const images = loadPackManifest();
  const entry = images.find(e => e.id === packId);
  if (!entry) { res.status(404).json({ error: "Pack entry not found" }); return; }
  const filePath = path.join(WORKSPACE_ROOT, entry.path);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: "Image file not found" }); return; }
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "no-cache");
  fs.createReadStream(filePath).pipe(res);
});

// ─── POST /api/image-library/pack-upload ─────────────────────────────────────
const packUploadMw = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: HARD_LIMIT_BYTES },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "image/svg+xml" || file.mimetype === "image/gif") {
      cb(new Error("Unsupported format. Use JPG, PNG, or WebP."));
    } else {
      cb(null, true);
    }
  },
}).single("file");

router.post("/image-library/pack-upload", (req, res, next) => {
  packUploadMw(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "Image exceeds 20MB limit." }); return;
    }
    if (err instanceof Error) { res.status(422).json({ error: err.message }); return; }
    next();
  });
}, (req, res) => {
  const { packId } = req.body as { packId?: string };
  if (!packId) { res.status(400).json({ error: "packId is required" }); return; }
  if (!req.file) { res.status(400).json({ error: "No file uploaded" }); return; }

  const images = loadPackManifest();
  const idx = images.findIndex(e => e.id === packId);
  if (idx === -1) { res.status(404).json({ error: "Pack entry not found" }); return; }

  const entry = images[idx];
  // Detect extension from mime type
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp",
    "application/octet-stream": ".jpg",
  };
  const ext = mimeToExt[req.file.mimetype] || path.extname(req.file.originalname) || ".jpg";
  // Save to the configured path (always as .jpg for consistency, or use detected ext)
  const destPath = path.join(WORKSPACE_ROOT, entry.path);
  const destDir  = path.dirname(destPath);
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(destPath, req.file.buffer);
  req.log.info({ packId, path: entry.path }, "Pack image uploaded");
  void ext; // ext kept for future use if we support multi-format packs

  // Mark approved in manifest
  images[idx] = { ...entry, approved: true };
  savePackManifest(images);

  res.json({ ok: true, packId, path: entry.path });
});

// ─── GET /api/image-library/role-preview/:industry ───────────────────────────
// Returns a fresh random role assignment for a pack industry.
// Called by the Templates UI "Randomise" button.
router.get("/image-library/role-preview/:industry", (req, res) => {
  const industry     = req.params.industry as string;
  const packIndustry = mapToPackIndustry(industry) ?? industry;
  const roles        = assignImageRoles(industry, WORKSPACE_ROOT);
  const entries      = getPackEntries(packIndustry, WORKSPACE_ROOT);
  const uploaded     = entries.filter((e: { hasFile: boolean }) => e.hasFile).length;

  res.json({
    industry,
    packIndustry,
    uploaded,
    total:      entries.length,
    roles,
    roleLabels: Object.fromEntries(ALL_ROLES.map((r: ImageRole) => [r, ROLE_LABELS[r]])),
  });
});

// ─── DELETE /api/image-library/pack/:packId ───────────────────────────────────
router.delete("/image-library/pack/:packId", (req, res) => {
  const { packId } = req.params;
  const images = loadPackManifest();
  const idx = images.findIndex(e => e.id === packId);
  if (idx === -1) { res.status(404).json({ error: "Pack entry not found" }); return; }
  const entry = images[idx];
  const filePath = path.join(WORKSPACE_ROOT, entry.path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  images[idx] = { ...entry, approved: false };
  savePackManifest(images);
  res.json({ ok: true, packId });
});

// ─── GET /api/projects/:slug/save ─────────────────────────────────────────
router.get("/projects/:slug/save", (req, res) => {
  const p = loadProject(req.params.slug);
  if (!p) { res.status(404).json({ error: "Project not found" }); return; }
  res.json({ ok: true, project: p });
});

// ─── PUT /api/projects/:slug/integrations ─────────────────────────────────
router.put("/projects/:slug/integrations", (req, res) => {
  const slug = req.params.slug;
  const p    = loadProject(slug);
  if (!p) { res.status(404).json({ error: "Project not found" }); return; }
  const { ideogramApiKey, openaiApiKey } = req.body as { ideogramApiKey?: string; openaiApiKey?: string };
  const existing = (p.integrations ?? {}) as Record<string, unknown>;
  const updated  = { ...existing };
  if (ideogramApiKey !== undefined) updated.ideogramApiKey = ideogramApiKey || undefined;
  if (openaiApiKey   !== undefined) updated.openaiApiKey   = openaiApiKey   || undefined;
  p.integrations = updated;
  saveProject(slug, p);
  res.json({ ok: true });
});

export default router;
