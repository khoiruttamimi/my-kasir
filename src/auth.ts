import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { login } from './server/services/user.service';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: 'jwt',
    maxAge: 60 * 60 * 12, //12 jam
  },
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },

      async authorize(credentials) {
        const email = credentials.email;
        const password = credentials.password;

        if (typeof email !== 'string' || typeof password !== 'string') {
          return null;
        }

        const user = await login(email, password);

        if (!user) {
          return null;
        }

        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }

      return token;
    },

    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;

      return session;
    },
  },
});
