import { GoogleGenAI } from "@google/genai";
import type { LocalAreaEvidenceRecord } from "../pharmacyLocalAreaResolver.ts";
import { hydrateNationalGeminiEnv } from "../nationalGeminiClientV1.ts";
import { LocalityMemoryV1, type LocalityEntityKind } from "./pharmacyLocalityMemoryV1.ts";

const CLUSTER_PAGE_GEMINI_MODEL = "gemini-3.6-flash";

function clusterGeminiClient(): GoogleGenAI {
  hydrateNationalGeminiEnv();
  const apiKey = String(process.env.GEMINI_API_KEY || "").trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey });
}

export interface ClinicalPathwayDefinition {
  id: string;
  conditionName: string;
  targetPatientGroup: string;
  clinicalKeywords: string[];
  nhsFrameworkLabel: string;
}

// Clinically approved NHS Pharmacy First clinical pathways
const CLINICAL_PATHWAY_MATRIX: ClinicalPathwayDefinition[] = [
  {
    id: "uti",
    conditionName: "uncomplicated urinary tract infections (UTIs)",
    targetPatientGroup: "women aged 16 to 64",
    clinicalKeywords: ["prescription-only antibiotics", "dipstick validation testing", "clinical assessment criteria", "secure electronic NHS care summary log"],
    nhsFrameworkLabel: "NHS Pharmacy First protocol"
  },
  {
    id: "shingles",
    conditionName: "acute shingles outbreaks",
    targetPatientGroup: "adults aged 18 and over",
    clinicalKeywords: ["systemic anti-viral medication", "prodromal neurogenic pain", "dermatomal rash distribution patterns", "critical 72-hour clinical assessment window"],
    nhsFrameworkLabel: "NHS localized prescribing framework"
  },
  {
    id: "otitis-media",
    conditionName: "acute middle ear infections (otitis media)",
    targetPatientGroup: "children and young people aged 1 to 17",
    clinicalKeywords: ["specialist otoscope examination", "tympanic membrane structural inspection", "clinical safety-netting directions", "bacterial vs viral differentiation"],
    nhsFrameworkLabel: "national clinical pathway guidelines"
  },
  {
    id: "sinusitis",
    conditionName: "acute sinusitis sinus blockages",
    targetPatientGroup: "adults and children aged 12 and over",
    clinicalKeywords: ["nasal corticosteroid sprays", "maxillary sinus localized tenderness", "symptomatic containment", "bacterial presentation markers"],
    nhsFrameworkLabel: "NHS minor ailments diagnostic framework"
  },
  {
    id: "sore-throat",
    conditionName: "acute bacterial sore throat infections",
    targetPatientGroup: "adults and children aged 5 and over",
    clinicalKeywords: ["FeverPAIN clinical validation scoring", "rapid throat swab assessments", "targeted narrow-spectrum antibiotic therapy", "viral symptom containment rules"],
    nhsFrameworkLabel: "NHS Pharmacy First clinical framework"
  }
];

const HOOK_SYNTAX_STYLES = [
  "Style A: Begin immediately with an active geographic directional verb mapping the high street, prominent commercial corridors, or high-traffic pathways of the specific neighborhood.",
  "Style B: Begin with a clean environmental or topographical framing clause positioning the neighborhood relative to nearby valleys, outer green boundaries, or historic regional borders.",
  "Style C: Begin immediately with a public transport infrastructure or route framework (e.g., light rail pathways, localized train stations, or primary arterial road intersections).",
  "Style D: Begin with a localized architectural or heritage marker tracing the structural characteristics or unique public layouts historic to the area."
];

const SERVICE_DEFINITION_STRUCTURES = [
  "Style A: Five short paragraphs. Vary sentence length. Open with what the service is for, then the pharmacist consultation, then assessment of symptoms and medicines, then possible advice/treatment/referral, then the individual clinical-assessment caveat.",
  "Style B: Mixed rhythm. One short definition, one longer consultation sentence, one medium outcomes paragraph, one short caveat, one close for people in this neighbourhood without listing conditions.",
  "Style C: Patient-journey order. Decide to ask the pharmacy, private consultation, review of symptoms and medical history, possible next steps, referral if that is safer.",
  "Style D: Start from everyday health concerns in this area, then explain Pharmacy First, then how the pharmacist assesses, then outcomes, then eligibility depending on clinical assessment.",
];

/**
 * Parses raw text lines from LocalAreaEvidenceRecord.evidence into categorized LocalityEntityKind fields
 */
function extractCategorizedEntities(evidence: string[]): Record<LocalityEntityKind, string[]> {
  const result: Record<LocalityEntityKind, string[]> = {
    road: [], landmark: [], park: [], shopping: [], school: [], neighbour: [], gp: [], transport: []
  };
  for (const line of evidence) {
    const lower = line.toLowerCase();
    if (lower.includes("medical") || lower.includes("surgery") || lower.includes("gp") || lower.includes("health centre")) {
      result.gp.push(line);
    } else if (lower.includes("park") || lower.includes("woods") || lower.includes("reserve")) {
      result.park.push(line);
    } else if (lower.includes("station") || lower.includes("tram") || lower.includes("line") || lower.includes("bus")) {
      result.transport.push(line);
    } else if (lower.includes("road") || lower.includes("lane") || lower.includes("avenue") || lower.includes("street")) {
      result.road.push(line);
    } else if (lower.includes("school") || lower.includes("academy") || lower.includes("college")) {
      result.school.push(line);
    } else if (lower.includes("market") || lower.includes("shopping") || lower.includes("parade")) {
      result.shopping.push(line);
    } else {
      result.landmark.push(line);
    }
  }
  return result;
}

/**
 * Main generation execution handler
 */
export async function generateProgrammaticClusterPage(
  area: LocalAreaEvidenceRecord,
  loopIndex: number,
  memoryTracker: LocalityMemoryV1
): Promise<string> {
  const categorized = extractCategorizedEntities(area.evidence);
  const targetedGp = memoryTracker.claimOne(categorized.gp) || "your regular family practitioner";
  const targetedPark = memoryTracker.claimOne(categorized.park) || "local green open spaces";
  const transportPool = categorized.transport.length ? categorized.transport : categorized.road;
  const targetedTransport = memoryTracker.claimOne(transportPool) || "local high street pathways";
  const targetedLandmark = memoryTracker.claimOne(categorized.landmark) || "surrounding neighborhood avenues";
  const clinicalMatrix = CLINICAL_PATHWAY_MATRIX[loopIndex % CLINICAL_PATHWAY_MATRIX.length];
  const hookStyle = HOOK_SYNTAX_STYLES[loopIndex % HOOK_SYNTAX_STYLES.length];
  const serviceStructure = SERVICE_DEFINITION_STRUCTURES[loopIndex % SERVICE_DEFINITION_STRUCTURES.length];

  const systemInstruction = `You are an elite clinical copywriter and expert Local Search Engineer specializing in UK healthcare regulations. Your task is to write unique, highly authoritative copy for a pharmacy landing page providing the NHS Pharmacy First service. Return BOTH a hyper-local introduction AND a completely fresh re-phrasing of the core “What Pharmacy First is” service section. The local introduction must feel geographically precise. The service section must stay clinically accurate while varying vocabulary, sentence length, and reading structure on every pass so pages are not duplicates.
STRICT LINGUISTIC RULES:
1. ANTI-BOILERPLATE MANDATE: Do not use common AI clichés or filler introductory phrases. Completely ban the following words from the output: "nestled", "beacon", "testament", "look no further", "hub", "vibrant", "pulsing", "essential", "gateway", "boasts", "discover", "welcome".
2. HOOK SYNTAX ENFORCEMENT: You must strictly execute the assigned [HOOK_SYNTAX_STYLE]. Do not deviate. Start paragraph 1 immediately with the requested grammatical structure to prevent duplicate layouts across pages.
3. CLINICAL COMPLIANCE: Use the assigned [TARGETED_CLINICAL_PATHWAY] and [REQUISITE_CLINICAL_TERMINOLOGY] only as approved facts to rephrase. Do not invent additional conditions, age bands, medicines, eligibility rules, GP names, hospitals or partnerships.
4. SERVICE-SECTION UNIQUENESS: Execute [SERVICE_DEFINITION_STRUCTURE]. Vary vocabulary and sentence lengths. Rephrase approved clinical meaning; do not copy a shared template.
5. JOURNEY LOCK: PROCESS_HEADING must be exactly “What happens next in ${area.name}”. Use three locked steps only: “Speak with our clinical pharmacy team”, “Private clinical assessment”, “Personalised care path & treatments”. Do not inject MAIN_AREA into step titles or bodies.
OUTPUT SCHEMA:
Do not return JSON. Do not wrap the answer in curly braces. Do not invent JSON object keys.
Return precise labeled text with no conversational preambles:
### ${area.name} Pharmacy First Clinic
**[A unique, contextual 5-7 word headline mentioning a specific landmark, road, or localized feature]**
HERO INTRODUCTION:
[Paragraph 1 - Local Area Geography & Clinical Infrastructure]
LOCAL INTRODUCTION:
[The FULL remaining local introduction. Multiple rich paragraphs covering landmarks, streets and residential history. Do not truncate.]
SERVICE_PARAGRAPH_1:
[one unique Pharmacy First paragraph]
SERVICE_PARAGRAPH_2:
[one unique Pharmacy First paragraph]
SERVICE_PARAGRAPH_3:
[one unique Pharmacy First paragraph]
SERVICE_PARAGRAPH_4:
[one unique Pharmacy First paragraph]
SERVICE_PARAGRAPH_5:
[one unique Pharmacy First paragraph]
PROCESS_HEADING:
What happens next in ${area.name}
PROCESS_STEP_1_TITLE:
Speak with our clinical pharmacy team
PROCESS_STEP_1_BODY:
[consultation prep. Do not name ${area.name}]
PROCESS_STEP_2_TITLE:
Private clinical assessment
PROCESS_STEP_2_BODY:
[symptoms, medical history, previous checks. Do not name ${area.name}]
PROCESS_STEP_3_TITLE:
Personalised care path & treatments
PROCESS_STEP_3_BODY:
[guidance, NHS treatment or referral. Do not name ${area.name}]`;

  const userPrompt = `DATA MATRIX FOR EXECUTION:
- MAIN_AREA: ${area.name}
- HOOK_SYNTAX_STYLE: ${hookStyle}
- SERVICE_DEFINITION_STRUCTURE: ${serviceStructure}
- LOCALLY_TRACKED_GP: ${targetedGp}
- NATURAL_LANDMARK: ${targetedPark}
- TRANSPORTATION_OR_STREET_MARKER: ${targetedTransport}
- SURROUNDING_CONTEXT: ${targetedLandmark}
- TARGETED_CLINICAL_PATHWAY: ${clinicalMatrix.conditionName} for ${clinicalMatrix.targetPatientGroup}
- REQUISITE_CLINICAL_TERMINOLOGY: ${clinicalMatrix.clinicalKeywords.join(", ")}`;

  try {
    const response = await clusterGeminiClient().models.generateContent({
      model: CLUSTER_PAGE_GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.4,
        topP: 0.8,
        maxOutputTokens: 8192,
      },
    });
    const generatedText = response.text || "";
    if (!generatedText) {
      throw new Error(`Gemini returned empty content for area [${area.name}]`);
    }
    return memoryTracker.scrubUsedEntities(generatedText);
  } catch (error) {
    console.error(`Gemini execution pipeline failed for area [${area.name}]:`, error);
    throw error;
  }
}
