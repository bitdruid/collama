# Change Log
https://keepachangelog.com/

## [Unreleased]

## [1.2.2] - 2026-02-16

### Changed
- Metrics output for openai (channel)
- Warning if the output of an edit-command reached the token-limit
- Finetuning of request-parameters

## [1.2.1] - 2026-02-15

### Fixed
- Auto-Completion did not use "raw" on ollama

## [1.2.0] - 2026-02-12

### Added
- OpenAI-compatible backend support (vLLM - other may be buggy) alongside Ollama
- Automatic context window detection for both Ollama and OpenAI backends (vLLM max_context_length required)
- Context length validation — prompts exceeding the model's context window are blocked with a notification instead of throwing server-side exceptions
- Chat context trimming — when a conversation exceeds the context window, older message pairs are automatically removed from the LLM context while remaining visible in the chat
- Visual indicators (warning icon and red tint) for chat messages no longer included in the LLM context
- Delete individual message pairs from chat history with token estimation
- Proxy support for OpenAI-compatible endpoints

### Changed
- Ollama and OpenAI client migrated from completions/generate to chat completions API
- Improved backend detection with timeout handling

## [1.1.0] - 2026-02-08

### Added
- Split endpoints for completion and instruction
- Commit message generation from staged changes
- Secure bearer token authentication for API endpoints
- Real-time context usage bar in chat (token consumption tracking)
- Enhanced chat context with file references and line numbers
- Multiple chat sessions support

### Changed
- Refactored LLM client interfaces and model configuration
- Centralized LLM option construction
- Unified request settings across chat and commit features

