# Polars lane (resident Python kernel)

Use Polars when it fits the existing or selected DataFrame pipeline. Inspect the
available interpreter and imports first; a persistent kernel is useful for repeated
queries when the runtime provides one. If Polars/Arrow are missing, the following
cache helper is an authorized-setup option, not a required first step. Follow
`execution-surfaces.md` for alternatives and cache ownership.

```python
import subprocess, sys
site = subprocess.run(["bash", "scripts/ensure-py-deps.sh", sys.executable],
                      capture_output=True, text=True, check=True).stdout.strip()
sys.path.insert(0, site)
import polars as pl
```

In a persistent kernel, Polars objects can be reused across cells: lazy frames,
intermediate results, and the DuckDB handoff all persist with no per-call process cost.

## When Polars wins over DuckDB SQL

- Expression-chain transforms: many derived columns, per-column conditional logic, string
  pipelines — `with_columns` chains read and optimize better than nested SQL SELECTs.
- Reshapes: `unpivot`/`pivot` beat SQL gymnastics.
- Larger-than-RAM pipelines: the streaming engine executes lazy plans in chunks.
- Window-heavy feature engineering with `over()`.

SQL-shaped work (joins, aggregation, ad-hoc questions) stays in DuckDB; mixed pipelines hand
off zero-copy (below) instead of forcing one engine to do everything.

## Current API (1.x) — older spellings fail or warn

Training data is full of the pre-1.0 API. Current names:

| Use | Not |
| --- | --- |
| `pl.scan_csv` / `pl.scan_parquet` + `.collect()` | eager `read_*` on big files |
| `.group_by(...)` | `.groupby(...)` |
| `pl.len()` | `pl.count()` |
| `.collect(engine="streaming")` | `.collect(streaming=True)` |
| `.unpivot(...)` | `.melt(...)` |

Lazy first: `scan_*` builds a plan, pushes filters and projections down to the file read, and
executes once at `.collect()`. Eager `read_*` is for small files mutated interactively.

```python
out = (pl.scan_csv("data.csv")
       .filter(pl.col("value") > 100)
       .group_by("category")
       .agg(pl.col("value").sum().alias("total"), pl.len().alias("n"))
       .sort("total", descending=True)
       .collect())
```

## Zero-copy handoff with DuckDB

Both engines speak Arrow, so mixed pipelines pay no serialization cost — all in-kernel:

```python
import duckdb
df = duckdb.sql("SELECT * FROM 'orders.csv' o JOIN 'items.csv' i USING (id)").pl()
shaped = df.with_columns((pl.col("qty") * pl.col("price")).alias("rev"))
duckdb.register("shaped", shaped)
out = duckdb.sql("SELECT category, SUM(rev) AS total FROM shaped GROUP BY 1").pl()
```

- `.pl()` requires pyarrow — the injection above provides it; without it, it raises
  `ModuleNotFoundError`.
- `.df()` requires pandas; use it only when pandas is the chosen available pipeline.

## Streaming past RAM

```python
out = (pl.scan_parquet("huge.parquet")
       .filter(pl.col("status") == "active")
       .group_by("region").agg(pl.len())
       .collect(engine="streaming"))
```

Streaming executes lazy plans only — keep the plan lazy end-to-end, with no intermediate
`.collect()` breaking it into eager pieces.

## Kernel-less fallback (uv one-shot)

On a harness with no persistent kernel, the same code runs as one-shots — batch several
questions per process, since each invocation pays spawn plus imports:

```bash
uv run --with duckdb --with polars --with pyarrow python -c "
import duckdb
import polars as pl
df = duckdb.sql(\"SELECT * FROM 'data.csv'\").pl()
print(df.group_by('category').agg(pl.len()).sort('category'))
"
```
