import { z } from 'zod';

import type { RawConfig, RunConfig } from './types.js';

export const RAW_CONFIG_KEYS = [
	'allowDomains',
	'allowStatusCodes',
	'concurrency',
	'configFile',
	'cwd',
	'denyDomains',
	'denyStatusCodes',
	'exclude',
	'failOn',
	'ignoreDomains',
	'ignoreUrlPatterns',
	'mode',
	'outputDetail',
	'outputJson',
	'paths',
	'respectGitignore',
	'retryBaseDelayMs',
	'retryMaxDelayMs',
	'retries',
	'timeoutSeconds',
	'userAgent',
	'verbose',
] as const;

export function createRawConfigSchema(source: string): z.ZodType<RawConfig> {
	return z.strictObject({
		allowDomains: createOptionalStringArrayField('allowDomains', source),
		allowStatusCodes: createOptionalNumberArrayField('allowStatusCodes', source),
		concurrency: createOptionalNumberField('concurrency', source),
		configFile: createOptionalStringField('configFile', source),
		cwd: createOptionalStringField('cwd', source),
		denyDomains: createOptionalStringArrayField('denyDomains', source),
		denyStatusCodes: createOptionalNumberArrayField('denyStatusCodes', source),
		exclude: createOptionalStringArrayField('exclude', source),
		failOn: createOptionalStringField('failOn', source),
		ignoreDomains: createOptionalStringArrayField('ignoreDomains', source),
		ignoreUrlPatterns: createOptionalStringArrayField('ignoreUrlPatterns', source),
		mode: createOptionalStringField('mode', source),
		outputDetail: createOptionalStringField('outputDetail', source),
		outputJson: createOptionalStringField('outputJson', source),
		paths: createOptionalStringArrayField('paths', source),
		respectGitignore: createOptionalBooleanField('respectGitignore', source),
		retryBaseDelayMs: createOptionalNumberField('retryBaseDelayMs', source),
		retryMaxDelayMs: createOptionalNumberField('retryMaxDelayMs', source),
		retries: createOptionalNumberField('retries', source),
		timeoutSeconds: createOptionalNumberField('timeoutSeconds', source),
		userAgent: createOptionalStringField('userAgent', source),
		verbose: createOptionalBooleanField('verbose', source),
	});
}

export function createRunConfigSchema(
	source: string,
	normalize: (input: RawConfig) => RunConfig,
): z.ZodType<RunConfig> {
	return createRawConfigSchema(source).transform((input, context) => {
		try {
			return normalize(input);
		} catch (error) {
			context.issues.push({
				code: 'custom',
				input,
				message: error instanceof Error ? error.message : String(error),
			});

			return z.NEVER;
		}
	});
}

export function formatSchemaError(error: z.ZodError, source: string): string {
	const unrecognizedKeyIssue = error.issues.find((issue) => issue.code === 'unrecognized_keys');

	if (unrecognizedKeyIssue && 'keys' in unrecognizedKeyIssue) {
		return `Unknown config key(s) in ${source}: ${unrecognizedKeyIssue.keys.join(', ')}. Allowed keys: ${[...RAW_CONFIG_KEYS].sort().join(', ')}.`;
	}

	return error.issues[0]?.message ?? `Invalid config in ${source}.`;
}

export function parseBooleanInput(value: string, errorMessage: string): boolean {
	const result = z
		.string()
		.trim()
		.pipe(z.enum(['true', 'false'], { error: errorMessage }))
		.transform((normalizedValue) => normalizedValue === 'true')
		.safeParse(value);

	if (result.success) {
		return result.data;
	}

	throw new Error(errorMessage);
}

export function parseIntegerInput(value: string, errorMessage: string): number {
	const result = z
		.string()
		.trim()
		.pipe(z.string().regex(/^[-+]?\d+$/, { error: errorMessage }))
		.transform((normalizedValue) => Number.parseInt(normalizedValue, 10))
		.safeParse(value);

	if (result.success) {
		return result.data;
	}

	throw new Error(errorMessage);
}

export function parseOutputDetailInput(value: string, errorMessage: string): 'detailed' | 'simple' {
	const result = z
		.string()
		.trim()
		.pipe(z.enum(['simple', 'detailed'], { error: errorMessage }))
		.safeParse(value);

	if (result.success) {
		return result.data;
	}

	throw new Error(errorMessage);
}

function createOptionalBooleanField(
	fieldName: string,
	source: string,
): z.ZodType<boolean | undefined> {
	return z
		.unknown()
		.optional()
		.refine((value) => value === undefined || typeof value === 'boolean', {
			error: `Invalid ${fieldName} in ${source}: expected a boolean.`,
		})
		.transform((value) => value as boolean | undefined);
}

function createOptionalNumberArrayField(
	fieldName: string,
	source: string,
): z.ZodType<number[] | undefined> {
	return z
		.unknown()
		.optional()
		.refine((value) => value === undefined || isNumberArray(value), {
			error: `Invalid ${fieldName} in ${source}: expected an array of integers.`,
		})
		.transform((value) => value as number[] | undefined);
}

function createOptionalNumberField(
	fieldName: string,
	source: string,
): z.ZodType<number | undefined> {
	return z
		.unknown()
		.optional()
		.refine((value) => value === undefined || typeof value === 'number', {
			error: `Invalid ${fieldName} in ${source}: expected a number.`,
		})
		.transform((value) => value as number | undefined);
}

function createOptionalStringArrayField(
	fieldName: string,
	source: string,
): z.ZodType<string[] | undefined> {
	return z
		.unknown()
		.optional()
		.refine((value) => value === undefined || isStringArray(value), {
			error: `Invalid ${fieldName} in ${source}: expected an array of strings.`,
		})
		.transform((value) => value as string[] | undefined);
}

function createOptionalStringField(fieldName: string, source: string): z.ZodType<string | undefined> {
	return z
		.unknown()
		.optional()
		.refine((value) => value === undefined || typeof value === 'string', {
			error: `Invalid ${fieldName} in ${source}: expected a string.`,
		})
		.transform((value) => value as string | undefined);
}

function isNumberArray(values: unknown): values is number[] {
	return Array.isArray(values) && values.every((value) => typeof value === 'number');
}

function isStringArray(values: unknown): values is string[] {
	return Array.isArray(values) && values.every((value) => typeof value === 'string');
}
