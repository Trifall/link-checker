import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		exclude: ['src/e2e/**/*.test.ts'],
		include: ['src/**/*.test.ts'],
	},
});
