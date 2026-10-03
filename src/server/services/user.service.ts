import 'server-only';
import { randomUUID } from 'node:crypto';

import { ApiError } from '@/utils/api';
import bcrypt from 'bcryptjs';
import type { User, UserResponse } from '@/models/user';
import {
  findActiveUserByEmail,
  findUserById,
  findUsers,
  insertUser,
  updateUserById,
  softDeleteUserById,
  insertUsersIntoEmptyTable,
} from '@/server/repositories/user.repository';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const login = async (email: string, password: string): Promise<UserResponse | null> => {
  const user = await findActiveUserByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password))) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
};

// Drizzle wraps driver errors in `cause`. Translate only the email index conflict.
async function withEmailConflict<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    let current: unknown = error;
    const seen = new Set<unknown>();
    while (current && typeof current === 'object' && !seen.has(current)) {
      seen.add(current);
      const details = current as { code?: string; constraint?: string; cause?: unknown };
      if (details.code === '23505' && details.constraint === 'users_active_email_unique') {
        throw new ApiError('Email is already registered', 409);
      }
      current = details.cause;
    }
    throw error;
  }
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
  if (
    !Number.isSafeInteger(page) ||
    page < 1 ||
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    !Number.isSafeInteger((page - 1) * limit)
  ) {
    throw new ApiError('Page and limit must be positive integers', 400);
  }
  return findUsers({ page, limit, search });
}

export async function getUserById(id: string) {
  if (!UUID_PATTERN.test(id)) return null;
  return findUserById(id);
}

export async function createUser(payload: unknown) {
  const data = validatePayload(payload) as Omit<User, 'id'>;
  if (await findActiveUserByEmail(data.email)) throw new ApiError('Email is already registered', 409);
  data.password = await bcrypt.hash(data.password, 10);
  return withEmailConflict(() => insertUser(data));
}

export async function updateUser(id: string, payload: unknown) {
  const data = validatePayload(payload, true);
  if (!UUID_PATTERN.test(id) || !(await findUserById(id))) return null;
  if (data.email) {
    const existing = await findActiveUserByEmail(data.email);
    if (existing && existing.id.toLowerCase() !== id.toLowerCase()) {
      throw new ApiError('Email is already registered', 409);
    }
  }
  if (data.password !== undefined) data.password = await bcrypt.hash(data.password, 10);
  return withEmailConflict(() => updateUserById(id, data));
}

export async function deleteUser(id: string) {
  if (!UUID_PATTERN.test(id)) return null;
  return softDeleteUserById(id);
}

// Explicit bootstrap tool only: preserve bcrypt hashes rather than hashing them again.
export async function importLegacyUsers(payload: unknown) {
  if (!Array.isArray(payload) || !payload.length) throw new ApiError('Legacy users must be a non-empty array', 400);
  const emails = new Set<string>();
  const ids = new Set<string>();
  const mapping: { oldId: string; newId: string }[] = [];
  const records = payload.map((entry: unknown) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new ApiError('Invalid legacy User', 400);
    const source = entry as Record<string, unknown>;
    if (typeof source.id !== 'string' || !source.id) throw new ApiError('Legacy User ID is required', 400);
    const data = validatePayload({
      name: source.name,
      email: source.email,
      password: source.password,
      role: source.role,
    }) as Omit<User, 'id'>;
    if (!/^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$/.test(data.password)) {
      throw new ApiError('Legacy passwords must already be valid bcrypt hashes', 400);
    }
    const id = UUID_PATTERN.test(source.id) ? source.id.toLowerCase() : randomUUID();
    if (emails.has(data.email) || ids.has(source.id.toLowerCase()))
      throw new ApiError('Duplicate legacy User ID or email', 400);
    emails.add(data.email);
    ids.add(source.id.toLowerCase());
    mapping.push({ oldId: source.id, newId: id });
    return { ...data, id };
  });
  const imported = await withEmailConflict(() => insertUsersIntoEmptyTable(records));
  if (!imported)
    throw new ApiError('User import refused: users table must be empty, including soft-deleted accounts', 409);
  return { count: imported.length, mapping };
}
