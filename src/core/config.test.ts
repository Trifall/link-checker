import { describe, expect, it } from 'vitest';

import { normalizeConfig } from './config.js';

describe('normalizeConfig', () => {
	it('applies the default scaffold values', () => {
		const config = normalizeConfig();

		expect(config.paths).toEqual(['**/*.md', '**/*.mdx']);
		expect(config.concurrency).toBe(20);
		expect(config.timeoutSeconds).toBe(15);
		expect(config.failOn).toBe('mixed');
		expect(config.outputDetail).toBe('simple');
		expect(config.respectGitignore).toBe(true);
	});

	it('normalizes explicit overrides', () => {
		const config = normalizeConfig({
			concurrency: 5,
			exclude: [' docs/generated/** ', 'docs/generated/**'],
			failOn: 'warning',
			ignoreDomains: ['example.com'],
			ignoreUrlPatterns: ['https://example.com/*'],
			outputDetail: 'detailed',
			outputJson: ' reports/result.json ',
			paths: [' README.md ', 'docs/**/*.md'],
			respectGitignore: false,
			retries: 4,
			timeoutSeconds: 30,
			userAgent: 'custom-agent',
			verbose: true,
		});

		expect(config.paths).toEqual(['README.md', 'docs/**/*.md']);
		expect(config.exclude).toEqual(['docs/generated/**']);
		expect(config.failOn).toBe('warning');
		expect(config.ignoreDomains).toEqual(['example.com']);
		expect(config.ignoreUrlPatterns).toEqual(['https://example.com/*']);
		expect(config.outputDetail).toBe('detailed');
		expect(config.outputJson).toBe('reports/result.json');
		expect(config.respectGitignore).toBe(false);
		expect(config.verbose).toBe(true);
	});

	it('normalizes all supported config fields', () => {
		const config = normalizeConfig({
			allowDomains: [' Example.com ', 'example.com'],
			allowStatusCodes: [429, 403, 429],
			concurrency: 8,
			configFile: ' configs/link-checker.config.json ',
			cwd: ' /workspace/docs ',
			denyDomains: [' Critical.Example.com '],
			denyStatusCodes: [503, 500, 503],
			exclude: [' generated/** ', 'generated/**'],
			failOn: 'error',
			ignoreDomains: [' Localhost '],
			ignoreUrlPatterns: [' https://example.com/* '],
			mode: 'action',
			outputDetail: 'detailed',
			outputJson: ' reports/output.json ',
			paths: [' README.md ', 'docs/**/*.md'],
			respectGitignore: false,
			retryBaseDelayMs: 25,
			retryMaxDelayMs: 250,
			retries: 3,
			timeoutSeconds: 9,
			userAgent: ' custom-agent/1.0 ',
			verbose: true,
		});

		expect(config).toEqual({
			allowDomains: ['example.com'],
			allowStatusCodes: [403, 429],
			concurrency: 8,
			configFile: 'configs/link-checker.config.json',
			cwd: '/workspace/docs',
			denyDomains: ['critical.example.com'],
			denyStatusCodes: [500, 503],
			exclude: ['generated/**'],
			failOn: 'error',
			ignoreDomains: ['localhost'],
			ignoreUrlPatterns: ['https://example.com/*'],
			mode: 'action',
			outputDetail: 'detailed',
			outputJson: 'reports/output.json',
			paths: ['README.md', 'docs/**/*.md'],
			respectGitignore: false,
			retryBaseDelayMs: 25,
			retryMaxDelayMs: 250,
			retries: 3,
			timeoutSeconds: 9,
			userAgent: 'custom-agent/1.0',
			verbose: true,
		});
	});

	it('rejects decimal numeric config values instead of truncating them', () => {
		expect(() =>
			normalizeConfig({
				concurrency: 1.9,
			}),
		).toThrow('Invalid config: concurrency must be a positive integer.');
		expect(() =>
			normalizeConfig({
				retries: 2.5,
			}),
		).toThrow('Invalid config: retries must be a non-negative integer.');
	});

	it('rejects non-finite numeric config values', () => {
		expect(() =>
			normalizeConfig({
				timeoutSeconds: Number.POSITIVE_INFINITY,
			}),
		).toThrow('Invalid config: timeoutSeconds must be a positive integer.');
	});

	it('rejects invalid output detail modes', () => {
		expect(() =>
			normalizeConfig({
				outputDetail: 'full',
			}),
		).toThrow('Invalid config: outputDetail must be either simple or detailed. Received full.');
	});

	it('rejects invalid regex ignore URL patterns during config normalization', () => {
		expect(() =>
			normalizeConfig({
				ignoreUrlPatterns: ['regex:['],
			}),
		).toThrow('Invalid config: ignoreUrlPatterns contains invalid regex pattern regex:[.');
	});
});
