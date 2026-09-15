import fs from "node:fs";
import path from "node:path";

function safeReadJson(filePath: string): any | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function normaliseKey(value: string | undefined): string {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function listBlock(title: string, items: unknown): string {
  if (!Array.isArray(items) || items.length === 0) return "";
  return `${title}:\n${items.map((x) => `- ${String(x)}`).join("\n")}\n\n`;
}

export function buildStructuredIntelligencePrompt(args: {
  serviceKey?: string;
  serviceName?: string;
  location?: string;
}): string {
  const root = process.cwd();
  const serviceKey = normaliseKey(args.serviceKey || args.serviceName);
  const locationKey = normaliseKey(args.location);

  const serviceProfile = safeReadJson(
    path.join(root, "config", "intelligence", `${serviceKey}.json`)
  );

  const locationProfile = safeReadJson(
    path.join(root, "config", "intelligence", `location-${locationKey}.json`)
  );

  if (!serviceProfile && !locationProfile) return "";

  let out = "\n\nSTRUCTURED INTELLIGENCE ENGINE\n\n";
  out += "Use the intelligence below as core source material. Do not treat it as optional notes.\n";
  out += "The final copy must clearly reflect customer problems, buying motivations, outcomes, objections, trust signals and local business context.\n";
  out += "Do not invent claims, awards, client numbers or guarantees beyond the supplied intelligence.\n\n";

  if (serviceProfile) {
    out += "SERVICE INTELLIGENCE\n\n";
    out += `Service: ${serviceProfile.service || args.serviceName || args.serviceKey || ""}\n\n`;
    out += listBlock("Customer types", serviceProfile.customerTypes);
    out += listBlock("Buying motivations", serviceProfile.buyingMotivations);
    out += listBlock("What customers do not buy", serviceProfile.whatTheyDoNotBuy);
    out += listBlock("Customer problems", serviceProfile.customerProblems);
    out += listBlock("Consequences of doing nothing", serviceProfile.consequences);
    out += listBlock("Immediate outcomes", serviceProfile.immediateOutcomes);
    out += listBlock("Medium-term outcomes", serviceProfile.mediumTermOutcomes);
    out += listBlock("Long-term outcomes", serviceProfile.longTermOutcomes);
    out += listBlock("Objections", serviceProfile.objections);
    out += listBlock("Hidden concerns", serviceProfile.hiddenConcerns);
    out += listBlock("Common questions", serviceProfile.commonQuestions);
    out += listBlock("Common mistakes", serviceProfile.commonMistakes);
    out += listBlock("What's included", serviceProfile.whatsIncluded);
    out += listBlock("Best for", serviceProfile.bestFor);
    out += listBlock("Trust signals", serviceProfile.trustSignals);
    out += listBlock("Writing angles", serviceProfile.writingAngles);
  }

  if (locationProfile) {
    out += "LOCATION INTELLIGENCE\n\n";
    out += `Location: ${locationProfile.location || args.location || ""}\n`;
    if (locationProfile.locationType) out += `Location type: ${locationProfile.locationType}\n\n`;
    out += listBlock("Known for", locationProfile.knownFor);
    out += listBlock("Typical local business types", locationProfile.businessTypes);
    out += listBlock("Local business challenges", locationProfile.businessChallenges);
    out += listBlock("Local growth drivers", locationProfile.growthDrivers);
    out += listBlock("Local writing rules", locationProfile.localWritingRules);
    out += listBlock("Example local angles", locationProfile.exampleAngles);
  }

  out += "MANDATORY WRITING RULES\n\n";
  out += "- Write like someone who understands why local businesses buy this service.\n";
  out += "- Open the page with outcome-led language: customers do not buy websites, they buy enquiries, trust, visibility and growth.\n";
  out += "- Use outcome-led language throughout: enquiries, visibility, trust, customers and growth.\n";
  out += "- Use customer concerns and objections naturally.\n";
  out += "- Include at least 1 specific local reference from LOCATION INTELLIGENCE in the visible body copy.\n";
  out += "- The local relevance or why-location section MUST include one sentence using this pattern: 'From businesses around [specific local place] to companies in [local sector], [location] businesses increasingly rely on [service] to [outcome].'\n";
  out += "- Use a real place from Known for, such as Lakeside, Doncaster Racecourse or Yorkshire Wildlife Park when available.\n";
  out += "- If commercial areas are listed, prefer commercial areas over tourist landmarks.\n";
  out += "- Avoid tourism copy. Local references must support business credibility, competition, visibility or customer trust.\n";
  out += "- Avoid generic agency copy and repeated phrasing.\n";

  return out;
}
