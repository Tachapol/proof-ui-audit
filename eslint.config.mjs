import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'test-results/**',
      'public/**',
      '.proofui-data/**',
      'artifacts/**',
    ],
  },
  {
    // Screenshots are runtime-generated audit evidence, not static optimizable
    // assets. next/image optimization does not apply to dynamic blob/file paths.
    rules: {
      '@next/next/no-img-element': 'off',
    },
  },
];

export default eslintConfig;
