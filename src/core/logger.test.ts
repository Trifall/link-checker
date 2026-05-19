import { PassThrough } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { createLogger, LOGGER_REDACT_PATHS } from './logger.js';

describe('LOGGER_REDACT_PATHS', () => {
	it('covers common secret-bearing fields', () => {
		expect(LOGGER_REDACT_PATHS).toContain('headers.authorization');
		expect(LOGGER_REDACT_PATHS).toContain('config.headers.cookie');
		expect(LOGGER_REDACT_PATHS).toContain('password');
	});
});

describe('createLogger', () => {
	it('redacts configured sensitive fields', async () => {
		const stream = new PassThrough();
		const chunks: string[] = [];

		stream.on('data', (chunk) => {
			chunks.push(String(chunk));
		});

		const logger = createLogger(
			{ mode: 'cli', verbose: false },
			{ destination: stream, enabled: true, level: 'info' },
		);

		logger.info(
			{
				config: {
					headers: {
						cookie: 'session=secret',
					},
				},
				headers: {
					authorization: 'Bearer super-secret',
				},
				password: 'hunter2',
				response: {
					headers: {
						'set-cookie': 'refresh-token=secret',
					},
				},
				token: 'top-secret-token',
			},
			'Redaction test',
		);

		await new Promise<void>((resolve) => setTimeout(resolve, 0));

		const payload = JSON.parse(chunks.join('').trim()) as Record<string, unknown>;
		const headers = payload.headers as { authorization: string };
		const config = payload.config as { headers: { cookie: string } };
		const response = payload.response as { headers: { 'set-cookie': string } };

		expect(payload.password).toBe('[Redacted]');
		expect(payload.token).toBe('[Redacted]');
		expect(headers.authorization).toBe('[Redacted]');
		expect(config.headers.cookie).toBe('[Redacted]');
		expect(response.headers['set-cookie']).toBe('[Redacted]');
	});

	it('uses the debug log level for verbose runs', async () => {
		const stream = new PassThrough();
		const chunks: string[] = [];

		stream.on('data', (chunk) => {
			chunks.push(String(chunk));
		});

		const logger = createLogger(
			{ mode: 'action', verbose: true },
			{ destination: stream, enabled: true },
		);

		logger.debug({ component: 'test' }, 'Debug test');

		await new Promise<void>((resolve) => setTimeout(resolve, 0));

		const payload = JSON.parse(chunks.join('').trim()) as Record<string, unknown>;

		expect(payload.level).toBe('debug');
		expect(payload.msg).toBe('Debug test');
	});
});
