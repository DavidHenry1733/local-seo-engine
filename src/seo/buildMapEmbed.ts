import { MapEmbed } from "../generator/types";

/**
 * The map is ALWAYS the same on every page — it shows where the business is based.
 * It does not vary by page location. pageLocation is intentionally not used.
 */
export function buildMapEmbed(businessAddress: string): MapEmbed {
  const encodedQuery = encodeURIComponent(businessAddress);
  const embedUrl     = `https://www.google.com/maps?q=${encodedQuery}&output=embed`;

  return {
    heading: `Where We're Based`,
    body:    `Our team is based in ${businessAddress}. We work with businesses across South Yorkshire — get in touch to find out how we can help your business grow.`,
    query:   businessAddress,
    embedUrl,
  };
}
