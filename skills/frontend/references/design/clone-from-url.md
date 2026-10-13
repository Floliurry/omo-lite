# Clone From URL — Runtime Design-System Extraction

Use this when the user gives a **live site or a URL** to clone: "clone aside.com", "rebuild this page", "make it look exactly like `<url>`". A live URL affords what a screenshot cannot — the browser's **runtime truth**. Extract that truth with the real browser, make it the `DESIGN.md` contract, then build reusable primitives against it. Never eyeball a screenshot into a one-off.

## Outcome and stop rule

A `DESIGN.md` recording observed tokens, interaction states and motion, with inaccessible definitions identified as unverified, plus a component-level clone that an independent reviewer confirms is an extensible design system (live DOM, reused primitives) — not a screenshot-matched or pasted-image fake. Done is defined by `/visual-qa` reference-fidelity mode passing on fresh evidence, not by your own glance.

## Phase 1 — Extract the runtime truth (never guess a value)

Select a connected real browser through [browser capability and session selection](../../../ultimate-browsing/references/browser-session.md). Use `getComputedStyle` for resolved element values; readable stylesheet rules may supplement them with definitions, but do not replace rendered-state observations.

Sweep the page and read, for every meaningful element and every repeated pattern:

- **Tokens** — color, background, border, font family/size/weight, line-height, letter-spacing, radius, shadow, and spacing (padding/margin/gap). Cluster the repeated values into the token scale.
- **Interaction states** — capture `default/hover/focus/active` (plus disabled/loading/empty/error where they exist) by DRIVING the state, then re-reading the computed style. A system with only the resting state is incomplete.
- **Motion** — computed transitions/animations and transforms, plus `CSSKeyframesRule` definitions where stylesheet `cssRules` is readable. Catch `SecurityError` per stylesheet; record inaccessible definitions as unverified and retain observed states, timing and frame sequences.
- **Assets** — `<img>` and background-image URLs, inline SVG, `@font-face` files, video sources. Record provenance and reuse the originals when within the authorized asset scope. Otherwise use user-provided or permitted substitutes and record the resulting fidelity limit.
- **Responsive** — re-run the sweep at 375 / 768 / 1280 and record what actually changes per breakpoint.

A compact sweep payload to inject through the browser's evaluate action (extend the recorded fields as needed):

```js
() => {
  const out = [];
  for (const el of document.querySelectorAll("*")) {
    const s = getComputedStyle(el);
    out.push({
      tag: el.tagName,
      color: s.color, background: s.backgroundColor, border: s.borderColor,
      font: s.fontFamily, size: s.fontSize, weight: s.fontWeight,
      lineHeight: s.lineHeight, letterSpacing: s.letterSpacing,
      radius: s.borderRadius, shadow: s.boxShadow,
      padding: s.padding, margin: s.margin, gap: s.gap,
      transition: s.transition, animation: s.animation, transform: s.transform,
    });
  }
  return out;
}
```

## Phase 2 — Write the DESIGN.md contract

Turn the extraction into `DESIGN.md` per `design-system-architecture.md`: token scales, typography, spacing, the component anatomy with every captured state, the motion rules, and the responsive deltas. Name which source each value came from. If a value is not in `DESIGN.md`, it may not appear in code.

## Phase 3 — Clone-code reusable primitives (one at a time)

Build primitives against the contract, not the screenshot. One component per cycle: implement, render, compare to the source region, fix, then move on. Use the assets selected in Phase 1. Never paste a raster or `background-image` where a live element belongs. Never approximate a token you already extracted.

## Phase 4 — Reference-fidelity QA (mandatory, motion included)

Verify through `/visual-qa` in reference-fidelity mode against the source captures, for every page and every breakpoint. Interaction states and animations are IN SCOPE: drive hover/focus/click/scroll, then compare the settled states AND the motion itself against the source. You are not done until the dual-oracle gate passes on fresh evidence.

## Anti-patterns

- Treating source declarations as proof of rendered values without observing the page.
- Claiming inaccessible keyframes were extracted because computed element styles were readable.
- Resting state only — capture hover/focus/active and the rest.
- Screenshot-matched one-off — build reusable, token-driven primitives.
- Silently replacing an authorized original asset, or claiming a substitute is an exact match.
- Desktop only — re-extract at each breakpoint.

## Provenance

This runtime-extraction workflow follows the MIT-licensed **[JCodesMore/ai-website-cloner-template](https://github.com/JCodesMore/ai-website-cloner-template)** clone-website approach: browser automation plus a `getComputedStyle` sweep, state/motion/asset capture, spec files, and visual QA. It is a project-original synthesis, not a copy of that template. Asset reuse follows the task's existing authorization and provenance; this guide grants no additional rights. For a design-system recreation, apply the extracted tokens, layout grammar, component anatomy, states and motion to the user's own product and content.
