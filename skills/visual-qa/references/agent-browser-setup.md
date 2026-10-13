# agent-browser setup and capture fallback

Use agent-browser when an existing runtime/project browser cannot supply the required web capture, or when this integration is selected explicitly. First apply [browser capability and session selection](../../ultimate-browsing/references/browser-session.md). A missing skill name or failed connection alone does not authorize installation.

[agent-browser](https://github.com/vercel-labs/agent-browser) is a browser CLI. Keep it as a fallback; the visual evidence requirements do not depend on this particular executable.

## Check or set up within scope

If already installed, inspect `agent-browser --version` and `agent-browser --help` and use its supported flags. Do not replace a working version merely because another reference contains an example. For new setup, use the project's package manager and an approved tool environment. Global installation is an option only if global setup is authorized; the original recipe remains:

```bash
npm install -g agent-browser
agent-browser install
```

The first command installs a global CLI; the second downloads its managed browser. Bun's global installation is an alternative when Bun is present and that same scope is authorized. If setup is excluded, stop this fallback and report the missing capture capability; do not mark QA passed or alter unrelated configuration.

## Capture with an owned session

Use an explicit task session supported by the installed CLI; confirm its session and viewport flags in its help before use. Navigate the intended URL, set the reference viewport, establish the required scroll/interaction state, then capture PNG. For versions supporting these options:

```bash
agent-browser --session omo-visual-check open "<authorized-url>"
agent-browser --session omo-visual-check set viewport 1280 720
agent-browser --session omo-visual-check screenshot actual.png
```

Use a unique session name for concurrent tasks. Verify actual image dimensions and device scale instead of assuming the viewport command succeeded. Capture every required page/state, then use the unchanged visual-qa evidence tool:

```bash
node "$SKILL_DIR/scripts/visual-qa.mjs" image-diff <reference.png> actual.png
```

`$SKILL_DIR` here is the visual-qa skill directory. Mismatched dimensions make `dimensionsMatch` false and invalidate like-for-like comparison. Inspect the pixels and hand the evidence to visual-qa's independent passes; a successful CLI exit or low diff alone is not the verdict.

Close this task's session on completion or failure (`agent-browser --session <owned-session> close` for supported versions). When attaching to an existing user browser, preserve it and close only owned pages or disconnect; do not use a whole-browser close command. Keep the original error and name any resource that could not be cleaned up.
