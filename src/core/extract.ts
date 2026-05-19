import { readFile } from 'node:fs/promises';

import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

import { getLogger } from './logger.js';
import type { DiscoveredFile, GroupedLink, LinkOccurrence, RunConfig } from './types.js';

const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

type MarkdownNode = {
	children?: MarkdownNode[];
	identifier?: string;
	value?: string;
	position?: {
		start?: {
			column?: number;
			line?: number;
		};
	};
	type: string;
	url?: string;
};

export async function extractLinks(
	files: DiscoveredFile[],
	config: RunConfig,
): Promise<{ extractedLinkCount: number; groupedLinks: GroupedLink[] }> {
	const logger = getLogger({ component: 'extract' });

	logger.debug({ fileCount: files.length }, 'Extracting links from markdown files');

	const occurrences = await Promise.all(
		files.map(async (file) => extractLinksFromFile(file, config)),
	);
	const allOccurrences = occurrences.flat();
	const groupedLinks = groupLinks(allOccurrences);

	logger.debug(
		{ extractedLinkCount: allOccurrences.length, uniqueUrlCount: groupedLinks.length },
		'Finished extracting links',
	);

	return {
		extractedLinkCount: allOccurrences.length,
		groupedLinks,
	};
}

async function extractLinksFromFile(
	file: DiscoveredFile,
	config: RunConfig,
): Promise<LinkOccurrence[]> {
	const content = await readFile(file.absolutePath, 'utf8');
	const tree = markdownProcessor.parse(content);
	const definitions = new Map<string, string>();
	const occurrences: LinkOccurrence[] = [];

	visit(tree as never, 'definition', (node) => {
		const definitionNode = node as MarkdownNode;

		if (typeof definitionNode.identifier === 'string' && typeof definitionNode.url === 'string') {
			definitions.set(normalizeIdentifier(definitionNode.identifier), definitionNode.url);
		}
	});

	visit(tree as never, (node, _index, parent) => {
		const markdownNode = node as MarkdownNode;
		const parentNode = parent as MarkdownNode | undefined;

		if (markdownNode.type === 'link' && typeof markdownNode.url === 'string') {
			pushOccurrence(occurrences, file.relativePath, markdownNode, markdownNode.url, config);
		}

		if (markdownNode.type === 'linkReference' && typeof markdownNode.identifier === 'string') {
			const resolvedUrl = definitions.get(normalizeIdentifier(markdownNode.identifier));

			if (resolvedUrl) {
				pushOccurrence(occurrences, file.relativePath, markdownNode, resolvedUrl, config);
			}
		}

		if (markdownNode.type === 'text' && typeof markdownNode.value === 'string') {
			if (parentNode && shouldSkipTextNode(parentNode)) {
				return;
			}

			for (const bareUrl of extractBareUrls(markdownNode.value)) {
				pushOccurrence(occurrences, file.relativePath, markdownNode, bareUrl, config);
			}
		}
	});

	return occurrences;
}

function groupLinks(occurrences: LinkOccurrence[]): GroupedLink[] {
	const groupedLinks = new Map<string, LinkOccurrence[]>();

	for (const occurrence of occurrences) {
		const existingOccurrences = groupedLinks.get(occurrence.url);

		if (existingOccurrences) {
			existingOccurrences.push(occurrence);
			continue;
		}

		groupedLinks.set(occurrence.url, [occurrence]);
	}

	return [...groupedLinks.entries()]
		.map(([url, groupedOccurrences]) => ({
			occurrences: groupedOccurrences,
			url,
		}))
		.sort((left, right) => left.url.localeCompare(right.url));
}

function isIgnoredUrl(url: string, config: RunConfig): boolean {
	if (config.ignoreUrlPatterns.some((pattern) => matchesUrlPattern(url, pattern))) {
		return true;
	}

	try {
		const { hostname } = new URL(url);

		return config.ignoreDomains.some((domain) => {
			const normalizedDomain = domain.trim().toLowerCase();
			const normalizedHostname = hostname.toLowerCase();

			return (
				normalizedHostname === normalizedDomain ||
				normalizedHostname.endsWith(`.${normalizedDomain}`)
			);
		});
	} catch {
		return false;
	}
}

function isSupportedUrl(value: string): boolean {
	try {
		const url = new URL(value);

		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}

function matchesUrlPattern(url: string, pattern: string): boolean {
	const trimmedPattern = pattern.trim();

	if (!trimmedPattern) {
		return false;
	}

	if (trimmedPattern.startsWith('regex:')) {
		const rawPattern = trimmedPattern.slice('regex:'.length).replace(/^\/(.+)\/([gimsuyd]*)$/, '$1');

		try {
			return new RegExp(rawPattern).test(url);
		} catch {
			return false;
		}
	}

	if (!trimmedPattern.includes('*')) {
		return url === trimmedPattern;
	}

	const escapedPattern = escapeRegex(trimmedPattern).replaceAll('*', '.*');

	return new RegExp(`^${escapedPattern}$`).test(url);
}

function normalizeIdentifier(identifier: string): string {
	return identifier.trim().toLowerCase();
}

function pushOccurrence(
	occurrences: LinkOccurrence[],
	filePath: string,
	node: MarkdownNode,
	url: string,
	config: RunConfig,
): void {
	if (!isSupportedUrl(url) || isIgnoredUrl(url, config)) {
		return;
	}

	occurrences.push({
		column: node.position?.start?.column ?? 1,
		filePath,
		line: node.position?.start?.line ?? 1,
		url,
	});
}

function escapeRegex(value: string): string {
	return value.replaceAll(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function extractBareUrls(value: string): string[] {
	const matches = value.match(/https?:\/\/[^\s<>()\]]+/g);

	if (!matches) {
		return [];
	}

	return matches.map((match) => match.replaceAll(/[),.;:!?]+$/g, ''));
}

function shouldSkipTextNode(parentNode: MarkdownNode): boolean {
	return ['code', 'definition', 'inlineCode', 'link', 'linkReference'].includes(parentNode.type);
}
