import assert from 'node:assert/strict';
import { expect, test } from '@jest/globals';
import { NextRequest } from 'next/server';
import type { User, UserResponse } from '@/models/user';
import { loadSource } from './helpers/load-source';
import { ApiError, jsonRequest, routeFixture } from './helpers/route-fixture';

const id = '11111111-1111-4111-8111-111111111111';
const url = 'http://localhost/api/users';
const payload = { name: ' Cashier ', email: ' Cashier@Example.com ', password: 'correct-password', role: 'cashier' };

function setup() {
  const auth = routeFixture();
  let stored: UserResponse | null = null;
  let calls = 0;
  const repository = {
    findActiveUserByEmail: async (email: string) => (stored?.email === email ? stored : null),
    findUsers: async (params: { page: number; limit: number; search: string }) => {
      calls++;
      return { data: stored ? [stored] : [], pagination: params };
    },
    insertUser: async ({ password, ...user }: Omit<User, 'id'>) => {
      calls++;
      expect(password).toMatch(/^\$2/);
      stored = { ...user, id };
      return stored;
    },
    findUserById: async () => stored,
    updateUserById: async (_id: string, data: Partial<User>) => {
      calls++;
      assert.ok(stored);
      stored = { ...stored, name: data.name ?? stored.name };
      return stored;
    },
    softDeleteUserById: async () => {
      calls++;
      const previous = stored;
      stored = null;
      return previous;
    },
  };
  const service = loadSource<typeof import('@/server/services/user.service')>('src/server/services/user.service.ts', {
    'server-only': {},
    '@/utils/api': { ApiError },
    '@/server/repositories/user.repository': repository,
  });
  const dependencies = { ...auth.dependencies, '@/server/services/user.service': service };
  return {
    auth,
    collection: loadSource<typeof import('@/app/api/users/route')>('src/app/api/users/route.ts', dependencies),
    item: loadSource<typeof import('@/app/api/users/[id]/route')>('src/app/api/users/[id]/route.ts', dependencies),
    get calls() {
      return calls;
    },
  };
}

test('all User endpoints reject anonymous and cashier sessions before repository access', async () => {
  for (const role of ['anonymous', 'cashier'] as const) {
    const h = setup();
    if (role === 'anonymous') h.auth.signOut();
    else h.auth.setRole(role);
    const context = { params: Promise.resolve({ id }) };
    const responses = await Promise.all([
      h.collection.GET(new NextRequest(url), undefined),
      h.collection.POST(jsonRequest(url, 'POST', payload), undefined),
      h.item.GET(new NextRequest(url), context),
      h.item.PUT(jsonRequest(url, 'PUT', { name: 'Changed' }), context),
      h.item.PATCH(jsonRequest(url, 'PATCH', { name: 'Changed' }), context),
      h.item.DELETE(new NextRequest(url), context),
    ]);
    for (const response of responses) {
      expect(response.status).toBe(role === 'anonymous' ? 401 : 403);
      expect(await response.json()).toStrictEqual({ message: role === 'anonymous' ? 'Unauthorized' : 'Forbidden' });
    }
    expect(h.calls).toBe(0);
  }
});

test('User routes preserve public projections, list parameters, update envelopes, and deleted-user 404s', async () => {
  const h = setup();
  const created = await h.collection.POST(jsonRequest(url, 'POST', payload), undefined);
  expect(created.status).toBe(201);
  const user = { id, name: 'Cashier', email: 'cashier@example.com', role: 'cashier' };
  expect(await created.json()).toStrictEqual(user);
  const list = await h.collection.GET(new NextRequest(url + '?page=2&limit=5&search=Cashier'), undefined);
  expect(list.status).toBe(200);
  expect(await list.json()).toStrictEqual({ data: [user], pagination: { page: 2, limit: 5, search: 'Cashier' } });
  const context = { params: Promise.resolve({ id }) };
  const detail = await h.item.GET(new NextRequest(url), context);
  expect(detail.status).toBe(200);
  expect(await detail.json()).toStrictEqual(user);
  for (const method of ['PUT', 'PATCH'] as const) {
    const updated = await h.item[method](jsonRequest(url, method, { name: method }), context);
    expect(updated.status).toBe(200);
    expect(await updated.json()).toStrictEqual({ data: { ...user, name: method } });
  }
  const deleted = await h.item.DELETE(new NextRequest(url), context);
  expect(deleted.status).toBe(200);
  expect(await deleted.json()).toStrictEqual({ ...user, name: 'PATCH' });
  for (const response of [
    await h.item.GET(new NextRequest(url), context),
    await h.item.PUT(jsonRequest(url, 'PUT', { name: 'Missing' }), context),
    await h.item.DELETE(new NextRequest(url), context),
  ]) {
    expect(response.status).toBe(404);
    expect(await response.json()).toStrictEqual({ message: 'User not found' });
  }
});

test('User routes translate malformed JSON, validation, pagination and email conflict errors', async () => {
  const h = setup();
  const malformed = await h.collection.POST(new NextRequest(url, { method: 'POST', body: '{' }), undefined);
  expect(malformed.status).toBe(400);
  expect(await malformed.json()).toStrictEqual({ message: 'Request body must be valid JSON' });
  const invalid = await h.collection.POST(jsonRequest(url, 'POST', { ...payload, role: 'owner' }), undefined);
  expect(invalid.status).toBe(400);
  expect(await invalid.json()).toStrictEqual({ message: 'Role must be admin or cashier' });
  const pagination = await h.collection.GET(new NextRequest(url + '?page=0'), undefined);
  expect(pagination.status).toBe(400);
  expect(h.calls).toBe(0);
  await h.collection.POST(jsonRequest(url, 'POST', payload), undefined);
  const duplicate = await h.collection.POST(jsonRequest(url, 'POST', payload), undefined);
  expect(duplicate.status).toBe(409);
  expect(await duplicate.json()).toStrictEqual({ message: 'Email is already registered' });
  expect(h.calls).toBe(1);
});
