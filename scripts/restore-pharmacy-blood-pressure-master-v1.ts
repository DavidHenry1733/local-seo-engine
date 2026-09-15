#!/usr/bin/env npx tsx
/**
 * Restore blood-pressure-checks-master-v1.md from validated pharmaconnect publish output.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as cheerio from "cheerio";
import {
  countWords,
  loadMasterLibraryFile,
  parseMasterLibraryMarkdown,
} from "../src/pharmacy/pharmacyMasterLibraryParser.ts";
import { writeCanonicalMasterPublishPage } from "../src/pharmacy/pharmacyMasterPublishRenderer.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_HTML = path.join(
  ROOT,
  "output/pharmacy-master-publish/pharmaconnect/blood-pressure-checks/index.html",
);
const OUT_MD = path.join(ROOT, "docs/pharmacy-master-library/blood-pressure-checks-master-v1.md");

const SECTION_HEADINGS: Record<number, string> = {
  1: "What Blood Pressure Checks Are",
  2: "Who Should Consider A Blood Pressure Check",
  3: "Understanding Blood Pressure Readings",
  4: "What Happens During The Appointment",
  5: "What Your Results May Mean",
  6: "When Urgent Medical Review Is Needed",
  7: "Frequently Asked Questions",
  8: "Common Misconceptions",
  9: "Patient Concerns",
  10: "Why Patients Choose Blood Pressure Checks",
  11: "Why Patients Choose A Community Pharmacy",
  12: "Trust And Safety",
  13: "Booking And Next Steps",
};

function htmlProseToMarkdown(html: string): string {
  const $ = cheerio.load(`<div id="root">${html}</div>`);
  const out: string[] = [];

  $("#root")
    .children()
    .each((_, el) => {
      const tag = el.tagName?.toLowerCase() || "";
      const $el = $(el);
      if (tag === "p") {
        let text = $el.html() || "";
        text = text.replace(/<strong>([\s\S]*?)<\/strong>/gi, "**$1**");
        text = text.replace(/<em>([\s\S]*?)<\/em>/gi, "*$1*");
        text = text.replace(/<[^>]+>/g, "");
        text = text.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
        if (text && !text.startsWith("## Owner Variables") && !text.includes("Published CTA block")) {
          out.push(text);
        }
      } else if (tag === "ul" || tag === "ol") {
        $el.find("li").each((__, li) => {
          const t = $(li).text().trim();
          if (t) out.push(`- ${t}`);
        });
      } else if (tag === "div" && $el.hasClass("table-wrap")) {
        const rows: string[][] = [];
        $el.find("tr").each((__, tr) => {
          const cells = $(tr)
            .find("th,td")
            .map((___, c) => $(c).text().trim())
            .get();
          if (cells.length) rows.push(cells);
        });
        if (rows.length) {
          out.push("");
          out.push(`| ${rows[0]!.join(" | ")} |`);
          out.push(`| ${rows[0]!.map(() => "---").join(" | ")} |`);
          for (const row of rows.slice(1)) out.push(`| ${row.join(" | ")} |`);
          out.push("");
        }
      } else if (tag === "h3") {
        out.push(`### ${$el.text().trim()}`);
      }
    });

  return out.join("\n\n").trim();
}

function extractSectionBody($: cheerio.CheerioAPI, num: number): string {
  const section = $(`section[data-master-section="${num}"]`).first();
  if (!section.length) return "";
  const prose = section.find(".content-card.master-prose").first();
  return htmlProseToMarkdown(prose.html() || "");
}

function extractFaqs($: cheerio.CheerioAPI): string {
  const items: string[] = [];
  $('section[data-component="faq-accordion"] .faq-item').each((_, el) => {
    const q = $(el).find(".faq-q").first().text().trim();
    const a = $(el).find(".faq-answer").first().text().trim();
    if (q && a) items.push(`**${q}**\n${a}`);
  });
  return items.join("\n\n");
}

function tokenizeOwnerCopy(text: string): string {
  return text
    .replace(/01709 210731/g, "{{phone}}")
    .replace(/Monday to Friday 9am–6pm, Saturday 9am–1pm/g, "{{opening_hours}}")
    .replace(/Call \{\{phone\}\} to book/g, "{{booking_link}}")
    .replace(/private consultation room/gi, "{{consultation_room}}")
    .replace(
      /NHS Hypertension Case-Finding Service — confirm local commissioning when you call/g,
      "{{nhs_service}}",
    )
    .replace(
      /Private blood pressure checks available — fee confirmed at booking if applicable/g,
      "{{private_service}}",
    )
    .replace(/Brook Pharmacy/g, "{{pharmacyName}}")
    .replace(/\bRotherham\b/g, "{{town}}");
}

function buildSection8(): string {
  return `**Myth: One high reading means I have hypertension.**
Reality: Diagnosis requires confirmed repeated measurements and GP assessment — not a single clinic or home reading.

**Myth: High blood pressure always causes symptoms.**
Reality: Many people with raised blood pressure feel completely well. That is why screening exists.

**Myth: The pharmacy will put me on blood pressure tablets.**
Reality: Pharmacists screen and refer. Starting or adjusting long-term treatment is your GP's role.

**Myth: Every pharmacy blood pressure check is a free NHS service.**
Reality: The NHS Hypertension Case-Finding Service is offered only at participating pharmacies. Private checks may carry a fee.

**Myth: If I feel fine, I do not need a check.**
Reality: High blood pressure often has no symptoms. Risk factors and age — not how you feel — determine whether screening is sensible.

**Myth: Home monitors replace professional checks.**
Reality: Home monitoring supports ongoing awareness, but validated clinical measurement and GP review remain important for diagnosis and treatment decisions.`;
}

function buildMasterMarkdown(): string {
  if (!fs.existsSync(SOURCE_HTML)) {
    throw new Error(`Source HTML not found: ${SOURCE_HTML}`);
  }
  const html = fs.readFileSync(SOURCE_HTML, "utf8");
  const $ = cheerio.load(html);

  const parts: string[] = [
    "# Blood Pressure Checks — Master Library V1",
    "",
    "**Version:** 1.0",
    "**Service:** Blood Pressure Checks (NHS Hypertension Case-Finding Service)",
    "**Market:** England (NHS community pharmacy)",
    "**Document purpose:** Canonical master content for publish, visual experience, and content ecosystem generation. Uses profile tokens — not tenant-specific fixed copy.",
    "",
    "---",
    "",
    "## 0. Document Metadata",
    "",
    "publishDefault: false",
    "",
    "Restored from validated `output/pharmacy-master-publish/pharmaconnect/blood-pressure-checks/index.html` and ecosystem §8 misconception pack.",
    "",
  ];

  for (const num of [1, 2, 3, 4, 5, 6]) {
    let body = extractSectionBody($, num);
    body = tokenizeOwnerCopy(body);
    parts.push(`## ${num}. ${SECTION_HEADINGS[num]}`, "", body, "");
  }

  parts.push(`## 7. ${SECTION_HEADINGS[7]}`, "", extractFaqs($), "");

  parts.push(`## 8. ${SECTION_HEADINGS[8]}`, "", "publishDefault: false", "", buildSection8(), "");

  for (const num of [9, 10, 11, 12]) {
    let body = extractSectionBody($, num);
    body = tokenizeOwnerCopy(body);
    parts.push(`## ${num}. ${SECTION_HEADINGS[num]}`, "", body, "");
  }

  let section13 = extractSectionBody($, 13);
  section13 = tokenizeOwnerCopy(section13);
  section13 = section13
    .split("\n\n")
    .filter((p) => !p.includes("Owner Variables") && !p.includes("| Variable |"))
    .join("\n\n");
  parts.push(
    `## 13. ${SECTION_HEADINGS[13]}`,
    "",
    `Call {{phone}} to confirm whether this pharmacy offers the NHS blood pressure check service or private screening, and whether you need an appointment. Ask about ABPM availability if you think you may need it.`,
    "",
    `Opening hours: {{opening_hours}}`,
    "",
    `Book online: {{booking_link}}`,
    "",
    `Before you attend, note your current medicines, any recent home readings, and whether you have a family history of high blood pressure or heart disease. Wear loose sleeves and avoid caffeine for about 30 minutes beforehand if possible.`,
    "",
    `Consultations take place in a {{consultation_room}}. NHS service availability: {{nhs_service}}. Private checks: {{private_service}}.`,
    "",
    `After your check, follow the advice you are given — whether that is returning for ABPM, booking a GP appointment within the timeframe explained, or scheduling your next routine screening. If you develop urgent symptoms at any point, seek emergency help. Do not wait for a follow-up appointment if you feel seriously unwell.`,
    "",
    `A pharmacy blood pressure check is one step in looking after your heart health. Used appropriately, it helps you find raised readings early, understand what they mean, and reach your GP when medical review is needed.`,
    "",
    `Call {{phone}} to book or ask about walk-in availability.`,
    "",
    "---",
    "",
    "## Owner variable reference",
    "",
    "| Variable | Purpose |",
    "| --- | --- |",
    "| `{{phone}}` | Primary contact number |",
    "| `{{opening_hours}}` | Opening hours |",
    "| `{{booking_link}}` | Booking URL or call-to-book text |",
    "| `{{consultation_room}}` | Consultation room description |",
    "| `{{nhs_service}}` | NHS service availability note |",
    "| `{{private_service}}` | Private service availability note |",
    "| `{{pharmacyName}}` | Pharmacy trading name |",
    "| `{{town}}` | Primary town / local area |",
    "",
  );

  return parts.join("\n");
}

console.log("\nRestore Blood Pressure Checks Master V1\n");
const md = buildMasterMarkdown();
fs.mkdirSync(path.dirname(OUT_MD), { recursive: true });
fs.writeFileSync(OUT_MD, md, "utf8");
console.log(`Wrote ${OUT_MD} (${countWords(md)} words)`);

const parsed = parseMasterLibraryMarkdown(md, "blood-pressure-checks", "Blood Pressure Checks");
console.log(`Sections: ${parsed.sections.length}, FAQs: ${parsed.faqs.length}`);

const rel = "docs/pharmacy-master-library/blood-pressure-checks-master-v1.md";
for (const slug of ["pharmaconnect"]) {
  const result = writeCanonicalMasterPublishPage({
    slug,
    serviceId: "blood-pressure-checks",
    serviceName: "Blood Pressure Checks",
    masterRelativePath: rel,
    localArea: "Rotherham",
    urlPath: "/blood-pressure-checks/",
  });
  console.log(`Regenerated master publish ${slug}: ${result.outputPath}`);
}
