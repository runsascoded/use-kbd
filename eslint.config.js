import config from '@rdub/eslint-config'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  ...config,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**'],
  },
  {
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-unused-vars': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportDeclaration[source.value=/\\.tsx?$/]',
          message: 'Do not include .ts/.tsx extension in imports',
        },
      ],
      'import/order': ['error', { 'newlines-between': 'ignore' }],
    }
  }
]
