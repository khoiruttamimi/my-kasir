import 'server-only';

import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

// Scope the pool to the operation so serverless invocations release every connection.
// eslint-disable-next-line no-unused-vars -- Parameter name documents the callback type.
export async function withTransactionDatabase<T>(operation: (database: ReturnType<typeof drizzle>) => Promise<T>) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! });
  try {
    return await operation(drizzle(pool));
  } finally {
    await pool.end();
  }
}
