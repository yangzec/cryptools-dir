/** Client-safe Google favicon URL for a website; empty string if URL is invalid. */
export function faviconUrlForWebsite(websiteUrl: string): string {
  try {
    const host = new URL(websiteUrl).hostname;
    if (!host) return '';
    return `https://www.google.com/s2/favicons?domain=${host}&sz=128`;
  } catch {
    return '';
  }
}
