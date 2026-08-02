// The phone treatment: compact padding, scrolling type tabs, reflowed swatches.
export const MOBILE_BREAKPOINT = 900;

/* Where the generator's two columns stop sitting side by side — well before the
   phone treatment. It matches the card's own 1600px cap on purpose: below that
   the card is limited by the viewport, so the columns would be under ~750px and
   the swatch rows, template cards and frame tiles start to squeeze. Pinning the
   two together means every side-by-side view gets columns worth splitting.
   app.css carries the matching `@media (max-width: 1600px)` block, and
   Generator.jsx watches this to move the feedback strip; a test in
   mobile-css.test.js keeps the CSS and the JS from drifting apart. */
export const STACK_BREAKPOINT = 1600;

export function isMobileViewport(width) {
  return width <= MOBILE_BREAKPOINT;
}

export function defaultTemplatesOpen(width) {
  return !isMobileViewport(width);
}

export function shouldCollapseTemplatesOnResize(matchesMobile) {
  return matchesMobile;
}
