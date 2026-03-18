<p align="center">
  <img src="media/collama.png" alt="collama" width="250px"/>
</p>

<div align="center">

# Collama

**AI-powered code completion and editing for VS Code using local LLM backends**

[![Version](https://img.shields.io/github/package-json/v/bitdruid/collama)](https://github.com/bitdruid/collama)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code Version](https://img.shields.io/badge/VS%20Code-%5E1.109.0-blue)](https://code.visualstudio.com/)

[Overview](#overview) • [Features](#features) • [Infos](#infos) • [Quick Start](#quick-start) • [Installation](#installation) • [Configuration](#configuration) • [Models](#models) • [Usage](#usage) • [Contributing](#contributing)

</div>

___

## Overview

Collama is a VS Code extension that provides code completions, refactoring suggestions, and documentation generation. It supports multiple backends:

- **[Ollama](https://ollama.com)** - local
- **[OpenAI compatible](https://ai-sdk.dev/providers/openai-compatible-providers)** — local / cloud
- **[Anthropic](https://www.anthropic.com)** — cloud (this feature was only added as poc testing / better use claude ext)

> **Status:** This project is in heavy active development. Please note that the output may sometimes be unexpected or unusual. If you have any ideas to improve the quality just let me know and contribute!

## Features

**Code Completion**
- Inline, multiline, and multiblock suggestions
- Uses currently opened tabs as context
<p align="left">
  <img src="media/collama.gif" alt="collama" width="500px"/>
</p>

**Code Edits**
- Generate docstrings, extract functions, refactor code
- Simplify complex code, fix syntax errors
- Manual instructions for custom edits

**Chat Interface**
- Multiple chat sessions with custom titles
- Send selected code/files as context with file references
- Real-time context usage bar with automatic trimming
- Edit messages, copy sessions, scroll navigation
- Export chat history to JSON for backup and sharing
- Auto-accept all toggle for edits and creates to streamline workflow

**AI Agent with Tool Calling**
- File system tools: read, list, search, create, edit files
- Git tools: list commits/branches, view diffs
- Code analysis: get diagnostics from language server
- Security: path protection, workspace boundaries, .gitignore integration
- Real-time tool execution feedback
- Read-only mode for safe exploration

**Commit Messages**
- AI-generated conventional commits from staged changes
- Accessible via command palette or Source Control view

**Current Context Management**
- Smart pruning of editor tabs in autocomplete to fit context
- Chat history optimization (tool results removed)
- Token counter visualization in agent-loop / total usage

## Infos

- The agentic mode (tool-calling) has been tested on vLLM (nvidia h200) with the following models:
  - gpt-oss:120b
  - glm-4.7-fp8
  - minimax2.5
> [!NOTE]
> For smaller models (like gpt-oss:20b), it's recommended to use chat-only mode instead of agentic mode for better performance.


## Quick Start

### Prerequisites

- **VS Code** 1.109.0 or higher
- **Ollama** or **OpenAI compatible** running locally (or accessible on your network)
- A supported code model (see [Models](#models))

## Installation

Install the extension from the marketplace or build the vsix yourself, then configure an endpoint in settings.
For authentication, set your API key as a bearer token — see [Bearer Tokens](#bearer-tokens-api-key).

**Ollama (local, remote)**<br>
See [Ollama installation instructions](https://docs.ollama.com/quickstart) or the [Docker image](https://ollama.com/blog/ollama-is-now-available-as-an-official-docker-image). Point `apiEndpointCompletion` / `apiEndpointInstruct` to your Ollama host (default: `http://127.0.0.1:11434`).

**OpenAI / OpenAI-compatible (local, remote, cloud)**<br>
Point the endpoint settings to your server (e.g. [vLLM](https://docs.vllm.ai/), LiteLLM) or to `https://api.openai.com` for the OpenAI cloud API.

## Configuration

Configure Collama via VS Code Settings (Preferences → Settings, search "collama"):

| Setting                                | Type    | Default                  | Description                                              |
| -------------------------------------- | ------- | ------------------------ | -------------------------------------------------------- |
| `collama.apiEndpointCompletion`        | string  | `http://127.0.0.1:11434` | Endpoint for code auto-completion                        |
| `collama.apiEndpointInstruct`          | string  | `http://127.0.0.1:11434` | Endpoint for code edits/chat                             |
| `collama.apiModelCompletion`           | string  | `qwen2.5-coder:3b`       | Model for code completions                               |
| `collama.apiModelInstruct`             | string  | `gpt-oss:20b`            | Model for code edits (use instruct/base variant)         |
| `collama.apiTokenContextLenCompletion` | number  | `4096`                   | Context window size (tokens) for the completion model    |
| `collama.apiTokenContextLenInstruct`   | number  | `4096`                   | Context window size (tokens) for the instruct/chat model |
| `collama.apiTokenPredictCompletion`    | number  | `400`                    | Max tokens to generate per completion request            |
| `collama.apiTokenPredictInstruct`      | number  | `4096`                   | Max tokens to generate per instruct/chat request         |
| `collama.autoComplete`                 | boolean | `true`                   | Enable auto-suggestions                                  |
| `collama.suggestMode`                  | string  | `inline`                 | Suggestion style: `inline`, `multiline`, or `multiblock` |
| `collama.suggestDelay`                 | number  | `1500`                   | Delay (ms) before requesting completion                  |
| `collama.agentic`                      | boolean | `true`                   | Use agentic (tool use) mode for chat                     |
| `collama.enableEditTools`              | boolean | `true`                   | Enable edit tools (read-only mode when disabled)         |
| `collama.tlsRejectUnauthorized`        | boolean | `true`                   | Verify TLS certificates for HTTPS endpoints              |

### Manual Token Settings

You have to manually adjust the token limits for context and prediction. The values are expressed in tokens, not characters.

- `collama.apiTokenContextLenCompletion` / `collama.apiTokenContextLenInstruct` – maximum number of tokens that can be sent to the model as context.
- `collama.apiTokenPredictCompletion` / `collama.apiTokenPredictInstruct` – maximum number of tokens the model can generate in a single request.

Changing these values will automatically trigger a re‑calculation of the context window and may affect the real‑time context usage bar shown in the chat view.

> [!NOTE]
> Check the max context window of your model online.

### Bearer Tokens (API Key)

If your API endpoints require authentication (e.g. vLLM with `--api-key`, or a reverse proxy), you can securely store bearer tokens using VS Code's encrypted credential storage. Tokens are sent as `Authorization: Bearer <token>` headers with every request.

1. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
2. Run one of these commands:
    - `collama: Set Bearer Token (Completion)` - for the completion endpoint
    - `collama: Set Bearer Token (Instruct)` - for the instruct/chat endpoint
3. Enter your token in the password input (characters will be masked)
4. The token is stored encrypted in your system's credential manager

**Note:** Tokens are stored securely and never appear in plain text in your settings or configuration files. To clear a token, run the same command and leave the input empty.

## Models

### Recommended Models

Collama is tested primarily with the **Qwen Coder** for Completion and **gpt-oss** for Instruction.

#### For Code Completion (FIM - Fill In Middle)

- **any qwen coder > 3b** recommended
- **qwen2.5-coder:7b** (stable quality)

#### For Code Edits (Instruct/Base Models)

- **any instruct model with thinking capabilities** recommended
- **gpt-oss:20b** (stable quality)
  Do not use an FIM model for instructions. It will produce very poor quality answers.

### Model Completion Compatibility Table

| Model         | Tested Sizes | FIM Support | Status   | Notes                                    |
| ------------- | ------------ | ----------- | -------- | ---------------------------------------- |
| codeqwen      | —            | ⚠️           | Untested | May work; contributions welcome          |
| qwen2.5-coder | 1.5B, 3B, 7B | ✅           | Stable   | Recommended for most use cases           |
| qwen3-coder   | 30B          | ✅           | Stable   | Excellent quality, higher resource usage |
| starcoder     | —            | ⚠️           | Untested | May work; contributions welcome          |
| starcoder2    | 3B           | ✅           | Stable   | Like qwen2.5-coder                       |
| codellama     | 7B, 13B      | ⚠️           | Limited  | Limited file context support; FIM is ok  |

Note: Models are tested primarily with quantization level q4. Results may vary with other quantization levels.

Note: ChatML format is not supported - that means only true FIM models will work for autocomplete!

## Usage

### Code Completion

1. **Trigger Completion**: Use `editor.action.inlineSuggest.trigger` (default keybinding varies by OS)
    - Set custom keybinding: `Alt + S` or `Ctrl + NumPad 1` (example)
2. **Auto-Trigger**: Completions trigger automatically after 1.5 seconds of inactivity (configurable via `suggestDelay`)
3. **Accept**: Press `Tab` to accept suggestion, `Esc` to dismiss

### Code Edits

1. Select code in the editor
2. Right-click → **collama (on selection)** and choose:
    - **Write Docstring** - Generate documentation
    - **Extract Functions** - Refactor into separate functions
    - **Simplify Code** - Improve readability and efficiency
    - **Fix Syntax** - Correct syntax errors
    - **Edit (manual)** - Custom AI-assisted edits

### Chat Interface

1. Open the Chat view in the sidebar (Collama icon)
2. Right-click on selected code in editor → **Send to Chat**
3. Type your message - the context is automatically attached with:
    - File name and path
    - Line number references
    - Selected code or full file content
4. Monitor token usage with the real-time context bar and agent-token counter
5. Create multiple chat sessions to organize conversations by topic
6. Session Management: Copy / rename / delete sessions
7. Export chat history to JSON for backup and sharing
8. Use auto-accept all toggle for faster workflow when making multiple edits

### Commit Message Generation

1. Stage your changes in Git
2. Open Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run **collama: Generate Commit Message**
4. The AI analyzes your staged diff and generates a conventional commit message
5. Review and edit the message in the Source Control input box before committing

### AI Agent Usage

> [!IMPORTANT]
> It is recommended to turn off agentic-mode for small local/home models (like gpt-oss:20b) and use them in chat-only mode instead.

**Available Tools:**

- **File System Tools**
    - `readFile` - Read the contents of a file in the workspace (supports optional line ranges with automatic chunking to 100-line boundaries for efficient reading)
    - `searchFiles` - Search file contents for a regex pattern (supports optional glob pattern to filter files)
    - `lsPath` - List files and folders in a workspace directory (supports recursion depth and glob pattern filtering)
    - `create` - Create a new file or folder (with content: creates a file with preview; without content: creates a folder)
    - `editFile` - Edit a file by replacing an exact string match with new content (shows diff preview and asks for confirmation)
    - `deleteFile` - Delete a file from the workspace (asks for user confirmation)

- **Git Tools**
    - `gitLog` - Git log info (list commits or list branches with optional filters)
    - `gitDiff` - Get a git diff (working tree changes or compare commits/branches)

- **Code Analysis Tools**
    - `getDiagnostics` - Get diagnostics (errors, warnings, hints) from the language server

**Read-Only Mode:**

When `enableEditTools` is disabled (toggle via status bar), the following tools are unavailable:

- `editFile`, `create`, `deleteFile`

The agent can still use read-only tools to explore and analyze your codebase safely.

## Contributing

Contributions are welcome! Here's how you can help:

1. **Report Issues** [Open an issue](https://github.com/bitdruid/collama/issues)
2. **Submit PRs**: Fork, create a feature branch, and submit a pull request
