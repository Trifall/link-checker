import { describe, expect, it } from 'vitest';

import { buildDomainStats, buildMarkdownSummary, formatCheck, shouldFailRun } from './report.js';
import type { RunResult } from './types.js';

describe('buildDomainStats', () => {
	it('groups checks by final domain and counts redirects', () => {
		const stats = buildDomainStats([
			{
				attempts: 1,
				message: 'HEAD returned 200',
				occurrences: [{ column: 1, filePath: 'README.md', line: 1, url: 'https://example.com' }],
				redirected: false,
				status: 'ok',
				statusCode: 200,
				url: 'https://example.com',
			},
			{
				attempts: 1,
				finalUrl: 'https://docs.example.com/page',
				message: 'HEAD returned 429 after redirect to https://docs.example.com/page',
				occurrences: [
					{ column: 1, filePath: 'README.md', line: 2, url: 'https://redirect.example.com' },
				],
				redirected: true,
				status: 'warning',
				statusCode: 429,
				url: 'https://redirect.example.com',
			},
		]);

		expect(stats).toEqual([
			{
				checkedCount: 1,
				domain: 'docs.example.com',
				errorCount: 0,
				okCount: 0,
				redirectCount: 1,
				warningCount: 1,
			},
			{
				checkedCount: 1,
				domain: 'example.com',
				errorCount: 0,
				okCount: 1,
				redirectCount: 0,
				warningCount: 0,
			},
		]);
	});
});

describe('formatCheck', () => {
	it('includes redirect targets when present', () => {
		const output = formatCheck({
			attempts: 1,
			finalUrl: 'https://example.com/final',
			message: 'HEAD returned 301 after redirect to https://example.com/final',
			method: 'HEAD',
			occurrences: [
				{ column: 2, filePath: 'README.md', line: 7, url: 'https://example.com/start' },
			],
			redirected: true,
			status: 'warning',
			statusCode: 301,
			url: 'https://example.com/start',
		});

		expect(output).toContain('-> https://example.com/final');
	});
});

describe('buildMarkdownSummary', () => {
	it('renders counts and issue sections', () => {
		const summary = buildMarkdownSummary({
			brokenCount: 1,
			checkedCount: 2,
			checks: [
				{
					attempts: 1,
					finalUrl: 'https://bad.example/final',
					message: 'HEAD returned 404',
					method: 'HEAD',
					occurrences: [{ column: 1, filePath: 'README.md', line: 3, url: 'https://bad.example' }],
					redirected: true,
					status: 'error',
					statusCode: 404,
					url: 'https://bad.example',
				},
				{
					attempts: 1,
					message: 'HEAD returned 429',
					method: 'HEAD',
					occurrences: [{ column: 1, filePath: 'README.md', line: 4, url: 'https://warn.example' }],
					redirected: false,
					status: 'warning',
					statusCode: 429,
					url: 'https://warn.example',
				},
			],
			domainStats: [
				{
					checkedCount: 1,
					domain: 'bad.example',
					errorCount: 1,
					okCount: 0,
					redirectCount: 1,
					warningCount: 0,
				},
				{
					checkedCount: 1,
					domain: 'warn.example',
					errorCount: 0,
					okCount: 0,
					redirectCount: 0,
					warningCount: 1,
				},
			],
			discoveredFileCount: 1,
			extractedLinkCount: 2,
			note: 'Scanned 1 files.',
			redirectedCount: 1,
			warningCount: 1,
		} satisfies Pick<
			RunResult,
			| 'brokenCount'
			| 'checkedCount'
			| 'checks'
			| 'domainStats'
			| 'discoveredFileCount'
			| 'extractedLinkCount'
			| 'note'
			| 'redirectedCount'
			| 'warningCount'
		>);

		expect(summary).toContain('| Files scanned | 1 |');
		expect(summary).toContain('| Redirects | 1 |');
		expect(summary).toContain('## Errors');
		expect(summary).toContain('## Domains');
		expect(summary).toContain('## Warnings');
	});
});

describe('shouldFailRun', () => {
	it('honors the configured failOn mode', () => {
		const warningChecks = [
			{
				attempts: 1,
				message: 'HEAD returned 429',
				occurrences: [{ column: 1, filePath: 'README.md', line: 1, url: 'https://warn.example' }],
				redirected: false,
				status: 'warning' as const,
				statusCode: 429,
				url: 'https://warn.example',
			},
		];
		const errorChecks = [
			{
				attempts: 1,
				message: 'HEAD returned 404',
				occurrences: [{ column: 1, filePath: 'README.md', line: 2, url: 'https://bad.example' }],
				redirected: false,
				status: 'error' as const,
				statusCode: 404,
				url: 'https://bad.example',
			},
		];

		expect(
			shouldFailRun(
				{
					allowDomains: [],
					allowStatusCodes: [],
					concurrency: 1,
					cwd: process.cwd(),
					denyDomains: [],
					denyStatusCodes: [],
					exclude: [],
					failOn: 'warning',
					ignoreDomains: [],
					ignoreUrlPatterns: [],
					mode: 'cli',
					outputDetail: 'simple',
					paths: ['README.md'],
					respectGitignore: true,
					retryBaseDelayMs: 0,
					retryMaxDelayMs: 0,
					retries: 0,
					timeoutSeconds: 5,
					userAgent: 'test-agent',
					verbose: false,
				},
				warningChecks,
			),
		).toBe(false);
		expect(
			shouldFailRun(
				{
					allowDomains: [],
					allowStatusCodes: [],
					concurrency: 1,
					cwd: process.cwd(),
					denyDomains: [],
					denyStatusCodes: [],
					exclude: [],
					failOn: 'mixed',
					ignoreDomains: [],
					ignoreUrlPatterns: [],
					mode: 'cli',
					outputDetail: 'simple',
					paths: ['README.md'],
					respectGitignore: true,
					retryBaseDelayMs: 0,
					retryMaxDelayMs: 0,
					retries: 0,
					timeoutSeconds: 5,
					userAgent: 'test-agent',
					verbose: false,
				},
				warningChecks,
			),
		).toBe(false);
		expect(
			shouldFailRun(
				{
					allowDomains: [],
					allowStatusCodes: [],
					concurrency: 1,
					cwd: process.cwd(),
					denyDomains: [],
					denyStatusCodes: [],
					exclude: [],
					failOn: 'error',
					ignoreDomains: [],
					ignoreUrlPatterns: [],
					mode: 'cli',
					outputDetail: 'simple',
					paths: ['README.md'],
					respectGitignore: true,
					retryBaseDelayMs: 0,
					retryMaxDelayMs: 0,
					retries: 0,
					timeoutSeconds: 5,
					userAgent: 'test-agent',
					verbose: false,
				},
				warningChecks,
			),
		).toBe(false);
		expect(
			shouldFailRun(
				{
					allowDomains: [],
					allowStatusCodes: [],
					concurrency: 1,
					cwd: process.cwd(),
					denyDomains: [],
					denyStatusCodes: [],
					exclude: [],
					failOn: 'mixed',
					ignoreDomains: [],
					ignoreUrlPatterns: [],
					mode: 'cli',
					outputDetail: 'simple',
					paths: ['README.md'],
					respectGitignore: true,
					retryBaseDelayMs: 0,
					retryMaxDelayMs: 0,
					retries: 0,
					timeoutSeconds: 5,
					userAgent: 'test-agent',
					verbose: false,
				},
				errorChecks,
			),
		).toBe(true);
	});
});
