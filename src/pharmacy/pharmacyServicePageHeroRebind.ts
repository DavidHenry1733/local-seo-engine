/**
 * Rebind hero section markup from Component DNA without regenerating written content.
 */
import * as cheerio from "cheerio";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { buildProfileHeroHtml } from "./pharmacyServicePageTrustInjection.ts";

export function rebindHeroSectionInMainHtml(
  mainHtml: string,
  serviceName: string,
  profile: PharmacyServicePageProfile,
  contentContext?: ContentGenerationContext,
): string {
  const $ = cheerio.load(`<div id="rebind-root">${mainHtml}</div>`, { decodeEntities: false });
  const hero = $("#rebind-root #hero-section");
  if (!hero.length) return mainHtml;

  const heroImageHtml =
    hero.find(".hero-image-wrap, .hero-media, [data-image-slot='hero']").first().prop("outerHTML") ||
    hero.find("img").first().parent().prop("outerHTML") ||
    "";

  if (!heroImageHtml) return mainHtml;

  hero.replaceWith(buildProfileHeroHtml(serviceName, profile, heroImageHtml, contentContext));
  return $("#rebind-root").html() || mainHtml;
}
