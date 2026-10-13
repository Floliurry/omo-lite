#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# dependencies = [
#     "duckdb",
#     "polars",
#     "numpy",
#     "pyarrow",
#     "typer",
#     "rich",
# ]
# ///

"""Quick data query runner. SQL arg -> DuckDB; --filter (Polars SQL) -> Polars; --describe -> schema + stats."""

from __future__ import annotations

from pathlib import Path

import typer
from rich import print as rprint
from rich.table import Table


def _run_duckdb(file_path: Path, sql: str) -> None:
    import duckdb

    connection = duckdb.connect()
    try:
        relation = _duckdb_relation(connection, file_path)
        for alias in ("data", "df", file_path.stem):
            connection.register(alias, relation)
        df = connection.sql(sql).pl()
    finally:
        connection.close()
    _print_polars(df)


def _duckdb_relation(connection, file_path: Path):  # noqa: ANN001, ANN202
    match file_path.suffix.lower():
        case ".csv":
            return connection.read_csv(str(file_path))
        case ".parquet":
            return connection.read_parquet(str(file_path))
        case ".json" | ".jsonl" | ".ndjson":
            return connection.read_json(str(file_path))
        case suffix:
            rprint(f"[red]Unsupported format:[/red] {suffix} (Excel: export to CSV or Parquet first)")
            raise SystemExit(1)


def _run_polars_filter(file_path: Path, expr: str) -> None:
    import polars as pl

    df = _read_file(file_path)
    filtered = df.filter(pl.sql_expr(expr))
    _print_polars(filtered)


def _run_describe(file_path: Path) -> None:
    df = _read_file(file_path)

    rprint(f"\n[bold]Schema:[/bold] {file_path.name} ({len(df)} rows × {len(df.columns)} cols)")
    for name, dtype in zip(df.columns, df.dtypes):
        rprint(f"  {name}: [cyan]{dtype}[/cyan]")

    rprint("\n[bold]Statistics:[/bold]")
    _print_polars(df.describe())


def _read_file(file_path: Path):  # noqa: ANN202
    import polars as pl

    suffix = file_path.suffix.lower()
    if suffix == ".csv":
        return pl.read_csv(file_path)
    if suffix == ".parquet":
        return pl.read_parquet(file_path)
    if suffix == ".json":
        return pl.read_json(file_path)
    if suffix in (".jsonl", ".ndjson"):
        return pl.read_ndjson(file_path)
    rprint(f"[red]Unsupported format:[/red] {suffix} (Excel: export to CSV or Parquet first)")
    raise SystemExit(1)


def _print_polars(df) -> None:  # noqa: ANN001
    table = Table(show_lines=False)
    for col_name in df.columns:
        table.add_column(col_name)
    for row in df.iter_rows():
        table.add_row(*(str(v) for v in row))
    rprint(table)
    rprint(f"[dim]{df.shape[0]} rows × {df.shape[1]} cols[/dim]")


def main(
    file: Path = typer.Argument(help="Data file (csv, parquet, json, ndjson)"),
    sql: str = typer.Argument(None, help="SQL query (uses DuckDB). Use 'data' as table name."),
    filter_expr: str = typer.Option(None, "--filter", "-f", help="Polars SQL filter, e.g. 'amount > 100'"),
    describe: bool = typer.Option(False, "--describe", "-d", help="Print schema + stats"),
) -> None:
    """Query data files with DuckDB (SQL) or Polars (SQL filter expressions)."""
    if not file.exists():
        rprint(f"[red]File not found:[/red] {file}")
        raise SystemExit(1)

    if describe:
        _run_describe(file)
    elif filter_expr:
        _run_polars_filter(file, filter_expr)
    elif sql:
        _run_duckdb(file, sql)
    else:
        _run_describe(file)


if __name__ == "__main__":
    typer.run(main)
