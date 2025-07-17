# Changelog

## 1.0.0 (2025-07-17)


### ⚠ BREAKING CHANGES

* **compatibility:** Minimum required Bun version is now 1.1.0

### Features

* add automated npm publishing workflow ([54bbc3a](https://github.com/subtree/api-replay/commit/54bbc3a66ad230e7ca5b4ce384c607f23d2e6c28))
* add automatic release notes workflow ([e5c819e](https://github.com/subtree/api-replay/commit/e5c819ecbc36f869407f1dadb0767b503156846a))
* **ai-history:** Create ai-history.md to log user commands and requests ([d5eba46](https://github.com/subtree/api-replay/commit/d5eba46e8282a9d4274d786ea9e3d997e6278be1))
* **api-replay:** Implement core API replay functionality with recording and replay modes, including comprehensive test suite and configuration files ([de8d56a](https://github.com/subtree/api-replay/commit/de8d56a6f40dd66e0a40245eb44ab753e32ea94d))
* **ci:** Implement GitHub Actions CI/CD workflow for automated testing and coverage reporting ([695765a](https://github.com/subtree/api-replay/commit/695765a27fde2d71026a3a558e5e8e79c1408045))
* **testing:** Implement robust CI-safe test suite ([4d29316](https://github.com/subtree/api-replay/commit/4d29316a74651c8a1c5036c1eff99289120fc72e))
* **tests:** Add comprehensive matching and deduplication test suites for API replay functionality, enhancing coverage and validation of include/exclude logic ([78052e1](https://github.com/subtree/api-replay/commit/78052e1d9d33073ecea0c8faf1c06ffcffb231dc))
* **tests:** Enhance CI-safe test suite and update API recordings ([619266d](https://github.com/subtree/api-replay/commit/619266d9b39fea44af75a8544ac2c2de491ada2b))
* **TODO, ai-history, README:** Update TODO.md with replay verification mechanism, enhance ai-history with user request details, and clarify README support for Bun ([9b0ff3e](https://github.com/subtree/api-replay/commit/9b0ff3e23ace93af7f2932b4516e564cb3865ed6))
* **TODO:** Create detailed TODO.md outlining implementation steps for api-replay library ([1d11d73](https://github.com/subtree/api-replay/commit/1d11d730ef8151e4f80bb5da77498f85c9136815))


### Bug Fixes

* **ci:** Separate TypeScript declaration generation from build process to resolve CI failures ([709cd9b](https://github.com/subtree/api-replay/commit/709cd9b62395dd882af647243b98ea058b9d0fdc))
* **compatibility:** Further improve response handling for Bun 1.0.0 ([94cbaed](https://github.com/subtree/api-replay/commit/94cbaedede73088fdad96afa80c81866987b68e9))
* **compatibility:** Improve response handling for Bun 1.0.0 compatibility ([729d640](https://github.com/subtree/api-replay/commit/729d640e85b3b1926eca38bfa977141a88bb67da))
* handle case when no tags are found in version bump logic ([828231d](https://github.com/subtree/api-replay/commit/828231d5182cb5ff1b04da4ce482142c794194db))
* **tests:** Resolve GitHub Actions test failures by addressing async error handling and enhancing deduplication test validation ([eefa955](https://github.com/subtree/api-replay/commit/eefa955d4b4f8c90336d13470adf72bb388e60e0))
* **types:** Resolve TypeScript type errors ([b4e1468](https://github.com/subtree/api-replay/commit/b4e1468194b51c0c2370ffb04f7a95b52453674c))
* update permissions to include issues write access. ([599a91b](https://github.com/subtree/api-replay/commit/599a91bf8be53461f4f8aa7dc685bc2174832bec))


### Miscellaneous Chores

* **compatibility:** Update minimum Bun version to 1.1.0 ([5a92978](https://github.com/subtree/api-replay/commit/5a92978310af800024d3f3618dddfe44a3681674))
