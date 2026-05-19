import { defineConfig } from 'tsdown';

export default defineConfig({
	clean: true,
	deps: {
		alwaysBundle: [/.*/],
		onlyBundle: [/.*/],
	},
	dts: true,
	entry: {
		action: 'src/action.ts',
		cli: 'src/cli.ts',
		index: 'src/index.ts',
	},
	format: ['esm'],
	outDir: 'dist',
	platform: 'node',
	shims: true,
	sourcemap: true,
	target: 'node24',
});
