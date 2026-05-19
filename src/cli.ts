#!/usr/bin/env node

import { pathToFileURL } from 'node:url';

import { Command } from '@commander-js/extra-typings';
import { z } from 'zod';

import { parseIntegerInput, parseOutputDetailInput } from './core/config.schema.js';
import { getLogger } from './core/logger.js';
import { buildMarkdownSummary } from './core/report.js';
import { runLinkCheck } from './core/run-link-check.js';
import type { OutputDetail, RawConfig, RunResult } from './core/types.js';

export type OutputFormat = 'json' | 'markdown' | 'text';
type RenderOptions = {
	issuesOnly?: boolean;
};

export function createProgram(): Command {
	const program = new Command()
		.name('link-checker')
		.description(
			'Check markdown links locally or in CI. Run `link-checker scan --help` or `link-checker scan -h` to see scan options.',
		);

	program
		.command('scan')
		.description('Scan repository files for links.')
		.option('-c, --config <path>', 'Path to a JSON or JSONC config file')
		.option('--allow-domain <domain...>', 'Domains that may downgrade failures to warnings')
		.option('--allow-status-code <code...>', 'HTTP status codes to treat as OK')
		.option('-p, --paths <glob...>', 'Markdown paths or globs to scan')
		.option('--exclude <glob...>', 'Paths or globs to exclude')
		.option('--deny-domain <domain...>', 'Domains that upgrade warnings to errors')
		.option('--deny-status-code <code...>', 'HTTP status codes to force as errors')
		.option('--timeout-seconds <number>', 'Per-request timeout in seconds', parseInteger)
		.option('--concurrency <number>', 'Maximum concurrent URL checks', parseInteger)
		.option(
			'--retry-base-delay-ms <number>',
			'Base delay between retries in milliseconds',
			parseInteger,
		)
		.option(
			'--retry-max-delay-ms <number>',
			'Maximum delay between retries in milliseconds',
			parseInteger,
		)
		.option('--retries <number>', 'Retry attempts for retryable failures', parseInteger)
		.option('--fail-on <mode>', 'Failure mode: error, warning, or mixed')
		.option('--detail <level>', 'Issue detail level: simple or detailed', parseOutputDetail)
		.option('--detailed', 'Alias for --detail detailed')
		.option('--ignore-url-pattern <pattern...>', 'URL patterns to skip')
		.option('--ignore-domain <domain...>', 'Domains to skip')
		.option('--user-agent <value>', 'Override the default user agent')
		.option('--output-json <path>', 'Write a JSON report to this path')
		.option('--format <type>', 'Output format: text, json, or markdown', parseOutputFormat, 'text')
		.option('--issues-only', 'Only include errors and warnings in rendered output')
		.option('--verbose', 'Emit verbose output')
		.option('--no-respect-gitignore', 'Do not respect .gitignore during discovery')
		.action(async (options) => {
			const format = options.format as OutputFormat;
			const outputDetail = options.detail ?? (options.detailed ? 'detailed' : undefined);
			const result = await runWithRequestedFormat(format, () =>
				runLinkCheck({
					allowDomains: options.allowDomain,
					allowStatusCodes: parseIntegerList(options.allowStatusCode),
					concurrency: options.concurrency,
					configFile: options.config,
					exclude: options.exclude,
					denyDomains: options.denyDomain,
					denyStatusCodes: parseIntegerList(options.denyStatusCode),
					failOn: options.failOn,
					ignoreDomains: options.ignoreDomain,
					ignoreUrlPatterns: options.ignoreUrlPattern,
					mode: 'cli',
					outputDetail,
					outputJson: options.outputJson,
					paths: options.paths,
					respectGitignore: options.respectGitignore,
					retryBaseDelayMs: options.retryBaseDelayMs,
					retryMaxDelayMs: options.retryMaxDelayMs,
					retries: options.retries,
					timeoutSeconds: options.timeoutSeconds,
					userAgent: options.userAgent,
					verbose: options.verbose,
				} satisfies RawConfig),
			);

			writeResult(result, format, options.issuesOnly ? { issuesOnly: true } : {});

			if (result.shouldFail) {
				process.exitCode = 1;
			}
		});

	program.showHelpAfterError();

	return program;
}

export async function runCli(argv: string[] = process.argv): Promise<void> {
	try {
		await createProgram().parseAsync(argv);
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}

export function renderResult(
	result: RunResult,
	format: Exclude<OutputFormat, 'text'>,
	options: RenderOptions = {},
): string {
	const renderedResult = options.issuesOnly ? filterResultToIssues(result) : result;

	if (format === 'json') {
		return JSON.stringify(renderedResult, null, 2);
	}

	return buildMarkdownSummary(renderedResult);
}

function filterResultToIssues(result: RunResult): RunResult {
	return {
		...result,
		checks: result.checks.filter((check) => check.status !== 'ok'),
	};
}

function isDirectExecution(): boolean {
	return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

async function runWithRequestedFormat<T>(
	format: OutputFormat,
	action: () => Promise<T>,
): Promise<T> {
	if (format !== 'json') {
		return action();
	}

	const previousLogLevel = process.env.LOG_LEVEL;
	process.env.LOG_LEVEL = 'silent';

	try {
		return await action();
	} finally {
		if (previousLogLevel === undefined) {
			delete process.env.LOG_LEVEL;
		} else {
			process.env.LOG_LEVEL = previousLogLevel;
		}
	}
}

function parseInteger(value: string): number {
	return parseIntegerInput(value, `Expected a number, received "${value}".`);
}

function parseIntegerList(values: string[] | undefined): number[] | undefined {
	if (!values) {
		return undefined;
	}

	return values.map((value) => parseInteger(value));
}

function parseOutputFormat(value: string): OutputFormat {
	const errorMessage = `Expected output format to be text, json, or markdown. Received "${value}".`;
	const result = z
		.enum(['text', 'json', 'markdown'], {
			error: errorMessage,
		})
		.safeParse(value);

	if (result.success) {
		return result.data;
	}

	throw new Error(errorMessage);
}

function parseOutputDetail(value: string): OutputDetail {
	return parseOutputDetailInput(
		value,
		`Expected issue detail level to be simple or detailed. Received "${value}".`,
	);
}

function writeResult(result: RunResult, format: OutputFormat, options: RenderOptions = {}): void {
	if (format !== 'text') {
		process.stdout.write(`${renderResult(result, format, options)}\n`);
		return;
	}

	writeTextResult(result);
}

function writeTextResult(result: RunResult): void {
	const logger = getLogger({ entrypoint: 'cli' });

	logger.info(
		{
			brokenCount: result.brokenCount,
			checkedCount: result.checkedCount,
			discoveredFileCount: result.discoveredFileCount,
			extractedLinkCount: result.extractedLinkCount,
			redirectedCount: result.redirectedCount,
			warningCount: result.warningCount,
		},
		result.note,
	);

	if (result.config.verbose) {
		logger.debug({ config: result.config }, 'Resolved runtime config');
	}

	if (result.reportPath) {
		logger.info({ reportPath: result.reportPath }, 'Wrote report file');
	}
}

if (isDirectExecution()) {
	await runCli();
}
