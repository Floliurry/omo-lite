# omo-lite

[中文](README.md) | English

A slim Codex plugin built from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)'s
Codex port. It gives Codex rewritten base instructions, a rule for the lead agent, a set of agent
roles, skills, a few hooks and an `omo` command for reading files. Every file here is the source
Codex loads: there is no build step and no generated copy.

## Why this exists

We ran oh-my-openagent's Codex port day to day on our own projects and kept correcting the same
behaviors. Two things made that slow.

The port carried a large maintenance chain: shared and generated package layers, a bootstrap and
auto-update installer, and tests whose job was to keep the copies in sync. A one-line change to a
skill had to pass through all of it. This plugin drops the chain, so a change is an edit to the file
Codex reads, followed by a reinstall.

Much of the behavior we kept correcting came from Codex's own built-in instructions rather than
from the plugin. They asked for a commentary update every 60 seconds, which made the lead redo a
sub-agent's search instead of waiting for it. They asked to make every action "concrete and
reviewable" before asking, which produced staged installers with backup and rollback for a
two-byte patch. Three separate requests to state risks and limits turned replies into audit reports.
So this plugin replaces the built-in text with our own base instructions, written as one consistent
whole, and keeps the upstream text beside it to track changes.

Codex also has no tool for reading a file. Every command's output goes into the context as printed
until it passes about 10,000 tokens, and then Codex keeps only the head and the tail. The `omo`
command reads, searches and runs commands with bounded output that says how to get the rest.

## How it works

- **Base instructions** (`instructions/codex-base.md`) replace Codex's built-in instructions through
  `model_instructions_file`. They cover when to act and when to ask, how to write to the user and in
  files, and how to read, edit and write code. Sub-agents inherit them whatever their model.
- **The lead rule** (`rules/lead.md`) is injected into the main agent by a hook. It covers finding
  the direction before the work, what to delegate and what to keep, and when to use a workflow.
- **Agent roles** (`agents/*.toml`) set the model, reasoning effort and instructions for read-only
  researchers (explorer, librarian), workers at three sizes, reviewers and planners. The model names
  in them are the ones we use; change them to the models your account offers.
- **Skills** (`skills/`) hold everything that applies only to some tasks: programming and commit
  policy, debugging, frontend, browsing, data work, planning and execution workflows, team mode and
  session search.
- **Hooks** (`hooks/`) are plain Node scripts:

  | Hook | When | Does |
  | --- | --- | --- |
  | `resident-rule.mjs` | Session start, prompt, compaction | Injects the lead rule with the session's model name; after a compaction, a pointer to the rule file |
  | `patch-check.mjs` | Before and after `apply_patch` | Refuses a patch whose hunk matches several places, which `apply_patch` would apply to the first; accepts a JSON edit (`{"edit", "old", "new"}`) and turns it into a patch; names the changed lines afterwards |
  | `read-reset.mjs` | Compaction | Lets `omo read` print ranges again that were read before the compaction |
  | `subagent-context.mjs` | Sub-agent start | Gives a sub-agent the helper that loads the files its assignment lists under `Context:` |
  | `ultrawork-trigger.mjs` | Prompt | Points a `/ulw …` or `ulw: …` request at the ultrawork skill |
  | `thread-title.mjs` | Thread creation | Reminds a team-mode leader to title new threads |
  | `ulw-execute-continuation.mjs` | Stop | Keeps a selected ulw-execute plan running until its final check passes |

- **The `omo` command** (`tools/omo.mjs`):

  | Command | Prints |
  | --- | --- |
  | `omo read FILE [START-END]` | The file with line numbers, a page of about 8,000 tokens at a time; an unchanged range read again in the same thread prints a one-line note |
  | `omo grep PATTERN [PATH...]` | Matching lines grouped by file, at most 100 |
  | `omo glob PATTERN [DIR...]` | Matching paths, at most 100 |
  | `omo run [--grep REGEX] COMMAND` | Saves the full output to a file, then prints the exit code, the matching lines and the last 40 lines |

## Repository layout

| Path | What it is |
| --- | --- |
| `.codex-plugin/plugin.json` | Plugin manifest |
| `.mcp.json` | Remote search servers (grep.app, Context7) |
| `instructions/` | The base instructions, the multi-agent texts for the lead and sub-agents, the upstream instructions they were written against, and `check-upstream.mjs`, which names the upstream sections that changed since |
| `rules/lead.md` | The lead rule |
| `agents/` | Agent role TOMLs |
| `skills/` | Skills; vendored ones carry their own `ATTRIBUTION.md` or `SOURCE` |
| `hooks/` | `hooks.json` and the hook scripts |
| `tools/omo.mjs` | The `omo` command |
| `install.mjs` | The installer we use ourselves (see below) |
| `test/` | Tests; nothing under it is installed |

## Installing

Most people ask Codex to install a plugin, so this section is written for whoever does the work,
person or agent. Installing changes `<codex home>/config.toml` (`~/.codex` unless `CODEX_HOME` is
set), which every Codex session on the machine reads, so the user sees each change before it is made.
It needs Node.js on PATH.

`install.mjs` makes these changes:

- copies the plugin into `<codex home>/plugins/cache/<marketplace>/omo/<version>/` and writes a
  marketplace entry beside it (`sisyphuslabs` unless `--marketplace` names another);
- in `config.toml`, enables the `plugins`, `plugin_hooks` and `multi_agent` features, the plugin and
  its Context7 server, points `model_instructions_file` at the installed base instructions and sets
  the multi-agent texts under `[features.multi_agent_v2]`, after backing the file up to
  `config.toml.bak-omo-lite`;
- copies `agents/*.toml` into `<codex home>/agents/`;
- writes the `omo` command to `~/.local/bin` (`--bin-dir` to change).

It leaves alone a `model_instructions_file` or a role that `config.toml` already points somewhere
else, and an `omo` command it did not write, and says so.

To install:

1. Clone the repository and run `node install.mjs --dry-run` in it. It prints every change without
   making any; show that list to the user.
2. Once the user agrees, run `node install.mjs`. Let the installer make the changes rather than
   editing `config.toml` by hand.
3. Pass on the hooks the installer lists as not yet trusted. Codex runs a plugin hook only while
   `config.toml` records the hash of its current definition, and the IDE never asks, so an untrusted
   hook is skipped without notice. The user reviews and trusts them in a terminal `codex` session
   under `/hooks`; an agent does not compute or write these hashes.
4. Restart Codex, for example by reloading the VS Code window. A running session keeps the
   instructions it started with.

To undo, restore `config.toml.bak-omo-lite` and delete the plugin's cache directory.

Only Linux and WSL are checked. On Windows, unchecked, the hooks need `node` on PATH, and the `omo`
command, a POSIX shell script, is not installed.

## Development

```sh
node --test test/                          # hooks, installer, omo command, workflow scripts
python3 -m unittest discover -s test/ultimate-browsing   # the browsing engine
bash test/ast-grep/smoke.sh                # ast-grep helper
node instructions/check-upstream.mjs       # upstream sections changed since our snapshot
```

When Codex's built-in instructions change upstream, `check-upstream.mjs` (also run by the installer)
names the changed sections. Read them, take over what applies into `codex-base.md`, then replace the
snapshot. Commit messages follow
[the programming skill's commit policy](skills/programming/references/commit-policy.md#commit-messages).

## License

Derived from oh-my-openagent and distributed under its Sustainable Use License 1.0; see
[LICENSE.md](LICENSE.md). Vendored skills keep their own terms: `skills/frontend` (Apache 2.0),
`skills/ast-grep` (`LICENSE`), and `skills/ultimate-browsing` and `skills/ulw-research` (see their
`ATTRIBUTION.md`).
