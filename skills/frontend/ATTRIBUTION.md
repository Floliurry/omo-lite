# ATTRIBUTION / NOTICE

This package (`@oh-my-opencode/shared-skills`) includes third-party content that is
redistributed under its original license, consistent with the project's distribution
license (see `LICENSE.md`: "All third party components incorporated into the
oh-my-opencode Software are licensed under the original license provided by the owner of
the applicable component"). Each upstream's license and required notices are reproduced
below. Modifications to the original files are noted where applicable.

The third-party files are copied into this skill's `references/` tree from the upstream
commit named in each section below. The file bodies are verbatim, except that `SKILL.md`
frontmatter may quote a single-line `description:` value so that YAML parsing is
deterministic; the description text itself is unchanged.

---

## 1. Open Design (brand design-system DESIGN.md references)

The brand design-system reference files under `frontend/references/design/<brand>.md`
(Apple, Stripe, Linear, Nike, BMW, Airbnb, Bugatti, Tesla, and the other named brands)
are path-mapped verbatim copies of the `design-systems/<brand>/DESIGN.md` files from the
Open Design project, copied to `frontend/references/design/<brand>.md` (dots in `<brand>`
map to dashes in the upstream directory name, e.g. `linear.app` -> `linear-app`).

- Source: https://github.com/nexu-io/open-design
- Pinned upstream commit: 6afe7eae156bfa29251a51fd0636649c257f7444
- Copyright 2026 Open Design contributors
- Licensed under the Apache License, Version 2.0 (the "License"); you may not use these
  files except in compliance with the License. You may obtain a copy of the License at:

      http://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software distributed under
  the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
  KIND, either express or implied. See the License for the specific language governing
  permissions and limitations under the License. A full copy of the Apache-2.0 license
  text is provided in `LICENSE-Apache-2.0.txt` alongside this notice.

- **Changes (Apache-2.0 §4(b)):** the original `DESIGN.md` design-system files are
  redistributed verbatim. The only modification is path-mapping: each upstream
  `design-systems/<brand>/DESIGN.md` is renamed to `frontend/references/design/<brand>.md`
  (with dots in the brand name mapped to dashes for the upstream directory lookup). The
  file contents are byte-for-byte identical to the pinned upstream commit; no text is
  abridged, summarized, or rewritten.

- **Trademark notice:** All product names, brand names, trademarks, and registered
  trademarks referenced in these design-system files (e.g. Apple, BMW, Airbnb, Bugatti,
  Stripe, Nike, Tesla, and other named brands) are the property of their respective owners
  and are used for identification and descriptive purposes only. This project is not
  affiliated with, endorsed by, or sponsored by any of those brands. No trademark license
  is granted under the Apache License 2.0 (Section 6). Named typefaces are referenced by
  name only; no font binaries are included.

---

## 2. taste-skill (Leonxlnx) — taste and image-generation skills

The taste-skill files and image-generation skills under `frontend/references/design/`
(`taste-skill.md`, `gpt-tasteskill.md`, `minimalist-skill.md`, `brutalist-skill.md`,
`soft-skill.md`, `redesign-skill.md`, `image-to-code-skill.md`, `output-skill.md`,
`stitch-skill.md`, `imagegen-frontend-web.md`, `imagegen-frontend-mobile.md`,
`imagegen-brandkit.md`) are path-mapped copies of the per-skill `SKILL.md` files from the
taste-skill project (each `skills/<name>/SKILL.md` is renamed to
`references/design/<name>.md`; `imagegen-brandkit.md` maps from `skills/brandkit/SKILL.md`).
`stitch-design-example.md` is a path-mapped verbatim copy of `skills/stitch-skill/DESIGN.md`,
the worked example of the design-system document that the stitch skill exports.
Only the frontmatter description quoting described above may differ from upstream.

- Source: https://github.com/Leonxlnx/taste-skill
- Official site: https://www.tasteskill.dev/
- Pinned upstream commit: b17742737e796305d829b3ad39eda3add0d79060

```
MIT License

Copyright (c) 2026 Leonxlnx

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 3. Project-original files

`frontend/SKILL.md`, `frontend/references/supplied-reference.md`, and
`frontend/references/design/_INDEX.md`, `aside.md` and `design-system-architecture.md`
are original to this project and require no third-party attribution.

`frontend/references/design/aside.md` is a project-original synthesis from live browser
capture evidence and a local reconnaissance run following the MIT-licensed
`JCodesMore/ai-website-cloner-template` workflow; it is not copied from Aside or from the
template. Aside names, trademarks, product text, and visual assets remain the property of
their respective owners and are referenced only for descriptive design-analysis purposes.

`frontend/references/design/lazyweb.md` is a project-original, curl-only operating guide
for the Lazyweb (lazyweb.com) design-research API, written from live endpoint verification;
no Lazyweb source, documentation text, or screenshot content is vendored. Lazyweb names
remain the property of their owner, and the guide grants no license to ship, trace, or
commit reference screenshots harvested through it.

`frontend/references/design/interaction-skill.md` is a project-original, curl-only
operating guide for consulting the beui.dev animated-component registry during interaction
and motion work, written from live endpoint verification; no beui.dev source code,
documentation text, or component implementations are vendored. beui.dev names remain the
property of their owner, and the guide instructs reading component source for mechanism
extraction only, not vendoring it into references or projects.

`frontend/references/design/clone-from-url.md` is a project-original runtime-extraction
workflow guide. Its browser + `getComputedStyle` clone approach follows the same
MIT-licensed `JCodesMore/ai-website-cloner-template` clone-website workflow that `aside.md`
cites; no source from that template is copied. It carries no third-party attribution beyond
that lineage note, and it grants no license to copy any target site's trademarks, brand
assets, or proprietary copy.
