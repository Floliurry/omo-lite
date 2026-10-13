# ATTRIBUTION / NOTICE

This skill (`ulw-research`, part of `@oh-my-opencode/shared-skills`) is authored by
the oh-my-openagent project. One design idea is adapted from a third-party project,
credited below. No third-party source is vendored here — only the verification idea
is adapted into this skill's prompt contract.

---

## 1. insane-research (fivetaku) — inspiration for the claim-verification gate

The high-risk non-code verification gate in Phase 3b is inspired by the
data-flow-lock verification design in **insane-research** by fivetaku. The current
local evidence conditions and record conventions are owned by `SKILL.md`, not this
notice. They assess independence by provenance rather than a fixed domain count.

- Source: https://github.com/fivetaku/insane-research
- License: MIT (declared in the project's `README.md`).
- **What is adapted:** the IDEA only — an evidence gate constraining which claims
  may be asserted as established. No insane-research code is copied or redistributed;
  this skill expresses its local contract as runtime-agnostic guidance rather than
  invoking the upstream checker.

```
MIT License

Copyright (c) 2026 fivetaku

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
