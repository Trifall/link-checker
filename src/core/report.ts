import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { getLogger, sanitizeUrl } from './logger.js';
import type {
	CheckedLinkResult,
	DomainStat,
	LinkOccurrence,
	RunConfig,
	RunResult,
} from './types.js';

export function buildDomainStats(checks: CheckedLinkResult[]): DomainStat[] {
	const domainMap = new Map<string, DomainStat>();

	for (const check of checks) {
		const domain = getDomain(check.finalUrl ?? check.url);
		const currentValue = domainMap.get(domain) ?? {
			checkedCount: 0,
			domain,
			errorCount: 0,
			okCount: 0,
			redirectCount: 0,
			warningCount: 0,
		};

		currentValue.checkedCount += 1;

		if (check.status === 'error') {
			currentValue.errorCount += 1;
		} else if (check.status === 'warning') {
			currentValue.warningCount += 1;
		} else {
			currentValue.okCount += 1;
		}

		if (check.redirected) {
			currentValue.redirectCount += 1;
		}

		domainMap.set(domain, currentValue);
	}

	return [...domainMap.values()].sort(
		(left, right) =>
			right.errorCount - left.errorCount ||
			right.warningCount - left.warningCount ||
			right.redirectCount - left.redirectCount ||
			right.checkedCount - left.checkedCount ||
			left.domain.localeCompare(right.domain),
	);
}

export function buildSummary(
	result: Pick<
		RunResult,
		| 'brokenCount'
		| 'checkedCount'
		| 'discoveredFileCount'
		| 'extractedLinkCount'
		| 'redirectedCount'
		| 'warningCount'
	>,
): string {
	return [
		`Scanned ${result.discoveredFileCount} files.`,
		`Found ${result.extractedLinkCount} markdown link occurrences.`,
		`Checked ${result.checkedCount} unique URLs.`,
		`Redirects: ${result.redirectedCount}.`,
		`Errors: ${result.brokenCount}.`,
		`Warnings: ${result.warningCount}.`,
	].join(' ');
}

export function formatCheck(check: CheckedLinkResult): string {
	const occurrence = check.occurrences[0];
	const location = occurrence ? formatOccurrence(occurrence) : 'unknown location';
	const method = check.method ? `${check.method} ` : '';
	const statusCode = check.statusCode ? ` ${check.statusCode}` : '';
	const redirect = check.finalUrl ? ` -> ${sanitizeUrl(check.finalUrl)}` : '';

	return `${check.status.toUpperCase()}: ${method}${sanitizeUrl(check.url)}${statusCode}${redirect} (${check.message}) at ${location}`;
}

export function buildMarkdownSummary(
	result: Pick<
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
	>,
): string {
	const lines = [
		'## Summary',
		'',
		'| Metric | Value |',
		'| --- | --- |',
		`| Files scanned | ${result.discoveredFileCount} |`,
		`| Link occurrences | ${result.extractedLinkCount} |`,
		`| Unique URLs checked | ${result.checkedCount} |`,
		`| Redirects | ${result.redirectedCount} |`,
		`| Domains | ${result.domainStats.length} |`,
		`| Errors | ${result.brokenCount} |`,
		`| Warnings | ${result.warningCount} |`,
		'',
		result.note,
	];

	appendIssueSection(
		lines,
		'Errors',
		result.checks.filter((check) => check.status === 'error'),
	);
	appendIssueSection(
		lines,
		'Warnings',
		result.checks.filter((check) => check.status === 'warning'),
	);
	appendDomainSection(lines, result.domainStats);

	return lines.join('\n');
}

export function shouldFailRun(config: RunConfig, checks: CheckedLinkResult[]): boolean {
	const hasError = checks.some((check) => check.status === 'error');

	if (config.failOn === 'warning') {
		return false;
	}

	if (config.failOn === 'error') {
		return hasError;
	}

	return hasError;
}

function sanitizeConfig(config: RunConfig): Record<string, unknown> {
	return {
		allowDomains: config.allowDomains,
		allowStatusCodes: config.allowStatusCodes,
		concurrency: config.concurrency,
		denyDomains: config.denyDomains,
		denyStatusCodes: config.denyStatusCodes,
		exclude: config.exclude,
		failOn: config.failOn,
		ignoreDomains: config.ignoreDomains,
		ignoreUrlPatterns: config.ignoreUrlPatterns,
		outputDetail: config.outputDetail,
		outputJson: config.outputJson,
		paths: config.paths,
		respectGitignore: config.respectGitignore,
		retryBaseDelayMs: config.retryBaseDelayMs,
		retryMaxDelayMs: config.retryMaxDelayMs,
		retries: config.retries,
		timeoutSeconds: config.timeoutSeconds,
		userAgent: config.userAgent,
		verbose: config.verbose,
	};
}

export async function writeJsonReport(
	config: RunConfig,
	result: Pick<
		RunResult,
		| 'brokenCount'
		| 'checkedCount'
		| 'checks'
		| 'domainStats'
		| 'discoveredFileCount'
		| 'extractedLinkCount'
		| 'note'
		| 'redirectedCount'
		| 'shouldFail'
		| 'warningCount'
	>,
): Promise<string | undefined> {
	if (!config.outputJson) {
		return undefined;
	}

	const reportPath = path.resolve(config.cwd, config.outputJson);

	await mkdir(path.dirname(reportPath), { recursive: true });
	await writeFile(
		reportPath,
		JSON.stringify(
			{
				checks: result.checks,
				config: sanitizeConfig(config),
				domainStats: result.domainStats,
				errors: result.checks.filter((check) => check.status === 'error'),
				redirectedCount: result.redirectedCount,
				warnings: result.checks.filter((check) => check.status === 'warning'),
				summary: {
					brokenCount: result.brokenCount,
					checkedCount: result.checkedCount,
					domainCount: result.domainStats.length,
					discoveredFileCount: result.discoveredFileCount,
					extractedLinkCount: result.extractedLinkCount,
					note: result.note,
					redirectedCount: result.redirectedCount,
					shouldFail: result.shouldFail,
					warningCount: result.warningCount,
				},
				generatedAt: new Date().toISOString(),
			},
			null,
			2,
		),
	);

	getLogger({ component: 'report' }).debug({ reportPath }, 'Wrote JSON report');

	return reportPath;
}

function appendIssueSection(lines: string[], title: string, checks: CheckedLinkResult[]): void {
	if (checks.length === 0) {
		return;
	}

	lines.push('', `## ${title}`, '');

	for (const check of checks.slice(0, 20)) {
		lines.push(`- ${formatCheck(check)}`);
	}

	if (checks.length > 20) {
		lines.push(`- ...and ${checks.length - 20} more`);
	}
}

function appendDomainSection(lines: string[], domainStats: DomainStat[]): void {
	if (domainStats.length === 0) {
		return;
	}

	lines.push(
		'',
		'## Domains',
		'',
		'| Domain | Checked | OK | Errors | Warnings | Redirects |',
		'| --- | --- | --- | --- | --- | --- |',
	);

	for (const domainStat of domainStats.slice(0, 20)) {
		lines.push(
			`| ${domainStat.domain} | ${domainStat.checkedCount} | ${domainStat.okCount} | ${domainStat.errorCount} | ${domainStat.warningCount} | ${domainStat.redirectCount} |`,
		);
	}

	if (domainStats.length > 20) {
		lines.push('', `Showing top 20 domains out of ${domainStats.length}.`);
	}
}

function getDomain(value: string): string {
	try {
		return new URL(value).hostname.toLowerCase();
	} catch {
		return 'invalid-url';
	}
}

function formatOccurrence(occurrence: LinkOccurrence): string {
	return `${occurrence.filePath}:${occurrence.line}:${occurrence.column}`;
}
