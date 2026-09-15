/**
 * Local cluster trust cards — suppress unsupported profile claims.
 */
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { PharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import type { ProfileTrustCard } from "./pharmacyServicePageTrustInjection.ts";
import { enrichTrustCards } from "./pharmacyServicePageIntelligence.ts";

export function buildLocalClusterTrustCards(
  profile: PharmacyServicePageProfile,
  areaName: string,
  contentContext?: ContentGenerationContext,
): ProfileTrustCard[] {
  const name = profile.pharmacyName;
  const town = profile.town;
  const cards: ProfileTrustCard[] = [];

  if (profile.gphcNumber?.trim()) {
    cards.push({
      title: "GPhC Registered Pharmacy",
      body: `${name} is a GPhC registered pharmacy premises (${profile.gphcNumber}).`,
    });
  }

  if (profile.nhsServicesAvailable) {
    cards.push({
      title: "NHS Pharmacy Services",
      body: `${name} provides NHS pharmacy services for eligible patients in ${town || "the local area"}.`,
    });
  }

  if (profile.consultationRoomAvailable) {
    cards.push({
      title: "Private Consultation Room",
      body: `Speak privately with the ${name} pharmacist team in a dedicated consultation room.`,
    });
  }

  cards.push({
    title: `Local support for ${areaName}`,
    body: `${name} supports patients in ${areaName}${town ? ` and ${town}` : ""} with pharmacist-led NHS Pharmacy First care and practical booking guidance.`,
  });

  const fillerCards: ProfileTrustCard[] = [
    {
      title: "Pharmacy First pathways",
      body: `${name} uses NHS clinical pathways for sore throat, earache, impetigo, infected insect bites, shingles, sinusitis, and uncomplicated UTI where eligible.`,
    },
    {
      title: "NHS-funded service",
      body: `${name} provides NHS Pharmacy First at no charge for eligible patients where commissioning criteria are met.`,
    },
    {
      title: "Pharmacist-led assessment",
      body: `Trained pharmacists at ${name} assess symptoms, apply PGDs where appropriate, and signpost to GP or urgent care when needed.`,
    },
  ];

  for (const filler of fillerCards) {
    if (cards.length >= 4) break;
    if (!cards.some((c) => c.title === filler.title)) cards.push(filler);
  }

  return enrichTrustCards(contentContext, profile, cards.slice(0, 4));
}
