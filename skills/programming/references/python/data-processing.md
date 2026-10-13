# Data Processing — Polars + DuckDB

## Selection

Preserve an existing data pipeline and its dependencies. For new analytical work, choose DuckDB for SQL-shaped queries and Polars for expression/DataFrame pipelines. Pandas remains valid when it is the project's selected tool. This guide does not select an application's transactional database or ORM.

| Operation | Candidate | Decision criterion |
|---|---|---|
| CSV / Parquet / JSON SQL query | DuckDB | Direct file scans, joins and aggregations |
| `.duckdb` file | DuckDB | Native format |
| Filter / sort / window / reshape | Polars or DuckDB | Match the existing pipeline and measure consequential performance differences |
| Larger than RAM | Polars streaming or DuckDB out-of-core | Keep execution and result materialization within the memory budget |
| Mixed pipeline | Arrow-compatible handoff | Avoid unnecessary conversions; inspect actual allocation/transfer costs |

For placement, available execution surfaces and large-data handling, read `data-scientist`. It supplies methods, not universal speed multipliers.

## Standard imports

```python
import numpy as np
import polars as pl
import duckdb
```

## DuckDB direct file query

```python
result = duckdb.sql("""
    SELECT category, SUM(amount) AS total
    FROM 'data.csv'
    WHERE date >= '2026-01-01'
    GROUP BY category
    ORDER BY total DESC
""").pl()  # zero-copy → Polars DataFrame
```

`.pl()` returns Polars and needs its Arrow dependencies; `.df()` returns pandas when that is the selected pipeline. Direct scanning avoids an initial full-table load, but operators and collected results still use memory.

## Polars lazy pipeline

```python
result = (
    pl.scan_csv("data.csv")              # lazy, no read yet
    .filter(pl.col("amount") > 1000)
    .filter(pl.col("status") == "active")
    .sort("amount", descending=True)
    .head(100)
    .collect()                            # execute optimised plan
)
```

`scan_*` over `read_*` for files; `lazy()` then `collect()` for in-memory frames. Polars optimises the entire plan before execution (predicate pushdown, projection pushdown, common subexpression elimination).

## Streaming for OOM data

```python
result = (
    pl.scan_csv("huge.csv")
    .filter(pl.col("active"))
    .group_by("category")
    .agg([
        pl.len().alias("count"),
        pl.sum("amount").alias("total"),
    ])
    .collect(engine="streaming")
)
```

## Hybrid pipeline (most realistic shape)

```python
# Phase 1: DuckDB for the join
joined = duckdb.sql("""
    SELECT o.*, c.region, p.category
    FROM 'orders.parquet' o
    JOIN 'customers.parquet' c ON o.customer_id = c.id
    JOIN 'products.parquet'  p ON o.product_id  = p.id
""").pl()

# Phase 2: Polars for filtering and transformation
processed = (
    joined
    .filter(pl.col("amount") > 100)
    .with_columns([
        (pl.col("amount") * 1.1).alias("amount_with_tax"),
    ])
)

# Phase 3: DuckDB for final aggregation - register Polars frame by name
duckdb.register("processed", processed)
final = duckdb.sql("""
    SELECT region, category, SUM(amount_with_tax) AS revenue
    FROM processed
    GROUP BY region, category
    ORDER BY revenue DESC
""").pl()
```

## Type safety with Polars

Polars supports schema overrides at read time, and `.cast()` for explicit conversion. Avoid implicit coercion in hot paths.

```python
schema = {"id": pl.Int64, "amount": pl.Float64, "date": pl.Date}
df = pl.read_csv("data.csv", schema_overrides=schema)
```

basedpyright understands `polars-stubs`, which ship with polars itself. No extra type stubs to install.

## Things you might miss from pandas (and how to do them in Polars)

| pandas | polars |
|---|---|
| `df.iloc[5]` | `df.row(5)` (named tuple) or `df[5]` (single-row frame) |
| `df.loc[df["x"] > 5]` | `df.filter(pl.col("x") > 5)` |
| `df["x"].apply(fn)` | `df["x"].map_elements(fn)` (slow path) or use native expressions |
| `df.merge(...)` | `df.join(other, on="key")` |
| `df.groupby(...).agg(...)` | `df.group_by(...).agg(...)` |
| `pd.read_csv(...).dtypes` | `pl.read_csv(...).schema` |
| `df.to_dict("records")` | `df.to_dicts()` |

## Sources

- Polars docs: <https://docs.pola.rs>
- DuckDB Python API: <https://duckdb.org/docs/api/python/overview>
- Cross-reference - this skill set's `data-scientist` skill (load it for the deep version)
