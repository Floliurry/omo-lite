# Rendered Research Deliverables

Read this when the selected deliverable is rendered or carries assets — PDF, DOCX, slides, styled HTML, charts, diagrams or generated images — and give it to any asset or assembly worker. A plain Markdown or chat answer needs none of it.

## Design spec

Before asset or assembly work starts, reuse the selected template or existing design contract. Record shared choices only where they are unresolved; a small `design-spec.md` beside the research record is useful when several contributors need those decisions, not a mandatory duplicate of an existing style guide. Give production workers that same source: template, palette, typography with glyph coverage for the report's language, and applicable figure conventions. Keep prose and assets coherent with the selected design rather than letting each renderer choose unrelated defaults.

**Figure standard.** Each figure sits in a fixed-size container styled from the spec (border, background, caption); the image scales to fit entirely inside it with its aspect ratio preserved — `object-fit: contain` semantics — never stretched, cropped or spilling out. Every chart carries a title, axis labels, units and value labels in the report's language.

## Assets

Use figures when they clarify the approved deliverable. Delegate production to a write-capable worker only with a scoped artifact assignment and available tools. Give each the selected design contract, and choose assets from the claims and the reader's needs:

- **Charts** for quantitative comparisons, computed from real data. Put the numbers in an actual table (CSV or JSON beside the record) and plot from that table, never from prose. Follow the selected `data-scientist` skill and use only available, authorized dependencies. Keep outputs in an `assets/` directory beside the record.
- **Mermaid graphs** when a process, architecture, timeline or evidence structure is easier to follow visually. Theme them to the spec and confirm each rendered file exists before the document references it.
- **Generated visuals** when an illustration serves the report and image generation is available and authorized. Prompt from the spec's style and palette.
- **Rendered-page captures** for sources whose visual state, dynamic content or provenance affects a claim. Record access limits when capture is unavailable.

Before rendering, list every asset the document references, confirm each file exists and is non-empty, and re-render whatever is missing.

## Assembly and rendering

Assign an assembly worker when document production is independently useful; supply the design spec and only the relevant available design and visualization skills. Use the selected template. Absent a stronger house style, a rendered report runs: executive summary → key findings by theme → detailed analysis (short attributed quotes, figures, revision-pinned permalinks, verification results) → comparative analysis when options compete → numbered sources with access dates → methodology → a correction log naming what verification overturned. Every claim keeps the synthesis citation.

These recipes need available tooling and applicable setup authority before any dependency installation or download:

| Target | How |
|---|---|
| PDF | Author one self-contained HTML file, then print it headless: `chrome --headless --disable-gpu --no-pdf-header-footer --print-to-pdf=<out.pdf> file://<report.html>`. Embed the spec fonts as real webfonts (CJK included) rather than trusting system fallbacks. `uv run --with weasyprint python` is the fallback renderer. |
| DOCX | `pandoc <report.md> -o <out.docx>`, adding `--reference-doc=<template.docx>` for a house style; `uv run --with python-docx python` when pandoc is unavailable. Charts and Mermaid renders go in as images. |
| Slides | `uv run --with python-pptx python` — one claim per slide, a chart or diagram per claim. |
| Standalone HTML | The authored source itself. |

## Look at the rendered artifact

Render the produced artifact back to images — PDF pages to PNG, HTML in a real browser — and inspect the pixels for missing or broken figures, images stretched or spilling their containers, chart or diagram text off the spec's font or palette, clipped tables, overflowing CJK text, blank pages, unlabeled chart values and wrong page breaks. Fix and re-render until the pages are clean. Reading the source markup is not looking at it. A separately selected visual acceptance contract still applies in full; if a required renderer, browser or reviewer is unavailable, report the blocked check instead of claiming the artifact passed.
