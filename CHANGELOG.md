# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-04-04

### Added

- `bagdock doctor` command — CLI version, auth, project config, and AI agent diagnostics
- Multi-profile support — `bagdock auth list`, `bagdock auth switch`, `--profile` / `-p` global flag
- `BAGDOCK_PROFILE` environment variable for profile selection
- Backwards-compatible migration from flat credentials to profile-based format
- `install.sh` (macOS/Linux) and `install.ps1` (Windows) shell installers
- Test infrastructure with vitest — `tests/output.test.ts`, `tests/config.test.ts`, `tests/doctor.test.ts`
- CI now runs tests in addition to type checking and build verification
- CHANGELOG.md
- Skills installer metadata in `package.json`
- Expanded per-command README documentation with options tables, error codes, and examples

### Changed

- Output module `setOutputMode` now properly resets flags when called with `false` values
- Credentials file format updated to support multiple named profiles
- Version bumped to 0.3.0

## [0.2.0] - 2026-04-04

### Added

- Agent protocol: `--json`, `--quiet`, `--api-key` global flags
- `bagdock keys create|list|delete` — API key management commands
- `bagdock apps list|get` — deployed application commands
- `bagdock logs list|tail|get` — execution log commands
- Structured JSON output for non-TTY environments (auto-detected)
- `src/output.ts` — TTY/JSON output utilities
- Skills system — `SKILL.md`, reference documentation, and `evals.json`

### Changed

- Auth token resolution now follows priority chain: `--api-key` > `BAGDOCK_API_KEY` > `BAGDOCK_TOKEN` > credentials file
- `deploy`, `submit`, `env` commands updated to use unified `getAuthToken()`

## [0.1.4] - 2026-04-04

### Fixed

- `bin` path corrected for npm 11.x strict validation (removed `./` prefix)
- Added `keywords` for npm discoverability

## [0.1.3] - 2026-04-04

### Changed

- npm publishing via GitHub Actions OIDC Trusted Publishing (no tokens required)
- Updated CI to Node.js 24 for npm 11.x compatibility

## [0.1.1] - 2026-04-03

### Added

- Initial public release
- `bagdock login` — OAuth2 Device Authorization Grant (RFC 8628)
- `bagdock logout`, `bagdock whoami`
- `bagdock init` — project scaffolding with `bagdock.json`
- `bagdock deploy` — build and deploy to Cloudflare Workers for Platforms
- `bagdock submit` — marketplace submission
- `bagdock env list|set|remove` — environment variable management
- MIT License

[0.3.0]: https://github.com/bagdock/bagdock-cli/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/bagdock/bagdock-cli/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/bagdock/bagdock-cli/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/bagdock/bagdock-cli/compare/v0.1.1...v0.1.3
[0.1.1]: https://github.com/bagdock/bagdock-cli/releases/tag/v0.1.1
