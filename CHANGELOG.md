# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-07-20

### Added

- Initial release of api-replay library
- HTTP recording and replay functionality for Bun runtime
- `ReplayAPI` class with `start()`, `done()`, `setVerbose()`, `wasReplayed()`, and `getMode()` methods
- Configurable request matching with include/exclude rules for headers, query parameters, and body
- Request deduplication during recording to prevent unnecessary API calls
- Automatic mode detection (record vs replay) based on existing recording files
- Global fetch interception for seamless integration with existing test code
- JSON recording storage with metadata (timestamp, test name, library version)
- Comprehensive TypeScript type definitions
- Full test suite with 100% line coverage and 94.02% function coverage
- ESLint and Prettier configuration for code quality
- Pre-commit hooks with Husky for automated code formatting
- CI/CD pipeline with GitHub Actions
- Complete JSDoc documentation for all public APIs

### Features

- **Zero-configuration**: Works out of the box with sensible defaults
- **Bun-native**: Built specifically for Bun runtime with optimized performance
- **Type-safe**: Full TypeScript support with comprehensive type definitions
- **Flexible matching**: Configurable rules for matching requests during replay
- **Test isolation**: Automatic test name to filename conversion with proper sanitization
- **Deduplication**: Prevents duplicate requests during recording phase
- **Verbose logging**: Optional detailed logging for debugging and monitoring

### Technical Details

- Requires Bun >= 1.1.0
- Zero external dependencies
- Recordings stored in `./apirecordings/` directory
- Compatible with any HTTP client that uses fetch API
- Supports all HTTP methods (GET, POST, PUT, DELETE, etc.)
- Handles request and response bodies of any content type