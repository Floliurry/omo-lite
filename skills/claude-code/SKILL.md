---
name: claude-code
description: "Run local Claude Code for an external second opinion, review, or explicitly requested Claude work, with observable, workspace-associated persistent sessions. Not a replacement for ordinary internal subagent delegation."
---

# Claude Code

Invoke the installed Claude CLI directly with its normal configured tools, MCP servers, hooks and persistent session storage. Use a dedicated worktree for writable work and keep the session associated with that checkout so the user can inspect and resume it. External review is optional input: it is not a planning gate, approval authority, or permission to implement its recommendations.

## Prepare a bounded request

- Confirm applicable authorization for sending task data to Claude, spending on the selected model, and accessing the required resources. Availability of the CLI or its tools does not grant additional authority. Do not include credentials or unrelated logs.
- Check `command -v claude`, `claude --version`, and `claude --help`. The example below was checked against 2.1.280; use installed help for supported flags. If the command, authentication, requested model, or required permissions are unavailable, stop and report the blocker. Do not install, reconfigure, read credentials, or silently switch models.
- Give enough background to assess the real problem: desired outcome, relevant source paths or excerpts, constraints, observed evidence, and open decisions. Distinguish facts from assumptions. For a review, ask for counterexamples, alternatives, concrete evidence and bounded findings without suggesting the conclusion; state that the assignment is read-only. For authorized implementation, state the owned files and required checks.
- Use the assigned project checkout as the process working directory: the main checkout for a read-only review, or the dedicated worktree for writable work as below. There is no top-level `--cwd` flag. Print mode skips the workspace trust dialog, so use a trusted checkout and understand its local configuration. Set `CLAUDE_CODE_ENTRYPOINT=claude-vscode` on the first launch so the session passes the VS Code Session Manager's programmatic-origin filter (see below). Keep normal `HOME`, `CLAUDE_CONFIG_DIR`, configuration, hooks, and permissions. Do not substitute an unrelated cwd or a temporary Claude profile, use `--bare`/`--safe-mode`/`--restricted`, or disable hooks merely to isolate a review packet. A temporary prompt file is fine; it does not require a different cwd.

For authorized material outside the workspace, pass the needed directories with
`--add-dir <path>` (check installed help). Re-supply them on a resume that still
needs those materials; do not assume per-launch directory access persists, or carry
unneeded directories into a new scope. Keep the session cwd at its assigned checkout.

Keep the default tool set and configured MCP servers. Do not add a Read/Grep/Glob-only `--tools` list, an empty strict MCP configuration, or permission-mode overrides to an ordinary launch. Tool availability and permission to perform an action are separate: the assignment defines the work, and native permission rules still apply. Use a restricted profile only when the task actually requires one.

## Isolate writable work

Normal tools include editing and shell commands. Give Claude its own Git worktree
before assigning implementation, formatting, generation or checks that can modify
repository files. Concurrent writers must not share the lead's checkout or another
worker's worktree, even when their intended file scopes appear separate.

- Create or reuse a task-owned worktree from an identified base commit, with a
  separate branch when needed. Put its exact cwd, base, owned paths and checks in
  the assignment. Reuse that worktree for related follow-ups; a new parallel writer
  needs a separate checkout.
- A new worktree does not inherit staged, unstaged or untracked changes. If the
  task depends on current uncommitted work, transfer only the required diff/files
  and verify the starting content before launch. Do not silently use an older
  committed baseline, copy unrelated changes, or create an unrequested commit.
- Run Claude and its write-producing commands in the assigned worktree. Adapt
  absolute file paths accordingly; do not direct edits back into the main checkout
  or add it as a writable working directory. Worktrees separate checkout files and
  indexes, not shared Git refs, services, external output paths or MCP side effects;
  give shared resources distinct task-owned locations or serialize their use.
- A strictly read-only review may use the main checkout with a no-mutation
  assignment. If it needs a stable view while others edit, provide the intended
  snapshot in a worktree. If the review becomes implementation or needs mutating
  checks, start a new session in an owned worktree and carry over the relevant
  findings before allowing writes; keep the original review session read-only.
- Keep the worktree and its changes through review and handoff. The lead reviews
  the diff and integrates accepted work under the existing Git authority, resolves
  conflicts and runs relevant checks on the integrated result. Remove only owned
  worktrees/branches after their changes are accounted for and inspection or resume
  no longer depends on them; do not discard work to make cleanup succeed.

Worktree isolation keeps normal tools available; it is not a security sandbox.
Return the exact worktree path for inspection and resume. The Session Manager may
require opening that checkout in VS Code rather than showing it in the main
workspace's list; see the [workspace filter evidence](references/session-launch.md).

## Launch and observe

Use the user's requested exact model ID. This example pins `claude-opus-5-5`; do not replace it with the moving `opus` alias or add a fallback without agreement. Choose a fresh UUID for new work and a recognizable display name. Leave native persistence enabled: do not pass `--no-session-persistence` for normal work.

Run the following with the execution tool's working directory set to the assigned checkout (the worktree for writable work). Prepare `prompt_file` with the bounded request first; the path is a placeholder, not a file to create blindly.

```bash
workspace="$PWD"
session_id="$(python3 -c 'import uuid; print(uuid.uuid4())')"
session_name="project-plan-second-opinion"
model="claude-opus-5-5"
prompt_file="/absolute/path/to/review-request.md"
material_args=()
# If needed: material_args=(--add-dir '/authorized/review-material')

printf 'cwd=%s\nsession_id=%s\nname=%s\nmodel=%s\n' \
  "$workspace" "$session_id" "$session_name" "$model"
CLAUDE_CODE_ENTRYPOINT=claude-vscode \
claude -p "${material_args[@]}" --model "$model" \
  --session-id "$session_id" --name "$session_name" \
  --output-format stream-json --verbose \
  < "$prompt_file"
```

Print mode provides a stream the caller can observe; it still loads normal workspace/user context and tools. The entrypoint matches the extension's own launch convention, but does not attach a VS Code permission handler. Without a permission host, actions that require a prompt can be denied. For work that needs interactive approvals, launch in a PTY with `tty: true` and both stdin and stdout attached to that terminal:

```bash
CLAUDE_CODE_ENTRYPOINT=claude-vscode \
claude "${material_args[@]}" --model "$model" \
  --session-id "$session_id" --name "$session_name" \
  "$(cat -- "$prompt_file")"
```

Choose one launch mode for a new UUID. A PTY launch omits `-p` and stream flags; do not pipe or redirect its output, which can select non-interactive mode. Observe it through the execution tool's terminal read/write facility and handle only approvals already covered by the task. `--allowedTools` can preapprove narrowly authorized operations when needed; it does not select the tool palette. `--permission-prompts none` is for deliberately unattended work and can remove tools needing human answers; it is not the normal-session default. Do not use permission bypass flags to resolve a denied operation.

Observe the stream through the execution tool while the process runs; do not discard output and assume success from a launched process. If it yields a running process ID, use that tool's wait/poll facility rather than launching a duplicate review.

- In stream mode, check the `system` / `init` event's `cwd`, `session_id`, `model`, `tools`, `mcp_servers` and `permissionMode` against the requested session and normal configuration. Report a mismatch instead of treating it as the requested run. In PTY mode, inspect the native session/tool display and terminal output.
- In stream mode, check process exit status and the final `result`: its subtype, `is_error`, and `permission_denials`. In PTY mode, wait for the completed response and inspect actual tool outcomes; an idle prompt can also be waiting for input. A successful result can still have denied tools and incomplete work. Missing final output, interruption, or required access denied means incomplete work, not approval.
- After completion, confirm the native transcript exists for this UUID and its metadata associates it with the intended workspace. By default it is `~/.claude/projects/<workspace-key>/<session-id>.jsonl`; respect an already configured Claude directory. Do not invent the workspace-key encoding or scan unrelated transcript contents. A filename-only lookup under the configured `projects` directory can locate this exact UUID:

  ```bash
  claude_dir="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
  find "$claude_dir/projects" -mindepth 2 -maxdepth 2 \
    -type f -name "$session_id.jsonl" -print
  ```

Native storage is global but workspace-associated; no raw-log tree is required inside every repository. If persistence cannot be confirmed, say so and retain the known ID and observed outcome rather than promising resumability.

The local-transcript Session Manager in VS Code 2.1.281 excludes `sdk-cli`,
`sdk-ts`, `sdk-py`, and daemon-kind sessions. CLI 2.1.280 assigns `sdk-cli` to a
print invocation with no entrypoint or with `cli`; it preserves `claude-vscode`.
The transcript head's origin takes precedence over a later resume, so set the
entrypoint before creating the session. A new ordinary session then passes this
origin filter; workspace, archive and UI filters still govern display. The SDK
transport itself does not impose the old read-only/no-MCP tool profile.

Do not promise that `/open?session=<UUID>` rescues a hidden SDK session: the
extension's activation path also looks it up through the session list. Resume an
existing hidden session explicitly in the terminal, or start a new visible session
with the relevant context. Do not rewrite transcripts or patch the extension.
See [version-specific filter and launch evidence](references/session-launch.md)
when checking a different installed version or diagnosing a missing session.

## Continue and hand back

For the same work, use `--resume <session-id>` from the same exact cwd, keeping the intended model and appropriate tool/permission scope. Do not use `--continue`: it picks the most recent session and can select another concurrent task. Do not combine a new `--session-id` or `--fork-session` with a continuation unless a separate session is intended. Avoid concurrent writers to one session.

Return the session UUID, display name, exact cwd, model, native transcript path (or persistence limitation), and the meaningful findings/access failures. For worktree work, include its base/branch, changed files, verification and integration status. Give copyable continuation commands with the real session cwd (including the worktree path), UUID and any still-needed authorized material directories substituted. For agent follow-up:

```bash
material_args=()
# If still needed: material_args=(--add-dir '/authorized/review-material')
cd -- '/actual/workspace' && CLAUDE_CODE_ENTRYPOINT=claude-vscode claude -p "${material_args[@]}" \
  --resume 'actual-session-uuid' --model 'claude-opus-5-5' \
  --output-format stream-json --verbose \
  'Follow-up question for the same review.'
```

For human inspection and interactive continuation, omit print/JSON-stream mode:

```bash
cd -- '/actual/workspace' && CLAUDE_CODE_ENTRYPOINT=claude-vscode \
  claude --resume 'actual-session-uuid' --model 'claude-opus-5-5'
```

Interactive continuation needs an attached terminal and uses that invocation's
configuration, tools and permissions. Include still-needed authorized `--add-dir`
paths for further work. A terminal resume does not change an old session's origin
or prove that the IDE Session Manager lists it. Before opening the same session
elsewhere, end or detach the existing writer through its native lifecycle.

## Relay the review to the user

The point of a second opinion is to show the user what someone without your stake in the change sees, so relay it before judging it:

1. List every finding the reviewer gave, in its own terms: defects, trade-offs it marked for the author or user to decide, open hypotheses and anything it said it could not check. Do not merge, soften or drop items, and give the path of its full report so the user can compare.
2. Then add your judgment of each item: **accept**; **reject**, with evidence that answers the reviewer's actual argument rather than a point it did not make; or **user decides**. An item the reviewer marked for the author or user defaults to user decides.
3. Judge by whether the finding is true and whose decision it is, not by whether it threatens the change you just made. A finding that leaves your change standing can still be correct and worth acting on.

You own implementation of what is accepted; the review grants no authority of its own. If useful for handoff, keep a brief session link and each item's disposition in the project's existing evidence note; do not require another transcript copy or token ledger.

For version-specific details, consult the official [CLI reference](https://code.claude.com/docs/en/cli-reference) and [Claude directory guide](https://code.claude.com/docs/en/claude-directory).
