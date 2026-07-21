export const MOBILE_BREAKPOINT = 900;

export function isMobileViewport(width) {
  return width <= MOBILE_BREAKPOINT;
}

export function defaultTemplatesOpen(width) {
  return !isMobileViewport(width);
}

export function shouldCollapseTemplatesOnResize(matchesMobile) {
  return matchesMobile;
}
