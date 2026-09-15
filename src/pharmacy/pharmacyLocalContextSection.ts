/**
 * Local Context section — area-specific community and healthcare context for service area pages.
 */
export interface LocalContextInput {
  area: string;
  town: string;
  pharmacyName: string;
  serviceName: string;
  healthcare?: string;
  community?: string;
}

export interface LocalContextSection {
  type: "localContext";
  heading: string;
  body: string;
  bullets: string[];
}

export function buildLocalContextSection(input: LocalContextInput): LocalContextSection {
  const area = String(input.area || input.town || "your area").trim();
  const town = String(input.town || area).trim();
  const pharmacyName = String(input.pharmacyName || "your local pharmacy").trim();
  const serviceName = String(input.serviceName || "this pharmacy service").trim();
  const healthcare = String(input.healthcare || "").trim();
  const community = String(input.community || "").trim();

  const healthcareRef = healthcare
    ? `${healthcare} is one of the healthcare locations patients in ${area} mention when planning ${serviceName.toLowerCase()} visits.`
    : `Patients in ${area} often plan ${serviceName.toLowerCase()} around nearby GP and NHS services in ${town}.`;

  const communityRef = community
    ? `${community} is a familiar local reference point for residents in ${area} arranging pharmacy appointments.`
    : `${area} sits within ${town}'s community pharmacy catchment, with straightforward access for local residents.`;

  const body = [
    `${pharmacyName} provides ${serviceName.toLowerCase()} for patients in ${area}, ${town}.`,
    healthcareRef,
    communityRef,
    `The aim is to provide straightforward healthcare support locally without unnecessary delays or confusion about the next steps.`,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    type: "localContext",
    heading: "Local Community Context",
    body,
    bullets: [],
  };
}
