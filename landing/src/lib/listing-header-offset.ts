/** CSS variable synced from `HeaderClient` — height of sticky site header (px). */
export const PS_HEADER_HEIGHT_VAR = "--ps-header-height";

export const PS_HEADER_HEIGHT_FALLBACK_PX = 57;

export function syncHeaderHeightCssVar(headerEl: HTMLElement): void {
  document.documentElement.style.setProperty(
    PS_HEADER_HEIGHT_VAR,
    `${Math.round(headerEl.getBoundingClientRect().height)}px`
  );
}
