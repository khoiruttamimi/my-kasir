# Coding agent guide

Read [.specify/memory/constitution.md](.specify/memory/constitution.md) for project principles
and governance. This file provides practical repository guidance; preserve the existing architecture.

## Structure and responsibilities

- `src/app/`: Next.js App Router pages/layouts and `api/**/route.ts` HTTP handlers.
  Pages compose feature containers; keep business logic out of route handlers.
- `src/features/`: auth and dashboard features. Each dashboard feature keeps its
  `container.tsx`, components, `api/*.api.ts` request functions, and `hooks/use-*.ts` together.
- `src/components/`: reusable UI, including `antd-wrapper`, `pagination-table`, and
  `dashboard-layout`. Reuse Ant Design and the theme in `src/app/layout.tsx`.
- `src/hooks/`, `src/providers/`: shared hooks and providers. Use `use-query-params.ts`
  for URL pagination/search and `query-provider.tsx` for the existing React Query setup.
- `src/models/`, `src/types/`, `src/utils/`: shared domain contracts, response types,
  formatting helpers, and the client `fetcher`/`ApiError` in `src/utils/api.ts`.
- `src/server/services/`: runtime validation and business rules; delegate persistence to
  `src/server/repositories/`. Preserve their `server-only` imports.
- `src/server/db/`: Drizzle schema and Neon connections. `index.ts` uses HTTP;
  `transaction.ts` supplies an operation-scoped WebSocket pool for interactive transactions.
- `drizzle/`: migrations and metadata; `scripts/`: guarded data tools; `docs/`: migration,
  import, and seed instructions; `tests/`: Node service tests.
  Retained `src/server/data/` JSON is not the runtime store for Product, User, or Transaction.

## Coding and reuse

- Use strict TypeScript, existing models/response types, and `@/*` imports for `src/*`.
  Validate untrusted input at runtime; narrow `unknown` instead of bypassing checks with `any`.
- Follow adjacent code: kebab-case files, `.service.ts`/`.repository.ts`/`.api.ts` suffixes,
  PascalCase components/types, and camelCase values. Keep local import/export patterns.
- Follow `.prettierrc`: two spaces, single quotes, semicolons, 120 columns, bracket spacing,
  and parentheses around arrow parameters. Explain any necessary localized lint suppression.
- Reuse shared UI/helpers before extracting new abstractions. Keep feature-only code local.
  Add explicit client boundaries where interactivity requires them.
- Put server-state requests in feature API modules and React Query hooks. Include request
  parameters in query keys and invalidate affected queries after mutations. Handle loading,
  errors, and pending mutations; preserve URL pagination/search behavior.

## API, persistence, and security

- Keep the flow: route → service → repository → Drizzle → Neon. Never import database code
  into client UI. Preserve endpoint-specific response envelopes, statuses, and serialization.
- Use `readJsonBody` and `apiResponse` from `src/server/utils/api.ts` and the shared `ApiError`
  for expected HTTP failures. Services validate payloads; repositories own queries.
- Protect API handlers with `withAuth` from `src/server/auth/with-auth.ts`. User management
  remains admin-only. UI role checks do not enforce authorization; do not infer new API role
  restrictions from disabled controls.
- Preserve `src/auth.ts` credentials/JWT behavior. Soft-deleted Users cannot log in again,
  but deletion does not revoke existing JWT sessions. Keep bcrypt hashing/comparison and
  password-free public projections (`UserResponse`). Never expose passwords, hashes, or secrets.
- Keep database URLs/secrets server-side and out of logs/source control. Use Drizzle expressions
  or bound SQL parameters; never interpolate untrusted values into SQL text.
- Preserve soft deletes, active-only reads, constraints, and historical snapshots. Transaction
  creation keeps locked Product snapshots, atomic header/items, server-calculated integer totals,
  session-derived cashier identity, and database-generated invoices. Do not add stock changes,
  taxes, discounts, or a User foreign key as incidental cleanup.
- Add reviewed migrations without rewriting applied migrations. Before data work, read
  `docs/transaction-database-migration.md`, `docs/user-database-migration.md`, and
  `docs/development-transaction-seed.md` as applicable. Migration, import, and seed execution
  are explicit database operations, separate from verification; retain existing guards.

## Commands and verification

Run from the repository root using pnpm (declared version: 10.2.1).

| Purpose | Command |
| --- | --- |
| Development server | `pnpm dev` |
| Lint | `pnpm lint` |
| Type check | `pnpm exec tsc --noEmit` |
| Service tests | `node --test tests/user-service.test.mjs tests/transaction-service.test.mjs` |
| Production build | `pnpm build` |
| Serve built application | `pnpm start` |

There is no package test script. The `.test.mjs` suites use `node:test`, TypeScript transpilation,
and mocked repositories; they do not verify live Neon, route authorization, or browser behavior.
Run relevant tests for changed service behavior and add focused regression cases. Use type/lint
checks for application changes and build for routing, bundling, server/client, or production-config
changes. Document database/manual checks and any verification limits separately. Report existing
failures rather than disabling checks. Documentation-only edits need consistency/scope checks.

## Scope of changes

Inspect affected code and documentation before editing. Make the smallest coherent change that
fulfills the request; preserve unrelated work, contracts, dependencies, and configuration. Avoid
unrelated formatting, architecture changes, speculative abstractions, or dependency additions.
Ask when an important architectural/security decision is unresolved. Summarize what changed,
what was checked, and any remaining limits; do not claim checks that were not run.
