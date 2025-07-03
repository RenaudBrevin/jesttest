import { defineConfig } from 'eslint/config'
import globals from 'globals'
import js from '@eslint/js'

export default defineConfig([
  {
    name: 'app/files-to-lint',
    files: ['**/*.{js,mjs,jsx}'],
  },

  {
    ignores: [
      '**/dist/**',
      '**/dist-ssr/**',
      '**/coverage/**',
      '**/amplify/**',
      '**/node_modules/**'
    ]
  },

  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },

  {
    files: ['amplify/backend/function/**/src/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
      ecmaVersion: 2022,
      sourceType: 'commonjs'
    },
  },

  skipFormatting,
])