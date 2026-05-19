import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runLinkCheck } from './run-link-check.js';

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories
			.splice(0)
			.map((directory) => rm(directory, { force: true, recursive: true })),
	);
});

describe('runLinkCheck', () => {
	it('checks unique URLs and reports errors and warnings', async () => {
		const cwd = await createTempDirectory();
		const server = createServer((request, response) => {
			if (request.url === '/redirect') {
				response.writeHead(302, { location: '/ok' }).end();
				return;
			}

			if (request.url === '/ok') {
				response.writeHead(200).end('ok');
				return;
			}

			if (request.url === '/forbidden') {
				response.writeHead(403).end('forbidden');
				return;
			}

			response.writeHead(404).end('missing');
		});

		await new Promise<void>((resolve) => {
			server.listen(0, '127.0.0.1', () => resolve());
		});

		const address = server.address();

		if (!address || typeof address === 'string') {
			throw new Error('Expected a TCP server address.');
		}

		const baseUrl = `http://127.0.0.1:${address.port}`;

		await writeFile(
			path.join(cwd, 'README.md'),
			[
				`[ok](${baseUrl}/ok)`,
				`[redirect](${baseUrl}/redirect)`,
				`[warn](${baseUrl}/forbidden)`,
				`[missing](${baseUrl}/missing)`,
				`[duplicate](${baseUrl}/ok)`,
			].join('\n'),
		);

		try {
			const result = await runLinkCheck({
				concurrency: 2,
				cwd,
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
			});

			expect(result.discoveredFileCount).toBe(1);
			expect(result.extractedLinkCount).toBe(5);
			expect(result.checkedCount).toBe(4);
			expect(result.brokenCount).toBe(1);
			expect(result.redirectedCount).toBe(1);
			expect(result.warningCount).toBe(1);
			expect(result.shouldFail).toBe(true);
			expect(result.domainStats).toEqual([
				{
					checkedCount: 4,
					domain: '127.0.0.1',
					errorCount: 1,
					okCount: 2,
					redirectCount: 1,
					warningCount: 1,
				},
			]);
			expect(result.checks.find((check) => check.url === `${baseUrl}/redirect`)?.finalUrl).toBe(
				`${baseUrl}/ok`,
			);
		} finally {
			await new Promise<void>((resolve, reject) => {
				server.close((error) => {
					if (error) {
						reject(error);
						return;
					}

					resolve();
				});
			});
		}
	});

	it('applies allowlist and denylist rules for domains and status codes', async () => {
		const cwd = await createTempDirectory();
		const server = createServer((request, response) => {
			if (request.url === '/warn') {
				response.writeHead(403).end('forbidden');
				return;
			}

			response.writeHead(404).end('missing');
		});

		const baseUrl = await startServer(server);

		await writeFile(
			path.join(cwd, 'README.md'),
			[`[warn](${baseUrl}/warn)`, `[missing](${baseUrl}/missing)`].join('\n'),
		);

		try {
			const allowlistedResult = await runLinkCheck({
				allowDomains: ['127.0.0.1'],
				allowStatusCodes: [403],
				cwd,
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
			});

			expect(allowlistedResult.brokenCount).toBe(0);
			expect(allowlistedResult.warningCount).toBe(1);
			expect(
				allowlistedResult.checks.find((check) => check.url === `${baseUrl}/warn`)?.status,
			).toBe('ok');

			const denylistedResult = await runLinkCheck({
				cwd,
				denyDomains: ['127.0.0.1'],
				denyStatusCodes: [403],
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
			});

			expect(denylistedResult.brokenCount).toBe(2);
			expect(denylistedResult.warningCount).toBe(0);

			const overlappingStatusResult = await runLinkCheck({
				allowStatusCodes: [404],
				cwd,
				denyStatusCodes: [404],
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
			});

			expect(
				overlappingStatusResult.checks.find((check) => check.url === `${baseUrl}/missing`)?.status,
			).toBe('error');

			const overlappingDomainResult = await runLinkCheck({
				allowDomains: ['127.0.0.1'],
				cwd,
				denyDomains: ['127.0.0.1'],
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
			});

			expect(
				overlappingDomainResult.checks.find((check) => check.url === `${baseUrl}/missing`)?.status,
			).toBe('error');

			const denyStatusWithAllowedDomainResult = await runLinkCheck({
				allowDomains: ['127.0.0.1'],
				cwd,
				denyStatusCodes: [404],
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
			});

			expect(
				denyStatusWithAllowedDomainResult.checks.find(
					(check) => check.url === `${baseUrl}/missing`,
				)?.status,
			).toBe('error');
		} finally {
			await stopServer(server);
		}
	});

	it('retries flaky hosts with backoff and keeps exhausted timeout failures as errors', async () => {
		const cwd = await createTempDirectory();
		let flakyCount = 0;
		const server = createServer((request, response) => {
			if (request.url === '/eventually-ok') {
				flakyCount += 1;

				if (flakyCount < 5) {
					response.writeHead(503).end('busy');
					return;
				}

				response.writeHead(200).end('ok');
				return;
			}

			if (request.url === '/timeout') {
				setTimeout(() => {
					response.writeHead(200).end('slow ok');
				}, 1_500);
				return;
			}

			response.writeHead(503).end('always busy');
		});

		const baseUrl = await startServer(server);

		await writeFile(
			path.join(cwd, 'README.md'),
			[
				`[eventually-ok](${baseUrl}/eventually-ok)`,
				`[always-flaky](${baseUrl}/always-flaky)`,
				`[timeout](${baseUrl}/timeout)`,
			].join('\n'),
		);

		try {
			const result = await runLinkCheck({
				cwd,
				paths: ['README.md'],
				retries: 2,
				retryBaseDelayMs: 0,
				retryMaxDelayMs: 0,
				timeoutSeconds: 1,
			});

			expect(result.brokenCount).toBe(1);
			expect(result.warningCount).toBe(1);
			expect(
				result.checks.find((check) => check.url === `${baseUrl}/eventually-ok`)?.attempts,
			).toBe(3);
			expect(result.checks.find((check) => check.url === `${baseUrl}/always-flaky`)?.status).toBe(
				'warning',
			);
			expect(result.checks.find((check) => check.url === `${baseUrl}/timeout`)?.status).toBe(
				'error',
			);

			const strictResult = await runLinkCheck({
				cwd,
				denyStatusCodes: [503],
				paths: ['README.md'],
				retries: 2,
				retryBaseDelayMs: 0,
				retryMaxDelayMs: 0,
				timeoutSeconds: 1,
			});

			expect(strictResult.brokenCount).toBe(2);
		} finally {
			await stopServer(server);
		}
	}, 10_000);

	it('writes a JSON report when outputJson is configured', async () => {
		const cwd = await createTempDirectory();
		const server = createServer((request, response) => {
			if (request.url === '/ok') {
				response.writeHead(200).end('ok');
				return;
			}

			response.writeHead(404).end('missing');
		});

		const baseUrl = await startServer(server);

		await writeFile(
			path.join(cwd, 'README.md'),
			[`[ok](${baseUrl}/ok)`, `[missing](${baseUrl}/missing)`].join('\n'),
		);

		try {
			const result = await runLinkCheck({
				cwd,
				outputJson: 'reports/link-report.json',
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
			});

			expect(result.reportPath).toBe(path.join(cwd, 'reports', 'link-report.json'));

			const report = JSON.parse(await readFile(result.reportPath!, 'utf8')) as {
				config?: { outputJson?: string };
				summary?: { brokenCount?: number; checkedCount?: number };
			};

			expect(report.config?.outputJson).toBe('reports/link-report.json');
			expect(report.summary?.checkedCount).toBe(2);
			expect(report.summary?.brokenCount).toBe(1);
		} finally {
			await stopServer(server);
		}
	});

	it('uses browser-like request headers with the configured user agent', async () => {
		const cwd = await createTempDirectory();
		let receivedAccept = '';
		let receivedAcceptLanguage = '';
		let receivedUserAgent = '';
		const server = createServer((request, response) => {
			receivedAccept = request.headers.accept ?? '';
			receivedAcceptLanguage = request.headers['accept-language'] ?? '';
			receivedUserAgent = request.headers['user-agent'] ?? '';
			response.writeHead(200).end('ok');
		});

		const baseUrl = await startServer(server);

		await writeFile(path.join(cwd, 'README.md'), `[ok](${baseUrl}/ok)`);

		try {
			await runLinkCheck({
				cwd,
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
				userAgent: 'link-checker-test-agent',
			});

			expect(receivedAccept).toContain('text/html');
			expect(receivedAccept).toContain('*/*');
			expect(receivedAcceptLanguage).toBe('en-US,en;q=0.9');
			expect(receivedUserAgent).toBe('link-checker-test-agent');
		} finally {
			await stopServer(server);
		}
	});

	it('respects concurrency limits while checking unique URLs', async () => {
		const cwd = await createTempDirectory();
		let activeRequests = 0;
		let maxActiveRequests = 0;
		const server = createServer(async (_request, response) => {
			activeRequests += 1;
			maxActiveRequests = Math.max(maxActiveRequests, activeRequests);

			await new Promise<void>((resolve) => setTimeout(resolve, 75));

			activeRequests -= 1;
			response.writeHead(200).end('ok');
		});

		const baseUrl = await startServer(server);

		await writeFile(
			path.join(cwd, 'README.md'),
			[
				`[one](${baseUrl}/one)`,
				`[two](${baseUrl}/two)`,
				`[three](${baseUrl}/three)`,
				`[four](${baseUrl}/four)`,
			].join('\n'),
		);

		try {
			const result = await runLinkCheck({
				concurrency: 2,
				cwd,
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 5,
			});

			expect(result.checkedCount).toBe(4);
			expect(maxActiveRequests).toBeGreaterThan(1);
			expect(maxActiveRequests).toBeLessThanOrEqual(2);
		} finally {
			await stopServer(server);
		}
	});

	it('uses timeoutSeconds to stop slow requests', async () => {
		const cwd = await createTempDirectory();
		const server = createServer(async (_request, response) => {
			await new Promise<void>((resolve) => setTimeout(resolve, 1_500));
			response.writeHead(200).end('slow ok');
		});

		const baseUrl = await startServer(server);

		await writeFile(path.join(cwd, 'README.md'), `[slow](${baseUrl}/slow)`);

		try {
			const result = await runLinkCheck({
				cwd,
				paths: ['README.md'],
				retries: 0,
				timeoutSeconds: 1,
			});

			expect(result.brokenCount).toBe(1);
			expect(result.warningCount).toBe(0);
			expect(result.checks[0]?.status).toBe('error');
			expect(result.checks[0]?.message).toContain('timed out');
		} finally {
			await stopServer(server);
		}
	});
});

async function startServer(server: ReturnType<typeof createServer>): Promise<string> {
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve());
	});

	const address = server.address();

	if (!address || typeof address === 'string') {
		throw new Error('Expected a TCP server address.');
	}

	return `http://127.0.0.1:${address.port}`;
}

async function stopServer(server: ReturnType<typeof createServer>): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}

			resolve();
		});
	});
}

async function createTempDirectory(): Promise<string> {
	const directory = await mkdtemp(path.join(tmpdir(), 'link-checker-'));

	temporaryDirectories.push(directory);

	return directory;
}
