/**
 * Prominent telephone CTA — gated by Brand DNA navigation.telephoneCta evidence.
 */
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";

export function stripProminentTelephoneCtaFromMainHtml(
  mainHtml: string,
  profile: PharmacyServicePageProfile,
): string {
  if (profile.showProminentTelephoneCta) return mainHtml;

  return mainHtml.replace(
    /(<section[^>]*data-template-block="final-cta"[\s\S]*?<div class="cta-actions">)([\s\S]*?)(<\/div>[\s\S]*?<\/section>)/gi,
    (_match, open, actions, close) => {
      const cleaned = String(actions).replace(
        /<a\b[^>]*class="[^"]*\bbtn-white\b[^"]*"[^>]*href="tel:[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
        "",
      );
      return `${open}${cleaned}${close}`;
    },
  );
}
