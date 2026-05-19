import * as core from '@actions/core';
import { pathToFileURL } from 'node:url';

import { parseBooleanInput, parseIntegerInput } from './core/config.schema.js';
import { getLogger } from './core/logger.js';
import { buildMarkdownSummary, formatCheck } from './core/report.js';
import { runLinkCheck } from './core/run-link-check.js';
import type { CheckedLinkResult, RawConfig } from './core/types.js';

export type ActionCore = Pick<
	typeof core,
	| 'error'
	| 'getInput'
	| 'getMultilineInput'
	| 'setFailed'
	| 'setOutput'
	| 'summary'
	| 'warning'
>;

export function readActionInputs(actionCore: ActionCore = core): RawConfig {
	return {
		allowDomains: getMultilineInput(actionCore, 'allow-domains'),
		allowStatusCodes: getOptionalNumberListInput(actionCore, 'allow-status-codes'),
		concurrency: getOptionalNumberInput(actionCore, 'concurrency'),
		configFile: getOptionalInput(actionCore, 'config-file'),
		exclude: getMultilineInput(actionCore, 'exclude'),
		denyDomains: getMultilineInput(actionCore, 'deny-domains'),
		denyStatusCodes: getOptionalNumberListInput(actionCore, 'deny-status-codes'),
		failOn: getOptionalInput(actionCore, 'fail-on'),
		ignoreDomains: getMultilineInput(actionCore, 'ignore-domains'),
		ignoreUrlPatterns: getMultilineInput(actionCore, 'ignore-url-patterns'),
		mode: 'action',
		outputJson: getOptionalInput(actionCore, 'output-json'),
		paths: getMultilineInput(actionCore, 'paths'),
		respectGitignore: getOptionalBooleanInput(actionCore, 'respect-gitignore'),
		retryBaseDelayMs: getOptionalNumberInput(actionCore, 'retry-base-delay-ms'),
		retryMaxDelayMs: getOptionalNumberInput(actionCore, 'retry-max-delay-ms'),
		retries: getOptionalNumberInput(actionCore, 'retries'),
		timeoutSeconds: getOptionalNumberInput(actionCore, 'timeout-seconds'),
		userAgent: getOptionalInput(actionCore, 'user-agent'),
		verbose: getOptionalBooleanInput(actionCore, 'verbose'),
	};
}

export async function runAction(actionCore: ActionCore = core): Promise<void> {
	const result = await runLinkCheck(readActionInputs(actionCore));
	const logger = getLogger({ entrypoint: 'action' });

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
	actionCore.setOutput('checked-count', String(result.checkedCount));
	actionCore.setOutput('broken-count', String(result.brokenCount));
	actionCore.setOutput('warning-count', String(result.warningCount));

	annotateChecks(result.checks, actionCore);

	if (result.reportPath) {
		actionCore.setOutput('report-path', result.reportPath);
	}

	if (result.config.verbose) {
		logger.debug({ config: result.config }, 'Resolved runtime config');
	}

	await actionCore.summary.addRaw(buildMarkdownSummary(result), true).write();

	if (result.shouldFail) {
		actionCore.setFailed(result.note);
	}
}

function annotateChecks(checks: CheckedLinkResult[], actionCore: ActionCore): void {
	for (const check of checks) {
		if (check.status === 'ok') {
			continue;
		}

		for (const occurrence of check.occurrences) {
			const annotationProperties = {
				file: occurrence.filePath,
				startColumn: occurrence.column,
				startLine: occurrence.line,
			};

			if (check.status === 'error') {
				actionCore.error(formatCheck(check), annotationProperties);
				continue;
			}

			actionCore.warning(formatCheck(check), annotationProperties);
		}
	}
}

function getOptionalBooleanInput(actionCore: ActionCore, name: string): boolean | undefined {
	const value = getOptionalInput(actionCore, name);

	if (value === undefined) {
		return undefined;
	}

	return parseBooleanInput(value, `Input ${name} must be either true or false.`);
}

function getOptionalInput(actionCore: ActionCore, name: string): string | undefined {
	const value = actionCore.getInput(name).trim();

	return value ? value : undefined;
}

function getOptionalNumberListInput(actionCore: ActionCore, name: string): number[] | undefined {
	const values = getMultilineInput(actionCore, name);

	if (values.length === 0) {
		return undefined;
	}

	return values.map((value) => parseRequiredNumber(name, value));
}

function getMultilineInput(actionCore: ActionCore, name: string): string[] {
	return actionCore
		.getMultilineInput(name)
		.map((value) => value.trim())
		.filter(Boolean);
}

function getOptionalNumberInput(actionCore: ActionCore, name: string): number | undefined {
	const value = actionCore.getInput(name).trim();

	if (!value) {
		return undefined;
	}

	return parseRequiredNumber(name, value);
}

function isDirectExecution(): boolean {
	return process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
}

function parseRequiredNumber(name: string, value: string): number {
	return parseIntegerInput(value, `Input ${name} must be a number.`);
}

if (isDirectExecution()) {
	runAction().catch((error) => {
		core.setFailed(error instanceof Error ? error.message : String(error));
	});
}
