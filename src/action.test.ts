import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionCore } from './action.js';
import type { RunResult } from './core/types.js';

const { runLinkCheckMock } = vi.hoisted(() => ({
	runLinkCheckMock: vi.fn(),
}));

vi.mock('./core/run-link-check.js', () => ({
	runLinkCheck: runLinkCheckMock,
}));

import { readActionInputs, runAction } from './action.js';

describe('readActionInputs', () => {
	it('parses multiline, numeric, boolean, and optional inputs', () => {
		const { actionCore } = createActionCore({
			inputs: {
				'config-file': ' link-checker.config.json ',
				concurrency: '4',
				'fail-on': 'mixed',
				'output-json': ' reports/link-report.json ',
				'respect-gitignore': 'false',
				'retry-base-delay-ms': '25',
				'retry-max-delay-ms': '250',
				retries: '2',
				'timeout-seconds': '15',
				'user-agent': ' custom-agent ',
				verbose: 'true',
			},
			multilineInputs: {
				'allow-domains': ['example.com', 'docs.example.com'],
				'allow-status-codes': ['403', '429'],
				'deny-domains': ['critical.example.com'],
				'deny-status-codes': ['500'],
				exclude: ['docs/generated/**'],
				'ignore-domains': ['localhost'],
				'ignore-url-patterns': ['https://example.com/*'],
				paths: ['README.md', 'docs/**/*.md'],
			},
		});

		expect(readActionInputs(actionCore)).toEqual({
			allowDomains: ['example.com', 'docs.example.com'],
			allowStatusCodes: [403, 429],
			concurrency: 4,
			configFile: 'link-checker.config.json',
			denyDomains: ['critical.example.com'],
			denyStatusCodes: [500],
			exclude: ['docs/generated/**'],
			failOn: 'mixed',
			ignoreDomains: ['localhost'],
			ignoreUrlPatterns: ['https://example.com/*'],
			mode: 'action',
			outputJson: 'reports/link-report.json',
			paths: ['README.md', 'docs/**/*.md'],
			respectGitignore: false,
			retryBaseDelayMs: 25,
			retryMaxDelayMs: 250,
			retries: 2,
			timeoutSeconds: 15,
			userAgent: 'custom-agent',
			verbose: true,
		});
	});

	it('rejects invalid boolean inputs', () => {
		const { actionCore } = createActionCore({
			inputs: {
				verbose: 'sometimes',
			},
		});

		expect(() => readActionInputs(actionCore)).toThrow('Input verbose must be either true or false.');
	});

	it('rejects malformed numeric inputs', () => {
		const { actionCore } = createActionCore({
			inputs: {
				retries: '2x',
			},
		});

		expect(() => readActionInputs(actionCore)).toThrow('Input retries must be a number.');
	});

});

describe('runAction', () => {
	beforeEach(() => {
		runLinkCheckMock.mockReset();
	});

	it('passes parsed inputs to the core runner and publishes outputs, annotations, and summary', async () => {
		const { actionCore, mocks } = createActionCore({
			inputs: {
				concurrency: '3',
				'respect-gitignore': 'true',
				verbose: 'false',
			},
			multilineInputs: {
				paths: ['README.md'],
			},
		});
		const result = createRunResult({
			brokenCount: 1,
			checks: [
				{
					attempts: 1,
					message: 'HEAD returned 404',
					method: 'HEAD',
					occurrences: [{ column: 4, filePath: 'README.md', line: 6, url: 'https://bad.example' }],
					redirected: false,
					status: 'error',
					statusCode: 404,
					url: 'https://bad.example',
				},
				{
					attempts: 1,
					message: 'HEAD returned 429',
					method: 'HEAD',
					occurrences: [{ column: 2, filePath: 'README.md', line: 8, url: 'https://warn.example' }],
					redirected: false,
					status: 'warning',
					statusCode: 429,
					url: 'https://warn.example',
				},
			],
			note: 'Scanned 1 files. Checked 2 unique URLs.',
			reportPath: '/tmp/report.json',
			shouldFail: true,
			warningCount: 1,
		});

		runLinkCheckMock.mockResolvedValue(result);

		await runAction(actionCore);

		expect(runLinkCheckMock).toHaveBeenCalledWith({
			allowDomains: [],
			allowStatusCodes: undefined,
			concurrency: 3,
			configFile: undefined,
			denyDomains: [],
			denyStatusCodes: undefined,
			exclude: [],
			failOn: undefined,
			ignoreDomains: [],
			ignoreUrlPatterns: [],
			mode: 'action',
			outputJson: undefined,
			paths: ['README.md'],
			respectGitignore: true,
			retryBaseDelayMs: undefined,
			retryMaxDelayMs: undefined,
			retries: undefined,
			timeoutSeconds: undefined,
			userAgent: undefined,
			verbose: false,
		});
		expect(mocks.setOutput).toHaveBeenCalledWith('checked-count', '2');
		expect(mocks.setOutput).toHaveBeenCalledWith('broken-count', '1');
		expect(mocks.setOutput).toHaveBeenCalledWith('warning-count', '1');
		expect(mocks.setOutput).toHaveBeenCalledWith('report-path', '/tmp/report.json');
		expect(mocks.error).toHaveBeenCalledWith(expect.stringContaining('https://bad.example'), {
			file: 'README.md',
			startColumn: 4,
			startLine: 6,
		});
		expect(mocks.warning).toHaveBeenCalledWith(expect.stringContaining('https://warn.example'), {
			file: 'README.md',
			startColumn: 2,
			startLine: 8,
		});
		expect(mocks.summary.addRaw).toHaveBeenCalledWith(expect.stringContaining('## Summary'), true);
		expect(mocks.summary.write).toHaveBeenCalled();
		expect(mocks.setFailed).toHaveBeenCalledWith('Scanned 1 files. Checked 2 unique URLs.');
	});
});

function createActionCore(options: {
	inputs?: Record<string, string>;
	multilineInputs?: Record<string, string[]>;
}): {
	actionCore: ActionCore;
	mocks: {
		error: ReturnType<typeof vi.fn>;
		setFailed: ReturnType<typeof vi.fn>;
		setOutput: ReturnType<typeof vi.fn>;
		summary: { addRaw: ReturnType<typeof vi.fn>; write: ReturnType<typeof vi.fn> };
		warning: ReturnType<typeof vi.fn>;
	};
} {
	const summary = {
		addRaw: vi.fn().mockReturnThis(),
		write: vi.fn().mockResolvedValue(undefined),
	};
	const mocks = {
		error: vi.fn(),
		setFailed: vi.fn(),
		setOutput: vi.fn(),
		summary,
		warning: vi.fn(),
	};

	return {
		actionCore: {
			error: mocks.error as unknown as ActionCore['error'],
			getInput: (name: string) => options.inputs?.[name] ?? '',
			getMultilineInput: (name: string) => options.multilineInputs?.[name] ?? [],
			setFailed: mocks.setFailed as unknown as ActionCore['setFailed'],
			setOutput: mocks.setOutput as unknown as ActionCore['setOutput'],
			summary: summary as unknown as ActionCore['summary'],
			warning: mocks.warning as unknown as ActionCore['warning'],
		},
		mocks,
	};
}

function createRunResult(overrides: Partial<RunResult>): RunResult {
	return {
		brokenCount: 0,
		checks: [],
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
			mode: 'action',
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
		warningCount: 0,
		...overrides,
	};
}
