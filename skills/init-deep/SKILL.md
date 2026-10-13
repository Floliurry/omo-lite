---
name: init-deep
description: "Initializes a hierarchical AGENTS.md knowledge base for a project. Use when a repo needs its structure, commands, and conventions documented for agents."
---
# /init-deep

Generate hierarchical AGENTS.md files. Root + complexity-scored subdirectories.

## Usage

```
/init-deep                      # Update mode: modify existing + create new where warranted
/init-deep --create-new         # Read existing → remove all → regenerate from scratch
/init-deep --max-depth=2        # Limit directory depth (default: 3)
```

---

## Workflow (High-Level)

1. **Discovery + Analysis**
   - Read existing AGENTS.md and map the relevant structure, symbols, and conventions
   - Delegate independent discovery questions when their expected benefit exceeds coordination cost
2. **Score & Decide** - Determine AGENTS.md locations from merged findings
3. **Generate** - Root first, then warranted subdirs
4. **Review** - Deduplicate, trim, validate

<critical>
**Track all four phases with the active runtime's available plan/todo operations, reusing an existing task tracker.** If none is exposed, maintain one concise checklist in the session. Mark each phase in progress and then completed as the work happens; do not create a duplicate tracker.
</critical>

---

## Phase 1: Discovery + Analysis

**Mark "discovery" as in_progress.**

### Scope Discovery

Read existing AGENTS.md files first. Use focused searches to locate entry points, configuration, build and test conventions, and project-specific warnings. Trace relevant symbols and references with LSP and ast-grep when available. Ground structural claims in observed code rather than naming conventions.

Delegate a bounded, independent discovery question when it can run usefully alongside local analysis. Useful charters include package boundaries, entry-point reach, test conventions, or a complex hotspot; choose only those that the repository and current evidence warrant. Give each explorer the exact scope and expected evidence, then merge its findings with direct reads. File count, line count, depth, language count, and package count can guide where to inspect, but never determine an agent roster.

### Main Session: Structural Analysis

**During discovery**, the main session does:

#### 1. Bash Structural Analysis
```bash
# Directory depth + file counts
find . -type d -not -path '*/\\.*' -not -path '*/node_modules/*' -not -path '*/venv/*' -not -path '*/dist/*' -not -path '*/build/*' | awk -F/ '{print NF-1}' | sort -n | uniq -c

# Files per directory (top 30)
find . -type f -not -path '*/\\.*' -not -path '*/node_modules/*' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -30

# Code concentration by extension
find . -type f \\( -name "*.py" -o -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.go" -o -name "*.rs" \\) -not -path '*/node_modules/*' | sed 's|/[^/]*$||' | sort | uniq -c | sort -rn | head -20

# Existing AGENTS.md / CLAUDE.md
find . -type f \\( -name "AGENTS.md" -o -name "CLAUDE.md" \\) -not -path '*/node_modules/*' 2>/dev/null
```

#### 2. Read Existing AGENTS.md
For each existing file found, read its contents with the runtime's available file-reading operation. Extract key insights, conventions, and anti-patterns into an `EXISTING_AGENTS` working map.

If `--create-new`: Read all existing first (preserve context) → then delete all → regenerate.

#### 3. Code Map - use LSP and ast-grep where relevant

High-signal sources for the CODE MAP and the Symbol/Export/Reference scoring rows. Use both when present and relevant to the proposed AGENTS.md locations.

**LSP** - when available, check `lsp_status`; model-facing names are `lsp_status`/`lsp_symbols`/`lsp_find_references`/`lsp_goto_definition` (some harnesses drop the `lsp_` prefix):
- `lsp_symbols` scope="document" on relevant entry points -> file outline.
- `lsp_symbols` scope="workspace", query by kind (class/interface/function) -> symbol inventory.
- `lsp_find_references` on top exports (line/character from the symbols result) -> reference centrality.

**ast-grep** - use the ast-grep skill when its patterns can clarify exports or dependencies:
- `sg --pattern 'export $$$' --lang <lang>` -> export inventory; `sg --pattern 'import $$$ from "$MOD"'` -> dependency edges between modules for the scoring matrix.

If LSP is unavailable, use direct source reads and ast-grep where useful; mark reference centrality unmeasured in the CODE MAP.

### Integrate Findings

Collect any delegated results and verify consequential claims against source. Merge structural searches, symbols, existing guidance, and applicable explorer findings. Mark "discovery" as completed.

---

## Phase 2: Scoring & Location Decision

**Mark "scoring" as in_progress.**

### Scoring Matrix

| Factor | Weight | High Threshold | Source |
|--------|--------|----------------|--------|
| File count | 3x | >20 | bash |
| Subdir count | 2x | >5 | bash |
| Code ratio | 2x | >70% | bash |
| Unique patterns | 1x | Has own config | explore |
| Module boundary | 2x | Has index.ts/__init__.py | bash |
| Symbol density | 2x | >30 symbols | LSP/cg |
| Export count | 2x | >10 exports | LSP/cg |
| Reference centrality | 3x | >20 refs | LSP/cg |

### Decision Rules

| Score | Action |
|-------|--------|
| **Root (.)** | ALWAYS create |
| **>15** | Create AGENTS.md |
| **8-15** | Create if distinct domain |
| **<8** | Skip (parent covers) |

### Output
```
AGENTS_LOCATIONS = [
  { path: ".", type: "root" },
  { path: "src/hooks", score: 18, reason: "high complexity" },
  { path: "src/api", score: 12, reason: "distinct domain" }
]
```

**Mark "scoring" as completed.**

---

## Phase 3: Generate AGENTS.md

**Mark "generate" as in_progress.**

<critical>
**File Writing Rule**: Check whether the target AGENTS.md exists and read its current contents before changing it. Update an existing file with the runtime's available patch/edit operation; create a missing file with its native file-creation or patch operation. Do not blindly overwrite an existing file or discard unrelated edits.
</critical>

### Root AGENTS.md (Full Treatment)

```markdown
# PROJECT KNOWLEDGE BASE

**Generated:** {TIMESTAMP}
**Commit:** {SHORT_SHA}
**Branch:** {BRANCH}

## OVERVIEW
{1-2 sentences: what + core stack}

## STRUCTURE
```
{root}/
├── {dir}/    # {non-obvious purpose only}
└── {entry}
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|

## CODE MAP
{From LSP/ast-grep - skip only if neither exists or project <10 files}

| Symbol | Type | Location | Refs | Role |
|--------|------|----------|------|------|

## CONVENTIONS
{ONLY deviations from standard}

## ANTI-PATTERNS (THIS PROJECT)
{Explicitly forbidden here}

## UNIQUE STYLES
{Project-specific}

## COMMANDS
```bash
{dev/test/build}
```

## NOTES
{Gotchas}
```

**Quality gates**: concise, project-specific guidance; no generic advice, obvious information, or filler added to meet a length target.

### Subdirectory AGENTS.md

Write each warranted location from the merged project map. Delegate an independent location only when separate ownership and parallel work help. Give its writer the target path, reason, parent guidance, unique facts, expected sections, and a requirement to avoid parent duplication. Keep closely related locations with one owner so the hierarchy stays coherent.

Integrate any delegated drafts, then mark "generate" as completed.

---

## Phase 4: Review & Deduplicate

**Mark "review" as in_progress.**

For each generated file:
- Remove generic advice
- Remove parent duplicates
- Trim to size limits
- Verify telegraphic style

**Mark "review" as completed.**

---

## Final Report

```
=== init-deep Complete ===

Mode: {update | create-new}

Files:
  [OK] ./AGENTS.md (root, {N} lines)
  [OK] ./src/hooks/AGENTS.md ({N} lines)

Dirs Analyzed: {N}
AGENTS.md Created: {N}
AGENTS.md Updated: {N}

Hierarchy:
  ./AGENTS.md
  └── src/hooks/AGENTS.md
```

---

## Anti-Patterns

- **Unnecessary delegation**: Choose independent exploration and writing tasks from the evidence, not repository size.
- **Ignoring existing**: ALWAYS read existing first, even with --create-new
- **Over-documenting**: Not every dir needs AGENTS.md
- **Redundancy**: Child never repeats parent
- **Generic content**: Remove anything that applies to ALL projects
- **Verbose style**: Telegraphic or die
