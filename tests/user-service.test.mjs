import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import ts from 'typescript';
import bcrypt from 'bcryptjs';

const loadDependency = createRequire(import.meta.url);
function loadSource(file, dependencies = {}) {
  const loaded = new Module(path.resolve(file));
  loaded.require = (name) => (name in dependencies ? dependencies[name] : loadDependency(name));
  loaded._compile(
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText,
    path.resolve(file),
  );
  return loaded.exports;
}
const { ApiError } = loadSource('src/utils/api.ts');
const id = '11111111-1111-4111-8111-111111111111';
let stored;
let failure;
let query;
let imported;
const publicUser = (user) => (user ? { id: user.id, name: user.name, email: user.email, role: user.role } : null);
const repository = {
  findActiveUserByEmail: async (email) =>
    stored && !stored.deleted && stored.email.toLowerCase() === email.toLowerCase() ? stored : null,
  findUserById: async (userId) =>
    stored && !stored.deleted && stored.id === userId.toLowerCase() ? publicUser(stored) : null,
  findUsers: async (params) => {
    query = params;
    return { data: [publicUser(stored)], pagination: params };
  },
  insertUser: async (data) => {
    if (failure) throw failure;
    stored = { ...data, id };
    return publicUser(stored);
  },
  updateUserById: async (_id, data) => {
    if (failure) throw failure;
    stored = { ...stored, ...data };
    return publicUser(stored);
  },
  softDeleteUserById: async () => {
    if (!stored || stored.deleted) return null;
    stored.deleted = true;
    return publicUser(stored);
  },
  insertUsersIntoEmptyTable: async (records) => {
    imported = records;
    return stored ? null : records.map(publicUser);
  },
};
const service = loadSource('src/server/services/user.service.ts', {
  'server-only': {},
  '@/utils/api': { ApiError },
  '@/server/repositories/user.repository': repository,
});
const payload = { name: ' Cashier ', email: ' Cashier@Example.com ', password: 'correct-password', role: 'cashier' };

test('normalizes User data, hashes passwords, and does not return hashes', async () => {
  stored = undefined;
  const user = await service.createUser(payload);
  assert.deepEqual(user, { id, name: 'Cashier', email: 'cashier@example.com', role: 'cashier' });
  assert.notEqual(stored.password, payload.password);
  assert.equal(await bcrypt.compare(payload.password, stored.password), true);
  assert.equal('password' in user, false);
});

test('login is case-insensitive, rejects wrong passwords, and excludes deleted Users', async () => {
  stored = {
    id,
    name: 'Cashier',
    email: 'cashier@example.com',
    role: 'cashier',
    password: await bcrypt.hash(payload.password, 4),
  };
  assert.equal((await service.login('CASHIER@EXAMPLE.COM', payload.password)).id, id);
  assert.equal('password' in (await service.login(stored.email, payload.password)), false);
  assert.equal(await service.login(stored.email, 'wrong'), null);
  await service.deleteUser(id);
  assert.equal(stored.deleted, true);
  assert.equal(await service.login(stored.email, payload.password), null);
  assert.equal(await service.getUserById(id), null);
  assert.equal(await service.deleteUser(id), null);
});

test('partial updates preserve passwords unless supplied', async () => {
  stored = {
    id,
    name: 'Old',
    email: 'cashier@example.com',
    role: 'cashier',
    password: await bcrypt.hash('old-password', 4),
  };
  const oldHash = stored.password;
  await service.updateUser(id, { name: ' New ' });
  assert.equal(stored.name, 'New');
  assert.equal(stored.password, oldHash);
  const result = await service.updateUser(id, { password: 'new-password' });
  assert.equal(await bcrypt.compare('new-password', stored.password), true);
  assert.equal('password' in result, false);
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
    await assert.rejects(service.createUser(value), (error) => error.status === 400);
  }
  await assert.rejects(service.updateUser(id, {}), (error) => error.status === 400);
  assert.equal(await service.getUserById('1'), null);
  assert.equal(await service.updateUser('invalid', { name: 'New' }), null);
  assert.equal(await service.deleteUser('invalid'), null);
});

test('maps both prechecked and concurrent case-insensitive email conflicts to 409', async () => {
  stored = { ...payload, email: 'cashier@example.com', id };
  await assert.rejects(service.createUser(payload), (error) => error.status === 409);
  stored = undefined;
  failure = new Error('query failed', { cause: { code: '23505', constraint: 'users_active_email_unique' } });
  await assert.rejects(
    service.createUser(payload),
    (error) => error.status === 409 && error.message === 'Email is already registered',
  );
  stored = { ...payload, id };
  await assert.rejects(service.updateUser(id, { name: 'New' }), (error) => error.status === 409);
  failure = new Error('unrelated database failure');
  stored = undefined;
  await assert.rejects(service.createUser(payload), /unrelated database failure/);
  failure = undefined;
});

test('validates pagination and delegates search and page to repository', async () => {
  for (const params of [{ page: 0 }, { limit: 0 }, { page: 1.5 }, { page: Number.MAX_SAFE_INTEGER, limit: 10 }]) {
    await assert.rejects(service.getUsers(params), (error) => error.status === 400);
  }
  await service.getUsers({ page: 2, limit: 5, search: ' Name_% ' });
  assert.deepEqual(query, { page: 2, limit: 5, search: ' Name_% ' });
});

test('legacy import preserves hashes/UUIDs, maps old IDs, and refuses nonempty tables', async () => {
  stored = undefined;
  const hash = await bcrypt.hash('legacy-password', 4);
  const records = [
    { ...payload, id: '1', password: hash },
    { ...payload, id, email: 'second@example.com', password: hash },
  ];
  const result = await service.importLegacyUsers(records);
  assert.equal(result.count, 2);
  assert.equal(result.mapping[1].newId, id);
  assert.match(result.mapping[0].newId, /^[0-9a-f-]{36}$/);
  assert.equal(imported[0].password, hash);
  assert.equal(imported[1].password, hash);
  stored = { id };
  await assert.rejects(service.importLegacyUsers(records), (error) => error.status === 409);
  await assert.rejects(service.importLegacyUsers([{ ...payload, id: '1' }]), /bcrypt hashes/);
  await assert.rejects(service.importLegacyUsers([records[0], records[0]]), /Duplicate/);
});
