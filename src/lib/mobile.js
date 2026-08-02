// The phone treatment: compact padding, scrolling type tabs, reflowed swatches.
export const MOBILE_BREAKPOINT = 900;

/* Where the generator's two columns stop sitting side by side — well before the
   phone treatment, because the card is capped at 1320px: side by side, each
   column is stuck around 650px no matter how wide the screen gets, and its
   swatch rows, template cards and frame tiles are squeezed at that width.
   app.css carries the matching `@media (max-width: 1400px)` block, and
   Generator.jsx watches this to move the feedback strip; a test in
   mobile-css.test.js keeps the CSS and the JS from drifting apart. */
export const STACK_BREAKPOINT = 1400;

export function isMobileViewport(width) {
  return width <= MOBILE_BREAKPOINT;
}

export function defaultTemplatesOpen(width) {
  return !isMobileViewport(width);
}

export function shouldCollapseTemplatesOnResize(matchesMobile) {
  return matchesMobile;
}
