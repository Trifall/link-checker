import pino from 'pino';
import pretty from 'pino-pretty';

import type { RunMode } from './types.js';

type LogBindings = Record<string, string | number | boolean | undefined>;
type CreateLoggerOverrides = {
	destination?: pino.DestinationStream;
	enabled?: boolean;
	level?: string;
	redact?: pino.LoggerOptions['redact'];
};
type LoggerOptions = {
	mode: RunMode;
	verbose: boolean;
};

export const LOGGER_REDACT_PATHS: string[] = [
	'password',
	'secret',
	'token',
	'accessToken',
	'refreshToken',
	'apiKey',
	'authorization',
	'cookie',
	'headers.authorization',
	'headers.cookie',
	'headers["set-cookie"]',
	'config.headers.authorization',
	'config.headers.cookie',
	'config.headers["set-cookie"]',
	'req.headers.authorization',
	'req.headers.cookie',
	'req.headers["set-cookie"]',
	'request.headers.authorization',
	'request.headers.cookie',
	'request.headers["set-cookie"]',
	'res.headers.cookie',
	'res.headers["set-cookie"]',
	'response.headers.cookie',
	'response.headers["set-cookie"]',
	'err.config.headers.authorization',
	'err.config.headers.cookie',
	'err.config.headers["set-cookie"]',
];

const REDACTED_QUERY_PARAMS = new Set([
	'access_token',
	'accesstoken',
	'api_key',
	'apikey',
	'auth',
	'authorization',
	'client_secret',
	'clientsecret',
	'credential',
	'key',
	'passwd',
	'password',
	'private_key',
	'privatekey',
	'refresh_token',
	'refreshtoken',
	'secret',
	'signature',
	'token',
]);

export function sanitizeUrl(url: string): string {
	try {
		const parsed = new URL(url);

		let modified = false;

		for (const key of parsed.searchParams.keys()) {
			if (REDACTED_QUERY_PARAMS.has(key.toLowerCase())) {
				parsed.searchParams.set(key, '[Redacted]');
				modified = true;
			}
		}

		return modified ? parsed.toString() : url;
	} catch {
		return url;
	}
}

let logger: pino.Logger | undefined;
let loggerSignature: string | undefined;

export function configureLogger(options: LoggerOptions): pino.Logger {
	const signature = getLoggerSignature(options);

	if (logger && loggerSignature === signature) {
		return logger;
	}

	logger = createLogger(options);
	loggerSignature = signature;

	return logger;
}

export function createLogger(
	options: LoggerOptions,
	overrides: CreateLoggerOverrides = {},
): pino.Logger {
	return pino(
		{
			base: null,
			enabled: overrides.enabled ?? !isTestEnvironment(),
			formatters: {
				bindings: (bindings) => ({
					app: 'link-checker',
					host: bindings.hostname,
					mode: options.mode,
					pid: bindings.pid,
				}),
				level: (label) => ({ level: label }),
			},
			level: overrides.level ?? getLogLevel(options),
			name: 'link-checker',
			redact: overrides.redact ?? {
				censor: '[Redacted]',
				paths: LOGGER_REDACT_PATHS,
			},
			serializers: {
				err: pino.stdSerializers.err,
			},
			timestamp: pino.stdTimeFunctions.isoTime,
		},
		overrides.destination ?? createDestination(options.mode),
	);
}

export function getLogger(bindings?: LogBindings): pino.Logger {
	const currentLogger = logger ?? configureLogger({ mode: 'cli', verbose: false });

	return bindings ? currentLogger.child(bindings) : currentLogger;
}

function createDestination(mode: RunMode): pino.DestinationStream | undefined {
	if (!shouldPrettyPrint(mode)) {
		return undefined;
	}

	return pretty({
		colorize: true,
		ignore: 'pid,host',
		levelFirst: true,
		messageFormat: '{msg}',
		translateTime: 'SYS:standard',
	});
}

function getLoggerSignature(options: LoggerOptions): string {
	return JSON.stringify({
		enabled: !isTestEnvironment(),
		level: getLogLevel(options),
		mode: options.mode,
		pretty: shouldPrettyPrint(options.mode),
	});
}

function getLogLevel(options: LoggerOptions): string {
	return process.env.LOG_LEVEL?.trim().toLowerCase() || (options.verbose ? 'debug' : 'info');
}

function isTestEnvironment(): boolean {
	return process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
}

function shouldPrettyPrint(mode: RunMode): boolean {
	return mode === 'cli' && process.stdout.isTTY && !process.env.CI;
}
