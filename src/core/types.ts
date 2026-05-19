export type FailOn = 'error' | 'mixed' | 'warning';
export type HttpMethod = 'GET' | 'HEAD';
export type LinkCheckStatus = 'error' | 'ok' | 'warning';
export type OutputDetail = 'detailed' | 'simple';
export type RunMode = 'action' | 'cli';

export type RawConfig = {
	allowDomains?: string[] | undefined;
	allowStatusCodes?: number[] | undefined;
	concurrency?: number | undefined;
	configFile?: string | undefined;
	cwd?: string | undefined;
	denyDomains?: string[] | undefined;
	denyStatusCodes?: number[] | undefined;
	exclude?: string[] | undefined;
	failOn?: FailOn | string | undefined;
	ignoreDomains?: string[] | undefined;
	ignoreUrlPatterns?: string[] | undefined;
	mode?: RunMode | string | undefined;
	outputDetail?: OutputDetail | string | undefined;
	outputJson?: string | undefined;
	paths?: string[] | undefined;
	respectGitignore?: boolean | undefined;
	retryBaseDelayMs?: number | undefined;
	retryMaxDelayMs?: number | undefined;
	retries?: number | undefined;
	timeoutSeconds?: number | undefined;
	userAgent?: string | undefined;
	verbose?: boolean | undefined;
};

export type RunConfig = {
	allowDomains: string[];
	allowStatusCodes: number[];
	concurrency: number;
	configFile?: string;
	cwd: string;
	denyDomains: string[];
	denyStatusCodes: number[];
	exclude: string[];
	failOn: FailOn;
	ignoreDomains: string[];
	ignoreUrlPatterns: string[];
	mode: RunMode;
	outputDetail: OutputDetail;
	outputJson?: string;
	paths: string[];
	respectGitignore: boolean;
	retryBaseDelayMs: number;
	retryMaxDelayMs: number;
	retries: number;
	timeoutSeconds: number;
	userAgent: string;
	verbose: boolean;
};

export type DiscoveredFile = {
	absolutePath: string;
	relativePath: string;
};

export type LinkOccurrence = {
	column: number;
	filePath: string;
	line: number;
	url: string;
};

export type GroupedLink = {
	occurrences: LinkOccurrence[];
	url: string;
};

export type CheckedLinkResult = {
	attempts: number;
	finalUrl?: string;
	message: string;
	method?: HttpMethod;
	occurrences: LinkOccurrence[];
	redirected: boolean;
	status: LinkCheckStatus;
	statusCode?: number;
	url: string;
};

export type DomainStat = {
	checkedCount: number;
	domain: string;
	errorCount: number;
	okCount: number;
	redirectCount: number;
	warningCount: number;
};

export type RunResult = {
	brokenCount: number;
	checks: CheckedLinkResult[];
	checkedCount: number;
	config: RunConfig;
	domainStats: DomainStat[];
	discoveredFileCount: number;
	extractedLinkCount: number;
	note: string;
	reportPath?: string;
	redirectedCount: number;
	shouldFail: boolean;
	warningCount: number;
};
