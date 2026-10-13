# uv Setup — Per-Platform

This skill's uv lane (kernel-less harnesses, isolated one-shots) runs through `uv run --with ...`, and `scripts/ensure-py-deps.sh` uses uv as its installer. Use an existing suitable environment first. If uv is needed and absent, the scripts or manual commands below are options only when installation is authorized. If setup is excluded, report the missing uv route and use an available compatible tool.

## Automated (recommended)

| Platform | Command |
|---|---|
| macOS / Linux / WSL | `bash scripts/setup-uv.sh` |
| Windows (PowerShell) | `powershell -ExecutionPolicy Bypass -File scripts/setup-uv.ps1` |

Both scripts detect OS/architecture, preserve an existing uv version, and install only when uv is missing. They verify discovery with `uv --version`; an existing installation is not automatically upgraded. Running the scripts does not grant installation authority. On Git Bash/MSYS, use the PowerShell script for native Windows or run the shell script inside WSL.

## Manual install per platform

### macOS

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh        # official installer → ~/.local/bin/uv
# or, with Homebrew:
brew install uv
```

### Linux (x86_64 / aarch64)

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh        # official installer → ~/.local/bin/uv
```

The installer detects glibc vs musl and downloads the right static binary. On minimal containers, ensure `curl` (or `wget`) exists; `wget -qO- https://astral.sh/uv/install.sh | sh` is the fallback.

### Windows (native)

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
# or, with winget:
winget install --id=astral-sh.uv -e
```

### Windows Subsystem for Linux

Use the Linux installer inside WSL:

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### CI

```yaml
# GitHub Actions
- uses: astral-sh/setup-uv@v5
# or plain shell anywhere:
- run: curl -LsSf https://astral.sh/uv/install.sh | sh
```

## PATH notes

- The official installers put the binary in `~/.local/bin` (Unix) or `%USERPROFILE%\.local\bin` (Windows). New shells get it automatically on most setups; an already-open shell needs `export PATH="$HOME/.local/bin:$PATH"` (Unix) or `$env:Path = "$env:USERPROFILE\.local\bin;$env:Path"` (PowerShell) once.
- Homebrew and winget install into their own prefixes that are already on PATH.

## Explicitly requested upgrade

Upgrade separately only when the task calls for it; ordinary setup preserves the installed version.

```bash
uv self update
```

`uv self update` only works for official-installer binaries; Homebrew/winget installs upgrade through their package manager (`brew upgrade uv` / `winget upgrade astral-sh.uv`). The setup scripts do not run these upgrade commands.

## Verify

```bash
uv --version
```

## Offline / air-gapped

Download the matching archive from the uv GitHub releases page, extract it, and put the `uv` binary anywhere on PATH. `uv run --with <pkg>` still needs network for first-time package resolution unless a mirror is configured via `UV_INDEX_URL`.
