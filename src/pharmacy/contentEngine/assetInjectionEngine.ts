export interface ClusterGalleryImage {
  url: string;
  altText: string;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function injectAssetsIntoClusterPage(
  markdown: string,
  assets: {
    mapEmbedUrl: string;
    imageGallery: ClusterGalleryImage[];
  },
): string {
  const map = `<figure class="cluster-map"><iframe src="${escapeAttribute(assets.mapEmbedUrl)}" title="Local area map" loading="lazy"></iframe></figure>`;
  const gallery = assets.imageGallery
    .map(
      (image) =>
        `<figure class="cluster-gallery"><img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.altText)}"></figure>`,
    )
    .join("\n");

  return `${markdown.trim()}\n\n${map}\n${gallery}\n`;
}
