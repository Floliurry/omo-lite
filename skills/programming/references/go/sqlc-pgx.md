# Database Stack — sqlc + pgx + goose + testcontainers

The canonical 2026 PostgreSQL stack. **Type-safe SQL with zero runtime reflection**, hot-path-friendly connection pooling, sane migrations, real Postgres in tests.

Use this recipe when a project has selected sqlc + pgx. Preserve an existing gorm stack; its tradeoffs are summarized at the end.

---

## Toolchain

```bash
go install github.com/sqlc-dev/sqlc/cmd/sqlc@latest
go install github.com/pressly/goose/v3/cmd/goose@latest
```

---

## Layout

```
internal/store/
├── sqlc.yaml                 # sqlc config
├── schema.sql                # the cumulative DDL sqlc parses
├── queries/                  # one *.sql per resource
│   ├── users.sql
│   ├── orders.sql
│   └── sessions.sql
├── sqlc/                     # GENERATED — do not hand-edit
│   ├── db.go
│   ├── models.go
│   ├── users.sql.go
│   ├── orders.sql.go
│   └── sessions.sql.go
├── migrations/               # goose migrations, ordered
│   ├── 20260101000001_create_users.sql
│   └── 20260102000001_add_orders.sql
├── pool.go                   # pgxpool factory
├── user_store.go             # domain-facing wrapper around sqlc
└── user_store_test.go        # testcontainers integration test
```

---

## `sqlc.yaml`

```yaml
version: "2"
sql:
  - engine: "postgresql"
    schema:  "schema.sql"
    queries: "queries"
    gen:
      go:
        package: "sqlc"
        out:     "sqlc"
        sql_package: "pgx/v5"
        emit_json_tags: false
        emit_prepared_queries: false
        emit_interface: true          # generates a Querier interface
        emit_exact_table_names: false
        emit_pointers_for_null_types: true
        emit_empty_slices: true
        overrides:
          - db_type: "uuid"
            go_type:
              import: "github.com/google/uuid"
              type:   "UUID"
          - db_type: "timestamptz"
            go_type:
              import: "time"
              type:   "Time"
```

Key choices:

- `sql_package: "pgx/v5"` — generated code uses pgx directly, not `database/sql`. Faster, type-safer.
- `emit_interface: true` — generates a `Querier` interface. Lets stores accept either `*pgxpool.Pool` or `pgx.Tx` for transaction support.
- `emit_pointers_for_null_types: true` — nullable columns become `*T`, not `sql.NullString`. Cleaner mapping to domain types.
- `overrides` for `uuid` → `google/uuid.UUID` and `timestamptz` → `time.Time`.

---

## `schema.sql`

```sql
-- internal/store/schema.sql
-- The CUMULATIVE schema sqlc parses. Not migrations — the end state.
-- Regenerate from a fresh DB via `pg_dump --schema-only`, or hand-maintain.

CREATE TABLE users (
    id         UUID         PRIMARY KEY,
    email      TEXT         NOT NULL UNIQUE,
    username   TEXT         NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_created_at ON users(created_at DESC);
```

---

## `queries/users.sql`

```sql
-- name: GetUser :one
SELECT id, email, username, created_at
FROM users
WHERE id = $1;

-- name: ListUsers :many
SELECT id, email, username, created_at
FROM users
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CreateUser :one
INSERT INTO users (id, email, username)
VALUES ($1, $2, $3)
RETURNING id, email, username, created_at;

-- name: UpdateUserEmail :exec
UPDATE users
SET email = $2
WHERE id = $1;

-- name: DeleteUser :exec
DELETE FROM users WHERE id = $1;
```

sqlc directives:

- `:one` — exactly one row; returns `(T, error)`. Returns `pgx.ErrNoRows` on miss.
- `:many` — zero or more rows; returns `([]T, error)`.
- `:exec` — no rows returned; returns `error`.
- `:execrows` — returns `(int64, error)` with affected row count.
- `:batchone` / `:batchmany` / `:batchexec` — pgx batch mode for bulk operations.

Run `task gen:sqlc` (or `sqlc generate`). The generated file is committed; CI checks it is up-to-date.

---

## Generated code shape (`sqlc/users.sql.go`)

```go
// GENERATED — do not edit
type User struct {
    ID        uuid.UUID
    Email     string
    Username  string
    CreatedAt time.Time
}

const getUser = `-- name: GetUser :one
SELECT id, email, username, created_at FROM users WHERE id = $1`

func (q *Queries) GetUser(ctx context.Context, id uuid.UUID) (User, error) {
    row := q.db.QueryRow(ctx, getUser, id)
    var u User
    err := row.Scan(&u.ID, &u.Email, &u.Username, &u.CreatedAt)
    return u, err
}
```

Type-safe inputs, type-safe outputs, compile-time-checked column-to-field mapping. **A schema change that drops a column breaks compilation.** Hand-rolled SQL would have failed at runtime.

---

## `store/pool.go`

```go
package store

import (
    "context"
    "fmt"
    "time"

    "github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
    cfg, err := pgxpool.ParseConfig(dsn)
    if err != nil { return nil, fmt.Errorf("parse dsn: %w", err) }

    cfg.MaxConns        = 25
    cfg.MinConns        = 5
    cfg.MaxConnLifetime = time.Hour
    cfg.MaxConnIdleTime = 30 * time.Minute
    cfg.HealthCheckPeriod = 1 * time.Minute

    pool, err := pgxpool.NewWithConfig(ctx, cfg)
    if err != nil { return nil, fmt.Errorf("connect: %w", err) }

    if err := pool.Ping(ctx); err != nil {
        pool.Close()
        return nil, fmt.Errorf("ping: %w", err)
    }
    return pool, nil
}
```

`pgxpool.Pool` is `Querier`-compatible (implements the interface sqlc generates). Same pool flows into sqlc queries unchanged.

---

## `store/user_store.go` — domain ↔ sqlc

```go
package store

import (
    "context"
    "errors"
    "fmt"

    "github.com/google/uuid"
    "github.com/jackc/pgx/v5"
    "github.com/jackc/pgx/v5/pgxpool"

    "github.com/your-org/myservice/internal/domain"
    "github.com/your-org/myservice/internal/store/sqlc"
)

type UserStore struct {
    q *sqlc.Queries
}

func NewUserStore(pool *pgxpool.Pool) *UserStore {
    return &UserStore{q: sqlc.New(pool)}
}

func (s *UserStore) Get(ctx context.Context, id domain.UserID) (domain.User, error) {
    row, err := s.q.GetUser(ctx, uuid.UUID(id))
    if err != nil {
        if errors.Is(err, pgx.ErrNoRows) {
            return domain.User{}, domain.ErrUserNotFound
        }
        return domain.User{}, fmt.Errorf("get user %s: %w", id, err)
    }
    return rowToDomain(row)
}

func (s *UserStore) Create(ctx context.Context, u domain.User) (domain.User, error) {
    row, err := s.q.CreateUser(ctx, sqlc.CreateUserParams{
        ID:       uuid.UUID(u.ID),
        Email:    u.Email.String(),
        Username: u.Username.String(),
    })
    if err != nil {
        return domain.User{}, fmt.Errorf("create user: %w", err)
    }
    return rowToDomain(row)
}

func rowToDomain(r sqlc.User) (domain.User, error) {
    email, err := domain.NewEmail(r.Email)
    if err != nil {
        return domain.User{}, fmt.Errorf("db invariant: email %q: %w", r.Email, err)
    }
    username, err := domain.NewUsername(r.Username)
    if err != nil {
        return domain.User{}, fmt.Errorf("db invariant: username %q: %w", r.Username, err)
    }
    return domain.User{
        ID:        domain.UserID(r.ID),
        Email:     email,
        Username:  username,
        CreatedAt: r.CreatedAt,
    }, nil
}
```

The wrapping is verbose. **That is the point.** sqlc rows are storage representations; domain types are business representations. Mapping them explicitly is where invariants are enforced.

`pgx.ErrNoRows` becomes `domain.ErrUserNotFound` — callers never see storage-level errors.

---

## Transactions — pgx.Tx satisfies the Querier interface

```go
func (s *UserStore) CreateWithProfile(
    ctx context.Context,
    pool *pgxpool.Pool,
    u domain.User,
    p domain.Profile,
) error {
    tx, err := pool.Begin(ctx)
    if err != nil { return fmt.Errorf("begin: %w", err) }
    defer tx.Rollback(ctx)  // no-op if Commit succeeded

    q := s.q.WithTx(tx)  // sqlc.Queries bound to the tx

    if _, err := q.CreateUser(ctx, /* ... */); err != nil {
        return fmt.Errorf("create user: %w", err)
    }
    if _, err := q.CreateProfile(ctx, /* ... */); err != nil {
        return fmt.Errorf("create profile: %w", err)
    }
    return tx.Commit(ctx)
}
```

Pattern:

- `defer tx.Rollback(ctx)` immediately after `Begin` — safe even after Commit (returns "tx closed", which we ignore via the unhandled return).
- `q.WithTx(tx)` returns a `*Queries` bound to the tx.
- Last line: `tx.Commit(ctx)`.

For nested transactions across multiple stores, accept a `Querier` parameter:

```go
func (s *UserStore) CreateTx(ctx context.Context, q sqlc.Querier, u domain.User) (domain.User, error) {
    // uses q instead of s.q — caller decides if it's pool or tx
}
```

---

## Migrations — goose

```bash
goose -dir internal/store/migrations create create_users sql
```

```sql
-- migrations/20260101000001_create_users.sql
-- +goose Up
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE users;
```

Run `up` and `status` against the database chosen for this deployment. Validate the `up`/`down`/`up` cycle on a disposable test database. Deployment or rollback of an existing database follows the project's migration procedure and the task's authorization:

```bash
goose -dir internal/store/migrations postgres "$DATABASE_URL" up
goose -dir internal/store/migrations postgres "$DATABASE_URL" status

# TEST_DATABASE_URL names a disposable database.
goose -dir internal/store/migrations postgres "$TEST_DATABASE_URL" up
goose -dir internal/store/migrations postgres "$TEST_DATABASE_URL" down
goose -dir internal/store/migrations postgres "$TEST_DATABASE_URL" up
```

Rules:

- One DDL change per migration. Never combine schema + data migrations in one file.
- For reversible migrations, implement `Down` and test `up` → `down` → `up` on a fresh container. Forward-only migrations require the project's recovery checks instead of a fabricated rollback.
- Migrations are append-only. Never edit a merged migration; add a new one.

`goose` can run programmatically as well:

```go
import (
    "github.com/jackc/pgx/v5/stdlib"
    "github.com/pressly/goose/v3"
)

db := stdlib.OpenDBFromPool(pool)
defer db.Close() // This closes the database/sql bridge, not the pgx pool.
if err := goose.SetDialect("postgres"); err != nil { ... }
if err := goose.UpContext(ctx, db, "migrations"); err != nil { ... }
```

Useful for tools that own their schema (CI runner, integration test setup).

---

## Integration tests — testcontainers

```go
package store_test

import (
    "context"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/jackc/pgx/v5/stdlib"
    "github.com/pressly/goose/v3"
    "github.com/stretchr/testify/require"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
)

func newTestDB(t *testing.T) *pgxpool.Pool {
    t.Helper()
    ctx := context.Background()

    pgC, err := postgres.Run(ctx,
        "postgres:16-alpine",
        postgres.WithDatabase("test"),
        postgres.WithUsername("test"),
        postgres.WithPassword("test"),
        postgres.BasicWaitStrategies(),
    )
    require.NoError(t, err)
    t.Cleanup(func() { _ = pgC.Terminate(ctx) })

    dsn, err := pgC.ConnectionString(ctx, "sslmode=disable")
    require.NoError(t, err)

    pool, err := store.NewPool(ctx, dsn)
    require.NoError(t, err)
    t.Cleanup(pool.Close)

    db := stdlib.OpenDBFromPool(pool)
    t.Cleanup(func() { _ = db.Close() })
    require.NoError(t, goose.SetDialect("postgres"))
    require.NoError(t, goose.UpContext(ctx, db, "../migrations"))
    return pool
}

func TestUserStore_Create_returns_new_user(t *testing.T) {
    // Given
    pool := newTestDB(t)
    s := store.NewUserStore(pool)
    ctx := context.Background()

    // When
    user, err := s.Create(ctx, domain.User{
        ID:       domain.UserID(uuid.Must(uuid.NewV7())),
        Email:    mustEmail("a@b.com"),
        Username: mustUsername("alice"),
    })

    // Then
    require.NoError(t, err)
    require.NotEmpty(t, user.ID)

    fetched, err := s.Get(ctx, user.ID)
    require.NoError(t, err)
    require.Equal(t, user.Email, fetched.Email)
}
```

testcontainers spins a real Postgres in Docker, runs migrations, hands you a pool. Tests are slow (~2s startup) but **real** — no fake that diverges from production.

For test suites with many cases, share one container across tests in the same package via `TestMain`:

```go
import (
    "context"
    "fmt"
    "os"
    "testing"

    "github.com/jackc/pgx/v5/pgxpool"
    "github.com/jackc/pgx/v5/stdlib"
    "github.com/pressly/goose/v3"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
)

var testPool *pgxpool.Pool

func runSharedContainerTests(m *testing.M) (exitCode int) {
    ctx := context.Background()
    pgC, err := postgres.Run(ctx, "postgres:16-alpine", /* ... */)
    if err != nil {
        fmt.Fprintln(os.Stderr, "start postgres container:", err)
        return 1
    }
    defer func() {
        if err := pgC.Terminate(ctx); err != nil {
            fmt.Fprintln(os.Stderr, "terminate postgres container:", err)
            exitCode = 1
        }
    }()

    dsn, err := pgC.ConnectionString(ctx, "sslmode=disable")
    if err != nil {
        fmt.Fprintln(os.Stderr, "get postgres connection string:", err)
        return 1
    }
    testPool, err = store.NewPool(ctx, dsn)
    if err != nil {
        fmt.Fprintln(os.Stderr, "open postgres pool:", err)
        return 1
    }
    defer testPool.Close()

    db := stdlib.OpenDBFromPool(testPool)
    defer func() {
        if err := db.Close(); err != nil {
            fmt.Fprintln(os.Stderr, "close migration bridge:", err)
            exitCode = 1
        }
    }()

    if err := goose.SetDialect("postgres"); err != nil {
        fmt.Fprintln(os.Stderr, "set goose dialect:", err)
        return 1
    }
    if err := goose.UpContext(ctx, db, "../migrations"); err != nil {
        fmt.Fprintln(os.Stderr, "run migrations:", err)
        return 1
    }
    return m.Run()
}

func TestMain(m *testing.M) {
    os.Exit(runSharedContainerTests(m))
}
```

Each test then uses a transaction it rolls back at the end — fast and isolated.

---

## Choosing between gorm and sqlc + pgx

| Concern | gorm | sqlc + pgx |
|---|---|---|
| Type safety | runtime reflection; column-to-field via tags | compile-time-checked from SQL |
| Performance | Measure generated SQL and ORM overhead on the workload | Measure SQL, pool settings and generated bindings on the workload |
| Association loading | `Preload` batches association queries; joins are also available | Explicit joins or separate queries in `.sql` |
| Migrations | Preserve the project's versioned migration process; review AutoMigrate separately | Explicit goose migrations in this recipe |
| Debugging | "what query did it run?" requires logging | the query IS the source |
| Cancellation | Pass context through the selected GORM API | Pass context through generated queries and pgx |

Preserve existing gorm projects. For a new stack, choose based on the project's query model and migration/tooling needs.

---

## Sources

- sqlc docs: https://docs.sqlc.dev
- pgx: https://github.com/jackc/pgx
- goose: https://github.com/pressly/goose
- testcontainers-go: https://golang.testcontainers.org
- pgx pool config: https://pkg.go.dev/github.com/jackc/pgx/v5/pgxpool#Config
- GORM context: https://gorm.io/docs/context.html
- GORM association loading: https://gorm.io/docs/preload.html
