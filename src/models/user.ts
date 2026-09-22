export type UserRole = 'admin' | 'cashier';

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: UserRole;
};

export type UserResponse = Omit<User, 'password'>;
