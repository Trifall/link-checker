import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { normalizeConfig } from './config.js';
import { discoverFiles } from './discovery.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe('discoverFiles', () => {
	it('finds markdown files and respects excludes', async () => {
		const cwd = await createTempDirectory();

		await mkdir(path.join(cwd, 'docs'), { recursive: true });
		await mkdir(path.join(cwd, 'dist'), { recursive: true });
		await writeFile(path.join(cwd, 'README.md'), '# Root');
		await writeFile(path.join(cwd, 'docs', 'guide.mdx'), '# Guide');
		await writeFile(path.join(cwd, 'docs', 'notes.txt'), 'ignore me');
		await writeFile(path.join(cwd, 'dist', 'generated.md'), '# Generated');

		const files = await discoverFiles(
			normalizeConfig({
				cwd,
				exclude: ['docs/guide.mdx'],
			}),
		);

		expect(files.map((file) => file.relativePath)).toEqual(['README.md']);
	});

	it('respects .gitignore when enabled', async () => {
		const cwd = await createTempDirectory();

		await mkdir(path.join(cwd, 'docs'), { recursive: true });
		await writeFile(path.join(cwd, '.gitignore'), 'docs/ignored.md\n');
		await writeFile(path.join(cwd, 'docs', 'ignored.md'), '# Ignore');
		await writeFile(path.join(cwd, 'docs', 'kept.md'), '# Keep');

		const files = await discoverFiles(normalizeConfig({ cwd }));

		expect(files.map((file) => file.relativePath)).toEqual(['docs/kept.md']);
	});

	it('can ignore .gitignore rules when disabled', async () => {
		const cwd = await createTempDirectory();

		await mkdir(path.join(cwd, 'docs'), { recursive: true });
		await writeFile(path.join(cwd, '.gitignore'), 'docs/ignored.md\n');
		await writeFile(path.join(cwd, 'docs', 'ignored.md'), '# Ignore');

		const files = await discoverFiles(
			normalizeConfig({
				cwd,
				respectGitignore: false,
			}),
		);

		expect(files.map((file) => file.relativePath)).toEqual(['docs/ignored.md']);
	});

	it('uses custom path patterns to narrow discovery', async () => {
		const cwd = await createTempDirectory();

		await mkdir(path.join(cwd, 'docs'), { recursive: true });
		await mkdir(path.join(cwd, 'notes'), { recursive: true });
		await writeFile(path.join(cwd, 'docs', 'guide.md'), '# Guide');
		await writeFile(path.join(cwd, 'notes', 'draft.md'), '# Draft');

		const files = await discoverFiles(
			normalizeConfig({
				cwd,
				paths: ['docs/**/*.md'],
			}),
		);

		expect(files.map((file) => file.relativePath)).toEqual(['docs/guide.md']);
	});
});

async function createTempDirectory(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'link-checker-'));

	temporaryDirectories.push(directory);

	return directory;
}
