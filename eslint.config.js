import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        Bun: 'readonly',
        require: 'readonly',
        RequestInfo: 'readonly',
        RequestInit: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        setTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript-specific rules
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-var-requires': 'error',
      
      // General rules
      'no-console': 'off', // Allow console.log for our library's verbose output
      'no-unused-vars': 'off', // Use TypeScript version instead
      'prefer-const': 'off', // Use TypeScript version instead
      'no-var': 'error',
      'prefer-arrow-callback': 'error',
      'prefer-template': 'error',
      'object-shorthand': 'error',
      
      // Code style
      'indent': ['error', 2],
      'quotes': ['error', 'single'],
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'max-len': ['warn', { code: 120 }],
      
      // Best practices
      'eqeqeq': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
    },
  },
  {
    files: ['__tests__/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Headers: 'readonly',
        URL: 'readonly',
        Bun: 'readonly',
        require: 'readonly',
        RequestInfo: 'readonly',
        RequestInit: 'readonly',
        FormData: 'readonly',
        File: 'readonly',
        setTimeout: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      // TypeScript-specific rules - relaxed for tests
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in tests
      '@typescript-eslint/explicit-function-return-type': 'off', // Don't require return types in tests
      '@typescript-eslint/no-non-null-assertion': 'off', // Allow non-null assertions in tests
      '@typescript-eslint/no-var-requires': 'off', // Allow require in tests
      
      // General rules - relaxed for tests
      'no-console': 'off',
      'no-unused-vars': 'off',
      'prefer-const': 'off',
      'no-var': 'error',
      'prefer-arrow-callback': 'off', // Allow regular functions in tests
      'prefer-template': 'off', // Allow string concatenation in tests
      'object-shorthand': 'off', // Allow verbose object syntax in tests
      
      // Code style - relaxed for tests
      'indent': ['error', 2],
      'quotes': 'off', // Allow both single and double quotes in tests
      'semi': ['error', 'always'],
      'comma-dangle': ['error', 'never'],
      'max-len': 'off', // Allow long lines in tests
      
      // Best practices
      'eqeqeq': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-wrappers': 'error',
      'no-throw-literal': 'error',
    },
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      'apirecordings/',
      'coverage/',
      '*.js',
      '*.d.ts',
    ],
  },
];