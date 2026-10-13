
# Go Programmer

Production Go in 2026. **Boring on purpose, strict by tooling, illegal states unrepresentable by convention.**

## Philosophy

Go gives you fewer type-system tools than Python, TypeScript, or Rust:

- No sum types — only `interface{}` with type-switch.
- No exhaustiveness check from the compiler — only the `exhaustive` linter.
- No `Option<T>` — only `nil` and the eternal trap of "is this nil interface or nil concrete?".
- No `Result<T, E>` — only `(T, error)`, no compiler enforcement of unwrapping.
- No newtype that prevents primitive coercion — `type UserID string` is still implicitly convertible from a literal when used carelessly.

**This is the whole point of the skill.** Where the language is weak, the linter bundle becomes the type checker, and code patterns become the type system. Use the project's configured compiler, linter and tests. The strict bundle, nil analysis and race detector offer different evidence; none substitutes for another tool's guarantees.

For a project adopting these patterns:

1. **Parse-don't-validate at every boundary.** HTTP/RPC/CLI/config gets parsed into a domain struct constructed only via `New*(...)` smart constructors. Once inside the domain, no further validation. See `data-modeling.md`.
2. **`(T, error)` everywhere.** No panics in library code. No bare `_ = err`. Errors are wrapped with `%w` and asserted with `errors.Is` / `errors.As`. Typed error structs for anything a caller can branch on. See `error-handling.md`.
3. **Sealed interfaces for variants.** Sum types via a sealed unexported method, dispatched through a `type switch`, with the `exhaustive` linter checking completeness. See `type-patterns.md`.
4. **Pass `context.Context` first when the operation needs cancellation or request-scoped state.** No `context.Background()` inside leaf functions. No goroutine without context-driven shutdown. No `time.Now()` in domain code — inject a clock. See `concurrency.md`.
5. **Use the project's contract tooling.** For new stacks, `sqlc`, `oapi-codegen`, and protobuf/Connect generation are useful options. Existing ORM, database/sql and serialization boundaries do not require replacement. See `sqlc-pgx.md`, `grpc-connect.md`.

## Tooling for the selected stack

| Category | Recipe default | Existing alternatives / considerations |
|---|---|---|
| Go version | **1.23+** (range-over-func, iter package, slog stable) | <1.22 |
| Module | `go modules` + `go work` for monorepos | dep, GOPATH layouts |
| Format | **`gofumpt`** (stricter gofmt) + `goimports -local <module>` | bare `gofmt` |
| Linter | **`golangci-lint v2`** with the strict bundle in `golangci-strict.md` | bare `go vet` |
| Nil checker | **`nilaway`** in CI | Optional static analysis; tests provide different evidence |
| Vet bundle | `go vet` + `fieldalignment` + `shadow` | Use the configured checks for the changed surface |
| Tests | `go test -race -shuffle=on -count=1` | Disable caching for fresh execution; race checks require a supported target |
| Goroutine leaks | `go.uber.org/goleak` in `TestMain` | Use the project's leak/lifecycle checks for owned goroutines |
| Mock | `go.uber.org/mock` (gomock successor) | hand-written stubs |
| DB | `sqlc` + `jackc/pgx/v5` | `database/sql` + `gorm` |
| HTTP framework | **`gin-gonic/gin`** — `go-chi/chi` for minimalist, `connectrpc/connect-go` for RPC | `echo` (smaller eco), `fiber` (fasthttp = non-stdlib), `gorilla/mux` (in maintenance mode) |
| RPC | **`connectrpc/connect-go`** (gRPC-compatible, HTTP/1.1-friendly, browser-friendly) | hand-rolled `grpc-go` unless you specifically need bidi streaming features Connect lacks |
| Validation | `go-playground/validator/v10` for HTTP boundary + `bufbuild/protovalidate-go` for proto + smart constructors for domain | ad-hoc `if len(s) == 0` chains |
| Config | `caarlos0/env/v11` (struct-tag env) | `viper` unless you actually need file+env+flag merging |
| Logging | **`log/slog`** (stdlib, Go 1.21+) | logrus, zap, zerolog when already established |
| CLI | `spf13/cobra` | hand-rolled `os.Args` parsing past 2 flags |
| TUI | `charm.land/bubbletea/v2` + `bubbles/v2` + `lipgloss/v2` — see `bubbletea-v2.md` for CJK/IME | bubbletea v1 if you need IME |

For a project that has adopted and configured this bundle, a CI gate can be:

```bash
gofumpt -l . && \
  golangci-lint run ./... && \
  nilaway ./... && \
  go test -race -shuffle=on -count=1 ./...
```

Required project checks must pass. Missing optional tools are a scoped verification limit, not authority to install them or reject otherwise valid evidence. See `golangci-strict.md` when configuring that selected bundle.

## Hard rules — code

Read these per-file references for the canonical patterns:

- **Types & data** → `type-patterns.md`, `data-modeling.md` — branded named types, smart constructors with unexported fields, sealed interfaces as sum types.
- **Errors** → `error-handling.md` — sentinel vs typed struct, `errors.Is/As`, `%w` wrapping, no panic in libraries, the `errorlint` ruleset.
- **Concurrency** → `concurrency.md` — `context.Context` discipline, `errgroup`, `sync.OnceValue`, `goleak`, `-race`, channel selection rules.
- **HTTP backend** → `backend-stack.md` — `gin` server skeleton, middleware ordering, SSE/streaming with `http.Flusher`, structured slog logging, graceful shutdown — distilled from the CLIProxyAPI codebase (a real proxy serving OpenAI/Gemini/Claude APIs).
- **RPC** → `grpc-connect.md` — when to pick Connect vs grpc-go, codegen pipeline, protovalidate, streaming.
- **DB** → `sqlc-pgx.md` — compile-time-safe SQL via sqlc + pgx connection pool + migrations via goose + testcontainers in CI.
- **CLI** → `cobra-stack.md` — cobra layout, slog integration, graceful shutdown on signals, fang-style colored help.
- **TUI** → `bubbletea-v2.md` — v2 model, `SetVirtualCursor(false)` + `tea.View{Cursor}` for CJK IME, why v1 was broken for Korean/Japanese/Chinese input.
- **Testing** → `testing.md` — table-driven tests, `require` vs `assert`, `autogold` snapshots, `gopter` property tests, `testcontainers` for integration, `goleak` for goroutine leaks.
- **Bootstrap** → `bootstrap.md` — `new-project.go` invocation, project layout (`cmd/`, `internal/`, `pkg/`), Taskfile, CI.
- **Strict config** → `golangci-strict.md` — the canonical `.golangci.yml` with the full linter whitelist and per-linter rationale.
- **One-liners** → `one-liners.md` — `go run` scripts with `//go:build ignore`, `gorun`-style invocation.

## Reviewable Go

Keep error checks near the operation whose failure they handle. Follow the project's Go doc-comment conventions for exported APIs; explain non-obvious contracts such as who closes a returned resource or channel, cancellation behavior and concurrency safety when relevant. Do not annotate each routine error check or hide it behind a helper solely to make the caller shorter.

## Existing codebases and module size

Preserve the selected framework, ORM/driver, formatter and test stack when editing an existing service. File length is a review signal, not an automatic refactor or permission gate. Split by responsibility only when needed for the requested change; consult [refactoring contracts](../refactoring.md) for that scoped structural work and [code-smell assessment and cleanup](../code-smells.md) when cleanup itself is requested.

## Activation

This skill activates whenever you write or modify any `.go` file, `go.mod`, `go.sum`, `.golangci.yml`, `Taskfile.yml`, or any of the codegen specs (`*.proto`, `*.sql` next to `sqlc.yaml`, `openapi.yaml` next to `oapi-codegen.yaml`). One-off scripts may use `//go:build ignore` + `go run`; use checks proportionate to their behavior.

Read the references relevant to the changed surface. Loading a recipe does not activate another architectural review workflow.
