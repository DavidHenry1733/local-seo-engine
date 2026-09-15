import fs from "node:fs";
import path from "node:path";
import {
  renderAlt,
  serviceDisplayName,
  normaliseServiceKey,
  type ImageSelection,
  type ImageLibraryConfig,
  type ManualOverride,
  type PageImageSelections,
  selectPageImages,
} from "./imageLibrary";

export type CampaignPaneSlot = "hero" | "support" | "trust" | "conversion";

const PANE_SLOTS: CampaignPaneSlot[] = ["hero", "support", "trust", "conversion"];
const IMAGE_EXTS = [".webp", ".jpg", ".jpeg", ".png"] as const;

export interface CampaignPaneSlotFile {
  slot: CampaignPaneSlot;
  localPath: string;
  ext: string;
  serviceKey: string;
  assignedFrom?: string;
}

/** Read campaign image pane meta from output/{campaignId}/assets/image-meta.json */
export function readCampaignImageMeta(
  campaignId: string,
  outputDir = "output",
): Record<string, Record<string, unknown>> {
  const metaPath = path.join(outputDir, campaignId, "assets", "image-meta.json");
  if (!fs.existsSync(metaPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(metaPath, "utf8")) as Record<string, Record<string, unknown>>;
  } catch {
    return {};
  }
}

/** Locate a campaign pane slot file on disk. */
export function findCampaignPaneSlotFile(
  campaignId: string,
  serviceKey: string,
  slot: CampaignPaneSlot,
  outputDir = "output",
): CampaignPaneSlotFile | null {
  const meta = readCampaignImageMeta(campaignId, outputDir);
  const metaEntry = meta[slot];
  const svcKey = normaliseServiceKey(
    (metaEntry?.serviceKey as string | undefined) || serviceKey,
  );
  const metaExt = (metaEntry?.ext as string | undefined) ?? "";
  const baseDir = path.join(outputDir, campaignId, "assets", svcKey);
  const exts = metaExt
    ? [metaExt, ...IMAGE_EXTS.filter((e) => e !== metaExt)]
    : [...IMAGE_EXTS];

  for (const ext of exts) {
    const localPath = path.join(baseDir, `${slot}${ext}`);
    if (fs.existsSync(localPath)) {
      return {
        slot,
        localPath,
        ext: ext.startsWith(".") ? ext.slice(1) : ext,
        serviceKey: svcKey,
        assignedFrom: metaEntry?.assignedFrom as string | undefined,
      };
    }
  }
  return null;
}

/** Build live or preview URL for a campaign pane slot asset. */
export function buildCampaignPaneImageUrl(
  campaignId: string,
  serviceKey: string,
  slot: CampaignPaneSlot,
  ext: string,
  domain: string,
  isLive: boolean,
): string {
  const svcKey = normaliseServiceKey(serviceKey);
  const extNorm = ext.startsWith(".") ? ext : `.${ext}`;
  if (isLive) {
    const base = domain.replace(/\/+$/, "");
    return `${base}/assets/${campaignId}/${svcKey}/${slot}${extNorm}`;
  }
  return `/assets/${campaignId}/${svcKey}/${slot}${extNorm}`;
}

/** Resolve all campaign pane slot selections for a page. */
export function resolveCampaignPaneImageSelections(opts: {
  campaignId: string;
  serviceKey?: string;
  domain: string;
  isLive: boolean;
  location: string;
  serviceName: string;
  outputDir?: string;
}): Partial<Record<CampaignPaneSlot, ImageSelection>> {
  const out: Partial<Record<CampaignPaneSlot, ImageSelection>> = {};
  const svcKey = normaliseServiceKey(opts.serviceKey ?? opts.serviceName);
  const displayName = serviceDisplayName(opts.serviceName);
  const meta = readCampaignImageMeta(opts.campaignId, opts.outputDir);
  const paneIsLive = !!(opts.domain?.replace(/\/+$/, ""));

  for (const slot of PANE_SLOTS) {
    const found = findCampaignPaneSlotFile(
      opts.campaignId,
      svcKey,
      slot,
      opts.outputDir,
    );
    if (!found) continue;
    const altTemplate =
      (meta[slot]?.altText as string | undefined) ??
      "{{Service}} {{Location}} — professional {{service}} services";
    out[slot] = {
      libraryId: found.assignedFrom ?? `campaign-pane:${opts.campaignId}:${slot}`,
      src: buildCampaignPaneImageUrl(
        opts.campaignId,
        found.serviceKey,
        slot,
        found.ext,
        opts.domain,
        paneIsLive,
      ),
      alt: renderAlt(altTemplate, displayName, opts.location),
      filename: `${slot}.${found.ext}`,
    };
  }
  return out;
}

/** Campaign pane slots that exist on disk for a campaign. */
export function campaignPaneSlotsFilled(
  campaignId: string,
  serviceKey?: string,
  outputDir = "output",
): CampaignPaneSlot[] {
  const svcKey = normaliseServiceKey(serviceKey ?? "");
  return PANE_SLOTS.filter((slot) =>
    findCampaignPaneSlotFile(campaignId, svcKey, slot, outputDir),
  );
}

/** Apply hero/support/trust/conversion selections to rendered HTML by wrapper class. */
export function applyImageSelectionsToHtml(
  html: string,
  selections: Partial<Record<CampaignPaneSlot, { src: string; alt: string } | null | undefined>>,
): string {
  function replaceByWrapper(
    h: string,
    wrapperClass: string,
    newSrc: string,
    newAlt: string,
  ): string {
    return h.replace(
      new RegExp(
        `(<div\\b[^>]*class="[^"]*\\b${wrapperClass}\\b[^"]*"[^>]*>[\\s\\S]*?<img\\b)([^>]*)(>)`,
        "i",
      ),
      (_full, pre, attrs, close) => {
        let a = attrs.replace(/\bsrc="[^"]*"/i, `src="${newSrc}"`);
        a = a.replace(/\balt="[^"]*"/i, `alt="${newAlt}"`);
        return `${pre}${a}${close}`;
      },
    );
  }

  let out = html;
  if (selections.hero?.src) {
    out = replaceByWrapper(out, "hero-media", selections.hero.src, selections.hero.alt);
  }
  if (selections.support?.src) {
    out = replaceByWrapper(out, "support-block-media", selections.support.src, selections.support.alt);
  }
  if (selections.trust?.src) {
    out = replaceByWrapper(out, "trust-block-media", selections.trust.src, selections.trust.alt);
  }
  if (selections.conversion?.src) {
    out = replaceByWrapper(
      out,
      "conversion-feature-image",
      selections.conversion.src,
      selections.conversion.alt,
    );
  }
  return out;
}

/**
 * Prefer campaign pane images, then slots already filled in runOneArea,
 * then deterministic/random image library fallback.
 */
export function resolveFinalImageSelections(opts: {
  campaignId?: string;
  serviceKey?: string;
  serviceName: string;
  pageSlug: string;
  location: string;
  domain: string;
  isLive: boolean;
  libConfig?: ImageLibraryConfig;
  manualOverride?: ManualOverride;
  campaignSlotsFilled?: string[];
  outputDir?: string;
}): PageImageSelections {
  const filled = new Set(opts.campaignSlotsFilled ?? []);
  const pane = opts.campaignId
    ? resolveCampaignPaneImageSelections({
        campaignId: opts.campaignId,
        serviceKey: opts.serviceKey ?? opts.serviceName,
        domain: opts.domain,
        isLive: opts.isLive,
        location: opts.location,
        serviceName: opts.serviceName,
        outputDir: opts.outputDir,
      })
    : {};

  const lib =
    opts.libConfig?.enabled
      ? selectPageImages({
          service: opts.serviceName,
          pageSlug: opts.pageSlug,
          location: opts.location,
          serviceName: serviceDisplayName(opts.serviceName),
          domain: opts.domain,
          isLive: opts.isLive,
          config: opts.libConfig,
          manualOverride: opts.manualOverride,
        })
      : { hero: null, support: null, trust: null, conversion: null };

  const pick = (slot: CampaignPaneSlot): ImageSelection | null => {
    if (pane[slot]) return pane[slot]!;
    if (filled.has(slot)) return null;
    return lib[slot];
  };

  return {
    hero: pick("hero"),
    support: pick("support"),
    trust: pick("trust"),
    conversion: pick("conversion"),
  };
}
