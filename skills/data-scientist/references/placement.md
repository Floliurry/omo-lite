# Placement: where should this computation live?

Decide before touching the data. Wrong placement wastes minutes (re-scanning a file queried
ten times) or kills the machine (loading a dataset larger than RAM and swapping).

## The probe (run first, once)

Three facts, one cell or script:

```python
import shutil
from pathlib import Path
size = Path("data.csv").stat().st_size
disk_free = shutil.disk_usage(".").free
# Obtain available RAM and process/container limits from the host's supported
# resource monitor. Total installed physical RAM is not free working memory.
# A row count can use a streaming scan, but still reads the source:
# duckdb.sql("SELECT count(*) FROM 'data.csv'")
```

If available memory cannot be measured, use a conservative bounded/streaming plan
and report the sizing limit; do not treat total physical RAM as an available budget.

CSV typically expands 2-5x in memory (string columns dominate); Parquet expands less
predictably — compressed columns can inflate 10x. Estimate the working set from the
decompressed size of the columns the question actually touches, not the file size.

## In memory — load once, iterate

When the working set stays within roughly 25% of free RAM AND the session will run repeated
queries: load once (`CREATE TABLE t AS SELECT ...` in DuckDB, or a collected DataFrame),
then iterate. This avoids repeated file scans; query latency still depends on the
workload. Prune at load time — select only the needed columns, filter obvious dross —
so the resident table is the working set, not the raw file.

## In place / streaming — single pass, or bigger than RAM

- Single-pass questions: query the file directly (`FROM 'data.csv'`). Loading first is pure
  waste.
- Bigger than RAM, SQL-shaped: cap DuckDB and let it spill —

  ```sql
  SET memory_limit = '4GB';
  SET temp_directory = '/tmp/duckdb_spill';
  ```

  Supported operations can spill; some operators and collected results still exceed
  the configured limit. Leave process/container headroom and handle out-of-memory
  as a failed query, not proof that streaming always fits.
- Bigger than RAM, DataFrame-shaped: use the available engine's bounded execution,
  such as Polars streaming (`collect(engine="streaming")` on a lazy plan) or pandas
  chunks in the existing Python environment. Account for intermediate and result
  memory; chunking the input alone does not bound an accumulating result.

## Remote, in place — move the query to the data

- Files behind http(s)/S3: use an already available httpfs extension, or install it
  only when dependency/network setup is authorized. Parquet supports selective reads
  based on file metadata and server range support; CSV generally needs a sequential scan —

  ```sql
  LOAD httpfs;   -- use an available extension; INSTALL is separate authorized setup
  SELECT region, SUM(amount) FROM 'https://example.com/sales.parquet'
  WHERE sale_date >= '2026-01-01' GROUP BY region;
  ```

  For supported Parquet sources, pruning can reduce the transfer. Metadata reads,
  row-group layout and server behavior affect it; measure consequential transfer costs.
- Data on another machine you can execute on (a remote worker with more RAM, a box closer
  to the data): run the query there and return the aggregate. A group-by result is
  kilobytes; the source is gigabytes.
- Decision rule: result much smaller than data — move the query. Repeated local iteration
  on one slice — move a pruned copy of that slice once, then work locally in memory.

## Hardware notes

- Both engines parallelize across all cores by default; leave that alone except on shared
  machines (`SET threads = N` in DuckDB, `POLARS_MAX_THREADS` for Polars).
- Sustained swapping is the failure mode to avoid on memory-tight machines: when the probe
  says the working set is close to free RAM, choose streaming, not hope.
