/**
 * Local hub/cluster page contract validation — blocks canonical render on failure.
 */
import type { LocalImageRole, LocalPageTypeContract } from "./pharmacyLocalPageTypeContracts.ts";

export interface LocalPageContractValidationResult {
  ok: boolean;
  blockedReason?: string;
  imageSlots: Record<LocalImageRole, number>;
  duplicateAccessSections: number;
  sectionIdsFound: string[];
}

function mainHtml(html: string): string {
  return html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html;
}

export function countImageSlotsByRole(html: string): Record<LocalImageRole, number> {
  const main = mainHtml(html);
  const roles: LocalImageRole[] = ["hero", "supporting", "trust", "conversion"];
  const out = { hero: 0, supporting: 0, trust: 0, conversion: 0 } as Record<LocalImageRole, number>;
  for (const role of roles) {
    const slotAttr = role === "supporting" ? "support" : role;
    const re = new RegExp(`<img[^>]+data-image-slot=["']${slotAttr}["']`, "gi");
    out[role] = (main.match(re) || []).length;
  }
  return out;
}

export function countDuplicateAccessSections(html: string): number {
  const main = mainHtml(html);
  let count = 0;
  if (/id="local-access"/i.test(main)) count += 1;
  if (/id="pharmacy-map-contact"/i.test(main)) count += 1;
  if (/data-template-block="map-contact"/i.test(main)) count += 1;
  if (/data-component-variant="structured-local-access"/i.test(main)) count += 1;
  return Math.max(0, count - 1);
}

export function validateLocalPageTypeContractHtml(
  html: string,
  contract: LocalPageTypeContract,
): LocalPageContractValidationResult {
  const main = mainHtml(html);
  const imageSlots = countImageSlotsByRole(html);
  const duplicateAccessSections = countDuplicateAccessSections(html);
  const sectionIdsFound: string[] = [];
  for (const sec of contract.sections) {
    const blockRe = new RegExp(`data-template-block=["']${sec.templateBlock.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
    const idRe = sec.sectionId ? new RegExp(`id=["']${sec.sectionId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i") : null;
    if (blockRe.test(main) || (idRe && idRe.test(main))) {
      sectionIdsFound.push(sec.sectionId);
    }
  }

  const missingImages = contract.requiredImageRoles.filter((role) => imageSlots[role] !== 1);
  if (missingImages.length) {
    return {
      ok: false,
      blockedReason: `Missing or duplicate image slots: ${missingImages.join(", ")} (${JSON.stringify(imageSlots)})`,
      imageSlots,
      duplicateAccessSections,
      sectionIdsFound,
    };
  }

  if (duplicateAccessSections > 0) {
    return {
      ok: false,
      blockedReason: `Duplicate access sections detected (${duplicateAccessSections})`,
      imageSlots,
      duplicateAccessSections,
      sectionIdsFound,
    };
  }

  const conversionInCtaOnly =
    /class="cta-band"[\s\S]*data-image-slot=["']conversion["']/i.test(main) &&
    !/data-template-block=["']conversion-image["']/i.test(main);
  if (conversionInCtaOnly) {
    return {
      ok: false,
      blockedReason: "Conversion image must use full-width conversion-image section, not CTA band only",
      imageSlots,
      duplicateAccessSections,
      sectionIdsFound,
    };
  }

  const requiredMissing = contract.sections
    .filter((s) => s.required && s.templateBlock !== "breadcrumbs")
    .filter((s) => {
      const blockRe = new RegExp(`data-template-block=["']${s.templateBlock.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`, "i");
      return !blockRe.test(main);
    });
  if (requiredMissing.length) {
    return {
      ok: false,
      blockedReason: `Missing required sections: ${requiredMissing.map((s) => s.sectionId).join(", ")}`,
      imageSlots,
      duplicateAccessSections,
      sectionIdsFound,
    };
  }

  return { ok: true, imageSlots, duplicateAccessSections, sectionIdsFound };
}

export function assertLocalPageContractOrThrow(html: string, contract: LocalPageTypeContract): void {
  const result = validateLocalPageTypeContractHtml(html, contract);
  if (!result.ok) {
    throw new Error(`Local page contract ${contract.contractId} blocked: ${result.blockedReason}`);
  }
}
