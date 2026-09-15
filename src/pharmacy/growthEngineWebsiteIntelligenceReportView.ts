/**
 * Website Report — customer-facing executive presentation (read-only).
 * Derives a short commercial summary from existing website-intelligence evidence.
 */
import type { WebsiteImportSnapshot } from "./pharmacyProfileSchema.ts";
import type { GrowthEngineWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceModel.ts";

export interface WebsiteExecutiveAction {
  title: string;
  benefit: string;
}

export interface WebsiteExecutiveSnapshotFacts {
  pagesFound: string;
  servicePagesDetected: string;
  supportingContent: string;
  reportStatus: string;
}

export interface WebsiteExecutiveReportView {
  live: boolean;
  websiteUrl: string;
  snapshot: WebsiteExecutiveSnapshotFacts;
  strengths: string[];
  gaps: string[];
  actions: WebsiteExecutiveAction[];
  conclusion: {
    position: string;
    opportunity: string;
    next: string;
  };
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item.trim());
  }
  return out;
}

function joinNames(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function importSignals(importSnap: WebsiteImportSnapshot | null | undefined) {
  const intel = importSnap?.intelligence;
  return {
    logo: Boolean(intel?.identity.logoUrl || importSnap?.logoUrl),
    phone: Boolean(intel?.business.phone.selected || importSnap?.phone),
    email: Boolean(intel?.business.email.selected || importSnap?.email),
  };
}

export function buildWebsiteExecutiveReportView(
  snapshot: GrowthEngineWebsiteIntelligenceSnapshot | null,
  importSnap?: WebsiteImportSnapshot | null,
): WebsiteExecutiveReportView {
  const analysis = snapshot?.analysis;
  const live = analysis?.dataSource === "website-live";
  const counts = analysis?.canonicalCounts;
  const services = analysis?.canonicalServices || [];
  const inventory = analysis?.inventory;
  const tech = analysis?.technical;
  const contacts = importSignals(importSnap);
  const empty: WebsiteExecutiveReportView = {
    live: false,
    websiteUrl: snapshot?.websiteUrl || "",
    snapshot: {
      pagesFound: "Not available yet",
      servicePagesDetected: "Not available yet",
      supportingContent: "Not available yet",
      reportStatus: "Needs a website scan",
    },
    strengths: [],
    gaps: [],
    actions: [],
    conclusion: {
      position: "We do not yet have a complete picture of your website.",
      opportunity: "Scan your website to see what patients can already find.",
      next: "Add your website address if needed, then scan to prepare your Growth Plan.",
    },
  };
  if (!snapshot || !analysis || !live || !counts) return empty;

  const pages = counts.contentPages;
  const visible = services.filter((s) => s.customerVisible);
  const mentioned = services.filter((s) => s.profileEnabled && s.coverageStatus === "mentioned-only");
  const blogs = counts.blogArticles;
  const faqs = counts.faqPages;
  const guides = counts.patientGuides;
  const localPages = counts.locationPages;
  const bookingPages = inventory?.byCategory.booking || 0;
  const supportTotal = blogs + faqs + guides;
  const supportLabel =
    supportTotal === 0
      ? "Limited — no blogs, FAQs or patient guides found"
      : [blogs ? `${blogs} blog${blogs === 1 ? "" : "s"}` : "", faqs ? `${faqs} FAQ page${faqs === 1 ? "" : "s"}` : "", guides ? `${guides} patient guide${guides === 1 ? "" : "s"}` : ""]
          .filter(Boolean)
          .join(" · ");

  const strengths = unique([
    visible.length
      ? `Patients can already see ${visible.length} service${visible.length === 1 ? "" : "s"} on your website, including ${joinNames(visible.map((s) => s.serviceName))}.`
      : "",
    bookingPages > 0 ? "Patients can use an online booking or request page." : "",
    contacts.logo && contacts.phone
      ? "Your brand logo and a phone number are present for patients."
      : contacts.logo
        ? "Your brand logo is present on the website."
        : contacts.phone
          ? "A phone number is available for patients to get in touch."
          : "",
    tech?.metaTitlesPresent && tech.metaDescriptionsPresent
      ? "Pages have titles and short summaries that can appear in search results."
      : "",
  ]).slice(0, 4);

  const gaps = unique([
    mentioned.length
      ? `${mentioned.length} service${mentioned.length === 1 ? "" : "s"} you offer ${mentioned.length === 1 ? "is" : "are"} only mentioned on the website, so patients may miss ${mentioned.length === 1 ? "it" : "them"}.`
      : counts.dedicatedServicePages === 0 && visible.length
        ? "Key services are shown, but they do not yet have their own dedicated pages."
        : "",
    supportTotal === 0
      ? "There is little patient information — no blogs, FAQs or guides — to help people understand your services."
      : "",
    localPages === 0 ? "There are no local pages to help nearby patients find you." : "",
    tech && !tech.https ? "The website is not using a secure connection, which can reduce patient trust." : "",
    !contacts.email ? "No email contact was found, so patients have fewer ways to get in touch." : "",
  ]).slice(0, 5);

  const actions: WebsiteExecutiveAction[] = [];
  const addAction = (title: string, benefit: string) => {
    if (actions.length >= 5) return;
    if (actions.some((a) => a.title.toLowerCase() === title.toLowerCase())) return;
    actions.push({ title, benefit });
  };
  if (mentioned.length || (counts.dedicatedServicePages === 0 && visible.length)) {
    addAction(
      "Give important services their own clear pages",
      "Patients can then find each service without searching through general content.",
    );
  }
  if (supportTotal === 0) {
    addAction(
      "Add patient-friendly FAQs and guides",
      "Clear answers help people understand how to use your services and when to visit.",
    );
  }
  if (localPages === 0) {
    addAction(
      "Add pages for the local areas you serve",
      "Nearby patients are more likely to recognise that your pharmacy is for them.",
    );
  }
  if (tech && !tech.https) {
    addAction(
      "Use a secure website address",
      "A padlock in the browser helps patients feel safe sharing their details.",
    );
  }
  if (!contacts.email) {
    addAction(
      "Make it easy to get in touch by email as well as phone",
      "Some patients prefer to write, especially outside opening hours.",
    );
  }

  const opportunity =
    mentioned.length
      ? "The clearest opportunity is to give each important service its own page, then add simple patient information around it."
      : supportTotal === 0
        ? "The clearest opportunity is to add patient guides, FAQs and local pages around the services you already show."
        : "Keep the website complete and easy for patients to use as you add the next service pages.";

  return {
    live: true,
    websiteUrl: snapshot.websiteUrl || analysis.websiteUrl || "",
    snapshot: {
      pagesFound: `${pages} page${pages === 1 ? "" : "s"} found`,
      servicePagesDetected: visible.length
        ? `${visible.length} service${visible.length === 1 ? "" : "s"} shown to patients`
        : `${counts.dedicatedServicePages} service page${counts.dedicatedServicePages === 1 ? "" : "s"} detected`,
      supportingContent: supportLabel,
      reportStatus: analysis.understandingComplete ? "Complete" : "In progress",
    },
    strengths,
    gaps,
    actions,
    conclusion: {
      position: `Your website currently has ${pages} content page${pages === 1 ? "" : "s"}${visible.length ? ` and already shows ${visible.length} service${visible.length === 1 ? "" : "s"} to patients` : ""}.`,
      opportunity,
      next: "Continue to Your Growth Plan to see the recommended next campaign based on this evidence.",
    },
  };
}
