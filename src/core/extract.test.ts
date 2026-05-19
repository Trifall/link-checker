import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { normalizeConfig } from './config.js';
import { extractLinks } from './extract.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe('extractLinks', () => {
	it('extracts markdown links, references, and autolinks while skipping ignored URLs', async () => {
		const cwd = await createTempDirectory();
		const filePath = path.join(cwd, 'README.md');

		await writeFile(
			filePath,
			[
				'[inline](https://example.com)',
				'[reference][docs]',
				'[docs]: https://example.org/docs',
				'<https://example.net>',
				'https://github.com/trifall/link-checker',
				'[mail](mailto:test@example.com)',
				'[local](./guide.md)',
				'```md',
				'https://code-block.example.com',
				'```',
			].join('\n'),
		);

		const extracted = await extractLinks(
			[
				{
					absolutePath: filePath,
					relativePath: 'README.md',
				},
			],
			normalizeConfig({
				cwd,
				ignoreDomains: ['example.net'],
				ignoreUrlPatterns: ['https://github.com/*'],
			}),
		);

		expect(extracted.extractedLinkCount).toBe(2);
		expect(extracted.groupedLinks.map((group) => group.url)).toEqual([
			'https://example.com',
			'https://example.org/docs',
		]);
	});
});

async function createTempDirectory(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'link-checker-'));

	temporaryDirectories.push(directory);

	return directory;
}
