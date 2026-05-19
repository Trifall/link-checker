import { getLogger } from './logger.js';
import { formatCheck } from './report.js';
import type {
	CheckedLinkResult,
	GroupedLink,
	HttpMethod,
	LinkCheckStatus,
	RunConfig,
} from './types.js';

const HEAD_FALLBACK_STATUS_CODES = new Set([401, 403, 405, 406, 500, 501, 502, 503]);
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const REQUEST_HEADERS = {
	accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
	'accept-language': 'en-US,en;q=0.9',
	'cache-control': 'no-cache',
	'sec-fetch-dest': 'document',
	'sec-fetch-mode': 'navigate',
	'sec-fetch-site': 'none',
	'sec-fetch-user': '?1',
	'upgrade-insecure-requests': '1',
} as const;

type CheckOutcome = {
	finalUrl?: string;
	message: string;
	method?: HttpMethod;
	redirected: boolean;
	retryable: boolean;
	status: LinkCheckStatus;
	statusCode?: number;
};

export async function checkLinks(
	groupedLinks: GroupedLink[],
	config: RunConfig,
): Promise<CheckedLinkResult[]> {
	const logger = getLogger({ component: 'check' });

	logger.debug(
		{
			concurrency: config.concurrency,
			retries: config.retries,
			uniqueUrlCount: groupedLinks.length,
		},
		'Checking extracted links',
	);

	const checks = await mapConcurrently(groupedLinks, config.concurrency, async (groupedLink) => {
		const outcome = await retryCheck(groupedLink.url, config);
		const check = {
			attempts: outcome.attempts,
			...(outcome.finalUrl ? { finalUrl: outcome.finalUrl } : {}),
			message: outcome.message,
			...(outcome.method ? { method: outcome.method } : {}),
			occurrences: groupedLink.occurrences,
			redirected: outcome.redirected,
			status: outcome.status,
			...(outcome.statusCode ? { statusCode: outcome.statusCode } : {}),
			url: groupedLink.url,
		} satisfies CheckedLinkResult;

		logCompletedCheck(check, config);

		return check;
	});

	const sortedChecks = checks.sort(
		(left, right) => compareStatus(left.status, right.status) || left.url.localeCompare(right.url),
	);

	logger.debug(
		{
			errorCount: sortedChecks.filter((check) => check.status === 'error').length,
			okCount: sortedChecks.filter((check) => check.status === 'ok').length,
			warningCount: sortedChecks.filter((check) => check.status === 'warning').length,
		},
		'Finished checking links',
	);

	return sortedChecks;
}

function createIssueLogObject(
	config: RunConfig,
	check: CheckedLinkResult,
): { check: CheckedLinkResult } | undefined {
	if (config.outputDetail !== 'detailed') {
		return undefined;
	}

	return { check };
}

function logCompletedCheck(check: CheckedLinkResult, config: RunConfig): void {
	if (config.mode !== 'cli' || check.status === 'ok') {
		return;
	}

	const logger = getLogger({ component: 'check' });
	const writer = check.status === 'error' ? logger.error.bind(logger) : logger.warn.bind(logger);
	const logObject = createIssueLogObject(config, check);

	if (logObject) {
		writer(logObject, formatCheck(check));
		return;
	}

	writer(formatCheck(check));
}

async function checkUrl(url: string, config: RunConfig): Promise<CheckOutcome> {
	const headOutcome = await requestUrl(url, 'HEAD', config);

	if (headOutcome.status === 'ok' || !shouldFallbackToGet(headOutcome)) {
		return headOutcome;
	}

	return requestUrl(url, 'GET', config);
}

function applyOutcomeRules(
	originalUrl: string,
	outcome: CheckOutcome,
	config: RunConfig,
): CheckOutcome {
	const logger = getLogger({ component: 'check' });
	let nextOutcome = { ...outcome };
	const effectiveUrl = outcome.finalUrl ?? originalUrl;
	const allowDomainMatch = matchesDomainRule(config.allowDomains, originalUrl, effectiveUrl);
	const denyDomainMatch = matchesDomainRule(config.denyDomains, originalUrl, effectiveUrl);
	let denyRuleMatched = false;

	if (outcome.statusCode !== undefined && config.allowStatusCodes.includes(outcome.statusCode)) {
		nextOutcome = {
			...nextOutcome,
			message: `${nextOutcome.message} (allowlisted status code)`,
			status: 'ok',
		};
	}

	if (outcome.statusCode !== undefined && config.denyStatusCodes.includes(outcome.statusCode)) {
		denyRuleMatched = true;
		nextOutcome = {
			...nextOutcome,
			message: `${nextOutcome.message} (denylisted status code)`,
			status: 'error',
		};
	}

	if (allowDomainMatch && !denyRuleMatched && nextOutcome.status === 'error') {
		nextOutcome = {
			...nextOutcome,
			message: `${nextOutcome.message} (allowlisted domain)`,
			status: 'warning',
		};
	}

	if (denyDomainMatch && nextOutcome.status === 'warning') {
		denyRuleMatched = true;
		nextOutcome = {
			...nextOutcome,
			message: `${nextOutcome.message} (denylisted domain)`,
			status: 'error',
		};
	}

	if (nextOutcome.status !== outcome.status || nextOutcome.message !== outcome.message) {
		logger.debug(
			{ nextStatus: nextOutcome.status, originalStatus: outcome.status, url: originalUrl },
			'Applied outcome policy overrides',
		);
	}

	return nextOutcome;
}

function compareStatus(left: LinkCheckStatus, right: LinkCheckStatus): number {
	return severityForStatus(right) - severityForStatus(left);
}

function classifyError(error: unknown, method: HttpMethod): CheckOutcome {
	const errorMessage = error instanceof Error ? error.message : String(error);
	const errorCode = getErrorCode(error);

	if (errorMessage.toLowerCase().includes('timeout') || errorCode === 'ETIMEDOUT') {
		return {
			message: `${method} timed out`,
			method,
			redirected: false,
			retryable: true,
			status: 'error',
		};
	}

	if (errorCode === 'EAI_AGAIN' || errorCode === 'ECONNRESET') {
		return {
			message: `${method} failed with a transient network error (${errorCode})`,
			method,
			redirected: false,
			retryable: true,
			status: 'warning',
		};
	}

	if (errorCode === 'ENOTFOUND') {
		return {
			message: `${method} failed because the host could not be resolved`,
			method,
			redirected: false,
			retryable: false,
			status: 'error',
		};
	}

	if (errorCode === 'ECONNREFUSED') {
		return {
			message: `${method} failed because the connection was refused`,
			method,
			redirected: false,
			retryable: false,
			status: 'error',
		};
	}

	return {
		message: `${method} failed: ${errorMessage}`,
		method,
		redirected: false,
		retryable: false,
		status: 'error',
	};
}

function classifyResponse(
	statusCode: number,
	method: HttpMethod,
	originalUrl: string,
	finalUrl: string,
): CheckOutcome {
	const redirected = finalUrl !== originalUrl;
	const redirectMessage = redirected ? ` after redirect to ${finalUrl}` : '';

	if (statusCode >= 200 && statusCode <= 399) {
		return {
			...(redirected ? { finalUrl } : {}),
			message: `${method} returned ${statusCode}${redirectMessage}`,
			method,
			redirected,
			retryable: false,
			status: 'ok',
			statusCode,
		};
	}

	if (statusCode === 401 || statusCode === 403 || statusCode === 429 || statusCode >= 500) {
		return {
			...(redirected ? { finalUrl } : {}),
			message: `${method} returned ${statusCode}${redirectMessage}`,
			method,
			redirected,
			retryable: RETRYABLE_STATUS_CODES.has(statusCode),
			status: 'warning',
			statusCode,
		};
	}

	return {
		...(redirected ? { finalUrl } : {}),
		message: `${method} returned ${statusCode}${redirectMessage}`,
		method,
		redirected,
		retryable: RETRYABLE_STATUS_CODES.has(statusCode),
		status: 'error',
		statusCode,
	};
}

function getErrorCode(error: unknown): string | undefined {
	if (!(error instanceof Error)) {
		return undefined;
	}

	const cause = (error as Error & { cause?: { code?: string } }).cause;

	if (typeof cause?.code === 'string') {
		return cause.code;
	}

	return undefined;
}

function getHostname(value: string): string | undefined {
	try {
		return new URL(value).hostname.toLowerCase();
	} catch {
		return undefined;
	}
}

async function mapConcurrently<Input, Output>(
	items: Input[],
	concurrency: number,
	mapper: (item: Input) => Promise<Output>,
): Promise<Output[]> {
	const normalizedConcurrency = Math.max(1, Math.floor(concurrency));
	const results = [] as Output[];
	let nextIndex = 0;

	await Promise.all(
		Array.from({ length: Math.min(normalizedConcurrency, items.length) }, async () => {
			while (nextIndex < items.length) {
				const currentIndex = nextIndex;
				nextIndex += 1;
				results[currentIndex] = await mapper(items[currentIndex]!);
			}
		}),
	);

	return results;
}

async function requestUrl(
	url: string,
	method: HttpMethod,
	config: RunConfig,
): Promise<CheckOutcome> {
	try {
		const response = await fetch(url, {
			headers: {
				...REQUEST_HEADERS,
				'user-agent': config.userAgent,
			},
			method,
			redirect: 'follow',
			signal: AbortSignal.timeout(config.timeoutSeconds * 1_000),
		});

		await response.body?.cancel().catch(() => undefined);

		return classifyResponse(response.status, method, url, response.url);
	} catch (error) {
		return classifyError(error, method);
	}
}

async function sleep(delayMs: number): Promise<void> {
	if (delayMs <= 0) {
		return;
	}

	await new Promise<void>((resolve) => {
		setTimeout(resolve, delayMs);
	});
}

async function retryCheck(
	url: string,
	config: RunConfig,
): Promise<CheckOutcome & { attempts: number }> {
	const maxAttempts = config.retries + 1;
	let latestOutcome: CheckOutcome | undefined;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		latestOutcome = await checkUrl(url, config);

		if (latestOutcome.status === 'ok' || !latestOutcome.retryable || attempt === maxAttempts) {
			const finalizedOutcome = finalizeOutcome(url, latestOutcome, attempt, config);

			return {
				attempts: attempt,
				...(finalizedOutcome.finalUrl ? { finalUrl: finalizedOutcome.finalUrl } : {}),
				message: finalizedOutcome.message,
				...(finalizedOutcome.method ? { method: finalizedOutcome.method } : {}),
				redirected: finalizedOutcome.redirected,
				retryable: finalizedOutcome.retryable,
				status: finalizedOutcome.status,
				...(finalizedOutcome.statusCode ? { statusCode: finalizedOutcome.statusCode } : {}),
			};
		}

		const delayMs = calculateRetryDelay(attempt, config);

		getLogger({ component: 'check' }).debug(
			{
				attempt,
				delayMs,
				status: latestOutcome.status,
				statusCode: latestOutcome.statusCode,
				url,
			},
			'Retrying link check',
		);

		await sleep(delayMs);
	}

	const finalizedOutcome = finalizeOutcome(
		url,
		latestOutcome ?? createFallbackOutcome(),
		maxAttempts,
		config,
	);

	return {
		attempts: maxAttempts,
		...(finalizedOutcome.finalUrl ? { finalUrl: finalizedOutcome.finalUrl } : {}),
		message: finalizedOutcome.message,
		...(finalizedOutcome.method ? { method: finalizedOutcome.method } : {}),
		redirected: finalizedOutcome.redirected,
		retryable: finalizedOutcome.retryable,
		status: finalizedOutcome.status,
		...(finalizedOutcome.statusCode ? { statusCode: finalizedOutcome.statusCode } : {}),
	};
}

function calculateRetryDelay(attempt: number, config: RunConfig): number {
	const exponentialDelay = config.retryBaseDelayMs * 2 ** Math.max(0, attempt - 1);
	const boundedDelay = Math.min(exponentialDelay, config.retryMaxDelayMs);
	const jitter = boundedDelay * (Math.random() * 0.3);

	return Math.floor(boundedDelay + jitter);
}

function createFallbackOutcome(): CheckOutcome {
	return {
		message: 'No response recorded',
		redirected: false,
		retryable: false,
		status: 'error',
	};
}

function finalizeOutcome(
	originalUrl: string,
	baseOutcome: CheckOutcome,
	attempts: number,
	config: RunConfig,
): CheckOutcome {
	let finalizedOutcome = { ...baseOutcome };

	if (attempts > 1) {
		finalizedOutcome.message = `${finalizedOutcome.message} after ${attempts} attempts`;
	}

	return applyOutcomeRules(originalUrl, finalizedOutcome, config);
}

function matchesDomainRule(rules: string[], ...urls: string[]): boolean {
	const hostnames = urls
		.map((url) => getHostname(url))
		.filter((hostname): hostname is string => hostname !== undefined);

	return rules.some((rule) => {
		const normalizedRule = rule.toLowerCase();

		return hostnames.some(
			(hostname) => hostname === normalizedRule || hostname.endsWith(`.${normalizedRule}`),
		);
	});
}

function severityForStatus(status: LinkCheckStatus): number {
	if (status === 'error') {
		return 3;
	}

	if (status === 'warning') {
		return 2;
	}

	return 1;
}

function shouldFallbackToGet(outcome: CheckOutcome): boolean {
	return outcome.method === 'HEAD' && outcome.statusCode !== undefined
		? HEAD_FALLBACK_STATUS_CODES.has(outcome.statusCode)
		: false;
}
