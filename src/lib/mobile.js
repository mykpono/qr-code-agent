// The phone treatment: compact padding, scrolling type tabs, reflowed swatches.
export const MOBILE_BREAKPOINT = 900;

/* Where the generator's two columns stop sitting side by side.

   Measured floor, not a guess: side by side the setup column is about
   (viewport - 96) / 2, and nothing in it clips as that shrinks — the swatch
   canvases are a fixed 22px, so the buttons simply lose padding. What does
   break is the COLOURS row, which wraps from three slots to two at ~1100px.
   1200 keeps a ~551px column: three colour slots across, four frame tiles a
   row, 39px corner swatches. Going lower is possible but reaches the cramped
   look the stacking exists to avoid.

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
