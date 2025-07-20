# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`api-replay` is a TypeScript library for HTTP recording and replay designed specifically for Bun runtime. It simplifies integration testing by recording actual HTTP API calls and replaying them in subsequent test runs.

**Current Status**: Documentation phase - implementation not yet started.

## Development Commands

Once the project is set up with a package.json, use these commands:

```bash
# Install dependencies
bun install

# Run tests (Bun's built-in test runner)
bun test

# Run specific test file
bun test <filename>

# Build/compile TypeScript (once configured)
bun run build
```

## Architecture & Structure

### Planned Directory Structure
```
api-replay/
├── src/                    # Source code
│   ├── index.ts           # Main entry point exporting replayAPI
│   ├── recorder.ts        # Recording logic
│   ├── replayer.ts        # Replay logic
│   ├── matcher.ts         # Request matching logic
│   └── types.ts           # TypeScript types
├── __tests__/             # Test files
├── .api-replay/           # Recorded API responses (git-ignored)
├── package.json
├── tsconfig.json
└── bunfig.toml            # Bun configuration
```

### Core Components

1. **replayAPI Object**: Global singleton exposing `start()` and `done()` methods
2. **Fetch Interceptor**: Overrides global fetch to capture/replay requests
3. **Request Matcher**: Compares incoming requests against recorded ones using configurable rules
4. **File Storage**: JSON files in `./apirecordings/` directory

### Key Technical Considerations

- Must use Bun-specific APIs (`Bun.write`, `Bun.file`, etc.)
- Intercept fetch globally during test execution
- Handle async operations properly for recording/replay
- Support configurable request matching (headers, query params, body)
- Pretty-print JSON recordings for readability

## Testing Approach

- Use https://jsonplaceholder.typicode.com/ for integration tests
- Verify both recording (first run) and replay (subsequent runs)
- Test various matching configurations
- Ensure proper cleanup after tests (restore original fetch)

## Implementation Notes

When implementing:
1. Start with the type definitions in `types.ts`
2. Build the matcher logic to handle request comparison
3. Implement recorder to intercept and save fetch calls
4. Add replayer to serve recorded responses
5. Create the main API interface in `index.ts`
6. Write comprehensive tests for all scenarios

## MANDATORY: AI History Maintenance

**CRITICAL RULE:** You MUST update the `ai-history.md` file after EVERY user command/request. This is not optional.

**Process:**
1. After completing any user request, ALWAYS update `ai-history.md`
2. Add a new numbered command entry with:
   - User request (exact quote)
   - Context if relevant
   - Action taken (detailed summary)
   - Results/outcomes
   - Key insights or learnings
3. Use the existing format and numbering sequence
4. This must be done for EVERY interaction, no exceptions

**Purpose:** The ai-history.md file serves as a complete audit trail of all work done on this project, enabling future Claude instances to understand the full context and evolution of the codebase.

# important-instruction-reminders
Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.