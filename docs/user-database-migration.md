# User database migration

User now follows API → Service → Repository → Drizzle → Neon using the existing
HTTP database connection. Payload validation and bcrypt hashing/comparison stay
in the service. Passwords are never included in API or login service responses.
The public model and all frontend response shapes are unchanged, including
`{ data: user }` for updates and the existing pagination envelope.

Review `drizzle/0005_modern_lilandra.sql`, then apply pending migrations yourself:

```sh
pnpm db:migrate
```

The `users` table has generated UUID IDs, name, email, bcrypt password hash, role,
and database-generated snake_case timestamps. The active-email unique index is
case-insensitive and enforces uniqueness across concurrent requests. Conflicts
return the existing HTTP 409 message. Soft deletion frees the email for reuse,
matching the former behavior after hard deletion. Active-only queries exclude
deleted accounts from lists, details, updates, and new logins.

Search keeps literal, trimmed, case-insensitive substring matching of name or
email. PostgreSQL handles count, limit, and offset. Lists sort by creation time
ascending to retain the former insertion order, with ID as a stable tie-breaker.

## Import existing accounts before switching traffic

The migration creates an empty table. Application User/login code no longer
reads or writes `src/server/data/users.json`; it remains an import source.
For a development database, run the separate, guarded command:

```sh
NODE_ENV=development MYKASIR_ALLOW_DEV_IMPORT=true pnpm db:import:users
```

Verify `DATABASE_URL` points to a development Neon branch first. The importer
rejects production environment markers and requires explicit opt-in. It refuses
any non-empty users table, including soft-deleted records; never overwrites or
merges existing accounts. It validates source data, imports all accounts
atomically, preserves valid existing UUIDs and bcrypt hashes, and generates new
UUIDs for legacy IDs such as `1`. Existing plaintext passwords therefore continue
to work. The command prints only ID mappings, never emails/password hashes.
No import was run during implementation.

Back up the JSON and record printed ID mappings. Sign out and sign in again to
refresh session IDs. Production import should be a separately reviewed data
operation preserving these hashes and applying explicit ID mappings; do not
bypass the development command's guard.

Transaction's `user_id` remains text and `user_name` remains a historical
snapshot. No User foreign key was added because historical and seeded cashier
IDs may not correspond to real User UUIDs. Deleting or renaming Users does not
change old transactions. Product and Category are unchanged.

Existing JWT sessions retain their current expiry/authorization behavior; soft
deleting a User prevents new login but does not automatically revoke issued
sessions. This migration does not change NextAuth session semantics.

## Verify

```sh
pnpm exec tsc --noEmit
pnpm lint
node --test tests/user-service.test.mjs tests/transaction-service.test.mjs
```

After applying to a test database and importing accounts, verify login, User
CRUD, duplicate emails (including concurrent requests), pagination/search, and
soft-delete behavior. SQL and import were not executed against Neon automatically.
