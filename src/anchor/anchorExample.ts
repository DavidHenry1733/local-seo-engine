/**
 * anchorExample.ts
 *
 * Demonstrates the anchor engine using real section HTML extracted from the
 * existing hub page output (output/inboxingproweb-local/index.html).
 *
 * Run:
 *   pnpm exec tsx src/anchor/anchorExample.ts
 */

import { applyInternalAnchors } from "./anchorEngine";
import type { AnchorEngineInput } from "./anchorTypes";

// ── Real section HTML from the hub page output ─────────────────────────────────

const splitSectionOneHtml = `
  <section class="section-band" id="split-section-one">
    <div class="wrap">
      <h2>Why Web Design matters for Sheffield businesses</h2>
      <p>In Sheffield, potential customers judge your business within seconds of landing on your site. If your website looks dated, loads slowly, or is hard to use, they click away and choose a competitor whose online presence feels more professional and trustworthy. Poor web design means missed enquiries, abandoned baskets, and prospects who never even bother to call or email.</p>
      <p>Local competition is fierce across trades, professional services, e-commerce, and hospitality. Customers compare multiple options side by side, and the business with the clearest, most convincing website usually wins the work. Web Design Sheffield is not just about appearance; it is about whether your site clearly answers questions, builds confidence, and makes it easy to take the next step.</p>
      <p>When your website is treated as a static brochure instead of a revenue-generating tool, every day brings lost leads, weaker cash flow, and a growing gap between you and better-prepared competitors. A poorly performing website costs money every single day.</p>
    </div>
  </section>
`.trim();

const splitSectionTwoHtml = `
  <section class="section-band section-band--alt" id="split-section-two">
    <div class="wrap">
      <h2>What Web Design includes</h2>
      <div class="section-2col">
        <p>InboxingProWeb delivers a complete Web Design service that provides a structured, conversion-focused website tailored to your Sheffield business. You get a clear site architecture, on-brand visual design, performance-tuned pages, persuasive copy, and a fully mobile-friendly website so customers can enquire easily from any device. Every page is planned to guide visitors from first click through to contact form, phone call, booking, or online purchase.</p>
        <p>Your new website is built to rank in traditional search engines and to perform strongly in AI-driven search results that extract and surface business information. We combine solid on-page local SEO, clear service descriptions, and consistent data so your website is easily understood by both human visitors and AI tools. Key elements like headings, calls to action, and contact details are positioned to maximise enquiries and sales.</p>
        <p>Unlike generic template builds from a volume web agency, our approach is tailored to your offer, pricing, and audience. We structure your content, service pages, and calls to action around how your customers actually buy, ensuring your website is built to rank, built to attract, and built to convert.</p>
      </div>
    </div>
  </section>
`.trim();

const aboutSectionHtml = `
  <section class="section-band" id="about-section">
    <div class="wrap">
      <h3>About InboxingProWeb</h3>
      <p>InboxingProWeb is part of DHM Digital Limited, a UK-based digital consultancy focused on helping local businesses build a strong and sustainable online presence. We specialise in creating professional websites, improving visibility through local SEO, and delivering reliable hosting solutions.</p>
      <p>Our approach is simple — provide high-quality digital services without the inflated agency pricing. Every website we build is designed to perform, generate enquiries, and support long-term business growth.</p>
    </div>
  </section>
`.trim();

const localRelevanceSectionHtml = `
  <section class="section-band section-band--alt" id="local-relevance-section">
    <div class="wrap">
      <div class="content-card" style="max-width:780px;">
        <h2>Web Design for Sheffield — why local matters</h2>
        <p>Sheffield customers often search for services with strong local intent, checking addresses, reviews, and trust signals before making contact. A locally tuned website helps you appear in these searches, show that you genuinely serve the area, and give visitors the confidence that you are nearby and available when they need you.</p>
        <p>By understanding Sheffield's mix of industrial, professional, and creative businesses, InboxingProWeb can structure your website to speak directly to local expectations. From highlighting service areas around the city to emphasising fast response times across nearby districts, a locally focused site helps convert browsers into paying clients.</p>
      </div>
    </div>
  </section>
`.trim();

// ── Engine input ───────────────────────────────────────────────────────────────

const input: AnchorEngineInput = {
  pageType:           "hub",
  primaryKeyword:     "Web Design Sheffield",
  supportingKeywords: ["local SEO", "website design", "small business website", "affordable web design"],
  serviceName:        "Web Design",
  location:           "Sheffield",

  hubPage: {
    label:    "Web Design Sheffield — hub",
    url:      "https://local.inboxingproweb.com/",
    linkType: "hub",
  },

  relatedClusterPages: [
    {
      label:    "Web Design Ecclesall",
      url:      "https://local.inboxingproweb.com/web-design-ecclesall/",
      linkType: "cluster",
    },
    {
      label:    "Web Design Fulwood",
      url:      "https://local.inboxingproweb.com/web-design-fulwood/",
      linkType: "cluster",
    },
  ],

  supportingPages: [
    {
      label:    "Why your website design affects local SEO",
      url:      "https://inboxingproweb.com/blog/website-design-local-seo/",
      linkType: "supporting",
    },
    {
      label:    "How a new website generates enquiries",
      url:      "https://inboxingproweb.com/blog/website-enquiries/",
      linkType: "supporting",
    },
  ],

  splitSectionOneHtml,
  splitSectionTwoHtml,
  aboutSectionHtml,
  localRelevanceSectionHtml,
};

// ── Run the engine ────────────────────────────────────────────────────────────

const output = applyInternalAnchors(input);

// ── Report ────────────────────────────────────────────────────────────────────

const inserted = output.insertions.filter((i) => i.status === "inserted");
const warnings = output.insertions.filter((i) => i.status === "warning");

console.log("═══════════════════════════════════════════════════════");
console.log("  Anchor Engine — Insertion Report");
console.log("═══════════════════════════════════════════════════════");
console.log(`  Total links attempted : ${output.insertions.filter(i => ["inserted","warning","skipped"].includes(i.status) && i.anchorText !== "").length}`);
console.log(`  Inserted              : ${inserted.length}`);
console.log(`  Warnings              : ${warnings.length}`);
console.log("═══════════════════════════════════════════════════════\n");

console.log("── Insertion details ─────────────────────────────────");
for (const ins of output.insertions) {
  if (ins.anchorText === "" && ins.status === "warning") {
    console.log(`  ⚠  VALIDATION  ${ins.message}`);
    continue;
  }
  const icon = ins.status === "inserted" ? "✓" : ins.status === "warning" ? "⚠" : "–";
  console.log(
    `  ${icon}  [${ins.linkType.padEnd(10)}] [${ins.anchorStyle.padEnd(7)}]` +
    `  "${ins.anchorText}"`
  );
  if (ins.sectionUsed) console.log(`      → section: ${ins.sectionUsed}`);
  if (ins.status !== "inserted") console.log(`      ↳ ${ins.message}`);
}

console.log("\n── Section HTML with injected links ─────────────────");

const sections: [string, string | undefined][] = [
  ["splitSectionOne",  output.splitSectionOneHtml],
  ["splitSectionTwo",  output.splitSectionTwoHtml],
  ["about",            output.aboutSectionHtml],
  ["localRelevance",   output.localRelevanceSectionHtml],
  ["resourcesIntro",   output.resourcesIntroHtml],
];

for (const [key, html] of sections) {
  if (!html) continue;
  const linkCount = (html.match(/<a href=/g) ?? []).length;
  console.log(`\n  [${key}] — ${linkCount} link(s) injected`);
  console.log("  " + "─".repeat(55));
  // Print a compact preview: just the <p> tags
  const paras = html.match(/<p[^>]*>[\s\S]*?<\/p>/g) ?? [];
  for (const p of paras) {
    // Collapse whitespace for display
    const preview = p.replace(/\s+/g, " ").trim();
    const truncated = preview.length > 200 ? preview.slice(0, 197) + "…" : preview;
    console.log(`  ${truncated}`);
  }
}

console.log("\n── Full insertion log (JSON) ──────────────────────────");
console.log(JSON.stringify(output.insertions, null, 2));
