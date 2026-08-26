/**
 * Local-page-only responsive containment — does not alter service/homepage global CSS sources.
 */
export function pharmacyLocalPageResponsiveStyleBlock(): string {
  const localBody =
    ':is([data-publish-source="local-location-engine"], [data-publish-source="local-hub-v1"], [data-publish-source="local-cluster-v1"], [data-publish-source="local-area-v1"])';
  return `<style data-local-page-responsive="v1">
body${localBody} { overflow-x: clip; }
@media (max-width: 980px) {
  body${localBody} .site-header .wrap,
  body${localBody} .site-header .header-row {
    min-width: 0;
    max-width: 100%;
  }
  body${localBody} .nav-links {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    width: 100%;
    max-width: 100%;
    min-width: 0;
    gap: 8px 12px;
    overflow: visible;
    white-space: normal;
  }
  body${localBody} .nav-links > a,
  body${localBody} .nav-dropdown {
    flex: 1 1 auto;
    flex-shrink: 1;
    min-width: 0;
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  body${localBody} .header-phone {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  body${localBody} .local-breadcrumb {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    max-width: 100%;
    overflow-wrap: anywhere;
  }
  body${localBody} main .wrap,
  body${localBody} .local-hub-grid,
  body${localBody} .local-cluster-grid,
  body${localBody} .areas-grid,
  body${localBody} .nearby-areas-grid,
  body${localBody} .hero-grid,
  body${localBody} .grid-2.trust-split-row {
    min-width: 0;
    max-width: 100%;
    box-sizing: border-box;
  }
  body${localBody} .hero-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  body${localBody} img,
  body${localBody} video {
    max-width: 100%;
    height: auto;
  }
  body${localBody} iframe,
  body${localBody} .pharmacy-map-card {
    max-width: 100%;
    width: 100%;
    box-sizing: border-box;
  }
  body${localBody} .nearby-area-grid {
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    max-width: 100%;
  }
  body${localBody} .process-grid.grid-4,
  body${localBody} .grid-4.process-grid,
  body${localBody} .grid-4.card-grid-equal,
  body${localBody} .grid-2.card-grid-equal,
  body${localBody} .grid-3.conditions-grid {
    grid-template-columns: minmax(0, 1fr);
    min-width: 0;
    max-width: 100%;
  }
  body${localBody} .process-grid.grid-4 > *,
  body${localBody} .grid-4.card-grid-equal > * {
    min-width: 0;
    max-width: 100%;
  }
  body${localBody} .footer-hours-time {
    white-space: normal;
    text-align: left;
  }
  body${localBody} section,
  body${localBody} .blue-band,
  body${localBody} .money-page-band {
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  body${localBody} .wrap {
    width: 100%;
    max-width: 100%;
    padding-inline: clamp(12px, 4vw, var(--brand-section-x, 24px));
    box-sizing: border-box;
  }
  body${localBody} section[data-media-position="left"] .section-media,
  body${localBody} section[data-media-position="right"] .section-media {
    float: none;
    width: 100%;
    max-width: 100%;
    margin: 0 0 var(--component-split-gap, 24px) 0;
  }
}
</style>`;
}
