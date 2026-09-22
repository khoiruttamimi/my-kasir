import { ApiError } from '@/utils/api';
import bcrypt from 'bcryptjs';
import type { User, UserResponse } from '@/models/user';
import { readJson, writeJson } from '../utils/json-storage';

import { createMutationQueue } from '../utils/mutation-queue';
import { paginate } from '../utils/paginate';

const FILE_NAME = 'users';
const mutate = createMutationQueue();

async function getData() {
  return readJson<User[]>(FILE_NAME);
}

export const login = async (email: string, password: string) => {
  const users = await getData();
  const user = users.find((user) => user.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    return null;
  }

  const isValidPassword = await bcrypt.compare(password, user.password);

  if (!isValidPassword) {
    return null;
  }

  return user;
};

function toResponse(user: User): UserResponse {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

function validatePayload(payload: unknown, partial = false): Partial<Omit<User, 'id'>> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new ApiError('Request body must be an object', 400);
  }

  const body = payload as Record<string, unknown>;
  const result: Partial<Omit<User, 'id'>> = {};
  const fields = ['name', 'email', 'password', 'role'];
  if (Object.keys(body).some((key) => !fields.includes(key))) {
    throw new ApiError('Only name, email, password and role can be provided', 400);
  }

  for (const field of fields) {
    if (partial && !(field in body)) continue;
    const value = body[field];
    if (typeof value !== 'string' || !value.trim()) {
      throw new ApiError(`${field} is required and must be a non-empty string`, 400);
    }
    switch (field) {
      case 'name':
        result.name = value.trim();
        break;
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
          throw new ApiError('Email is invalid', 400);
        }
        result.email = value.trim().toLowerCase();
        break;
      case 'password':
        if (Buffer.byteLength(value, 'utf8') > 72) {
          throw new ApiError('Password must not exceed 72 bytes', 400);
        }
        result.password = value;
        break;
      case 'role':
        if (value !== 'admin' && value !== 'cashier') {
          throw new ApiError('Role must be admin or cashier', 400);
        }
        result.role = value;
        break;
    }
  }
  if (!Object.keys(result).length) {
    throw new ApiError('At least one user field is required', 400);
  }
  return result;
}

export interface GetUsersParams {
  page?: number;
  limit?: number;
  search?: string;
}

export async function getUsers({ page = 1, limit = 10, search = '' }: GetUsersParams = {}) {
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1) {
    throw new ApiError('Page and limit must be positive integers', 400);
  }
  const users = await getData();
  const query = search.trim().toLowerCase();
  const filtered = users.filter(
    (user) => user.name.toLowerCase().includes(query) || user.email.toLowerCase().includes(query),
  );
  return paginate(filtered.map(toResponse), { page, limit });
}

export async function getUserById(id: string) {
  const users = await getData();
  const user = users.find((user) => user.id === id);
  return user ? toResponse(user) : null;
}

export async function createUser(payload: unknown) {
  const data = validatePayload(payload) as Omit<User, 'id'>;
  return mutate(async () => {
    const users = await getData();
    if (users.some((user) => user.email.toLowerCase() === data.email)) {
      throw new ApiError('Email is already registered', 409);
    }
    const user: User = { ...data, id: crypto.randomUUID(), password: await bcrypt.hash(data.password, 10) };
    await writeJson(FILE_NAME, [...users, user]);
    return toResponse(user);
  });
}

export async function updateUser(id: string, payload: unknown) {
  const data = validatePayload(payload, true);
  return mutate(async () => {
    const users = await getData();
    const index = users.findIndex((user) => user.id === id);
    if (index === -1) return null;
    if (data.email && users.some((user) => user.id !== id && user.email.toLowerCase() === data.email)) {
      throw new ApiError('Email is already registered', 409);
    }
    if (data.password !== undefined) data.password = await bcrypt.hash(data.password, 10);
    users[index] = { ...users[index], ...data };
    await writeJson(FILE_NAME, users);
    return toResponse(users[index]);
  });
}

export async function deleteUser(id: string) {
  return mutate(async () => {
    const users = await getData();
    const user = users.find((user) => user.id === id);
    if (!user) return null;
    await writeJson(
      FILE_NAME,
      users.filter((user) => user.id !== id),
    );
    return toResponse(user);
  });
}
