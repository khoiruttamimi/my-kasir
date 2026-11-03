# Tests

Unit tests live beside their source as `*.test.ts`. Use `*.test.tsx` when the test itself contains JSX.
Prioritize business rules and regression-prone behavior; not every source file needs a test.
Do not place test files in `src/app/`. Existing mocked route contract checks live in this directory.

Run all current tests from the repository root:

```sh
pnpm test
```

Run one file:

```sh
pnpm test --runTestsByPath src/server/services/product.service.test.ts
```

Run continuously during development with `pnpm test:watch`. Use `pnpm test --runInBand` for serial execution.

Tests use Jest with `next/jest` to transform TypeScript/TSX and resolve Next.js assets, plus the `@/` alias.
The configuration discovers `.test.ts` and `.test.tsx` files in `src/` and `tests/`, excluding `src/app/`.
Type-check test code with `pnpm exec tsc --noEmit`; the Jest transform alone does not type-check it.

The default environment is `node` for service and API contract tests. React component tests opt into
`jsdom` with a `/** @jest-environment jsdom */` docblock and use React Testing Library.
Import `@testing-library/jest-dom/jest-globals` in DOM test files for matchers such as `toBeInTheDocument()`.
`src/components/pagination-table/index.test.tsx` exercises a real component render and page selection.

`helpers/load-source.ts` transpiles real source and substitutes explicit dependencies, preserving
isolated service, repository, client, and form checks without a live database or Next authentication.
Its generic export type is a boundary for dynamically evaluated modules, not runtime validation of mocks.
The existing Product form harness simulates hooks and element trees; it does not render a real browser or Ant Design.
These checks do not prove live Neon constraints, transaction rollback/concurrency, real authentication,
or browser behavior. No migration, seed, or import is executed by this suite.
