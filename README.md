# Link Checker

`link-checker` is a TypeScript GitHub Action and CLI for scanning Markdown files, checking external HTTP(S) links, and reporting links that need attention.

## Project Goal

The goal of this project is to make Markdown link checking usable in two places with the same core logic:

- locally, through a CLI
- in CI, through a GitHub Action

It is built to:

- discover Markdown files with glob patterns
- extract external links from Markdown content
- check links with retries, timeout controls, and redirect tracking
- report errors, warnings, and redirects clearly
- optionally write a JSON report for later processing

## Technologies Used

- TypeScript
- `commander` with `@commander-js/extra-typings`
- `unified`, `remark-parse`, `remark-gfm`, and `unist-util-visit` for Markdown parsing
- `globby` for file discovery
- `zod` for runtime config validation
- `pino` and `pino-pretty` for logging
- `vitest` for tests
- `tsdown` for builds and bundling
- `pnpm` for package management
- `oxlint` and `oxfmt` for linting and formatting
- `release-please` for release automation

## Development

```bash
pnpm install
pnpm run test:unit
pnpm run test:e2e
pnpm run check
pnpm run smoke
```

## CLI Usage

Run the checker against one or more Markdown paths or globs:

```bash
pnpm run dev:cli scan --paths README.md "docs/**/*.md"
```

Use a config file:

```bash
pnpm run dev:cli scan --config link-checker.config.json
```

Enable verbose logging and write a JSON report:

```bash
pnpm run dev:cli scan --paths "docs/**/*.md" --verbose --output-json reports/link-report.json
```

Show detailed issue payloads without enabling debug logs:

```bash
pnpm run dev:cli scan --paths "docs/**/*.md" --detailed
```

Render the result as JSON:

```bash
pnpm run dev:cli scan --paths "docs/**/*.md" --format json
```

Render the result as Markdown:

```bash
pnpm run dev:cli scan --paths "docs/**/*.md" --format markdown
```

When running through `pnpm run`, pass the `scan` command directly after the script name. Do not add an extra `--`; with pnpm, that separator is forwarded to the CLI and Commander treats it as an unexpected argument.

## Config File

JSON and JSONC config files are supported.

Example `link-checker.config.json`:

```json
{
  "paths": ["README.md", "docs/**/*.md"],
  "exclude": ["docs/generated/**"],
  "ignoreDomains": ["localhost"],
  "allowDomains": ["example.com"],
  "allowStatusCodes": [403, 429],
  "denyDomains": ["critical.example.com"],
  "denyStatusCodes": [503],
  "timeoutSeconds": 15,
  "concurrency": 20,
  "retries": 2,
  "retryBaseDelayMs": 250,
  "retryMaxDelayMs": 2000,
  "failOn": "mixed",
  "outputDetail": "simple",
  "outputJson": "reports/link-report.json"
}
```

Example `link-checker.config.jsonc`:

```jsonc
{
  // Scan curated docs
  "paths": ["README.md", "docs/**/*.md"],
  "exclude": ["docs/generated/**"],
  "ignoreDomains": ["localhost"],
  "outputJson": "reports/link-report.json",
}
```

If no config file is provided explicitly, the checker looks for:

- `link-checker.config.jsonc`
- `link-checker.config.json`
- `.link-checkerrc.jsonc`
- `.link-checkerrc`
- `.link-checkerrc.json`

## GitHub Action Usage

To use the action:

```yaml
jobs:
  link-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Trifall/link-checker@v1
        with:
          paths: |
            README.md
            docs/**/*.md
          exclude: |
            docs/generated/**
          ignore-domains: |
            localhost
          output-json: reports/link-report.json
```

You can also drive the action through a config file instead of many individual inputs:

```yaml
jobs:
  link-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: Trifall/link-checker@v1
        with:
          config-file: link-checker.config.json
```

To use the local action inside this repository:

```yaml
jobs:
  link-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: ./
        with:
          config-file: link-checker.config.json
```

## Main Inputs

The action and CLI share the same core options.

- `paths`: Markdown files or glob patterns to scan
- `exclude`: files or glob patterns to skip
- `ignore-domains`: domains to skip entirely
- `ignore-url-patterns`: URL patterns to skip
- `allow-domains`: domains whose failures may be downgraded to warnings
- `deny-domains`: domains whose warning-class responses should be treated as errors
- `allow-status-codes`: status codes to treat as successful
- `deny-status-codes`: status codes to force as errors
- `timeout-seconds`: per-request timeout
- `concurrency`: maximum number of concurrent checks
- `retries`: retry attempts for retryable failures
- `retry-base-delay-ms`: base retry delay
- `retry-max-delay-ms`: maximum retry delay
- `fail-on`: failure mode, one of `error`, `mixed`, or `warning`
- `output-json`: optional path for a JSON report
- `verbose`: enable verbose logging

## HTTP Responses and False Positives

The checker uses `HEAD` first and falls back to `GET` when common server behavior makes `HEAD` unreliable, such as `403`, `405`, or `503` responses. Requests include browser-like navigation headers, but some sites still use bot protection, regional routing, JavaScript challenges, or rate limiting that can return `403`, `429`, or `503` to automation while loading normally in a browser.

By default, authentication and protection-style responses such as `401`, `403`, `429`, and `5xx` are warnings rather than hard broken-link errors. If a domain is known to block automated checks, prefer one of these options:

```bash
pnpm run dev:cli scan --paths README.md --allow-domain anydesk.com --allow-domain canva.com
```

```bash
pnpm run dev:cli scan --paths README.md --allow-status-code 403 --allow-status-code 503
```

Use `--deny-domain` or `--deny-status-code` for links where those same responses should fail the run.

Config files also support `outputDetail`, one of `simple` or `detailed`, for CLI text issue output.

The CLI also supports `--format` with these values:

- `text`: default human-readable log output
- `json`: machine-readable result payload on stdout
- `markdown`: Markdown summary on stdout

The CLI also supports text issue detail controls:

- `--detail simple`: default concise issue output
- `--detail detailed`: include the structured `check` payload for each issue
- `--detailed`: alias for `--detail detailed`

## Reporting

The checker reports:

- total discovered files, extracted links, and checked links
- broken links and warning-class links with file locations
- redirect counts and final destination URLs
- per-domain summary data
- optional JSON output with detailed results

When running as a GitHub Action, it also writes step outputs and a job summary.

## Logging

Logging uses `pino`.

- interactive CLI runs use readable pretty logs
- CI and GitHub Actions runs emit structured JSON logs
- set `LOG_LEVEL` to override the default log level
- use `--verbose` in the CLI or `verbose: true` in the action to enable debug logging
- use `--detailed` or `--detail detailed` in the CLI for richer issue payloads without debug logs
- common sensitive fields such as `authorization`, `cookie`, `token`, `secret`, and `password` are redacted by default

## Versioning

Major version tags such as `v1` are updated to point at the latest matching major release. Use `uses: Trifall/link-checker@v1` to automatically receive compatible updates.
