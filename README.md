<p align="center">
  <img src="media/collama.png" alt="collama" width="250px"/>
</p>

<div align="center">

# Collama

**AI-powered code completion and editing for VS Code using local LLM backends**

[![Version](https://img.shields.io/github/package-json/v/bitdruid/collama)](https://github.com/bitdruid/collama)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code Version](https://img.shields.io/badge/VS%20Code-%5E1.120.0-blue)](https://code.visualstudio.com/)

[Overview](#overview) • [Features](#features) • [Installation](#installation) • [Configuration](#configuration) • [Models](#models) • [Usage](#usage) • [Contributing](#contributing)

</div>

___

## Overview

Collama is a VS Code extension that provides code completions, refactoring suggestions, and documentation generation. It supports multiple backends:

- **[Ollama](https://ollama.com)** - local
- **[OpenAI compatible](https://ai-sdk.dev/providers/openai-compatible-providers)** — local / cloud

> **Status:** Heavy active development — output may occasionally be unexpected.

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
- **Search and attach files/folders directly from the chat input**
- **Send to chat from file tree** — right-click files/folders in VSCode explorer
- Real-time context usage bar with automatic trimming
- Edit messages, copy sessions, scroll navigation
- Import/export chat history as JSON for backup and sharing
- Auto-accept all toggle for edits and creates to streamline workflow
- Summarize individual turns or entire conversations to reduce context usage
- **AGENTS.md support** — define custom agent rules by placing an `AGENTS.md` file in your project root
- **Intercept a running agent** — queue a follow-up message while the agent is still working; it's injected at the next turn boundary without interrupting the current one

**AI Agent with Tool Calling**
- Tools for filesystem, git, shell, and memory (see [Available Tools](#ai-agent-usage))
- Workspace-boundary and `.gitignore` protection; optional read-only mode
- Confirmation flow with Accept / Accept All / Cancel-with-reason, plus a duration counter
- **Memory tool** — persist facts and preferences across sessions with a dedicated viewer/editor modal
- **Background shell sessions** — start long-running commands, poll output incrementally, and stop them across agent turns

**Commit Messages**
- AI-generated conventional commits from staged changes
- Accessible via command palette or Source Control view

**Current Context Management**
- Smart pruning of editor tabs in autocomplete to fit context
- Chat history optimization (tool results removed)
- Token counter visualization in agent-loop / total usage

## Installation

**Prerequisites:** VS Code 1.109.0+, an Ollama or OpenAI-compatible endpoint (local or remote), and a supported code model (see [Models](#models)).

Install the extension from the marketplace or build the vsix yourself, then configure an endpoint in settings.
For authentication, set your API key as a bearer token — see [Bearer Tokens](#bearer-tokens-api-key).

**Ollama (local, remote)**<br>
See [Ollama installation instructions](https://docs.ollama.com/quickstart) or the [Docker image](https://ollama.com/blog/ollama-is-now-available-as-an-official-docker-image). Point `apiEndpointCompletion` / `apiEndpointInstruct` to your Ollama host (default: `http://127.0.0.1:11434`).

**OpenAI / OpenAI-compatible (local, remote, cloud)**<br>
Point the endpoint settings to your server (e.g. [vLLM](https://docs.vllm.ai/), LiteLLM) or to `https://api.openai.com` for the OpenAI cloud API.

## Configuration

Configure Collama via VS Code Settings (Preferences → Settings, search "collama"):

| Setting                                | Type    | Default                  | Description                                                                                                                                  |
| -------------------------------------- | ------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `collama.apiEndpointCompletion`        | string  | `http://127.0.0.1:11434` | Endpoint for code auto-completion                                                                                                            |
| `collama.apiEndpointInstruct`          | string  | `http://127.0.0.1:11434` | Endpoint for code edits/chat                                                                                                                 |
| `collama.apiModelCompletion`           | string  | `qwen2.5-coder:3b`       | Model for code completions                                                                                                                   |
| `collama.apiModelInstruct`             | string  | `gpt-oss:20b`            | Model for code edits (use instruct/base variant)                                                                                             |
| `collama.apiTokenContextLenCompletion` | number  | `4096`                   | Context window size (tokens) for the completion model                                                                                        |
| `collama.apiTokenContextLenInstruct`   | number  | `4096`                   | Context window size (tokens) for the instruct/chat model                                                                                     |
| `collama.apiTokenPredictCompletion`    | number  | `400`                    | Max tokens to generate per completion request                                                                                                |
| `collama.apiTokenPredictInstruct`      | number  | `4096`                   | Max tokens to generate per instruct/chat request                                                                                             |
| `collama.autoComplete`                 | boolean | `false`                  | Enable auto-suggestions                                                                                                                      |
| `collama.suggestMode`                  | string  | `inline`                 | Suggestion style: `inline`, `multiline`, or `multiblock`                                                                                     |
| `collama.suggestDelay`                 | number  | `1500`                   | Delay (ms) before requesting completion                                                                                                      |
| `collama.verbosityMode`                | string  | `medium`                 | Chat response detail: `compact`, `medium`, or `detailed`                                                                                     |
| `collama.agenticMode`                  | boolean | `true`                   | Use agentic (tool use) mode for chat                                                                                                         |
| `collama.liteMode`                     | boolean | `false`                  | Reduce the agent system prompt for small/weak models                                                                                         |
| `collama.enableEditTools`              | boolean | `true`                   | Enable edit tools (read-only mode when disabled)                                                                                             |
| `collama.enableShellTool`              | boolean | `false`                  | Enable shell tool usage                                                                                                                      |
| `collama.extraBody`                    | object  | `{}`                     | Extra JSON body fields for every LLM request (Instruct). Use for provider-specific params like `chat_template_kwargs` for thinking/reasoning |
| `collama.tlsRejectUnauthorized`        | boolean | `false`                  | Verify TLS certificates for HTTPS endpoints                                                                                                  |

### Manual Token Settings

Set token limits to match your model or server configuration. Values are tokens, not characters.

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
Small models may struggle with **verbosity** settings. Test it and keep the setting for the specific model.

#### For Code Completion (FIM - Fill In Middle)

- **any qwen coder > 3b** recommended

#### For Code Edits (Instruct/Base Models)

- **any instruct model with thinking capabilities** (e.g. gpt-oss:20b)
- **Mid-level MoE models with dynamic quantization** (e.g. unsloth's dynamic GGUF quants) gave noticeably better results than dense models of similar size
- Dense mid-size models (e.g. qwen3:14b) can struggle here — prefer a MoE/dynamic-quant variant if results are poor

#### Agentic Chat

- **Prefer frontier models** (e.g. gpt-oss:120b, glm-4.7, minimax2.7) for agentic mode.
- **Mid-level MoE models with dynamic quantization** also handled agentic editing well (e.g. gpt-oss:20b bf16, qwen3.6:35b, qwen3:30b — all dynamic quants)

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

Note: tested primarily at q4 quantization (results may vary with others), and ChatML-format models are not supported — only true FIM models will work for autocomplete.

## Usage

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
  - deepseek-v4-flash

> [!WARNING]
> Small models should use chat with `Agentic` OFF.

**Available Tools:**

- **Explore**
    - `read` — Read a workspace file, optionally by line range
    - `grep` — Search workspace files with a regex pattern
    - `glob` — Find files and folders by glob pattern

- **Git**
    - `gitLog` — List commits or branches with optional filters
    - `gitDiff` — Show working tree, staged, or commit/branch diffs

- **Flow**
    - `decision` — Ask the user to choose between options when the right next step is ambiguous
    - `memory` — Persist useful facts across sessions with `write`/`read`/`delete` actions; stored memories are listed in the system prompt as `[scope] key — summary`

- **Edit Tools**
    - `edit` — Replace an exact string in a workspace file with preview and confirmation
    - `create` — Create a new file or folder with confirmation
    - `delete` — Delete a file or folder with confirmation
    - `notebook` — Edit Jupyter notebook cells with rich diff preview support

- **Shell Tool**
    - `shell` — Run shell commands with confirmation when `collama.enableShellTool` is enabled. Supports four actions:
        - `run` (default) — one-shot command; large output is written to a temp file instead of truncating
        - `start` — launch a command in the background and return a session id
        - `check` — poll incremental output and status of a background session
        - `stop` — terminate a background session
    - Commands containing write-capable shell constructs (redirection, substitution, ...) are marked with a warning in the confirmation dialog
    - Provably read-only commands (git read subcommands, bash/coreutils, PowerShell cmdlets) can beauto-accepted

## Contributing

Contributions are welcome! Here's how you can help:

1. **Report Issues** [Open an issue](https://github.com/bitdruid/collama/issues)
2. **Submit PRs**: Fork, create a feature branch, and submit a pull request
