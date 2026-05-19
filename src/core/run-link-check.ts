import { checkLinks } from './check.js';
import { resolveConfig } from './config.js';
import { discoverFiles } from './discovery.js';
import { extractLinks } from './extract.js';
import { configureLogger, getLogger } from './logger.js';
import { buildDomainStats, buildSummary, shouldFailRun, writeJsonReport } from './report.js';
import type { RawConfig, RunResult } from './types.js';

export async function runLinkCheck(input: RawConfig = {}): Promise<RunResult> {
	const config = await resolveConfig(input);
	configureLogger({ mode: config.mode, verbose: config.verbose });
	const logger = getLogger({ component: 'run-link-check' });

	logger.info(
		{
			configFile: config.configFile,
			cwd: config.cwd,
			pathCount: config.paths.length,
		},
		'Starting link check run',
	);
	const discoveredFiles = await discoverFiles(config);
	const extracted = await extractLinks(discoveredFiles, config);
	const checks = await checkLinks(extracted.groupedLinks, config);
	const brokenCount = checks.filter((check) => check.status === 'error').length;
	const domainStats = buildDomainStats(checks);
	const redirectedCount = checks.filter((check) => check.redirected).length;
	const warningCount = checks.filter((check) => check.status === 'warning').length;
	const resultWithoutReport = {
		brokenCount,
		checks,
		checkedCount: checks.length,
		config,
		domainStats,
		discoveredFileCount: discoveredFiles.length,
		extractedLinkCount: extracted.extractedLinkCount,
		redirectedCount,
		shouldFail: shouldFailRun(config, checks),
		warningCount,
	} satisfies Omit<RunResult, 'note' | 'reportPath'>;
	const note = buildSummary(resultWithoutReport);
	const reportPath = await writeJsonReport(config, {
		...resultWithoutReport,
		note,
	});

	logger.info(
		{
			brokenCount,
			checkedCount: checks.length,
			discoveredFileCount: discoveredFiles.length,
			extractedLinkCount: extracted.extractedLinkCount,
			reportPath,
			shouldFail: resultWithoutReport.shouldFail,
			warningCount,
		},
		'Completed link check run',
	);

	return {
		...resultWithoutReport,
		...(reportPath ? { reportPath } : {}),
		note,
		config,
	};
}
