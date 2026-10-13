---
name: frontend
description: "Designs and builds web pages and UI: layout, styling, imagery and motion. Use for a new page or component, a visual redesign, matching a screenshot or a live site, or a mockup image."
---

# Frontend

## Who looks at it, and where

Before choosing any style, settle what the page is for, who looks at it and on what screen. A page shown on one screen during a talk is designed for that screen; build other sizes, such as a phone layout, only when the page will be published or the user asks for them. When the request does not say who the page is for, ask.

## Find the direction

The direction comes from the user first, then the project, then references:

- What the user says and shows: the purpose, the audience, screenshots, sites or styles they point to.
- An existing design in the project, recorded in a DESIGN.md or visible in its components and tokens. Follow it and change only what the request changes.
- A screenshot or mockup that is the target to build: follow [supplied-reference](references/supplied-reference.md). A live site to copy: follow [clone-from-url](references/design/clone-from-url.md).
- A brand or style the user names: find it in the [reference index](references/design/_INDEX.md) and read that file. Take the decisions that give it its character, such as palette, type, spacing, materials and motion, and apply them to this project's content. It is a source to borrow from, not a design to reproduce, and its logos, imagery and copy stay with the brand.

Write the direction down before building: one sentence on mood, material and energy, the content in the order the viewer needs it, and the two or three motions the page uses, if any. Build one page or section to that direction and show it to the user before doing the rest.

## When nothing settles a choice

Where the user, the project and the chosen references leave a decision open, use these fallbacks. They keep a page off the patterns models produce by default; they are not a house style, and any direction from the user, the project or a reference overrides them.

- Fit the domain: tools and dashboards are quiet and dense; showcase and teaching pages can be expressive.
- Use at most two typefaces, chosen for this page rather than a default stack such as Inter, Roboto, Arial or the system font.
- Use one accent color, with every color defined as a CSS variable. Avoid one-note palettes: purple-blue gradients, beige and cream, dark slate, brown and orange.
- Leave out decorative orbs, blurred blobs and gradient bokeh.
- Use cards only for repeated items, dialogs and framed tools. Sections are full-width bands, and cards do not nest.
- Use generated or real bitmap images for illustrations and hero imagery. Hand-drawn SVG is for icons and simple diagrams; take icons from the project's set or Lucide.
- Make text fit its container at every size the page is shown at, with letter spacing 0.
- Use two or three motions with a purpose, and honor reduced motion.

## Build

Use the project's stack, components and tokens. A reference file does not authorize a new dependency or a different framework. Write semantic HTML with visible keyboard focus. Build the states the page really has, such as loading, empty and error when it shows data.

| Need | Reference |
| --- | --- |
| A reusable design system, written down as a DESIGN.md | [Design-system architecture](references/design/design-system-architecture.md) |
| App shells: sidebars, split panes, panels that scroll | [Layout](references/design/layout-skill.md) |
| Interaction and animation mechanics | [Interaction](references/design/interaction-skill.md) |
| A mockup image without code, or an image to build from | `imagegen-frontend-web.md`, `imagegen-frontend-mobile.md` or `imagegen-brandkit.md` in the [reference index](references/design/_INDEX.md) |
| Print or PDF output | [Paged media](references/design/print-paged-media.md) |

## Look at it

Open the page in a browser at the size it will be shown and look at screenshots while you work; fix what looks wrong before reporting, such as elements that overlap, text cut off or spilling out of its box, and CJK lines that wrap badly. When a screenshot leaves a doubt about one of these, settle it with a small check on that spot: a zoomed screenshot of the region, or the elements' bounding boxes measured in the page. Check text contrast, image alt text and keyboard focus. This is the check for ordinary page work. `visual-qa`, with its independent reviewers, is the acceptance check only when the user asks for one or the page must match an exact target, in its reference-fidelity mode for the latter.
