# MyKasir Constitution

## Core Principles

### I. Architecture and Maintainability

Changes MUST follow the existing Next.js App Router application boundaries. Pages and layouts
compose feature containers. Client feature API modules and hooks manage requests. API route
handlers handle HTTP concerns and delegate business rules to services; services validate inputs
and delegate persistence to repositories. Database access MUST remain outside UI components and
client hooks. Services and repositories MUST retain their existing `server-only` boundaries.

Features MUST extend these responsibilities without introducing a parallel backend, mandatory
new layer, or replacement framework unless an explicit architectural decision justifies it.
Changes MUST stay scoped to the stated requirement; unrelated cleanup is separate work.
These boundaries keep business logic understandable and independently testable.

### II. Type Safety and Contracts

Application changes MUST preserve TypeScript strict mode and reuse existing domain models,
shared response types, and Drizzle inference where applicable. External payloads MUST be treated
as untrusted and validated at runtime before use. Type assertions do not validate JSON.
New code MUST narrow unknown values rather than bypass checks with unbounded `any` or blanket
suppressions. Localized type/lint suppressions MUST explain their specific reason.

Changes MUST preserve endpoint-specific response envelopes, HTTP statuses, pagination, public
field shapes, and serialization unless a contract change is explicitly specified and callers
are updated. Public User responses MUST exclude passwords and hashes. This prevents contract
drift without requiring a new validation library.

### III. Reuse and Consistent UI

UI changes MUST reuse existing Ant Design components, theme/providers, shared wrappers, and
pagination components where they meet the requirement. Feature-specific code MUST stay in its
feature folder; reusable components, hooks, models, and utilities MUST use existing shared
locations. Extraction MUST serve concrete reuse or a clear responsibility boundary rather than
speculative future needs.

Server-state requests MUST follow the feature API module and TanStack React Query hook pattern.
Query keys MUST include parameters affecting results; successful mutations MUST invalidate
affected cached queries. Paginated screens MUST preserve the existing URL query parameter
pattern. Interactive UI MUST handle relevant loading, failure, and mutation states, with explicit
client component boundaries where required. New dependencies MUST explain the concrete need and
why the existing tools do not suffice.

### IV. Security and Data Integrity

Protected API routes MUST enforce server authentication through the existing `withAuth` pattern.
User management MUST retain admin-only API authorization; UI checks MUST NOT substitute for it.
Changes to role policy on other endpoints MUST be specified explicitly rather than inferred from
hidden or disabled controls. Existing NextAuth credentials/JWT semantics MUST be preserved unless
authentication changes are explicitly approved. Soft deletion currently prevents new logins but
does not revoke issued sessions; this constitution does not introduce session revocation.

Passwords MUST remain bcrypt hashes in storage and MUST NOT appear in public responses or logs.
Secrets and database URLs MUST remain in server environment configuration, outside source control,
client bundles, and logs. Queries MUST use Drizzle expressions or bound parameters instead of
interpolating untrusted input into SQL text. Expected HTTP errors MUST use existing `ApiError`
and response helpers without exposing internal database details.

Persistence changes MUST preserve active-only reads, existing soft deletes, and database
constraints. Transaction creation MUST retain atomic header/item insertion, locked Product
snapshots, server-calculated integer amounts, session-derived cashier identity, and database-issued
unique invoices. Historical snapshots MUST remain independent of subsequent Product/User edits.
The text cashier ID and absence of a User foreign key MUST remain compatible with legacy history.
Stock mutation, discounts, and taxes MUST NOT be introduced as incidental refactoring.

Schema evolution MUST use reviewed new Drizzle migrations without rewriting applied migrations.
Seed/import operations MUST remain explicit, separate from runtime requests and migrations, and
retain their development guards. Historical imports MUST preserve original values and use explicit
ID mappings as documented in `docs/`.

### V. Behavioral Verification and Code Quality

Implementation changes MUST pass relevant existing type, lint, and behavior checks, or document
pre-existing failures with evidence and their impact. Changes to service business rules MUST
include focused regression coverage of affected success and failure behavior using the existing
Node test setup where applicable. Tests MUST verify observable behavior rather than mirror code.

Mocked service tests MUST NOT be presented as proof of real database constraints, rollback,
concurrency, route authorization, or browser behavior. Changes affecting these behaviors MUST
include appropriate integration or manual verification evidence, or explicitly record what could
not be verified and why. The baseline does not require a new testing framework, coverage target,
or mandatory test-first workflow. Relevant operational and contract documentation MUST accompany
behavior changes so maintainers can reproduce and assess them.

## Repository Baseline

This baseline comes from inspected code/configuration and `docs/`, rather than the generic
scaffold README. Versions describe initial adoption and permit deliberate, reviewed upgrades.

- Runtime/UI: Next.js 15.5.26 App Router, React/React DOM 19.1.0, strict TypeScript 5,
  Ant Design 5, icons, Next.js style registry, and React 19 compatibility patch.
- Client data/auth: TanStack React Query 5; NextAuth 5.0.0-beta.32 credentials authentication
  with 12-hour JWT sessions; bcryptjs 3 for password hashing/comparison.
- Persistence: Drizzle ORM 0.45, Drizzle Kit 0.31, Neon PostgreSQL. Ordinary queries use
  Neon HTTP; interactive transaction creation uses an operation-scoped WebSocket pool with
  cleanup in `finally`. Both use `DATABASE_URL`.
- Tools: pnpm 10.2.1 with `pnpm-lock.yaml`, Sass/SCSS modules, dotenv, tsx, ESLint 9,
  and Prettier 3.
- `src/app/`: routes, layouts, loading/not-found UI, global CSS, and API handlers.
  `src/auth.ts`, `src/middleware.ts`, and auth type augmentation support authentication/routing.
- `src/features/`: auth and dashboard Product/User/Transaction containers, components,
  feature API modules, and query/mutation hooks.
- `src/components/`, `src/hooks/`, `src/providers/`, `src/models/`, `src/types/`, and
  `src/utils/`: shared UI, hooks/providers, domain contracts, and utilities.
- `src/server/`: services, repositories, schema/connections, helpers, and retained JSON data.
  Product, User, and Transaction repositories now use PostgreSQL. Retained JSON files/helpers
  do not establish a requirement for runtime JSON persistence.
- `drizzle/`: SQL migrations and metadata. `scripts/`: guarded seed/import tools.
  `docs/`: migration, historical data, and seed instructions. `tests/`: service tests.
  `.specify/` and `.agents/`: specification workflow resources separate from application code.
- Conventions: kebab-case filenames; `.service.ts`, `.repository.ts`, and `.api.ts` suffixes;
  `use-*.ts` hooks; PascalCase components/types; camelCase values; `@/*` alias to `src/*`.
  Follow local import/export patterns without imposing a new ordering rule. Prettier uses
  two spaces, single quotes, semicolons, 120 columns, bracket spacing, and arrow parentheses.
- Testing: User and Transaction `.test.mjs` files use `node:test`, strict assertions,
  TypeScript transpilation, and mocked repositories. No package test script or configured
  browser/integration runner is present. Live Neon checks are documented separately.

## Development Workflow and Quality Gates

Before implementation, contributors MUST inspect the affected feature, service/repository
contracts, and relevant `docs/` guidance. Plans and reviews MUST identify intentional behavior
changes, migration needs, verification limits, and compliance with these principles.

Use the existing checks for application changes:

```sh
pnpm exec tsc --noEmit
pnpm lint
node --test tests/user-service.test.mjs tests/transaction-service.test.mjs
```

Run relevant service tests when their behavior or dependencies change. Run `pnpm build` for
changes affecting bundling, routing, server/client boundaries, or production configuration.
Review lint warnings instead of disabling rules globally: the current ESLint setup includes
Next.js and TypeScript rules and treats console usage and ordinary unused variables as warnings.
Formatting MUST follow the existing Prettier configuration.

For database changes, review generated SQL and follow documented test-database verification
before claiming database behavior is verified. Migration generation, application, and seed/import
execution are distinct actions; passing code checks MUST NOT be treated as permission to write
to a database. Documentation-only work requires consistency/scope checks rather than application
or database operations.

## Governance

This constitution governs new changes while preserving the inspected architecture. It does not
assert universal compliance of existing files or require unrelated cleanup. Relevant existing
deviations MUST be identified during review. Intentional new exceptions MUST document scope,
rationale, impact, and follow-up in the plan or review and receive project-maintainer acceptance.

Amendments MUST explain the problem, affected principles, compatibility impact, and any migration
or documentation work. Established architecture and security changes require an explicit decision.
If evidence cannot settle an important choice, the author MUST ask the project maintainer before
finalizing it. Initial adoption is dated below; subsequent amendments require maintainer acceptance.

Semantic versioning applies: MAJOR for incompatible governance changes or principle removals or
redefinitions; MINOR for new principles or materially expanded obligations; PATCH for clarifications
without changed obligations. Amendments MUST update the version and last-amended date, preserve
the original ratification date, and include a temporary Sync Impact Report for review. That report
MUST be removed before committing the reviewed amendment.

Specifications, plans, tasks, implementation reviews, and amendments MUST check the current
constitution. Conflicts MUST be resolved explicitly rather than silently changing behavior.
Dependent workflow templates MUST NOT be modified as part of constitution updates.

**Version**: 1.0.0 | **Ratified**: 2026-10-14 | **Last Amended**: 2026-10-14
