export { normalizeConfig, resolveConfig } from './core/config.js';
export { configureLogger, createLogger, getLogger, LOGGER_REDACT_PATHS } from './core/logger.js';
export { runLinkCheck } from './core/run-link-check.js';
export type {
	CheckedLinkResult,
	DomainStat,
	DiscoveredFile,
	FailOn,
	GroupedLink,
	HttpMethod,
	LinkCheckStatus,
	LinkOccurrence,
	OutputDetail,
	RawConfig,
	RunConfig,
	RunMode,
	RunResult,
} from './core/types.js';
