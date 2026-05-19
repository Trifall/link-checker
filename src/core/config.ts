import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse as parseJsonc, printParseErrorCode } from 'jsonc-parser';
import type { ParseError } from 'jsonc-parser';
import { z } from 'zod';

import { createRawConfigSchema, createRunConfigSchema, formatSchemaError } from './config.schema.js';
import type { FailOn, OutputDetail, RawConfig, RunConfig } from './types.js';

const DEFAULT_ALLOW_STATUS_CODES = [] as number[];
const DEFAULT_CONCURRENCY = 20;
const DEFAULT_CONFIG_FILES = [
	'link-checker.config.jsonc',
	'link-checker.config.json',
	'.link-checkerrc.jsonc',
	'.link-checkerrc',
	'.link-checkerrc.json',
];
const DEFAULT_DENY_STATUS_CODES = [] as number[];
const DEFAULT_FAIL_ON: FailOn = 'mixed';
const DEFAULT_OUTPUT_DETAIL: OutputDetail = 'simple';
const DEFAULT_PATHS = ['**/*.md', '**/*.mdx'];
const DEFAULT_RETRY_BASE_DELAY_MS = 250;
const DEFAULT_RETRY_MAX_DELAY_MS = 2_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_TIMEOUT_SECONDS = 15;
const DEFAULT_USER_AGENT = 'trifall/link-checker';

export async function resolveConfig(input: RawConfig = {}): Promise<RunConfig> {
	const runtimeCwd = input.cwd?.trim() || process.cwd();
	const loadedConfig = await loadConfigFile(input.configFile, runtimeCwd);
	const mergedInput = mergeRawConfig(loadedConfig?.config ?? {}, input);

	if (loadedConfig?.config.cwd?.trim() && input.cwd === undefined) {
		mergedInput.cwd = loadedConfig.baseCwd;
	} else if (!mergedInput.cwd && loadedConfig) {
		mergedInput.cwd = loadedConfig.baseCwd;
	}

	if (loadedConfig) {
		mergedInput.configFile = loadedConfig.path;
	}

	return normalizeConfig(mergedInput);
}

export function normalizeConfig(input: RawConfig = {}): RunConfig {
	return parseWithSchema(createRunConfigSchema('input', normalizeRunConfig), input, 'input');
}

async function findDefaultConfigFile(cwd: string): Promise<string | undefined> {
	for (const fileName of DEFAULT_CONFIG_FILES) {
		const candidatePath = path.resolve(cwd, fileName);

		if (await pathExists(candidatePath)) {
			return candidatePath;
		}
	}

	return undefined;
}

function isRawConfig(value: unknown): value is RawConfig {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function loadConfigFile(
	requestedPath: string | undefined,
	runtimeCwd: string,
): Promise<{ baseCwd: string; config: RawConfig; path: string } | undefined> {
	const resolvedPath = requestedPath?.trim()
		? path.resolve(runtimeCwd, requestedPath.trim())
		: await findDefaultConfigFile(runtimeCwd);

	if (!resolvedPath) {
		return undefined;
	}

	if (!(await pathExists(resolvedPath))) {
		throw new Error(`Config file not found: ${resolvedPath}`);
	}

	const fileContent = await readFile(resolvedPath, 'utf8');
	const parseErrors = [] as ParseError[];
	const parsedValue = parseJsonc(fileContent, parseErrors, {
		allowTrailingComma: true,
		disallowComments: false,
	}) as unknown;

	if (parseErrors.length > 0) {
		throw new Error(
			`Invalid config file ${resolvedPath}: ${printParseErrorCode(parseErrors[0]!.error)}`,
		);
	}

	if (!isRawConfig(parsedValue)) {
		throw new Error(`Config file must contain a JSON object: ${resolvedPath}`);
	}

	const config = parseWithSchema(
		createRawConfigSchema(`config file ${resolvedPath}`),
		parsedValue,
		`config file ${resolvedPath}`,
	);
	const baseCwd = config.cwd?.trim()
		? path.resolve(path.dirname(resolvedPath), config.cwd.trim())
		: path.dirname(resolvedPath);

	return {
		baseCwd,
		config,
		path: resolvedPath,
	};
}

function isBareDomain(value: string): boolean {
	return (
		!value.includes('://') && !value.includes('/') && !value.includes('?') && !value.includes('#')
	);
}

function mergeRawConfig(base: RawConfig, overrides: RawConfig): RawConfig {
	const definedOverrides = Object.fromEntries(
		Object.entries(overrides).filter(([, value]) => value !== undefined),
	) as RawConfig;

	return {
		...base,
		...definedOverrides,
	};
}

function normalizeFailOn(value: RawConfig['failOn']): FailOn {
	if (value === undefined) {
		return DEFAULT_FAIL_ON;
	}

	if (value === 'error' || value === 'mixed' || value === 'warning') {
		return value;
	}

	throw new Error(
		`Invalid config: failOn must be one of error, mixed, or warning. Received ${String(value)}.`,
	);
}

function normalizeMode(value: RawConfig['mode']): RunConfig['mode'] {
	if (value === undefined) {
		return 'cli';
	}

	if (value === 'action' || value === 'cli') {
		return value;
	}

	throw new Error(`Invalid config: mode must be either action or cli. Received ${String(value)}.`);
}

function normalizeIgnoreUrlPatterns(values: string[] | undefined): string[] {
	const patterns = normalizeStringList(values);

	for (const pattern of patterns) {
		if (!pattern.startsWith('regex:')) {
			continue;
		}

		try {
			new RegExp(pattern.slice('regex:'.length));
		} catch {
			throw new Error(
				`Invalid config: ignoreUrlPatterns contains invalid regex pattern ${pattern}.`,
			);
		}
	}

	return patterns;
}

function normalizeOutputDetail(value: RawConfig['outputDetail']): OutputDetail {
	if (value === undefined) {
		return DEFAULT_OUTPUT_DETAIL;
	}

	if (value === 'detailed' || value === 'simple') {
		return value;
	}

	throw new Error(
		`Invalid config: outputDetail must be either simple or detailed. Received ${String(value)}.`,
	);
}

function normalizeDomainList(values: string[] | undefined, fieldName: string): string[] {
	const domains = normalizeStringList(values);

	for (const domain of domains) {
		if (!isBareDomain(domain)) {
			throw new Error(
				`Invalid config: ${fieldName} must contain bare domains like example.com. Received ${domain}.`,
			);
		}
	}

	return [...new Set(domains.map((domain) => domain.toLowerCase()))];
}

function normalizeNonNegativeInteger(
	value: number | undefined,
	fallback: number,
	fieldName: string,
): number {
	if (value === undefined || !Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
		if (value !== undefined) {
			throw new Error(`Invalid config: ${fieldName} must be a non-negative integer.`);
		}

		return fallback;
	}

	return value;
}

function normalizePositiveInteger(
	value: number | undefined,
	fallback: number,
	fieldName: string,
): number {
	if (value === undefined || !Number.isFinite(value) || !Number.isInteger(value) || value < 1) {
		if (value !== undefined) {
			throw new Error(`Invalid config: ${fieldName} must be a positive integer.`);
		}

		return fallback;
	}

	return value;
}

function normalizeStatusCodeList(values: number[] | undefined, fallback: number[]): number[] {
	if (!values) {
		return [...fallback];
	}

	return [...new Set(values.map((value) => validateStatusCode(value)))].sort(
		(left, right) => left - right,
	);
}

function normalizeStringList(values: string[] | undefined): string[] {
	if (!values) {
		return [];
	}

	return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeRunConfig(input: RawConfig): RunConfig {
	const paths = normalizeStringList(input.paths);
	const retryBaseDelayMs = normalizeNonNegativeInteger(
		input.retryBaseDelayMs,
		DEFAULT_RETRY_BASE_DELAY_MS,
		'retryBaseDelayMs',
	);
	const retryMaxDelayMs = normalizeNonNegativeInteger(
		input.retryMaxDelayMs,
		DEFAULT_RETRY_MAX_DELAY_MS,
		'retryMaxDelayMs',
	);

	if (retryBaseDelayMs > retryMaxDelayMs) {
		throw new Error(
			`Invalid config: retryBaseDelayMs (${retryBaseDelayMs}) must be less than or equal to retryMaxDelayMs (${retryMaxDelayMs}).`,
		);
	}

	return {
		allowDomains: normalizeDomainList(input.allowDomains, 'allowDomains'),
		allowStatusCodes: normalizeStatusCodeList(input.allowStatusCodes, DEFAULT_ALLOW_STATUS_CODES),
		concurrency: normalizePositiveInteger(input.concurrency, DEFAULT_CONCURRENCY, 'concurrency'),
		...(input.configFile?.trim() ? { configFile: input.configFile.trim() } : {}),
		cwd: input.cwd?.trim() || process.cwd(),
		denyDomains: normalizeDomainList(input.denyDomains, 'denyDomains'),
		denyStatusCodes: normalizeStatusCodeList(input.denyStatusCodes, DEFAULT_DENY_STATUS_CODES),
		exclude: normalizeStringList(input.exclude),
		failOn: normalizeFailOn(input.failOn),
		ignoreDomains: normalizeDomainList(input.ignoreDomains, 'ignoreDomains'),
		ignoreUrlPatterns: normalizeIgnoreUrlPatterns(input.ignoreUrlPatterns),
		mode: normalizeMode(input.mode),
		outputDetail: normalizeOutputDetail(input.outputDetail),
		...(input.outputJson?.trim() ? { outputJson: input.outputJson.trim() } : {}),
		paths: paths.length > 0 ? paths : [...DEFAULT_PATHS],
		respectGitignore: input.respectGitignore ?? true,
		retryBaseDelayMs,
		retryMaxDelayMs,
		retries: normalizeNonNegativeInteger(input.retries, DEFAULT_RETRIES, 'retries'),
		timeoutSeconds: normalizePositiveInteger(
			input.timeoutSeconds,
			DEFAULT_TIMEOUT_SECONDS,
			'timeoutSeconds',
		),
		userAgent: input.userAgent?.trim() || DEFAULT_USER_AGENT,
		verbose: input.verbose ?? false,
	};
}

function parseWithSchema<Output>(schema: z.ZodType<Output>, value: unknown, source: string): Output {
	const result = schema.safeParse(value);

	if (result.success) {
		return result.data;
	}

	throw new Error(formatSchemaError(result.error, source));
}

function validateStatusCode(value: number): number {
	if (!Number.isInteger(value) || value < 100 || value > 599) {
		throw new Error(
			`Invalid config: status codes must be integers between 100 and 599. Received ${String(value)}.`,
		);
	}

	return value;
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await access(filePath);
		return true;
	} catch {
		return false;
	}
}
