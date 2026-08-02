// The phone treatment: compact padding, scrolling type tabs, reflowed swatches.
export const MOBILE_BREAKPOINT = 900;

/* Where the generator's two columns stop sitting side by side — earlier than
   the phone treatment, because at 1200px the setup column is already down to
   ~640px and its swatch rows, template cards and frame tiles are squeezed.
   app.css carries the matching `@media (max-width: 1200px)` block, and
   Generator.jsx watches this to move the feedback strip; a test in
   mobile-css.test.js keeps the CSS and the JS from drifting apart. */
export const STACK_BREAKPOINT = 1200;

export function isMobileViewport(width) {
  return width <= MOBILE_BREAKPOINT;
}

export function defaultTemplatesOpen(width) {
  return !isMobileViewport(width);
}

export function shouldCollapseTemplatesOnResize(matchesMobile) {
  return matchesMobile;
}
