<p align="center">
  <img src="media/collama.png" alt="collama" width="250px"/>
</p>

<div align="center">

# Collama

**AI-powered code completion and editing for VS Code using local LLM backends**

[![Version](https://img.shields.io/github/package-json/v/bitdruid/collama)](https://github.com/bitdruid/collama)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code Version](https://img.shields.io/badge/VS%20Code-%5E1.120.0-blue)](https://code.visualstudio.com/)

[Overview](#overview) • [Features](#features) • [Installation](#installation) • [Configuration](#configuration) • [Models](#models) • [Usage](#usage) • [AI Agent](#ai-agent-usage) • [Web Search](#searxng-web-search-setup) • [Contributing](#contributing)

</div>

___

## Overview

Collama provides code completion, refactoring, documentation, and an agentic chat — all against local or OpenAI-compatible LLM backends:

- **[Ollama](https://ollama.com)** — local
- **[OpenAI compatible](https://ai-sdk.dev/providers/openai-compatible-providers)** — local / cloud (vLLM, LiteLLM, OpenAI)

> **Status:** Heavy active development — output may occasionally be unexpected.

## Features

**Code Completion** — inline, multiline, and multiblock suggestions using open tabs as context.
<p align="left">
  <img src="media/collama.gif" alt="collama" width="500px"/>
</p>

**Code Edits** — docstrings, extract/refactor functions, simplify code, fix syntax, or manual instructions on a selection.

**Chat Interface**
- Multiple sessions with custom titles; temporary (unlisted, non-persisted) sessions for quick experiments
- Attach files/folders from the chat input or via right-click in the explorer ("Send to Chat")
- Real-time context usage bar with automatic trimming; graceful wrap-up when a run hits the window
- Summarize individual turns or whole conversations to reclaim context
- Edit messages, copy sessions, import/export history as JSON
- **AGENTS.md support** — drop an `AGENTS.md` in the project root to define custom agent rules
- **Intercept a running agent** — queue a follow-up; it's injected at the next turn boundary without interrupting

**AI Agent with Tool Calling**
- Filesystem, git, shell, and memory tools (see [Available Tools](#ai-agent-usage))
- Workspace-boundary and `.gitignore` protection; optional read-only mode
- Confirmation flow with Accept / Accept All / Cancel-with-reason and a duration counter
- **Memory tool** — persist facts/preferences across sessions via a viewer/editor modal
- **Background shell sessions** — start long-running commands, poll output, and stop them across turns

**Commit Messages** — AI-generated conventional commits from staged changes, via command palette or Source Control.

## Installation

**Prerequisites:** VS Code 1.120.0+, an Ollama or OpenAI-compatible endpoint (local or remote), and a supported code model (see [Models](#models)).

Install from the marketplace or build the vsix yourself, then configure an endpoint in settings. For authenticated endpoints, set an API key as a bearer token — see [Bearer Tokens](#bearer-tokens-api-key).

- **Ollama** — see the [quickstart](https://docs.ollama.com/quickstart) or [Docker image](https://ollama.com/blog/ollama-is-now-available-as-an-official-docker-image); point `apiEndpoint*` at your host (default `http://127.0.0.1:11434`).
- **OpenAI / compatible** — point the endpoints at your server ([vLLM](https://docs.vllm.ai/), LiteLLM) or `https://api.openai.com`.

## Configuration

Configure via VS Code Settings (Preferences → Settings, search "collama"):

| Setting                                | Type    | Default   | Description                                                                                                                                  |
| -------------------------------------- | ------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `collama.apiEndpointCompletion`        | string  | _(empty)_ | Endpoint for code auto-completion (e.g. `http://127.0.0.1:11434`)                                                                            |
| `collama.apiEndpointInstruct`          | string  | _(empty)_ | Endpoint for code edits/chat (e.g. `http://127.0.0.1:11434`)                                                                                 |
| `collama.apiModelCompletion`           | string  | _(empty)_ | Model for code completions (e.g. `qwen2.5-coder:3b`)                                                                                         |
| `collama.apiModelInstruct`             | string  | _(empty)_ | Model for code edits — use instruct/base variant (e.g. `gpt-oss:20b`)                                                                        |
| `collama.apiTokenContextLenCompletion` | number  | `32000`   | Context window size (tokens) for the completion model                                                                                        |
| `collama.apiTokenContextLenInstruct`   | number  | `128000`  | Context window size (tokens) for the instruct/chat model                                                                                     |
| `collama.apiTokenPredictCompletion`    | number  | `400`     | Max tokens to generate per completion request                                                                                                |
| `collama.apiTokenPredictInstruct`      | number  | `8000`    | Max tokens to generate per instruct/chat request                                                                                             |
| `collama.autoComplete`                 | boolean | `false`   | Enable auto-suggestions                                                                                                                      |
| `collama.suggestMode`                  | string  | `inline`  | Suggestion style: `inline`, `multiline`, or `multiblock`                                                                                     |
| `collama.suggestDelay`                 | number  | `1500`    | Delay (ms) before requesting completion                                                                                                      |
| `collama.verbosityMode`                | string  | `medium`  | Chat response detail: `compact`, `medium`, or `detailed`                                                                                     |
| `collama.agenticMode`                  | boolean | `true`    | Use agentic (tool use) mode for chat                                                                                                         |
| `collama.liteMode`                     | boolean | `false`   | Reduce the agent system prompt for small/weak models                                                                                         |
| `collama.enableEditTools`              | boolean | `true`    | Enable edit tools (read-only mode when disabled)                                                                                             |
| `collama.enableShellTool`              | boolean | `false`   | Enable shell tool usage                                                                                                                      |
| `collama.extraBody`                    | object  | `{}`      | Extra JSON body fields for every LLM request (Instruct). Use for provider-specific params like `chat_template_kwargs` for thinking/reasoning |
| `collama.tlsRejectUnauthorized`        | boolean | `false`   | Verify TLS certificates for HTTPS endpoints                                                                                                  |
| `collama.searxngEndpoint`              | string  | _(empty)_ | SearXNG server URL for the agent's web search tool (e.g. `http://127.0.0.1:8888`). Requires JSON output format enabled on the instance       |

### Manual Token Settings

Token values, not characters. `apiTokenContextLen*` is the available context window; `apiTokenPredict*` is the max generated tokens per request. Context is shared by input and answer, so a higher predict limit leaves less room for input.

> [!NOTE]
> Check your model's maximum context window online and keep memory reservation in mind.

### Bearer Tokens (API Key)

For authenticated endpoints, store a token via Command Palette — `collama: Set Bearer Token (Completion)` / `(Instruct)`. Tokens are sent as `Authorization: Bearer <token>` and kept in VS Code's encrypted storage; run the command with an empty value to clear one.

## Models

Tested primarily with **Qwen Coder** for completion and **LiteLLM frontier models** for instruct. Small models may struggle with **verbosity** — pick a setting per model.

- **Completion (FIM)** — any Qwen Coder > 3B.
- **Code Edits** — an instruct model with thinking (e.g. gpt-oss:20b); mid-level MoE dynamic-quant variants (e.g. unsloth GGUF) beat dense models of similar size. Dense mid-size (e.g. qwen3:14b) can struggle.
- **Agentic Chat** — prefer frontier models (gpt-oss:120b, glm-4.7, minimax2.7); mid-level MoE dynamic quants also work (gpt-oss:20b bf16, qwen3:30b).
- **Pure Chat** — any chat model. Keep Agentic **OFF** for small models — they lack the reasoning for reliable tool calling.

### Model Completion Compatibility

| Model         | Tested Sizes | FIM Support | Status   | Notes              |
| ------------- | ------------ | ----------- | -------- | ------------------ |
| codeqwen      | —            | ⚠️           | Untested | May work           |
| qwen2.5-coder | 1.5B, 3B, 7B | ✅           | Stable   | Recommended        |
| qwen3-coder   | 30B          | ✅           | Stable   | Recommended        |
| starcoder     | —            | ⚠️           | Untested | May work           |
| starcoder2    | 3B           | ✅           | Stable   | Like qwen2.5-coder |

Tested mostly at q4 quantization. ChatML-format models are not supported — only true FIM models work for autocomplete.

## Usage

- **Completions** — trigger after `suggestDelay`; `Tab` to accept, `Esc` to dismiss.
- **Code edits** — select code, use **collama (on selection)** for docstrings, refactors, fixes, or manual edits.
- **Chat** — attach files/folders, manage sessions, summarize context, toggle auto-accept.
- **Commit messages** — stage changes, then run **collama: Generate Commit Message**.

### AI Agent Usage

`Agentic` can be toggled mid-chat without needing a fresh session. `Edit Tools` OFF gives read-only exploration; `Shell Tool` is OFF by default and enabled from the status bar menu.

> [!WARNING]
> Small models should chat with `Agentic` OFF.

Agentic mode tested on vLLM (NVIDIA H200) with gpt-oss:120b, glm-4.7-fp8, minimax2.5/2.7, deepseek-v4-flash.

**Available Tools:**

- **Explore** — `read` (file, optional line range), `grep` (regex search), `glob` (find by pattern)
- **Git** — `gitLog` (commits/branches), `gitDiff` (working tree, staged, or commit/branch)
- **Flow** — `decision` (ask the user to choose), `memory` (persist/recall/forget), `notepad` (per-task facts + todos)
- **Edit** — `edit` (replace exact string), `create`, `delete`, `notebook` (Jupyter cells)
- **Shell** — `shell` (`run`/`start`/`check`/`stop`); large output goes to a temp file, write commands are warned, read-only commands auto-accepted
- **Web Search** — `websearch` (via SearXNG instance configured in `collama.searxngEndpoint`)

### Web Search Setup

To enable web search in agentic mode, run a local SearXNG instance. A drop-in compose file is provided at [`media/searxng.yml`](media/searxng.yml) — no further configuration or file-editing needed.

**Usage:**

1. Run `docker compose -f media/searxng.yml up -d`
2. Configure `collama.searxngEndpoint` in VS Code settings to match your URL (e.g., `http://localhost:9000`)
3. Enable agentic mode (`collama.agenticMode = true`)

The search tool is only offered to the agent while SearXNG is reachable and has JSON output format enabled.

**Engine selection:**

The agent can restrict a search to specific engines. Which engines it gets offered is read from the instance (`/config`):

- By default, the agent is offered the engines of the `general` category — the same set a plain query searches. A search without an engine selection always uses the server default (`general`).
- To hand the agent a custom subset, tag the wanted engines with an extra `collama` category. If any engine carries it, only those are offered.

Note that the `categories:` key on an engine **replaces** its defaults — restate every category the engine should stay in (e.g. keep it on the UI's general and it tabs):

```yaml
engines:
  - name: github
    categories: [general, it, collama]
```

The provided [`media/searxng.yml`](media/searxng.yml) works as-is: all its engines are in `general`, so the agent is offered all of them.


## Contributing

Contributions welcome — [open an issue](https://github.com/bitdruid/collama/issues) or fork, branch, and submit a PR.
