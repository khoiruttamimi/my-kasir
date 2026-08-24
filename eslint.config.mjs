import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';
import prettierConfig from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...tseslint.configs.recommended, // aturan TypeScript
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: ['node_modules/**', '.next/**', 'out/**', 'build/**', 'next-env.d.ts'],
  },
  {
    rules: {
      ...prettierConfig.rules, // matikan rules ESLint yang bentrok sama Prettier
      'no-unused-vars': 'warn', // kasih warning, bukan error
      'no-console': 'warn', // biar gak ada console.log nyasar di production
    },
  },
];

export default eslintConfig;
