# Change Log
https://keepachangelog.com/

## [Unreleased]

## Changed

- Notepad persists between turns

### Removed

- Removed `Clean Chat` button
- Removed `Convert to Temporary Chat` button

### Changed

- Session header `New Temporary Chat` button is now a toggle between temp and normal session state

## [1.8.17] - 2026-07-15

### Fixed
- Typo in websearch tool registration
- Cap length of search result fields to prevent a token overflow for example if `someone dropped 200KB into a github-repo description field`

## [1.8.16] - 2026-07-14

### Added
- Web search tool (SearXNG) — search the web when a SearXNG server is configured and reachable; every query requires user confirmation before it leaves the machine
- Mailbox wakes the agent mid-turn on background events (currently background-shell exits), instead of only surfacing on its next check

### Changed
- Shell tool interface simplified — background commands now start via a single `is_background` flag instead of a separate `start` action
- Agent prompt now steers watcher/monitor/loop/long-running commands toward background shell instead of one-shot
- Default API endpoint/model settings are now blank instead of pointing at a specific local Ollama model; default context/predict token sizes raised to realistic values (32000/128000 context, 8000 instruct predict)

## [1.8.15] - 2026-07-11

### Changed
- Agent loop breaks on empty tool calls regardless of agentic mode — removed `toolsCallable` check and simplified tool schema sending (only sent in default+agenticMode, no `hasToolCalls` fallback)
- Removed `tool_choice` logic from agent settings since it's always `"none"` when tools aren't callable

### Fixed
- Session title derivation now covers both "New Chat" and "Temporary Chat" — renamed `isFirstMessage` to `isUnnamed` in chat panel
- Context trimming no longer accounts for tool calls — only reserves space for agentic overhead, dropping the `hasToolCalls` fallback
- Agent mode clears context file content (filepath-only) to prevent oversized attachments from exceeding token limits
- Textarea input capped at 12 rows with overflow scroll — prevents extreme input from pushing submit buttons out of reach

## [1.8.14] - 2026-07-09

### Added
- Two-segment context usage bar — trimmed tokens show as a hatched segment
- Context-limit — when tool results overflow mid-run, old tool results are trimmed and answer enforced
- Toggle `Agentic` mode mid-chat without a fresh session — `tool_choice: "none"` to avoid hallucinated calls
- `tool_choice` support in the OpenAI client settings

### Changed
- Auto-summary recommendation modal is now non-enforcing — slimmer, dismissible via the close button, outside-click, Escape, or a Dismiss button
- Pre-run context trim reserves the agent system prompt + tool schema so turns start within the window

### Fixed
- Agent errors now surface in the webview error modal (were silently swallowed — a mismatched log field plus `chat-complete` closing the modal right after it opened)

### Removed
- `ChatContext.hasToolCalls()` method — no longer needed after tool schema simplification

## [1.8.13] - 2026-07-06

### Added
- Background shell session indicators — status bar shows `sh:N` count, chat header shows green dot + count, composer banner shows "Shell N session(s) running" with green dot and pill badge
- Shell session change notification system — `onSessionChange()` and `getActiveSessionCount()` in shell-session module, forwarded to webview via `shell-sessions-update` message

## [1.8.12] - 2026-06-30

### Fixed
- Commit message on multiple repositories
- Height on "other" decision option
- Context indicator missplaced

## [1.8.11] - 2026-06-26

### Changed
- Refactored button components into a shared `ButtonBase` class under `template-components/button/` — `ButtonBox` (border-style) and `ControlButton` (filled-round) now share title/disabled/icon/focus/emitAction logic
- Cleaned up control-panel `styles.ts` — removed ~150 lines of per-button CSS now owned by the components
- Reordered agent edit rules in prompt: notepad facts/todos first, then exploration
- Changed `enableShellTool` default from `false` to `true`
- Changed `showThinking` default to `true` (show agent thinking by default)

### Fixed
- Windows CRLF handling in edit and explore tools
- Minimal styles for dangerous commands in tool-confirm-modal

## [1.8.10] - 2026-06-26

### Added
- Notepad tool to keep facts and todos while looping
- Flow banner/accordion type for memory, decision, and notepad tools
- Failed tool calls are now hidden from the webview

### Changed
- Tool metadata restructured — `CustomMessageKeys` now nests tool info under `toolMeta` with a `toolSuccess` flag
- Prompt rules updated

### Fixed
- Decisions and tool-confirmations now close properly on cancelation

## [1.8.9] - 2026-06-24

### Added
- Background shell sessions — `start`/`check`/`stop` actions for long-running commands that persist across agent turns, with incremental output polling and temp-file spillover for large output
- Settings badge and warning indicator on Agentic-Mode toggle when agentic mode is off (consistent with edit/shell tool warnings)

### Changed
- Tool roles restructured — dropped categories - added roles
- Default `tlsRejectUnauthorized` changed from `true` to `false` for easier local/trusted-network setups
- Removed unused Brain icon from chat header
- Improved session dropdown hover/active states with box-shadow and outline
- Adjusted theme color lightness values for better contrast

### Fixed
- shell tool could not resolve string boolean to real boolean

## [1.8.8] - 2026-06-23

### Added
- Memory tool as global storage for facts and preferences with add/edit/delete operations in a dedicated modal
- Memory tool banner and edit button UI

### Fixed
- Modal styles

## [1.8.7] - 2026-06-22

### Added
- Fancy typing effect — char-by-char reveal for streaming assistant text with animated glyph particles
- Visual indicator for characters inside thinking/reasoning content
- Scroll-down button now animates while the agent is generating
- Context usage bar now uses thousands delimiter for readability

### Changed
- Reduced color variations and detail across UI (simplified theme tokens, button-box, modals, accordions)
- Updated UI shadows and dropdown animation (uniform shadow, no clip-path)
- Replaced "eyecandy" toggle with fancy typing effect (always-on particle effect)
- Removed snake loading animation
- Banner styling fixes and minimum size adjustments

### Fixed
- Action button hover styling in session items

## [1.8.6] - 2026-06-19

### Added
- Diff highlighting in chat code blocks (green additions / red deletions)
- Edit tool accordion now renders a git-style unified diff instead of raw `oldString`/`newString`

## [1.8.5] - 2026-06-19

### Added
- `extraBody` config parameter for OpenAI client — passes additional body parameters to the API request
- Shell command read-only allowlist: git read-only subcommands, bash/coreutils, and PowerShell cmdlets auto-accept without confirmation when provably read-only
- Process substitution `<( ... )` detection as a write construct in shell commands
- Auto-accept for provably read-only shell commands with `autoAcceptShell` state management

### Changed
- Edit rules restructured with clearer exploration-before-editing workflow in agent prompts
- Summary prompt rules clarified (omit missing roles, never invent content)
- Import order cleanup in ollama/openai clients

### Fixed
- Glob output now truncated when exceeding token limit instead of returning all matches
- Read tool token limit calculation (removed erroneous `* 4` multiplier causing false oversized-read errors)

## [1.8.4] - 2026-06-18

### Added
- `dangerous` flag to shell tool definition (required parameter) — model marks commands as dangerous, backend also auto-detects write constructs
- Write construct detection in shell commands (`$(...)`, backticks, `>`, `>>`, newlines) — flagged as dangerous even if model omits the flag
- `normalizeToolArgs()` — canonicalizes `filePath` to absolute paths before execution for consistent history comparison
- Missing required argument validation for tool calls — returns a precise, correctable error instead of a downstream crash
- `successWithDiagnostics()` — LSP diagnostics appended to edit/create/notebook tool results so the model sees errors without a follow-up call
- `button-box` template component replacing `action-button` (AcceptButton, CancelButton, AcceptAllButton) — 28x28 square icon buttons with `action` event
- Custom text input option in decision modal ("Describe other...") with Enter/Escape handling
- `dangerous` flag propagation to tool confirm modal (warning icon for dangerous shell commands)
- Environment context injected into agent prompts (date, OS info, git status, workspace files listing)

### Changed
- Removed `explanation` required field from read/grep/glob/gitLog/gitDiff/decision tool definitions — reduces token overhead
- Removed standalone `diagnostics` tool — folded into edit/create/notebook success responses via `successWithDiagnostics()`
- Prompt templates refactored into `PromptConstructor` class with static methods — edit/commit/summary prompts use system+user message pairs
- Summary handler refactored to use `PromptConstructor` with system+user message split
- Modal title rendering extensible via `renderTitle()`/`renderHeaderExtra()` hooks
- Input fields now have border styling (was `border: none`)
- Usage warning color adjusted for better contrast (`#cca700` → `#b19000`)
- Tool confirm modal restyled — action label moved to title area, danger styling for filePath on dangerous commands
- Decision modal supports custom text input with Enter to submit, Escape to go back

### Fixed
- Diagnostics wait timeout reduced from 5s to 1500ms — files without a language server no longer waste time

## [1.8.3] - 2026-06-12

### Changed
- Prompt templates restructured with XML tags (`<rules>`, `<task>`, `<full_context>`, `<instruction>`, `<target_snippet>`, `<output_formatting>`) replacing `===== ... =====` markers
- Agent template sections wrapped in XML tags (`<general>`, `<output_verbosity>`, `<output_formatting>`, `<agent_rules>`, `<edit_rules>`, `<agent_project_rules>`)
- General reasoning rules updated for compactness — explicit reasoning-is-no-response guidance
- Output formatting rules updated with diff-block instruction (```diff for suggested edits)
- Summary template improved — only summarize messages that exist, never invent missing content

## [1.8.2] - 2026-06-10

### Fixed
- Empty API key causes OpenAI error when using Ollama v1 — fallback to `"ollama"` as default API key

## [1.8.1] - 2026-06-10

### Changed
- Default `autoComplete` setting changed from `true` to `false` — auto-completion now opt-in

## [1.8.0] - 2026-06-10

### Added
- Intercept queued messages into a running agent loop — submit a follow-up while the agent is still working; it's injected at the next turn boundary without interrupting the current one, with a pending-intercept banner showing queued messages (cancellable)
- On-the-fly parsing of leaking XML/JSON tool-calls — detects tool calls that models emit as text instead of native tool-call format and converts them, instead of leaking the raw markup into the chat
- Loading dots now show for the entire agent run (waiting, streaming, and tool execution) and live in-flow under the streaming text so they scroll with it instead of jumping

### Changed
- Ghost session creation centralized in `SessionManager.createGhostSession()`
- Banner component restyled and consolidated theme tokens for borders, fonts, and icons
- Chat output message components restructured (assistant/tool/user merged into a single `messages.ts`, edit moved out of `message-user`)
- Standardized border styles via shared theme tokens; updated README model recommendations
- Moved syntax-highlighting (hljs) styles into `styles/theme-code.ts`
- Read/grep tools now share a single `EXTENSION_HARD_TOKEN_CAP` size limit
- `read` tool history policy changed from `dropAll` to `evalOutdated` so stale reads are marked accordingly
- Output scrollbar now has a fixed, themed width with `scrollbar-gutter: stable` reserved, so content no longer shifts when the scrollbar appears; the pending-intercept banner aligns with it
- Instant (non-smooth) auto-scroll while the agent is generating, smooth scroll when idle
- Updated dependencies: `eslint`, `typescript-eslint`, `lucide`, `openai`

### Fixed
- Ghost (temporary) chats are no longer lost after converting to a stored session
- Decision tool now returns an error to the LLM instead of failing silently when `options` contains non-string entries
- Prevented UI freezes by rejecting/tokenizing oversized user-attached context files instead of loading their full content
- Agent mode no longer inlines full file contents for editor-attached context (path reference only, since the agent reads files via its own tools)
- Loading dots and pending-intercept banner spacing/margins adjusted for consistent symmetric padding

## [1.7.19] - 2026-06-02

### Added
- Font loading infrastructure: `@fontsource/roboto` and `@fontsource/jetbrains-mono` dependencies with esbuild plugin to inline woff2 fonts as base64 data URIs
- `injectFontStyles()` function that injects @font-face rules into the document head once
- Hardcoded font families (Roboto, JetBrains Mono) replacing VS Code CSS variable fallbacks

### Changed
- Simplified font weight scale — removed `thin`, `extraLight`, `medium`, `semiBold`, `extraBold`, `black`; kept `light` (200), `normal` (400), `bold` (700)
- Updated font-weight references across all components to use the simplified scale
- Updated decision tool description for clarity
- Strengthened agent prompt rules to emphasize decision tool usage before editing
- Changed delete button color from `usageDanger` to `cancel`
- Changed session item hover background from `uiBackgroundHoverDimm` to `uiBackgroundHover`
- Changed HTML export font-family to Roboto

## [1.7.18] - 2026-05-27

### Added
- Notebook editing tool with rich diff preview support
- Shell tool now writes large output to a temp file instead of truncating

### Changed
- Restructured prompt template generation with constants for better maintainability
- Reorganized chat module structure into backend/frontend/shared directories
- Simplified config.ts and extracted tool confirmation logic to separate module
- Frontend first-level folder structure refactored

### Fixed
- Debounce session saving and store one session per file in global state

## [1.7.17] - 2026-05-26

### Changed
- Simplified tool history policy to `dropAll`/`keepAll` only (removed per-call deduplication)
- Removed `AgentContext` wrapper in favor of direct `ChatContext` usage
- Lazy-load session messages from storage — only the active session is hydrated at startup for faster load times
- Explore tools (`read`, `grep`, `glob`, `gitLog`) now use the `dropAll` policy so their results are cleared after each turn

## [1.7.16] - 2026-05-21

### Added
- Export chat session to HTML for sharing or archiving

### Changed
- Limit `grep` tool output to prevent oversized responses from flooding context

## [1.7.15] - 2026-05-21

### Added
- Lite mode for system prompt — optionally switch to a minimal prompt to support small models

### Changed
- Unified theme font variables across UI components for visual consistency
- Optimized accordion and role-header sizing for better layout
- Improved chip coloring for clearer visual hierarchy
- Enhanced system prompt with better output instructions and code-backtick styling
- Refactored context handling with `relativePath` and instance-based `EditorContext` API

### Fixed
- Markdown code_inline blocks now detect file-urls for proper link handling
- Markdown link validation in chat output
- Removed statusbar indicators for the agent

## [1.7.14] - 2026-05-14

### Fixed
- Prevent webview from destruction when closing (persist chat state)

## [1.7.13] -  2026-05-14

### Fixed
- No markdown in decisions
- Wait before use of LSP diagnostics

## [1.7.12] - 2026-05-14

### Added
- **Decision tool** — agent can ask user to choose between options without interrupting the flow
- **References mode for analyse tool** — find all usages of a symbol at a given location
- Timestamp display for user messages in chat

### Changed
- Refactored `getDiagnostics` tool into `analyse` tool with unified diagnostics and references modes
- Tool history policies: `analyse`, `gitDiff`, `decision` now use `dropAll` (results cleared after turn)
- Minor styling improvements for message components

### Added
- ToolDecisionModal — modal UI for decision requests when agent asks user to choose between options

## [1.7.11] - 2026-05-14

### Added
- Stream thinking from ollama

## [1.7.10] - 2026-05-14

### Fixed
- Config endpoint protocol handling when the protocol is missing

## [1.7.9] - 2026-05-14

### Added
- Hide/show thinking toggle in chat settings

## [1.7.8] - 2026-05-13

### Fixed
- Renaming of chat sessions

## [1.7.7] - 2026-05-13

### Added
- Streaming reasoning/thinking support for chat responses
- `body` property on accordions to render plain-text content alongside structured children
- Bubble animation variant for the dots loader (randomly selected per chat instance)
- Loading-snake toggle in the chat settings (default off)

### Changed
- Replace snake-loading speed slider with a simple on/off toggle
- Move the empty-state component out of the session dropdown into chat-output
- Simplify the session dropdown's empty state to a plain hint
- Tighten `.vscodeignore` so only the icons/logo ship in the packaged `.vsix` (drops the `.gif` and `.kra` source)

## [1.7.6] - 2026-05-08

### Added
- Lucide dependency for shared web UI icons
- Bottom overlay template component for loading and scroll controls

### Changed
- Migrate web UI icons from inline SVGs to Lucide icons with size variants
- Centralize border-radius and loading animation styles in shared theme helpers
- Consolidate chat loading animations, including snake and dots variants
- Refactor agent modes, work loop, message dispatching, and IO logging internals
- Improve chat container overflow handling

### Fixed
- Scroll to the latest message after resending or editing a chat message

## [1.7.5] - 2026-05-05

### Added
- Barrel export for styles module (`src/chat/web/styles/index.ts`)
- User icon for message-user component role label

### Changed
- Reorder message action buttons (summarize moved between delete and resend)
- Remove text labels from message action buttons (icons only)

## [1.7.4] - 2026-05-04

### Changed
- Standardize tool responses with unified `ToolAnswer<T>` interface

## [1.7.3] - 2026-05-04

### Fixed
- Auto-accept state control and logging for agent

## [1.7.2] - 2026-05-01

### Changed
- Split LLM clients and clean config types

## [1.7.1] - 2026-04-30

### Fixed
- Add context line x - y for better code location display
- Fix button alignment in various components

## [1.7.0] - 2026-04-29

### Added
- Reusable banner component
- Chat-header component (renamed from chat-session)
- Further testing shell tool
- Send to chat from file tree — right-click files/folders in VSCode explorer to add them as context to the chat

### Changed
- Extract animations to dedicated theme-animations module
- Move settings button to chat header and simplify session management
- Consolidate modal and dropdown state into activeModal/activeDropdown
- Convert settings modal to dropdown and reorganize chat components
- Add explanation parameter to all agent tools
- Consolidate UI state naming, component structure, and icons

### Fixed
- Use Node path module for cross-platform path handling

## [1.6.10] - 2026-04-24

### Added
- Reusable `collama-slider` component with value labels, progress fill, and optional tick marks

### Changed
- Settings modal now uses compact slider controls for toggles, verbosity, and snake loading speed
- Refactored loading pulse and shadow styles into shared theme helpers
- Shortened displayed tool target paths to the last two path segments
- Updated default snake loading animation speed to 1500 px/s

## [1.6.9] - 2026-04-23

### Added
- AGENTS.md support — place an `AGENTS.md` file in your project root to define custom agent rules and behavior guidelines

### Changed
- Settings modal displays AGENTS.md status (active/not found) for transparency

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
