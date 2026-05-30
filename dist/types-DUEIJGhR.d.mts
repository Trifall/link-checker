//#region src/core/types.d.ts
type FailOn = "error" | "mixed" | "warning";
type HttpMethod = "GET" | "HEAD";
type LinkCheckStatus = "error" | "ok" | "warning";
type OutputDetail = "detailed" | "simple";
type RunMode = "action" | "cli";
type RawConfig = {
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
type RunConfig = {
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
type DiscoveredFile = {
  absolutePath: string;
  relativePath: string;
};
type LinkOccurrence = {
  column: number;
  filePath: string;
  line: number;
  url: string;
};
type GroupedLink = {
  occurrences: LinkOccurrence[];
  url: string;
};
type CheckedLinkResult = {
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
type DomainStat = {
  checkedCount: number;
  domain: string;
  errorCount: number;
  okCount: number;
  redirectCount: number;
  warningCount: number;
};
type RunResult = {
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
//#endregion
export { GroupedLink as a, LinkOccurrence as c, RunConfig as d, RunMode as f, FailOn as i, OutputDetail as l, DiscoveredFile as n, HttpMethod as o, RunResult as p, DomainStat as r, LinkCheckStatus as s, CheckedLinkResult as t, RawConfig as u };
//# sourceMappingURL=types-DUEIJGhR.d.mts.map