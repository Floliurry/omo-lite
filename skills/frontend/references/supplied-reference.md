# Implement a supplied visual reference

Use this route when a screenshot, mockup, Figma export, annotated packet, or already selected generated concept is the implementation contract. For a live site, use [clone-from-url.md](design/clone-from-url.md). A request to generate a design as images first and then build it uses `image-to-code-skill.md` from the [reference index](design/_INDEX.md).

## Establish the contract

1. Inspect every supplied view and annotation at its available resolution. Record source paths/URLs, viewport dimensions, visible copy, assets, layout geometry, type, colors, spacing, component anatomy, and states. Distinguish measurements from estimates; a single image does not establish hover behavior, hidden states, or every breakpoint.
2. Read the existing project design system and component layer. Map the target to relevant tokens, primitives, responsive constraints and fidelity requirements; update the existing design contract when affected. A bounded exact-reference component change can reuse source patterns without a new DESIGN.md or whole-system extraction. For a new/extracted shared system, record that in-scope contract in DESIGN.md or its project equivalent before dependent implementation. Resolve material conflicts from the user's request; ask only when still unresolved.
3. Keep the supplied image as the comparison target. Do not generate a replacement concept or load an alternative taste recipe that changes its layout, material, copy, or style. Additional asset generation may fill an identified gap within this contract; it does not authorize redesign. Record any accepted deviation.
4. For invisible states or unspecified breakpoints, reuse the project's accessible interaction and responsive patterns. Label these decisions as inferred; request clarification when a choice would materially change the reference or user flow.

## Implement and verify

- Use semantic UI code and reusable primitives. Preserve text and interaction as real elements; never implement a screen by displaying the reference image as the page.
- Match assets, geometry, typography, material, and content against the supplied reference, then exercise responsive behavior, keyboard interaction, loading/error states, and motion where applicable.
- Use `/visual-qa` in reference-fidelity mode, retaining its dual-oracle pass and its additional pixel comparison and code-fidelity checks.
- Completion requires the reference-fidelity and applicable implementation gates to pass, or explicit user acceptance of named remaining gaps under those workflows. An unreadable reference, missing browser capability, or unavailable comparison tool leaves the corresponding claim unverified; do not replace the target or report a visual pass from code inspection.
