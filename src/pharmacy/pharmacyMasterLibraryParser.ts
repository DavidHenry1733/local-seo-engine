/**
 * Master library parser — read publish sections from canonical master markdown.
 * No blueprint expansion, no AI generation.
 */
import fs from "node:fs";
import path from "node:path";

export interface MasterLibrarySection {
  number: number;
  heading: string;
  publishDefault: boolean;
  bodyMarkdown: string;
}

export interface MasterLibraryFaq {
  question: string;
  answer: string;
}

export interface ParsedMasterLibrary {
  serviceId: string;
  serviceName: string;
  sections: MasterLibrarySection[];
  faqs: MasterLibraryFaq[];
  ownerVariableKeys: string[];
}

export interface MasterOwnerVariables {
  phone: string;
  opening_hours: string;
  booking_link: string;
  consultation_room: string;
  nhs_medication_review: string;
  private_review_fee: string;
  [key: string]: string;
}

const SECTION_HEADING_RE = /^## (\d+)\.\s+(.+)$/;

/** Sections excluded from published pages by default (library-only). */
const LIBRARY_ONLY_SECTIONS = new Set([8]);

/** Metadata / appendix sections — never patient-facing. */
const NON_PUBLISH_SECTIONS = new Set([0]);

function isLibraryOnlySection(number: number, body: string): boolean {
  if (LIBRARY_ONLY_SECTIONS.has(number)) return true;
  if (/publishDefault:\s*false/i.test(body.split("\n")[0] || "")) return true;
  return false;
}

export function parseMasterLibraryMarkdown(md: string, serviceId: string, serviceName: string): ParsedMasterLibrary {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const sections: MasterLibrarySection[] = [];
  let current: { number: number; heading: string; lines: string[] } | null = null;

  const flush = () => {
    if (!current) return;
    const bodyMarkdown = current.lines.join("\n").trim();
    const publishDefault = !isLibraryOnlySection(current.number, bodyMarkdown) && !NON_PUBLISH_SECTIONS.has(current.number);
    sections.push({
      number: current.number,
      heading: current.heading,
      publishDefault,
      bodyMarkdown,
    });
    current = null;
  };

  for (const line of lines) {
    const match = line.match(SECTION_HEADING_RE);
    if (match) {
      flush();
      current = {
        number: Number(match[1]),
        heading: match[2]!.trim(),
        lines: [],
      };
      continue;
    }
    if (current) current.lines.push(line);
  }
  flush();

  const faqSection = sections.find((s) => s.number === 7);
  const faqs = faqSection ? parseMasterFaqs(faqSection.bodyMarkdown) : [];

  const ownerVariableKeys = extractOwnerVariableKeys(md);

  return { serviceId, serviceName, sections, faqs, ownerVariableKeys };
}

function extractOwnerVariableKeys(md: string): string[] {
  const keys = new Set<string>();
  for (const m of md.matchAll(/\{\{([a-z_]+)\}\}/g)) {
    keys.add(m[1]!);
  }
  return [...keys];
}

export function parseMasterFaqs(bodyMarkdown: string): MasterLibraryFaq[] {
  const faqs: MasterLibraryFaq[] = [];
  const blocks = bodyMarkdown.split(/\n\n+/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const qMatch = trimmed.match(/^\*\*(.+?\?)\*\*\s*\n([\s\S]+)$/);
    if (qMatch) {
      faqs.push({
        question: qMatch[1]!.trim(),
        answer: qMatch[2]!.trim().replace(/\n+/g, " "),
      });
    }
  }
  return faqs;
}

export function injectOwnerVariables(text: string, vars: MasterOwnerVariables): string {
  return text.replace(/\{\{([a-z_]+)\}\}/g, (_, key: string) => vars[key] ?? `{{${key}}}`);
}

export function countWords(text: string): number {
  return String(text || "")
    .replace(/\{\{[a-z_]+\}\}/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

export function publishSections(parsed: ParsedMasterLibrary): MasterLibrarySection[] {
  return parsed.sections.filter((s) => s.publishDefault && s.number !== 7);
}

export function loadMasterLibraryFile(relativePath: string): string {
  const roots = [
    process.env.WORKSPACE_ROOT,
    path.resolve(process.cwd()),
    path.resolve(process.cwd(), ".."),
  ].filter(Boolean) as string[];

  for (const root of roots) {
    const full = path.join(root, relativePath);
    if (fs.existsSync(full)) return fs.readFileSync(full, "utf8");
  }

  throw new Error(`Master library file not found: ${relativePath}`);
}
