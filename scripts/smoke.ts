import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { runLinkCheck } from '../src/core/run-link-check.js';

const cwd = await mkdtemp(path.join(tmpdir(), 'link-checker-smoke-'));
const server = createServer((request, response) => {
	if (request.url === '/redirect') {
		response.writeHead(302, { location: '/ok' }).end();
		return;
	}

	if (request.url === '/ok') {
		response.writeHead(200).end('ok');
		return;
	}

	response.writeHead(404).end('missing');
});

try {
	await new Promise<void>((resolve) => {
		server.listen(0, '127.0.0.1', () => resolve());
	});

	const address = server.address();

	if (!address || typeof address === 'string') {
		throw new Error('Expected a TCP server address.');
	}

	const baseUrl = `http://127.0.0.1:${address.port}`;

	await writeFile(
		path.join(cwd, 'README.md'),
		[
			`[ok](${baseUrl}/ok)`,
			`[redirect](${baseUrl}/redirect)`,
			`[missing](${baseUrl}/missing)`,
		].join('\n'),
	);

	await writeFile(
		path.join(cwd, 'link-checker.config.jsonc'),
		[
			'{',
			'	// local smoke config',
			'	"paths": ["README.md"],',
			'	"timeoutSeconds": 5,',
			'	"retries": 0,',
			'	"outputJson": "report.json",',
			'}',
		].join('\n'),
	);

	const result = await runLinkCheck({
		configFile: 'link-checker.config.jsonc',
		cwd,
	});

	if (result.checkedCount !== 3 || result.brokenCount !== 1 || result.redirectedCount !== 1) {
		throw new Error(`Unexpected smoke result: ${JSON.stringify(result, null, 2)}`);
	}

	if (!result.reportPath) {
		throw new Error('Smoke run did not produce a JSON report.');
	}

	const report = JSON.parse(await readFile(result.reportPath, 'utf8')) as {
		summary?: { redirectedCount?: number };
	};

	if (report.summary?.redirectedCount !== 1) {
		throw new Error(`Unexpected report payload: ${JSON.stringify(report, null, 2)}`);
	}

	console.log(result.note);
	console.log(`Smoke passed with report at ${result.reportPath}`);
} finally {
	await new Promise<void>((resolve, reject) => {
		server.close((error) => {
			if (error) {
				reject(error);
				return;
			}

			resolve();
		});
	});
	await rm(cwd, { force: true, recursive: true });
}
