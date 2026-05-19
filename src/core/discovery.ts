import path from 'node:path';

import { globby } from 'globby';

import { getLogger } from './logger.js';
import type { DiscoveredFile, RunConfig } from './types.js';

const DEFAULT_EXCLUDES = [
	'**/.git/**',
	'**/.next/**',
	'**/.svelte-kit/**',
	'**/build/**',
	'**/coverage/**',
	'**/dist/**',
	'**/node_modules/**',
];

export async function discoverFiles(config: RunConfig): Promise<DiscoveredFile[]> {
	const logger = getLogger({ component: 'discovery' });

	logger.debug(
		{
			cwd: config.cwd,
			excludeCount: config.exclude.length,
			pathPatterns: config.paths,
			respectGitignore: config.respectGitignore,
		},
		'Discovering markdown files',
	);

	const matches = await globby(config.paths, {
		absolute: true,
		cwd: config.cwd,
		expandDirectories: false,
		gitignore: config.respectGitignore,
		ignore: [...DEFAULT_EXCLUDES, ...config.exclude],
		onlyFiles: true,
		unique: true,
	});

	const files = matches
		.map((absolutePath) => {
			const resolvedPath = path.resolve(absolutePath);

			return {
				absolutePath: resolvedPath,
				relativePath: toPortablePath(path.relative(config.cwd, resolvedPath)),
			};
		})
		.sort((left, right) => left.relativePath.localeCompare(right.relativePath));

	logger.debug({ discoveredFileCount: files.length }, 'Finished discovering markdown files');

	return files;
}

function toPortablePath(filePath: string): string {
	return filePath.split(path.sep).join('/');
}
