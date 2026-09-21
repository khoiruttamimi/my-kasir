import bcrypt from 'bcryptjs';
import type { User } from '@/models/user';
import { readJson } from '../utils/json-storage';

const FILE_NAME = 'users';

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
