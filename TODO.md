# TODO: Testing Improvements for api-replay

This document outlines the testing improvements to be implemented for the api-replay library. All tests will be implemented without using mocks, relying on real file I/O and actual operations.

## 1. Edge Case Tests for Malformed Recordings

Create actual malformed recording files on disk to test error handling:

### Test Cases to Implement:
- [ ] **Invalid JSON syntax**
  - Missing brackets/braces
  - Trailing commas
  - Unterminated strings
  - Invalid escape sequences

- [ ] **Missing required fields**
  - Recording file without meta section
  - Recording file without calls array
  - Calls without request/response data
  - Missing required fields in request/response objects

- [ ] **Wrong data types**
  - String where number expected (e.g., status code)
  - Null where object expected
  - Array where object expected
  - Invalid types for headers/body

- [ ] **Corrupted response data**
  - Invalid base64 encoded bodies
  - Truncated response bodies
  - Invalid header formats
  - Malformed URLs

- [ ] **Version mismatches**
  - Old format recordings (e.g., version 0.x.x)
  - Future version recordings (e.g., version 2.0.0)
  - Missing version field
  - Version compatibility warnings

- [ ] **File system issues**
  - Read-only recording files
  - Missing recordings directory
  - Insufficient permissions
  - Symlink edge cases

- [ ] **Empty/zero-byte files**
  - Completely empty files
  - Files with only whitespace
  - Files with BOM (Byte Order Mark)

## 2. Concurrent Usage Scenarios

Test real concurrent operations using actual parallel execution:

### Test Cases to Implement:
- [ ] **Multiple tests using same recording**
  - Parallel reads from same recording file
  - Verify no corruption or race conditions
  - Test file locking behavior

- [ ] **Simultaneous record/replay modes**
  - Different tests running in different modes
  - Ensure proper isolation between instances
  - Test state management under concurrency

- [ ] **Race condition scenarios**
  - Multiple start() calls before done()
  - Concurrent done() calls
  - Interleaved start/done sequences
  - Async context switching during operations

- [ ] **File locking scenarios**
  - Writing while another process is reading
  - Multiple writers to same recording
  - Handling of locked files gracefully

- [ ] **Parallel matching operations**
  - Multiple requests matching against same recordings simultaneously
  - Verify thread-safe matching logic
  - Test performance under concurrent load

- [ ] **State isolation verification**
  - Ensure no cross-contamination between parallel instances
  - Verify each instance maintains independent state
  - Test global fetch restoration under concurrency

## 3. Performance Benchmarks for Large Recording Files

Create actual large recording files to measure and optimize performance:

### Benchmark Scenarios:
- [ ] **Large file sizes**
  - 10MB recording files
  - 50MB recording files
  - 100MB recording files
  - Measure load times and memory usage

- [ ] **Many recorded calls**
  - 1,000 calls in single file
  - 5,000 calls in single file
  - 10,000 calls in single file
  - Measure search/matching performance

- [ ] **Complex matching scenarios**
  - Deep object comparisons for headers
  - Large request/response bodies
  - Complex query parameter matching
  - Measure matching algorithm performance

- [ ] **Memory usage tracking**
  - Monitor memory during large file operations
  - Check for memory leaks
  - Verify efficient memory usage patterns
  - Test garbage collection behavior

- [ ] **Load time benchmarks**
  - Time to load and parse large recordings
  - Compare JSON.parse performance
  - Test streaming vs. full load approaches

- [ ] **Search performance metrics**
  - Time to find first match
  - Time to find last match
  - Time for no-match scenarios
  - Average matching time across call positions

## Implementation Strategy

### 1. Test Data Generators
Create utilities to programmatically generate:
- Malformed JSON files with specific corruption patterns
- Large recording files with configurable sizes
- Recording files with specific structures for testing

### 2. Real File I/O Testing
- Use Bun.write() to create test files
- Use actual file system operations
- Create temporary directories for test isolation
- Clean up test files after each test

### 3. Performance Measurement Tools
- Use Bun's built-in benchmark capabilities
- Create performance baseline measurements
- Track performance regressions
- Generate performance reports

### 4. Parallel Execution Framework
- Use Bun's test runner parallelization
- Create race condition reproducers
- Implement concurrent test scenarios
- Verify thread safety

### 5. Helper Utilities
- Recording file generator functions
- Corruption pattern generators
- Performance data collectors
- Test cleanup utilities

## Success Criteria

1. **Robustness**: Library handles all malformed input gracefully
2. **Concurrency**: Safe operation under parallel usage
3. **Performance**: Acceptable performance with large files
4. **Error Messages**: Clear, actionable error messages for all edge cases
5. **No Regressions**: Existing functionality remains intact

## Priority Order

1. **High Priority**: Malformed recordings tests (data integrity)
2. **High Priority**: Concurrent usage tests (production safety)
3. **Medium Priority**: Performance benchmarks (optimization)

This plan ensures comprehensive testing of edge cases and real-world scenarios without relying on mocks, using actual file operations and real concurrent execution.