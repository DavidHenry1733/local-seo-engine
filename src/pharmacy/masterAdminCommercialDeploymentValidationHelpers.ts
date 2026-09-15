export function inferredHostnameFromWebsite(website: string): string | null {
  try {
    return new URL(website.includes("://") ? website : `https://${website}`).hostname;
  } catch {
    return null;
  }
}
