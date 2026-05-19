import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { runLinkCheck } from '../core/run-link-check.js';

const fixturePath = 'fixtures/example-test.md';
const validUrls = [
	'https://www.google.com/',
	'https://www.youtube.com/',
	'https://www.reddit.com/',
	'https://www.wikipedia.org/',
	'https://www.yahoo.com/',
];
const brokenUrls = [
	'http://httpbin.org/status/404',
	'http://httpbin.org/status/500',
	'https://www.google.com/404',
];
const expectedErrorStatusCodes = new Map([
	['http://httpbin.org/status/404', 404],
	['http://httpbin.org/status/500', 500],
	['https://www.google.com/404', 404],
]);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

describe('public link fixture', () => {
	it(
		'checks the committed Markdown fixture against public endpoints',
		async () => {
			const result = await runLinkCheck({
				concurrency: 4,
				cwd: repoRoot,
				denyStatusCodes: [500],
				paths: [fixturePath],
				retries: 0,
				timeoutSeconds: 15,
			});

			expect(result.discoveredFileCount).toBe(1);
			expect(result.extractedLinkCount).toBe(8);
			expect(result.checkedCount).toBe(8);
			expect(result.brokenCount).toBe(3);
			expect(result.warningCount).toBe(0);
			expect(result.shouldFail).toBe(true);

			expect(
				result
					.checks.filter((check) => check.status === 'ok')
					.map((check) => check.url)
					.sort(),
			).toEqual([...validUrls].sort());
			expect(
				result
					.checks.filter((check) => check.status === 'error')
					.map((check) => check.url)
					.sort(),
			).toEqual([...brokenUrls].sort());

			for (const url of validUrls) {
				expect(result.checks.find((check) => check.url === url)?.status).toBe('ok');
			}

			for (const url of brokenUrls) {
				const check = result.checks.find((entry) => entry.url === url);

				expect(check?.status).toBe('error');
				expect(check?.statusCode).toBe(expectedErrorStatusCodes.get(url));
			}
		},
		60_000,
	);
});
