import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import { defineConfig, globalIgnores } from 'eslint/config';

export default defineConfig([
	globalIgnores(['dist', 'src/generated']),
	{
		files: ['**/*.ts'],
		extends: [js.configs.recommended, tseslint.configs.recommended],
		languageOptions: {
			globals: globals.node,
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
			],
		},
	},
	{
		// Stripe SDK mock fixtures cast partial responses past the full type — tracked
		// in issue-tasks.md under "stripe", to be typed properly during the Stripe FE phase.
		files: ['**/*.test.ts'],
		rules: {
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
]);
