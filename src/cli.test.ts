import { describe, expect, it } from 'vitest';

import { createProgram, renderResult } from './cli.js';
import type { RunResult } from './core/types.js';

describe('renderResult', () => {
	it('renders JSON output for machine-readable CLI usage', () => {
		const output = renderResult(createRunResult(), 'json');
		const payload = JSON.parse(output) as RunResult;

		expect(payload.checkedCount).toBe(2);
		expect(payload.checks).toHaveLength(3);
		expect(payload.note).toBe('Scanned 1 files.');
	});

	it('can omit passing checks from JSON output', () => {
		const output = renderResult(createRunResult(), 'json', { issuesOnly: true });
		const payload = JSON.parse(output) as RunResult;

		expect(payload.checkedCount).toBe(2);
		expect(payload.checks.map((check) => check.status)).toEqual(['error', 'warning']);
	});

	it('renders markdown output for summary-oriented CLI usage', () => {
		const output = renderResult(createRunResult(), 'markdown');

		expect(output).toContain('## Summary');
		expect(output).toContain('| Unique URLs checked | 2 |');
	});

	it('can omit passing checks from markdown output', () => {
		const output = renderResult(createRunResult(), 'markdown', { issuesOnly: true });

		expect(output).toContain('ERROR: HEAD https://example.com/missing 404');
		expect(output).toContain('WARNING: HEAD https://example.com/forbidden 403');
		expect(output).not.toContain('https://example.com/ok');
	});
});

describe('createProgram', () => {
	it('rejects malformed numeric option values', async () => {
		await expect(
			createProgram().exitOverride().parseAsync(['scan', '--retries', '2x'], {
				from: 'user',
			}),
		).rejects.toThrow('Expected a number, received "2x".');
	});

	it('rejects invalid detail levels', async () => {
		await expect(
			createProgram().exitOverride().parseAsync(['scan', '--detail', 'full'], {
				from: 'user',
			}),
		).rejects.toThrow('Expected issue detail level to be simple or detailed. Received "full".');
	});

	it('accepts the detailed alias', async () => {
		const command = createProgram().exitOverride();

		await expect(
			command.parseAsync(['scan', '--detailed', '--help'], {
				from: 'user',
			}),
		).rejects.toBeDefined();

		const scanHelpText = command.commands
			.find((subcommand) => subcommand.name() === 'scan')
			?.helpInformation();

		expect(scanHelpText).toContain('--detailed');
	});

	it('mentions how to view scan options from top-level help', () => {
		const helpText = createProgram().helpInformation();
		const scanHelpText = createProgram()
			.commands.find((command) => command.name() === 'scan')
			?.helpInformation();

		expect(helpText).toContain('Run `link-checker scan --help` or');
		expect(helpText).toContain('`link-checker scan -h` to see scan options.');
		expect(scanHelpText).toContain('--detail <level>');
		expect(scanHelpText).toContain('--detailed');
		expect(scanHelpText).toContain('--issues-only');
	});
});

function createRunResult(): RunResult {
	return {
		brokenCount: 1,
		checks: [
			{
				attempts: 1,
				message: 'HEAD returned 404',
				method: 'HEAD',
				occurrences: [
					{ column: 1, filePath: 'README.md', line: 1, url: 'https://example.com/missing' },
				],
				redirected: false,
				status: 'error',
				statusCode: 404,
				url: 'https://example.com/missing',
			},
			{
				attempts: 1,
				message: 'HEAD returned 403',
				method: 'HEAD',
				occurrences: [
					{ column: 1, filePath: 'README.md', line: 2, url: 'https://example.com/forbidden' },
				],
				redirected: false,
				status: 'warning',
				statusCode: 403,
				url: 'https://example.com/forbidden',
			},
			{
				attempts: 1,
				message: 'HEAD returned 200',
				method: 'HEAD',
				occurrences: [{ column: 1, filePath: 'README.md', line: 3, url: 'https://example.com/ok' }],
				redirected: false,
				status: 'ok',
				statusCode: 200,
				url: 'https://example.com/ok',
			},
		],
		checkedCount: 2,
		config: {
			allowDomains: [],
			allowStatusCodes: [],
			concurrency: 3,
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
			retryBaseDelayMs: 250,
			retryMaxDelayMs: 2000,
			retries: 2,
			timeoutSeconds: 15,
			userAgent: 'test-agent',
			verbose: false,
		},
		domainStats: [],
		discoveredFileCount: 1,
		extractedLinkCount: 2,
		note: 'Scanned 1 files.',
		redirectedCount: 0,
		shouldFail: false,
		warningCount: 1,
	};
}
