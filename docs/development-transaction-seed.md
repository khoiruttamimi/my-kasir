# Development Transaction seed

Apply and review the pending Transaction/invoice migrations first. Create at
least one active Product in the target Neon development database. The seed
uses the existing `DATABASE_URL` from the shell or `.env`; verify that it points
to a development database or Neon development branch, not production.

Run explicitly:

```sh
NODE_ENV=development MYKASIR_ALLOW_DEV_SEED=true pnpm db:seed
```

The command requires both settings, rejects production deployment markers
(`VERCEL_ENV=production` or `CONTEXT=production`), and refuses to run with a
missing `DATABASE_URL`. Environment guards cannot identify a production database
from an arbitrary connection URL; select your development database explicitly.
Do not store the opt-in flag in shared or production environment configuration.

The script adds 15 transactions using up to the first 100 active Products.
Each transaction selects 1–5 distinct Products (limited by availability), with
quantities of 1–3. It alternates cash and QRIS and uses the development cashier
`development-seed-cashier` / `Development Seed Cashier`.

Creation calls the existing Transaction service and repository. Active Product
checks, locked database snapshots, server totals/change, constraints, and atomic
Transaction/Transaction Item insertion remain the application's responsibility.
Invoices use the database default and sequence. No Product data is changed.

The initial Product prices only determine the tender amount: cash rounds up to
the next Rp10,000, QRIS pays exactly the estimated total. Avoid changing Product
prices or deleting Products while seeding. If a concurrent change makes the
payment invalid, the service safely rejects the transaction and the script stops.

Each run adds another 15 transactions; the command is intentionally not
idempotent and never deletes existing history. A failure reports how many
transactions already committed. Fix the cause before rerunning, which adds
new transactions instead of replacing the earlier ones. If there are no active
Products, the script stops with instructions to create Products first.

The Node `react-server` condition lets the standalone script import existing
`server-only` modules, and `tsx` runs TypeScript with the project's path aliases.
Neither changes production application behavior. Seed data is separate from
all Drizzle migration files.
