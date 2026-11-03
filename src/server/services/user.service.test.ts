import assert from 'node:assert/strict';
import { expect, test } from '@jest/globals';
import { loadSource } from '../../../tests/helpers/load-source';
import bcrypt from 'bcryptjs';
import type { User, UserResponse } from '@/models/user';

const { ApiError } = loadSource<typeof import('@/utils/api')>('src/utils/api.ts');
const id = '11111111-1111-4111-8111-111111111111';
let stored: (Partial<User> & { deleted?: boolean }) | undefined;
let failure: unknown;
let query: unknown;
let imported: User[] = [];
const publicUser = (user: typeof stored): UserResponse | null => {
  if (!user) return null;
  assert.ok(user.id && user.name && user.email && user.role);
  return { id: user.id, name: user.name, email: user.email, role: user.role };
};
const repository = {
  findActiveUserByEmail: async (email: string) =>
    stored && !stored!.deleted && stored.email?.toLowerCase() === email.toLowerCase() ? stored : null,
  findUserById: async (userId: string) =>
    stored && !stored!.deleted && stored.id === userId.toLowerCase() ? publicUser(stored) : null,
  findUsers: async (params: { page: number; limit: number; search: string }) => {
    query = params;
    return { data: [publicUser(stored)], pagination: params };
  },
  insertUser: async (data: Omit<User, 'id'>) => {
    if (failure) throw failure;
    stored = { ...data, id };
    return publicUser(stored);
  },
  updateUserById: async (_id: string, data: Partial<User>) => {
    if (failure) throw failure;
    stored = { ...stored, ...data };
    return publicUser(stored);
  },
  softDeleteUserById: async () => {
    if (!stored || stored!.deleted) return null;
    stored!.deleted = true;
    return publicUser(stored);
  },
  insertUsersIntoEmptyTable: async (records: User[]) => {
    imported = records;
    return stored ? null : records.map(publicUser);
  },
};
const service = loadSource<typeof import('@/server/services/user.service')>('src/server/services/user.service.ts', {
  'server-only': {},
  '@/utils/api': { ApiError },
  '@/server/repositories/user.repository': repository,
});
const payload = {
  name: ' Cashier ',
  email: ' Cashier@Example.com ',
  password: 'correct-password',
  role: 'cashier' as const,
};

test('normalizes User data, hashes passwords, and does not return hashes', async () => {
  stored = undefined;
  const user = await service.createUser(payload);
  expect(user).toStrictEqual({ id, name: 'Cashier', email: 'cashier@example.com', role: 'cashier' });
  expect(stored!.password!).not.toBe(payload.password);
  expect(await bcrypt.compare(payload.password, stored!.password!)).toBe(true);
  expect('password' in user).toBe(false);
});

test('login is case-insensitive, rejects wrong passwords, and excludes deleted Users', async () => {
  stored = {
    id,
    name: 'Cashier',
    email: 'cashier@example.com',
    role: 'cashier',
    password: await bcrypt.hash(payload.password, 4),
  };
  expect((await service.login('CASHIER@EXAMPLE.COM', payload.password))?.id).toBe(id);
  expect('password' in (await service.login(stored.email!, payload.password))!).toBe(false);
  expect(await service.login(stored.email!, 'wrong')).toBe(null);
  await service.deleteUser(id);
  expect(stored!.deleted).toBe(true);
  expect(await service.login(stored.email!, payload.password)).toBe(null);
  expect(await service.getUserById(id)).toBe(null);
  expect(await service.deleteUser(id)).toBe(null);
});

test('partial updates preserve passwords unless supplied', async () => {
  stored = {
    id,
    name: 'Old',
    email: 'cashier@example.com',
    role: 'cashier',
    password: await bcrypt.hash('old-password', 4),
  };
  const oldHash = stored!.password!;
  await service.updateUser(id, { name: ' New ' });
  expect(stored!.name).toBe('New');
  expect(stored!.password!).toBe(oldHash);
  const result = await service.updateUser(id, { password: 'new-password' });
  expect(await bcrypt.compare('new-password', stored!.password!)).toBe(true);
  expect('password' in result!).toBe(false);
});

test('validates payloads and rejects invalid IDs without UUID database errors', async () => {
  for (const value of [
    null,
    [],
    {},
    { ...payload, role: 'owner' },
    { ...payload, extra: true },
    { ...payload, email: 'invalid' },
    { ...payload, password: 'a'.repeat(73) },
  ]) {
    await assert.rejects(
      service.createUser(value),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  }
  await assert.rejects(
    service.updateUser(id, {}),
    (error: unknown) => error instanceof ApiError && error.status === 400,
  );
  expect(await service.getUserById('1')).toBe(null);
  expect(await service.updateUser('invalid', { name: 'New' })).toBe(null);
  expect(await service.deleteUser('invalid')).toBe(null);
});

test('maps both prechecked and concurrent case-insensitive email conflicts to 409', async () => {
  stored = { ...payload, email: 'cashier@example.com', id };
  await assert.rejects(
    service.createUser(payload),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
  stored = undefined;
  failure = new Error('query failed', { cause: { code: '23505', constraint: 'users_active_email_unique' } });
  await assert.rejects(
    service.createUser(payload),
    (error: unknown) =>
      error instanceof ApiError && error.status === 409 && error.message === 'Email is already registered',
  );
  stored = { ...payload, id };
  await assert.rejects(
    service.updateUser(id, { name: 'New' }),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
  failure = new Error('unrelated database failure');
  stored = undefined;
  await assert.rejects(service.createUser(payload), /unrelated database failure/);
  failure = undefined;
});

test('validates pagination and delegates search and page to repository', async () => {
  for (const params of [{ page: 0 }, { limit: 0 }, { page: 1.5 }, { page: Number.MAX_SAFE_INTEGER, limit: 10 }]) {
    await assert.rejects(
      service.getUsers(params),
      (error: unknown) => error instanceof ApiError && error.status === 400,
    );
  }
  await service.getUsers({ page: 2, limit: 5, search: ' Name_% ' });
  expect(query).toStrictEqual({ page: 2, limit: 5, search: ' Name_% ' });
});

test('legacy import preserves hashes/UUIDs, maps old IDs, and refuses nonempty tables', async () => {
  stored = undefined;
  const hash = await bcrypt.hash('legacy-password', 4);
  const records = [
    { ...payload, id: '1', password: hash },
    { ...payload, id, email: 'second@example.com', password: hash },
  ];
  const result = await service.importLegacyUsers(records);
  expect(result.count).toBe(2);
  expect(result.mapping[1].newId).toBe(id);
  expect(result.mapping[0].newId).toMatch(/^[0-9a-f-]{36}$/);
  expect(imported[0].password).toBe(hash);
  expect(imported[1].password).toBe(hash);
  stored = { id };
  await assert.rejects(
    service.importLegacyUsers(records),
    (error: unknown) => error instanceof ApiError && error.status === 409,
  );
  await assert.rejects(service.importLegacyUsers([{ ...payload, id: '1' }]), /bcrypt hashes/);
  await assert.rejects(service.importLegacyUsers([records[0], records[0]]), /Duplicate/);
});
