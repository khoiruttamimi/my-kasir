/* eslint-disable no-console -- Standalone import reports progress without credentials. */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';

async function main() {
  if (
    process.env.NODE_ENV !== 'development' ||
    process.env.MYKASIR_ALLOW_DEV_IMPORT !== 'true' ||
    process.env.VERCEL_ENV === 'production' ||
    process.env.CONTEXT === 'production'
  ) {
    throw new Error(
      'Import blocked: set NODE_ENV=development and MYKASIR_ALLOW_DEV_IMPORT=true, using a development Neon database.',
    );
  }
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must point to the development database.');
  const source: unknown = JSON.parse(await readFile('src/server/data/users.json', 'utf8'));
  const { importLegacyUsers } = await import('../src/server/services/user.service');
  const result = await importLegacyUsers(source);
  console.log(`Imported ${result.count} Users atomically; existing bcrypt passwords were preserved.`);
  for (const { oldId, newId } of result.mapping) {
    console.log(`User ID mapping: ${oldId} → ${newId}`);
  }
  console.log('Sign out and sign in again to refresh session User IDs.');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'User import failed.');
  process.exitCode = 1;
});
