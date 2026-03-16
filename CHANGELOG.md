# Change Log
https://keepachangelog.com/

## [Unreleased]

## [1.4.8] - 2026-03-17

### Added
- Tool message grouping in chat UI for cleaner display of consecutive tool calls

## [1.4.7] - 2026-03-16

### Added
- Anthropic client support (POC) for expanded model compatibility

### Changed
- Refactored chat container logic into modular components for better maintainability
- Improved edit cancel behavior with custom user feedback messages
- Code cleanup: removed commented code and simplified chat header structure
- Added a hidden llm-info tag to give the llm additional informations to chat-content

## [1.4.6] - 2026-03-13

### Added
- Improved readFile tool with enhanced deduplication logic
- Scroll-down button component for better chat navigation

### Changed
- Refactored chat output into clean role objects (assistant, tool, user)
- Improved chat UI layout and edit tool UX
- Defer tokenization and add caching for improved context usage performance
- Agent counter now has reduced opacity for better visual hierarchy
- Removed model selection from status bar for cleaner UI
- Split output.ts into modular role-based components
- Cleaned up extensions.ts structure

### Fixed
- Auto-scroll chat to bottom after message submit
- Clarified readFile tool description for better agent understanding

## [1.4.5] - 2026-03-11

### Fixed
- Edit tool can now fill empty files
- Reduced tool-use hallucination by removing JSON data from responses

### Documentation
- Improved searchFiles tool descriptions

## [1.4.4] - 2026-03-10

### Added

- Session copy functionality with preserved custom titles
- Dedicated `Session` class to manage chat session lifecycle

### Changed

- Extracted `ChatPanel` class from monolithic subscriptions module
- Separated host-side and web-side utility modules (`utils-host`, `utils-web`)
- Encapsulated chat history logic in `AgentContext`
- Standardized all web component file and folder naming to kebab-case
- Restructured web components into a cleaner directory layout
- Renamed `Context` to `EditorContext` to avoid ambiguity
- Updated dependencies

### Fixed

- Token counter only appears when data arrives
- Token counter resets when the chat completes
- Edit submit button not sending the changed message

## [1.4.3] - 2026-03-05

### Added

- Token counter for agent operations
- Deduplicate readFile calls

### Changed

- Auto-focus textarea after loading and reset
- Remove empty assistant message template from backend

## [1.4.2] - 2026-03-04

### Fixed

- Handle LiteLLM tool call streaming duplicates
- Improve tool call handling and update agent prompt

### Added

- Accept all edits functionality
- Improved agent robustness

### Changed

- Update README, agent, and tool logic
- Cleanup tools in analyse.ts
- Merge several tools to reduce amount
- Trim tool list

## [1.4.1] - 2026-02-27

### Changed

- Refactoring of chat related code to regain some readability

## [1.4.0] - 2026-02-26

### Changed

- Settings split into Subs for Completion / Instruction
- Manual settings for context window (input) and prediction (output)
- Backend detection loops when no connection was found

### Added
- Agentic mode with tool-calling loop for autonomous multi-step tasks
- Turn on / off agentic mode via `agentic` setting
- Read-only mode via `edit tools` setting — disables all file-modifying tools
- Ignore verification of TLS certs (custom certs / testing or trusted network)

## [1.3.0] - 2026-02-16

### Added
- Edit-Message button into chat

### Changed
- vscode engine to 1.109.0

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

