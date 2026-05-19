import { describe, expect, it } from 'vitest';

import {
	createRawConfigSchema,
	createRunConfigSchema,
	formatSchemaError,
	parseBooleanInput,
	parseIntegerInput,
	parseOutputDetailInput,
} from './config.schema.js';
import type { RawConfig, RunConfig } from './types.js';

describe('createRawConfigSchema', () => {
	it('accepts a config object containing all supported fields', () => {
		const schema = createRawConfigSchema('test input');
		const result = schema.parse({
			allowDomains: ['example.com'],
			allowStatusCodes: [200, 429],
			concurrency: 4,
			configFile: 'link-checker.config.json',
			cwd: '/workspace',
			denyDomains: ['bad.example.com'],
			denyStatusCodes: [500],
			exclude: ['generated/**'],
			failOn: 'mixed',
			ignoreDomains: ['localhost'],
			ignoreUrlPatterns: ['https://example.com/*'],
			mode: 'cli',
			outputDetail: 'detailed',
			outputJson: 'reports/output.json',
			paths: ['README.md'],
			respectGitignore: true,
			retryBaseDelayMs: 25,
			retryMaxDelayMs: 250,
			retries: 2,
			timeoutSeconds: 15,
			userAgent: 'test-agent',
			verbose: false,
		} satisfies RawConfig);

		expect(result).toEqual({
			allowDomains: ['example.com'],
			allowStatusCodes: [200, 429],
			concurrency: 4,
			configFile: 'link-checker.config.json',
			cwd: '/workspace',
			denyDomains: ['bad.example.com'],
			denyStatusCodes: [500],
			exclude: ['generated/**'],
			failOn: 'mixed',
			ignoreDomains: ['localhost'],
			ignoreUrlPatterns: ['https://example.com/*'],
			mode: 'cli',
			outputDetail: 'detailed',
			outputJson: 'reports/output.json',
			paths: ['README.md'],
			respectGitignore: true,
			retryBaseDelayMs: 25,
			retryMaxDelayMs: 250,
			retries: 2,
			timeoutSeconds: 15,
			userAgent: 'test-agent',
			verbose: false,
		});
	});

	it.each([
		['allowDomains', { allowDomains: 'example.com' }, 'Invalid allowDomains in test input: expected an array of strings.'],
		['allowStatusCodes', { allowStatusCodes: [200, '429'] }, 'Invalid allowStatusCodes in test input: expected an array of integers.'],
		['concurrency', { concurrency: '4' }, 'Invalid concurrency in test input: expected a number.'],
		['configFile', { configFile: ['link-checker.config.json'] }, 'Invalid configFile in test input: expected a string.'],
		['cwd', { cwd: true }, 'Invalid cwd in test input: expected a string.'],
		['denyDomains', { denyDomains: [123] }, 'Invalid denyDomains in test input: expected an array of strings.'],
		['denyStatusCodes', { denyStatusCodes: ['500'] }, 'Invalid denyStatusCodes in test input: expected an array of integers.'],
		['exclude', { exclude: [false] }, 'Invalid exclude in test input: expected an array of strings.'],
		['failOn', { failOn: ['mixed'] }, 'Invalid failOn in test input: expected a string.'],
		['ignoreDomains', { ignoreDomains: [null] }, 'Invalid ignoreDomains in test input: expected an array of strings.'],
		['ignoreUrlPatterns', { ignoreUrlPatterns: [1] }, 'Invalid ignoreUrlPatterns in test input: expected an array of strings.'],
		['mode', { mode: 123 }, 'Invalid mode in test input: expected a string.'],
		['outputDetail', { outputDetail: ['detailed'] }, 'Invalid outputDetail in test input: expected a string.'],
		['outputJson', { outputJson: {} }, 'Invalid outputJson in test input: expected a string.'],
		['paths', { paths: [12] }, 'Invalid paths in test input: expected an array of strings.'],
		['respectGitignore', { respectGitignore: 'true' }, 'Invalid respectGitignore in test input: expected a boolean.'],
		['retryBaseDelayMs', { retryBaseDelayMs: '25' }, 'Invalid retryBaseDelayMs in test input: expected a number.'],
		['retryMaxDelayMs', { retryMaxDelayMs: [] }, 'Invalid retryMaxDelayMs in test input: expected a number.'],
		['retries', { retries: '2' }, 'Invalid retries in test input: expected a number.'],
		['timeoutSeconds', { timeoutSeconds: '15' }, 'Invalid timeoutSeconds in test input: expected a number.'],
		['userAgent', { userAgent: 42 }, 'Invalid userAgent in test input: expected a string.'],
		['verbose', { verbose: 'false' }, 'Invalid verbose in test input: expected a boolean.'],
	])('rejects invalid %s values', (_fieldName, input, message) => {
		const result = createRawConfigSchema('test input').safeParse(input);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe(message);
		}
	});

	it('rejects unknown keys', () => {
		const result = createRawConfigSchema('test input').safeParse({
			madeUp: true,
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(formatSchemaError(result.error, 'test input')).toBe(
				'Unknown config key(s) in test input: madeUp. Allowed keys: allowDomains, allowStatusCodes, concurrency, configFile, cwd, denyDomains, denyStatusCodes, exclude, failOn, ignoreDomains, ignoreUrlPatterns, mode, outputDetail, outputJson, paths, respectGitignore, retries, retryBaseDelayMs, retryMaxDelayMs, timeoutSeconds, userAgent, verbose.',
			);
		}
	});
});

describe('createRunConfigSchema', () => {
	it('returns normalized config output', () => {
		const normalizedConfig = createNormalizedRunConfig();
		const result = createRunConfigSchema('test input', () => normalizedConfig).parse({
			concurrency: 4,
		});

		expect(result).toEqual(normalizedConfig);
	});

	it('surfaces normalization errors as schema issues', () => {
		const result = createRunConfigSchema('test input', () => {
			throw new Error('boom');
		}).safeParse({ concurrency: 4 });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0]?.message).toBe('boom');
		}
	});
});

describe('formatSchemaError', () => {
	it('returns the first validation error message for non-unknown-key errors', () => {
		const result = createRawConfigSchema('test input').safeParse({ concurrency: '4' });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(formatSchemaError(result.error, 'test input')).toBe(
				'Invalid concurrency in test input: expected a number.',
			);
		}
	});
});

describe('parseBooleanInput', () => {
	it('accepts trimmed boolean strings', () => {
		expect(parseBooleanInput(' true ', 'bad boolean')).toBe(true);
		expect(parseBooleanInput('false', 'bad boolean')).toBe(false);
	});

	it.each(['TRUE', 'yes', '', '0'])('rejects invalid boolean input %j', (value) => {
		expect(() => parseBooleanInput(value, 'bad boolean')).toThrow('bad boolean');
	});
});

describe('parseIntegerInput', () => {
	it('accepts signed and trimmed integer strings', () => {
		expect(parseIntegerInput(' 42 ', 'bad integer')).toBe(42);
		expect(parseIntegerInput('-7', 'bad integer')).toBe(-7);
		expect(parseIntegerInput('+3', 'bad integer')).toBe(3);
	});

	it.each(['', '2.5', '5s', '1e3', '  '])('rejects invalid integer input %j', (value) => {
		expect(() => parseIntegerInput(value, 'bad integer')).toThrow('bad integer');
	});
});

describe('parseOutputDetailInput', () => {
	it('accepts trimmed output detail strings', () => {
		expect(parseOutputDetailInput(' simple ', 'bad detail')).toBe('simple');
		expect(parseOutputDetailInput('detailed', 'bad detail')).toBe('detailed');
	});

	it.each(['', 'full', 'DETAILED'])('rejects invalid output detail input %j', (value) => {
		expect(() => parseOutputDetailInput(value, 'bad detail')).toThrow('bad detail');
	});
});

function createNormalizedRunConfig(): RunConfig {
	return {
		allowDomains: [],
		allowStatusCodes: [],
		concurrency: 4,
		cwd: '/workspace',
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
		retryMaxDelayMs: 2_000,
		retries: 2,
		timeoutSeconds: 15,
		userAgent: 'test-agent',
		verbose: false,
	};
}
