# Change Log
https://keepachangelog.com/

## [1.6.8] - 2026-04-23

### Added
- Verbosity mode setting — control how concise or detailed chat responses should be (compact, medium, or detailed)
- Compact mode: aggressive compression, no filler, symbols over words, assumes expert user
- Detailed mode: thorough responses with context, edge cases, examples, and structured formatting

### Changed
- Settings modal now includes a slider control for verbosity mode selection

## [1.6.7] - 2026-04-23

### Added
- Auto-summary — when context usage reaches high levels, a modal prompts you to summarize the conversation
- Context notifications — warns when context is nearly full or when messages have left the LLM context
- Flat design style option — toggle between flat and dimensional UI styles in settings
- Reusable action button components (accept/cancel) for consistent modal styling

### Changed
- Improved error modal formatting with cleaner error message display
- Better context tracking — context usage now accurately reflects only the messages in the LLM context
- Optimized message reindexing during context trimming

### Fixed
- Context trimming now properly accounts for previous context boundaries
- Summary operations correctly update context state after completion

## [1.6.6] - 2026-04-22

### Added
- Settings Button for extension and style settings
- Test implementation of a possible shell-tool (default off, keep off or check briefly)

### Changed
- Improved tool result deduplication for all non-editing tools
- Better path truncation in tools
- Refactored ChatPanel — extracted agent, session, and handler logic into separate modules for better maintainability
- Replaced vscode.git with cli git

### Fixed
- Several fixes when useing minimax2.7
- Tool calls metadata attached to assistant messages for better grouping

## [1.6.5] - 2026-04-09

### Added
- Chat search functionality — find messages in the conversation history
- Agent duration counter — track how long the agent has been running
- Summary progress indicator — visual feedback during conversation summarization
- Toggle ghost session state — convert between temporary and persistent sessions

### Changed
- Tool confirmation modal
- Enhanced edit tool preview tab management
- Active states for buttons and controls
- Fine tuned styles

### Fixed
- Auto-resize issues in chat components

## [1.6.4] - 2026-04-08

### Added
- File paths in chat messages are now clickable links for easy navigation
- Dynamic theme coloring between light / dark

### Changed
- Simplified color scheme logic
- 
### Fixed
- Prune incomplete messages when agent is cancelled to prevent server errors

## [1.6.3] - 2026-04-04

### Added
- Temp button in session header — creates a ghost session (temporary, unlisted, never persisted)

### Changed
- Temp-Chat button now converts active session to a temp chat (asks for confirmation)
- Active states for some buttons

## [1.6.2] - 2026-04-04

### Added
- Button for temporary chat
- Button to clear conversation

### Changed
- Replaced all UTF symbols with Lucide SVG images

## [1.6.1] - 2026-04-02

### Fixed
- Prevent memory leaks in web components
- Centralize ChatContext in ChatSessionStore

### Changed
- Reorganize type definitions and update imports
- Refactor @query, @state, @property, event handlers
- Move shared web types
- Extract DismissalController for modals and popups
- Barrel export with index
- Migrate Lit components to @customElement decorator
- Replace static properties with Lit decorators

## [1.6.0] - 2026-04-01

### Added
- Context file/folder search in chat input
- More detailed conversation summary
- Delete tool now supports deleting both files and folders (previously files only)

### Fixed
- Use session state for summarize/delete operations instead of passing messages directly
- Defer popup-close event and add proper box-sizing to prevent UI issues
- Scroll timing and copy button state issues resolved

### Changed
- Lit repeat directive for chat output rendering
- Tool names: `readFile` → `read`, `lsPath` → `glob`, `searchFiles` → `grep`, `editFile` → `edit`, `createFile`/`createFolder` → `create`, `deleteFile` → `delete`

## [1.5.1] - 2026-03-25

### Fixed
- Fixed response timeout issue with centralized chat-agent
- Fixed escaping characters issue in exploration-tools
- Fixed alignment of user message actions

### Changed
- Refactored styles by centralized definitions and chat-input splitting
- Optimized LLM options for reduced tool hallucinations
- Reset loading timeout on chunk receipt for better streaming reliability

### Added
- Errors are thrown into the chat with a dedicated modal

## [1.5.0] - 2026-03-23

### Added
- Tool confirmation modal with Accept/Accept All/Cancel buttons for agent operations
- Cancel with reason: provide feedback to the agent when rejecting tool actions
- Reusable slide-up modal component for better UI consistency
- Improved tokenizer initialization with background loading and caching

### Changed
- Enhanced UI styling across chat components for better visual consistency
- Optimized token counting performance with lazy initialization

## [1.4.9] - 2026-03-18

### Added
- Turn summarization - summarize individual user turns to reduce context
- Loading snake animation during agent operations
- Export chat history to JSON for backup and sharing
- Auto-accept all toggle for edits and creates to streamline workflow

### Changed
- Moved token counter display from sidebar to input buttons during loading
- Updated theme colors and improved link styling
- Minor changes in ui colors / gaps
- Moved context usage calculation from backend to frontend for improved performance

### Fixed
- Minor bug fixes and improvements

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
