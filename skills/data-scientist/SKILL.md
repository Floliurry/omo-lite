---
name: data-scientist
description: "Processes and analyzes datasets using available SQL/DataFrame tools, including DuckDB and Polars. Use for CSV/parquet/JSON analysis, group-by/join/aggregation, time series, distributions, cleaning, or plotting a dataset."
---

# Data Scientist: Hybrid-Engine Data Processing

Answer data questions through the cheapest engine and surface that can prove the answer, and
decide where the computation should live before heavy work. Preserve the project's existing data tools. Application database design, transactional queries and migrations belong to the project's backend stack; this skill does not replace its driver, ORM or migration system.

## Execution surfaces: inspect availability first

Use the runtime's actual tools and persistence contract. A JavaScript orchestration
cell is not necessarily a resident Bun or Python interpreter; values/connections
may not survive between calls. Inspect installed packages before invoking setup.

1. **Available persistent kernel:** reuse a connection for repeated queries when
   the kernel supports the chosen engine. Use its interpreter and import API;
   do not assume Bun globals or preinstalled Python packages.
2. **Existing project environment or one-shot process:** batch related queries
   when no suitable kernel exists, or isolate heavy/crash-prone work from it.
3. **Missing dependency:** use a suitable existing tool or report the gap. When
   setup is within the task's authorization, the existing `ensure-js-deps.sh`,
   `ensure-py-deps.sh` and uv recipes remain available. They can install packages
   into a user cache; check the destination and permissions before running them.

Read `references/execution-surfaces.md` for the selected surface's recipes.

## Engine selection

- **DuckDB** for SQL-shaped work: direct file queries, joins, aggregation, subqueries,
  window functions. It scans CSV/Parquet/JSON without an initial full-table load. Operators
  and collected results still consume memory; supported operations may spill.
- **Polars** when the pipeline is DataFrame-shaped: expression-chain transforms, reshapes,
  streaming datasets past RAM in an available Python environment.
  Read `references/polars-lane.md` — the current 1.x API differs from widely-memorized
  older spellings.
- **numpy** when numeric work goes beyond SQL/DataFrame aggregation: statistical tests,
  linear algebra, FFT, random sampling.
- **matplotlib** as a charting option when it fits the requested output — read `references/visualization.md` first; it carries the
  quality bar and a mandatory visual check.

Performance folklore ("X is Nx faster at filtering") varies with data shape, cardinality,
and hardware. When the engine choice materially matters, measure on the actual data instead
of trusting remembered multipliers.

## Placement: decide where the computation lives

Probe before you compute — one cell: file size, free RAM, and (when unclear) a row count via
a direct scan. Then place the work:

- **Load into memory** when the working set stays within roughly a quarter of free RAM AND
  the session will run repeated queries: `CREATE TABLE t AS SELECT ...` (or a collected
  DataFrame) once, then iterate. This avoids repeated file scans; query latency still
  depends on the workload.
- **Query in place / stream** when the question is single-pass, or the working set exceeds the available memory budget:
  DuckDB reads files directly (`FROM 'data.csv'`); past RAM, cap DuckDB's memory and let it
  spill, or use Polars' streaming engine in the Python kernel. NEVER load a larger-than-RAM
  dataset fully into memory — swapping stalls the whole machine, and streaming queries can still fail if operators or results exceed the budget.
- **Query remotely, in place** when the data lives elsewhere: DuckDB can reduce remote Parquet reads
  using column/row-group pruning when supported. CSV generally needs a sequential
  scan; filters do not guarantee a small network transfer. When data sits on another machine you can execute
  on, ship the query to the data and return the small result. Rule: result much smaller
  than data — move the query; repeated local iteration planned — move a pruned copy of the
  data once.

Sizing heuristics and recipes: `references/placement.md`.

## Compatibility

- Preserve pandas when it is the existing suitable pipeline; do not migrate it
  merely to follow this recipe. DuckDB `.df()` needs pandas, while `.pl()` needs
  the appropriate Polars/Arrow packages. Check what is available.
- The bundled CLI accepts CSV, Parquet, JSON and NDJSON. For Excel, use an
  existing suitable reader or export to a supported format; do not overwrite the
  source workbook to satisfy this helper.

## Output contract

Answer the question; report row counts and timing for anything heavy; then stop — no bonus
charts, no extra exploration passes beyond what the question needed. Chart when asked, or
when the answer is a shape (trend, distribution, comparison) that prose cannot carry — then
follow `references/visualization.md` including its look at the rendered chart.

## References

| Read | When |
| --- | --- |
| `references/execution-surfaces.md` | before the first query on any surface: kernel patterns, one-shot recipes, escalation rules |
| `references/polars-lane.md` | DataFrame-shaped pipeline or data past RAM: current API, Arrow handoff, package sets |
| `references/placement.md` | before heavy or remote work: sizing probe, memory limits, remote reads |
| `references/visualization.md` | before any chart: type selection, quality bar, CJK fonts, looking at the rendered chart |
| `references/uv-setup.md` | uv missing or broken on this machine |

## CLI fallback

With its dependencies available, run `python scripts/quick-query.py <file> [SQL]`
in the selected environment, or `uv run scripts/quick-query.py <file> [SQL]`
when that dependency-resolution route is authorized. The CLI
supports `--filter <polars-sql-expr>` and `--describe` for ad-hoc questions.
Supports CSV, Parquet, JSON, NDJSON.
