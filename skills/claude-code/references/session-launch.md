# Claude Code session visibility and normal tools

Checked on 2026-09-29: local CLI 2.1.280 and VS Code extension 2.1.281 on WSL.
These are installed-version findings; recheck the implementation after an upgrade
when the behavior differs. The skill's launch recipe is the maintained instruction.

## Why the session list hides SDK-origin sessions

The installed extension is
`~/.vscode-server/extensions/anthropic.claude-code-2.1.281-linux-x64/`.
Its minified `extension.js` contains these identifiable symbols:

- `e6.includeProgrammaticSessions` starts as `false`. `buildSessionList()` passes
  it as `includeProgrammatic` with the current workspace and `includeWorktrees:false`.
  On the local-transcript path, `uO$` delegates to `pr4`; `vZ$` excludes sessions
  classified by `kc4` when programmatic sessions are not requested.
- `kc4` recognizes `sdk-cli`, `sdk-ts` and `sdk-py`; it also recognizes session
  kinds `daemon` and `daemon-worker`. `claude-vscode` and ordinary `cli` are not
  programmatic origins under this filter.
- Transcript sampling reads the first and last 64 KiB. The head's `entrypoint`
  match (`nH`) wins; only when absent does the last tail match (`m5`) supply it.
  Appending a visible origin on resume therefore does not replace an SDK origin
  already in the head. Other checks include valid session IDs, non-sidechain
  records, usable title/prompt information and workspace association.
- The `/open` URI handler validates a session UUID and forwards it to panel
  startup. In `webview/index.js`, `activateSessionFromServer` reuses an already
  loaded session or searches the returned session list. A filtered session absent
  from that list does not become loadable merely by supplying its UUID; the panel
  can fall back to a new conversation. Terminal `--resume <UUID>` is a separate path.

For writable tasks, the skill assigns an independent worktree while retaining the
normal Claude profile. Because this list request sets `includeWorktrees:false`,
do not promise that a session launched from a separate worktree appears in the
main checkout's list. Give the user the session's exact worktree cwd to open in
VS Code or use for terminal resume, and retain it while inspection or continuation
depends on it. The live check below used the main checkout for a read-only task;
it does not establish cross-worktree UI discovery.

CLI 2.1.280's entrypoint initializer preserves an existing `claude-vscode` value.
For a print invocation, an unset entrypoint or `cli` becomes `sdk-cli`. The
executable inspected was the installed `@anthropic-ai/claude-code/bin/claude.exe`
behind `command -v claude`. Setting the variable on the first launch is significant;
changing only the resume command is insufficient for an existing hidden session.

## What the extension normally launches

`spawnClaude` uses the Agent SDK with the workspace, normal user/project/local
settings, MCP servers, native permission callbacks and a persistent session.
Its `Q9` environment helper sets `CLAUDE_CODE_ENTRYPOINT=claude-vscode`. It does
not select a Read/Grep/Glob-only built-in tool list. Thus SDK transport, session-list
classification, tool availability and permission handling are separate concerns.

The skill previously imposed the restricted tools, manual permission override,
disabled prompts and empty strict MCP configuration itself. The normal recipe now
omits those overrides. This preserves configured permission checks; it does not
grant every available tool permission to perform every operation.

The official [CLI reference](https://code.claude.com/docs/en/cli-reference) defines
`--tools` as built-in availability and `--allowedTools` as permission allow rules.
The [programmatic guide](https://code.claude.com/docs/en/headless) explains that
ordinary `-p` loads normal context, while permission requests without a host are
denied. `--permission-prompts none` additionally removes tools needing a person's
answer. Use an attached interactive terminal when normal permission prompts are
needed; setting the entrypoint does not create the extension's permission host.
The [VS Code guide](https://code.claude.com/docs/en/vs-code) documents workspace,
archive and status filters and the `/open?session=` route.

## Verification boundary

Source-extracted tests passed 10 session-origin cases and five CLI entrypoint cases
using synthetic records. They cover the three SDK origins, both daemon kinds,
ordinary CLI/VS Code origins, transcript-head precedence on resume, the tail
fallback, missing metadata, and print-mode entrypoint initialization. No extension
code or existing transcript was modified.

A live check with `--model haiku` and the normal stream-mode recipe (no tool, MCP or
permission overrides) confirmed the rest: the session initialized with the normal tools
and the configured MCP servers, Read and Bash ran without permission denials, the saved
title matched, the first origin was `claude-vscode`, and the classifier above did not
filter the transcript. Whether such a session shows in the extension's Session Manager
is checked in the UI, not here.
