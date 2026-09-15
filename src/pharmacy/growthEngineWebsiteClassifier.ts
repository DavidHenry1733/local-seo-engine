/**
 * Growth Engine — Website Intelligence V1 page classification.
 */
import type { WebsitePageCategory } from "./growthEngineWebsiteIntelligenceModel.ts";

function isDatedArticlePath(path: string): boolean {
  return /\/\d{4}\/\d{2}\/\d{2}\//.test(path) || /\/\d{4}\/\d{2}\/[^/]+/.test(path);
}

function isUtilityPath(path: string, title: string): boolean {
  const p = path.toLowerCase();
  const t = title.toLowerCase();
  if (/\/(hero-\d+|form|import-test|audit-thank-you|thank-you|thanks|unsubscribe|confirm(?:ation)?)\b/.test(p)) {
    return true;
  }
  if (/^(hero\s*\d+|form|import test|thank you|audit thank you)\b/.test(t)) return true;
  return false;
}

function isLandingPath(path: string): boolean {
  const p = path.toLowerCase();
  return /\/(lp|landing|web-design-landing|campaign|promo)(\/|$)/.test(p) || /-landing\/?$/.test(p);
}

function isOfferPath(path: string, title: string): boolean {
  const p = path.toLowerCase();
  const t = title.toLowerCase();
  return (
    /\/(founder[-_]?partner|partner[-_]?programme|partner[-_]?program|affiliate|special[-_]?offer)\b/.test(p)
    || /\b(founder partner|partner programme|partner program|special offer)\b/.test(t)
  );
}

function isPricingPath(path: string, title: string): boolean {
  const p = path.toLowerCase();
  const t = title.toLowerCase();
  return (
    /\/(pricing|prices|packages|plans|price-list)(-|\d|\/|$)/.test(p)
    || /\b(pricing|packages|price list)\b/.test(t)
  );
}

function isStrongCommercialServicePath(path: string): boolean {
  return /(website-design|web-design|local-seo|seo-for|email-marketing|email-communication|website-hosting|web-hosting|digital-marketing|branding|ppc|google-ads|social-media|marketing-services|pharmacy-website|pharmacy-email|pharmacy-hosting|growth-audit)(?!-landing)/i.test(
    path,
  );
}

export function classifyWebsitePage(path: string, title: string, html: string): WebsitePageCategory {
  const p = path.toLowerCase();
  const t = title.toLowerCase();
  const h = html.toLowerCase().slice(0, 8000);

  if (p === "/" || p === "" || /\/index\.(html|php|aspx)?$/i.test(p)) return "homepage";
  if (isUtilityPath(p, t)) return "utility";
  if (/\/about|\/who-we-are|\/our-story|\/meet-the-team/.test(p) || /\babout us\b/.test(t)) return "about";
  if (/\/contact|\/find-us|\/get-in-touch/.test(p) || /\bcontact\b/.test(t)) return "contact";
  if (/\/book|\/appointment|\/booking/.test(p) || /\bbook (an |a )?appointment\b/.test(t)) return "booking";
  if (/\/faq|\/faqs|\/frequently-asked/.test(p) || /\bfaq\b/.test(t)) return "faq";
  if (/\/guide|\/patient-guide|\/advice/.test(p) || /\bguide\b/.test(t)) return "guide";
  // Dated CMS article URLs must not become services merely because the title mentions "services".
  if (isDatedArticlePath(p)) return "blog";
  if (/\/blog|\/articles|\/insights/.test(p) && !/\/news\//.test(p)) return "blog";
  if (/\/news|\/press|\/updates/.test(p)) return "news";
  if (/\/location|\/branch|\/stores|\/find-a-pharmacy/.test(p) || /\blocation\b/.test(t)) return "locations";
  if (/\/privacy|\/terms|\/cookie|\/gdpr|\/policy|\/legal|\/nda\b/.test(p)) return "policy";
  if (/\/download|\/resource|\/leaflet|\/brochure/.test(p)) return "resources";
  if (/\/video|\/watch/.test(p) || /<video[\s>]/i.test(html)) return "resources";

  if (isPricingPath(p, t)) return "pricing";
  if (isOfferPath(p, t)) return "offer";
  // Landing pages only when not a strong dedicated commercial service path.
  if (isLandingPath(p) && !isStrongCommercialServicePath(p.replace(/-landing/g, ""))) return "landing";
  if (isLandingPath(p)) return "landing";

  if (/\/services?\/?$/.test(p) || (/\bservices\b/.test(t) && !/\/services?\//.test(p) && !isDatedArticlePath(p))) {
    // Index-style services hub only — not every title that contains the word "services".
    if (/\/services?\/?$/.test(p) || /^services?\b/.test(t) || /\bour services\b/.test(t)) return "services";
  }

  if (isStrongCommercialServicePath(p)) return "service-page";

  const clinicalServiceSlug =
    /\/(pharmacy-first|blood-pressure|travel-clinic|travel-vaccin|travel-health|vaccin|contraception|prescription|nms|ear-wax|smoking|weight-management|weight-loss|flu-vaccin|flu-jab|covid-vaccin|minor-ailment|health-check|dispens|malaria|medication-review)/i.test(
      p,
    );
  if (clinicalServiceSlug || (/\/services?\//.test(p) && p.split("/").filter(Boolean).length >= 2)) return "service-page";

  if (/case study|case-study/.test(t) || /\/case-stud/.test(p)) return "blog";

  // Avoid treating every "pharmacy"-mentioning marketing page as a clinical service page.
  if (
    /\bservice\b/.test(t)
    && p.split("/").filter(Boolean).length <= 2
    && !/\bfor pharmacies\b|\bpharmacy (website|seo|email|hosting|growth)\b/i.test(t + " " + h)
    && !isDatedArticlePath(p)
  ) {
    return "service-page";
  }

  return "other";
}
