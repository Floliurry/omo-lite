# omo-lite

[中文](README.md) | English

A slim Codex plugin built from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)'s
Codex port. It gives Codex rewritten base instructions, a rule for the lead agent, a set of agent
roles, skills, a few hooks and an `omo` command for reading files. Every file here is the source
Codex loads: there is no build step and no generated copy.

## Quick start

Needs Node.js on PATH. Only Linux and WSL are checked so far.

```sh
git clone https://github.com/Floliurry/omo-lite.git
cd omo-lite
node install.mjs --dry-run   # lists every change without making any
node install.mjs             # installs once the list looks right
```

Then:

1. Open `codex` in a terminal and review and trust the hooks the installer lists under `/hooks`. An
   untrusted hook is skipped without notice, and the IDE never asks.
2. Restart Codex, for example by reloading the VS Code window. A running session keeps the
   instructions it started with.
3. The model names in `agents/*.toml` are the ones we use; change them to the models your account
   offers and reinstall.

What the installer changes and how to undo it is under [Installing](#installing).

## Repository layout

The Chinese README in each directory describes what is in it.

| Path | What it is |
| --- | --- |
| [`instructions/`](instructions/README.md) | Base instructions that replace Codex's built-in ones; multi-agent texts for the lead and sub-agents; the upstream snapshot and the script that compares it |
| [`rules/`](rules/README.md) | The lead rule, injected into the main agent by a hook |
| [`agents/`](agents/README.md) | Agent roles: lookup, research, workers, reviewers and planners |
| [`skills/`](skills/README.md) | Skills that apply only to some tasks |
| [`hooks/`](hooks/README.md) | `hooks.json` and the hook scripts |
| [`tools/`](tools/README.md) | The `omo` command: reading, searching and running with bounded output |
| [`test/`](test/README.md) | Tests; nothing under it is installed |
| `.codex-plugin/plugin.json` | Plugin manifest, pointing at the skills, hooks and MCP config |
| `.mcp.json` | Remote search servers (grep.app, Context7) |
| `install.mjs` | The installer |

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

## Installing

Most people ask Codex to install a plugin, so this section is written for whoever does the work,
person or agent. Installing changes `<codex home>/config.toml` (`~/.codex` unless `CODEX_HOME` is
set), which every Codex session on the machine reads, so the user sees each change before it is made.

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

When an agent installs it:

1. Run `node install.mjs --dry-run` first and show the list of changes to the user.
2. Once the user agrees, run `node install.mjs`. Let the installer make the changes rather than
   editing `config.toml` by hand.
3. Pass on the hooks the installer lists as not yet trusted. Codex runs a plugin hook only while
   `config.toml` records the hash of its current definition, and the IDE never asks, so an untrusted
   hook is skipped. The user reviews and trusts them in a terminal `codex` session under `/hooks`;
   an agent does not compute or write these hashes.
4. Remind the user to restart Codex.

To undo, restore `config.toml.bak-omo-lite` and delete the plugin's cache directory.

On Windows, unchecked, the hooks need `node` on PATH, and the `omo`
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
snapshot; see [`instructions/`](instructions/README.md). Commit messages follow
[the programming skill's commit policy](skills/programming/references/commit-policy.md#commit-messages).

## License

Derived from oh-my-openagent and distributed under its Sustainable Use License 1.0; see
[LICENSE.md](LICENSE.md). Vendored skills keep their own terms: `skills/frontend` (Apache 2.0),
`skills/ast-grep` (`LICENSE`), and `skills/ultimate-browsing` and `skills/ulw-research` (see their
`ATTRIBUTION.md`).
