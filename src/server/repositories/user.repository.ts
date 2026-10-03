import 'server-only';

import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import type { User } from '@/models/user';
import { db } from '@/server/db';
import { users } from '@/server/db/schema';
import { withTransactionDatabase } from '@/server/db/transaction';

// Password hashes are selected only for authentication and internal mutations.
const responseColumns = { id: users.id, name: users.name, email: users.email, role: users.role };

export async function findUsers({ page, limit, search }: { page: number; limit: number; search: string }) {
  const term = search.trim().toLowerCase();
  const where = and(
    isNull(users.deletedAt),
    term
      ? or(sql`strpos(lower(${users.name}), ${term}) > 0`, sql`strpos(lower(${users.email}), ${term}) > 0`)
      : undefined,
  );
  const [data, [{ total }]] = await Promise.all([
    db
      .select(responseColumns)
      .from(users)
      .where(where)
      .orderBy(asc(users.createdAt), asc(users.id))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(where),
  ]);
  return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function findUserById(id: string) {
  const [user] = await db
    .select(responseColumns)
    .from(users)
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function findActiveUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(and(sql`lower(${users.email}) = ${email.toLowerCase()}`, isNull(users.deletedAt)))
    .limit(1);
  return user ?? null;
}

export async function insertUser(data: Omit<User, 'id'>) {
  const [user] = await db.insert(users).values(data).returning(responseColumns);
  return user;
}

export async function updateUserById(id: string, data: Partial<Omit<User, 'id'>>) {
  const [user] = await db
    .update(users)
    .set({ ...data, updatedAt: sql`now()` })
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning(responseColumns);
  return user ?? null;
}

export async function softDeleteUserById(id: string) {
  const [user] = await db
    .update(users)
    .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
    .where(and(eq(users.id, id), isNull(users.deletedAt)))
    .returning(responseColumns);
  return user ?? null;
}

export async function insertUsersIntoEmptyTable(data: User[]) {
  return withTransactionDatabase((database) =>
    database.transaction(async (tx) => {
      // Serialize bootstrap against other imports and User writes; never overwrite accounts.
      await tx.execute(sql`lock table ${users} in share row exclusive mode`);
      const [existing] = await tx.select({ id: users.id }).from(users).limit(1);
      if (existing) return null;
      const inserted = [];
      // Separate inserts preserve the source file's order for default list sorting.
      for (const user of data) {
        const [row] = await tx
          .insert(users)
          .values({
            ...user,
            createdAt: sql`clock_timestamp()`,
            updatedAt: sql`clock_timestamp()`,
          })
          .returning(responseColumns);
        inserted.push(row);
      }
      return inserted;
    }),
  );
}
