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
- Temporary chat sessions — create unlisted, non-persisted sessions for quick experiments
- Send selected code/files as context with file references
- **Search and attach files/folders directly from the chat input** - easily browse and add workspace files to your conversation context
- **Chat search functionality** — find messages in your conversation history
- Real-time context usage bar with automatic trimming
- Edit messages, copy sessions, scroll navigation
- Export chat history to JSON for backup and sharing
- Auto-accept all toggle for edits and creates to streamline workflow
- Summarize individual turns or entire conversations to reduce context usage
- **AGENTS.md support** — define custom agent rules by placing an `AGENTS.md` file in your project root

**AI Agent with Tool Calling**
- File system tools: read, grep, glob, create, write, delete files
- Git tools: list commits/branches, view diffs
- Code analysis: get diagnostics from language server
- Security: path protection, workspace boundaries, .gitignore integration
- Real-time tool execution feedback
- Agent duration counter — track how long the agent has been running
- Tool confirmation modal with Accept/Accept All/Cancel options
- Cancel with reason: provide feedback to guide the agent
- Read-only mode for safe exploration

**Commit Messages**
- AI-generated conventional commits from staged changes
- Accessible via command palette or Source Control view

**Current Context Management**
- Smart pruning of editor tabs in autocomplete to fit context
- Chat history optimization (tool results removed)
- Token counter visualization in agent-loop / total usage

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
| `collama.agentic`                      | boolean | `true`                   | Use tool-calling mode; recommended only for large models |
| `collama.enableEditTools`              | boolean | `true`                   | Enable edit tools (read-only mode when disabled)         |
| `collama.enableShellTool`              | boolean | `false`                  | Enable shell tool usage                                  |
| `collama.tlsRejectUnauthorized`        | boolean | `true`                   | Verify TLS certificates for HTTPS endpoints              |

### Manual Token Settings

Set token limits to match your model. Values are tokens, not characters.

- `apiTokenContextLen*` - available context window
- `apiTokenPredict*` - maximum generated tokens per request

Context length is shared by input tokens and the LLM answer, so a higher predict limit leaves less room for input/context.

> [!NOTE]
> Check your model's maximum context window online and keep memory reservation in mind.

### Bearer Tokens (API Key)

If an endpoint needs authentication, store the token via Command Palette:

- `collama: Set Bearer Token (Completion)`
- `collama: Set Bearer Token (Instruct)`

Tokens are sent as `Authorization: Bearer <token>` and stored in VS Code's encrypted credential storage. Run the same command with an empty value to clear one.

## Models

### Recommended Models

Collama is tested primarily with the **Qwen Coder** for Completion and **liteLLM frontier models** for Instructions.

#### For Code Completion (FIM - Fill In Middle)

- **any qwen coder > 3b** recommended

#### For Code Edits (Instruct/Base Models)

- **any instruct model with thinking capabilities** (e.g. gpt-oss:20b, qwen3:14b)

#### Agentic Chat

- **Only use frontier models** (e.g. gpt-oss:120b, glm-4.7b) for agentic mode.

#### Pure Chat

- **Any chat model** can be used for regular chat
- **Keep Agentic mode OFF for small models** — small models lack the reasoning for reliable tool calling

### Model Completion Compatibility Table

| Model         | Tested Sizes | FIM Support | Status   | Notes              |
| ------------- | ------------ | ----------- | -------- | ------------------ |
| codeqwen      | —            | ⚠️           | Untested | May work           |
| qwen2.5-coder | 1.5B, 3B, 7B | ✅           | Stable   | Recommended        |
| qwen3-coder   | 30B          | ✅           | Stable   | Recommended        |
| starcoder     | —            | ⚠️           | Untested | May work           |
| starcoder2    | 3B           | ✅           | Stable   | Like qwen2.5-coder |

Note: FIM models are tested primarily with quantization level q4. Results may vary with other.

Note: ChatML format is not supported - that means only true FIM models will work for autocomplete!

## Usage

Most actions are available from the editor context menu, chat sidebar, Command Palette, or Source Control view.

- **Completions:** trigger automatically after `suggestDelay`; press `Tab` to accept or `Esc` to dismiss.
- **Code edits:** select code and use **collama (on selection)** for docstrings, refactors, fixes, or manual edits.
- **Chat:** attach files/folders, manage sessions, summarize context, and toggle auto-accept for edits/creates.
- **Commit messages:** stage changes, then run **collama: Generate Commit Message**.

### AI Agent Usage

If a chat already contains tool calls, switch to a fresh chat after turning `Agentic` OFF. `Edit Tools` can be turned OFF for read-only exploration. `Shell Tool` is OFF by default and can be enabled from the status bar menu.

- Agentic mode has been tested on vLLM (NVIDIA H200) with:
  - gpt-oss:120b
  - glm-4.7-fp8
  - minimax2.5, minimax2.7

> [!WARNING]
> Small models should use chat with `Agentic` OFF.

**Available Tools:**

- **Explore**
    - `read` - Read a workspace file, optionally by line range
    - `grep` - Search workspace files with a regex pattern
    - `glob` - Find files and folders by glob pattern

- **Git**
    - `gitLog` - List commits or branches with optional filters
    - `gitDiff` - Show working tree, staged, or commit/branch diffs

- **Code Analysis**
    - `getDiagnostics` - Show language server diagnostics such as errors, warnings, info, and hints

- **Edit Tools**
    - `edit` - Replace an exact string in a workspace file with preview and confirmation
    - `create` - Create a new file or folder with confirmation
    - `delete` - Delete a file or folder with confirmation

- **Shell Tool**
    - `shell` - Run npm/python shell commands with confirmation when `collama.enableShellTool` is enabled (⚠️ **Work in Progress** — currently tested with npm/python debugging only; use with caution and explicit confirmations); keep it **OFF**

## Contributing

Contributions are welcome! Here's how you can help:

1. **Report Issues** [Open an issue](https://github.com/bitdruid/collama/issues)
2. **Submit PRs**: Fork, create a feature branch, and submit a pull request
