import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { normalizeConfig, resolveConfig } from './config.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe('resolveConfig', () => {
	it('loads the default config file from cwd', async () => {
		const cwd = await createTempDirectory();

		await writeFile(
			path.join(cwd, 'link-checker.config.json'),
			JSON.stringify({
				failOn: 'warning',
				outputDetail: 'detailed',
				paths: ['docs/**/*.md'],
				timeoutSeconds: 9,
			}),
		);

		const config = await resolveConfig({ cwd });

		expect(config.paths).toEqual(['docs/**/*.md']);
		expect(config.timeoutSeconds).toBe(9);
		expect(config.failOn).toBe('warning');
		expect(config.outputDetail).toBe('detailed');
		expect(config.configFile).toBe(path.join(cwd, 'link-checker.config.json'));
	});

	it('lets explicit inputs override config file values', async () => {
		const cwd = await createTempDirectory();

		await writeFile(
			path.join(cwd, 'link-checker.config.json'),
			JSON.stringify({
				concurrency: 3,
				paths: ['docs/**/*.md'],
				verbose: false,
			}),
		);

		const config = await resolveConfig({
			concurrency: 11,
			cwd,
			paths: ['README.md'],
			verbose: true,
		});

		expect(config.concurrency).toBe(11);
		expect(config.paths).toEqual(['README.md']);
		expect(config.verbose).toBe(true);
	});

	it('supports jsonc config files with comments and trailing commas', async () => {
		const cwd = await createTempDirectory();

		await writeFile(
			path.join(cwd, 'link-checker.config.jsonc'),
			[
				'{',
				'	// comment',
				'	"paths": ["docs/**/*.md",],',
				'	"ignoreDomains": ["example.com"],',
				'}',
			].join('\n'),
		);

		const config = await resolveConfig({ cwd });

		expect(config.paths).toEqual(['docs/**/*.md']);
		expect(config.ignoreDomains).toEqual(['example.com']);
		expect(config.configFile).toBe(path.join(cwd, 'link-checker.config.jsonc'));
	});

	it('resolves an explicit config file path and config-relative cwd', async () => {
		const cwd = await createTempDirectory();
		const configDirectory = path.join(cwd, 'config');

		await mkdir(configDirectory, { recursive: true });

		await writeFile(
			path.join(configDirectory, 'link-checker.config.json'),
			JSON.stringify({
				cwd: '../docs',
				mode: 'action',
				outputJson: 'reports/links.json',
				paths: ['guides/**/*.md'],
			}),
		);

		const config = await resolveConfig({
			configFile: path.join(configDirectory, 'link-checker.config.json'),
		});

		expect(config.configFile).toBe(path.join(configDirectory, 'link-checker.config.json'));
		expect(config.cwd).toBe(path.join(cwd, 'docs'));
		expect(config.mode).toBe('action');
		expect(config.outputJson).toBe('reports/links.json');
		expect(config.paths).toEqual(['guides/**/*.md']);
	});

	it('rejects unknown config keys with a helpful error', async () => {
		const cwd = await createTempDirectory();

		await writeFile(
			path.join(cwd, 'link-checker.config.json'),
			JSON.stringify({
				madeUpOption: true,
			}),
		);

		await expect(resolveConfig({ cwd })).rejects.toThrow(/Unknown config key\(s\)/);
	});

	it('rejects decimal numeric values in config files', async () => {
		const cwd = await createTempDirectory();

		await writeFile(
			path.join(cwd, 'link-checker.config.json'),
			JSON.stringify({
				concurrency: 1.9,
			}),
		);

		await expect(resolveConfig({ cwd })).rejects.toThrow(
			'Invalid config: concurrency must be a positive integer.',
		);
	});

	it('rejects non-bare domains in domain rule fields', () => {
		expect(() =>
			normalizeConfig({
				allowDomains: ['https://example.com'],
			}),
		).toThrow(/must contain bare domains/);
	});

	it('rejects invalid retry delay ranges', () => {
		expect(() =>
			normalizeConfig({
				retryBaseDelayMs: 500,
				retryMaxDelayMs: 100,
			}),
		).toThrow(/retryBaseDelayMs/);
	});
});

async function createTempDirectory(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'link-checker-'));

	temporaryDirectories.push(directory);

	return directory;
}
