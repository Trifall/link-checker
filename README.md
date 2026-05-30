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
pnpm run build
pnpm run test
pnpm run test:unit
pnpm run test:e2e
pnpm run lint
pnpm run lint:fix
pnpm run format
pnpm run format:check
pnpm run typecheck
pnpm run check
pnpm run smoke
```

`pnpm run check` runs lint, typecheck, tests, and build in sequence.

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

The action and CLI share the same core options. In the CLI, list options like `--allow-domain` use singular flag names (e.g. `--allow-domain foo.com --allow-domain bar.com`), while action inputs use plural names with multiline values.

| Input | CLI flag | Action input | Default | Description |
| --- | --- | --- | --- | --- |
| `paths` | `--paths` | `paths` | `**/*.md`, `**/*.mdx` | Markdown files or glob patterns to scan |
| `exclude` | `--exclude` | `exclude` | `.git/**`, `.next/**`, `.svelte-kit/**`, `build/**`, `coverage/**`, `dist/**`, `node_modules/**` | Files or glob patterns to skip |
| `ignore-domains` | `--ignore-domain` | `ignore-domains` | | Domains to skip entirely |
| `ignore-url-patterns` | `--ignore-url-pattern` | `ignore-url-patterns` | | URL patterns to skip (prefix with `regex:` for regex) |
| `allow-domains` | `--allow-domain` | `allow-domains` | | Domains whose failures may be downgraded to warnings |
| `deny-domains` | `--deny-domain` | `deny-domains` | | Domains whose warning-class responses should be treated as errors |
| `allow-status-codes` | `--allow-status-code` | `allow-status-codes` | | Status codes to treat as successful |
| `deny-status-codes` | `--deny-status-code` | `deny-status-codes` | | Status codes to force as errors |
| `timeout-seconds` | `--timeout-seconds` | `timeout-seconds` | `15` | Per-request timeout in seconds |
| `concurrency` | `--concurrency` | `concurrency` | `20` | Maximum number of concurrent checks |
| `retries` | `--retries` | `retries` | `2` | Retry attempts for retryable failures |
| `retry-base-delay-ms` | `--retry-base-delay-ms` | `retry-base-delay-ms` | `250` | Base retry delay in milliseconds |
| `retry-max-delay-ms` | `--retry-max-delay-ms` | `retry-max-delay-ms` | `2000` | Maximum retry delay in milliseconds |
| `fail-on` | `--fail-on` | `fail-on` | `mixed` | Failure mode: `error`, `mixed`, or `warning` |
| `output-json` | `--output-json` | `output-json` | | Optional path for a JSON report file |
| `verbose` | `--verbose` | `verbose` | `false` | Enable verbose logging |
| `respect-gitignore` | `--no-respect-gitignore` | `respect-gitignore` | `true` | Whether to respect `.gitignore` rules during file discovery |
| `user-agent` | `--user-agent` | `user-agent` | `trifall/link-checker` | Override the default user agent |
| `config-file` | `--config` | `config-file` | (auto-detected) | Path to a JSON or JSONC config file |

CLI-only options (no action equivalent):

| CLI flag | Default | Description |
| --- | --- | --- |
| `--format` | `text` | Output format: `text`, `json`, or `markdown` |
| `--detail` | `simple` | Issue detail level: `simple` or `detailed` |
| `--detailed` | | Alias for `--detail detailed` |
| `--issues-only` | `false` | Only include errors and warnings in rendered output |

The `outputDetail` config file key controls issue detail level for config-driven runs. It is not exposed as a direct action input; set it in a config file when using the action.

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
