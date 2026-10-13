# Execution surfaces

Choose among actually available surfaces. Preserve project dependencies, inspect
imports first, and follow the runtime's tool schema and persistence contract.
The cache helpers below may install dependencies: run them only for authorized
setup, with a suitable destination (override via `OMO_DATA_SCIENTIST_CACHE`).
If setup is unavailable or excluded, use an existing compatible tool or report
the missing capability; a user cache is still a filesystem mutation.

## Persistent kernel, JavaScript (Bun)

For a selected JavaScript runtime with compatible native-module support, prefer
an already available `@duckdb/node-api`. When setup is needed and authorized,
the bundled script installs `@duckdb/node-api` into a user-level
cache outside any repo and prints the absolute import path (its only stdout line):

```bash
bash scripts/ensure-js-deps.sh          # run from the skill directory
```

In a compatible kernel, use the import path it supports; for ESM:

```js
const { DuckDBInstance } = await import("<printed path>");
const db = await DuckDBInstance.create(":memory:");
const conn = await db.connect();
const reader = await conn.runAndReadAll("SELECT category, SUM(v) AS total FROM 'data.csv' GROUP BY 1");
reader.getRowObjects();                  // array of plain row objects
```

- Reuse only if the surface actually persists state. Close the owned connection
  and instance when finished; never close another task's shared resources.
- COUNT/SUM over integer columns return BigInt; convert (`Number(x)` or `String(x)`) before
  `JSON.stringify`, which throws on BigInt.
- Bun builtins cover ingest gaps with zero installs: `Bun.JSONL.parse`, `Bun.JSON5.parse`,
  `Bun.XML.parse`, `Bun.TOML.parse`, `Bun.Archive` for tarballs.
- nodejs-polars is NOT part of this skill's toolkit: its API lags the Python release by
  major versions (option objects that work in Python throw napi type errors). Polars work
  belongs to the Python kernel (below).

## Persistent kernel, Python (the default Python surface)

Check imports in the selected interpreter first. If Polars/Arrow are missing and
cache setup is authorized, the helper below installs into the selected cache and
prints its path (otherwise use the project environment or another suitable tool):

```python
import subprocess, sys
site = subprocess.run(["bash", "scripts/ensure-py-deps.sh", sys.executable],
                      capture_output=True, text=True, check=True).stdout.strip()
sys.path.insert(0, site)
import polars as pl
import pyarrow
```

- The install goes to a user cache keyed to the kernel's interpreter version; the
  interpreter itself is never mutated (it is frequently an externally-managed system
  Python, and mutating it breaks other tools).
- After successful imports in a persistent kernel, `duckdb.sql(...).pl()` hands off via
  Arrow, `duckdb.register(name, df)` goes the other way, and Polars lazy pipelines run
  in-kernel across cells.
- `duckdb.sql("SELECT ... FROM 'data.csv'")` queries files in place; without the injection,
  keep results in DuckDB or fetch plain Python values (`.fetchall()`).
- matplotlib figures render natively in kernels that display rich output; also save a PNG so
  the artifact survives the session.

## uv lane (fallback and isolation)

```bash
uv run --with duckdb --with polars --with pyarrow --with numpy python -c "<code>"
```

- Reach for it when there is no kernel, or when a heavy, crash-prone one-shot should not
  run inside (and possibly take down) the kernel.
- Include exactly the packages the code imports, plus pyarrow whenever `.pl()` is used.
- Each invocation pays process/import costs and may re-read inputs —
  fine for one-shots, wasteful for exploration loops.
- Past a few lines, a temp file beats `-c` quoting: write the script, `uv run script.py`.

## No kernel at all

Same engines, one process per batch of questions:

```bash
bun -e '<the JavaScript kernel pattern above>'         # DuckDB via @duckdb/node-api
uv run --with duckdb python -c "<sql via duckdb.sql>"  # DuckDB via Python
uv run scripts/quick-query.py data.csv "SELECT ..."    # zero-code CLI fallback
```

## Escalation rules

Select by availability, isolation and the work needed; these are alternatives, not a required ladder:

- Missing kernel packages — use a suitable existing project environment or
  authorized cache/uv setup. Do not force injection into a shared kernel.
- Crash-prone or memory-hungry one-shot that should not take the kernel down — uv lane.
- No kernel on this harness — one-shot recipes above.
- Data lives remotely or exceeds local RAM — read `placement.md` and move the query, not
  the data.
