import type { ToolCall } from "../../../../common/client";
import { logWebview, showToast } from "../utils";
import type { ChatSettings } from "../../../shared";
import type { ChatRoot } from "../chat-root";
import { ChatSessionStore } from "../components/chat-header/chat-session-store";
import { estTokens, EXTENSION_HARD_TOKEN_CAP } from "../../../../common/utils";

/** Creates a dispatcher function that routes inbound host messages to their handlers. */
export function createInboundDispatcher(host: ChatRoot) {
    const handlers: Record<string, (m: any) => void> = {
        init: (m) => handleInit(host, m),
        "agent-add-message": (m) => handleAgentAddMessage(host, m),
        "agent-inject-message": (m) => handleAgentInjectMessage(host, m),
        "agent-chunk": (m) => handleAgentChunk(host, m),
        "agent-error": (m) => handleAgentError(host, m),
        "agent-reasoning": (m) => handleAgentReasoning(host, m),
        "agent-tokens": (m) => handleAgentTokens(host, m),
        "agent-tool-calls": (m) => handleAgentToolCalls(host, m),
        "chat-complete": (m) => handleChatComplete(host, m),
        "config-update": (m) => handleConfigUpdate(host, m),
        "memory-list": (m) => handleMemoryList(host, m),
        "context-search-results": (m) => handleContextSearchResults(host, m),
        "context-trimmed": (m) => handleContextTrimmed(host, m),
        "context-update": (m) => handleContextUpdate(host, m),
        "history-replace": (m) => handleHistoryReplace(host, m),
        "sessions-update": (m) => handleSessionsUpdate(host, m),
        "summary-complete": (m) => handleSummarized(host, m),
        "summary-error": (m) => handleSummaryError(host, m),
        "summary-progress": (m) => handleSummaryProgress(host, m),
        "tool-confirm-request": (m) => handleToolConfirmRequest(host, m),
        "tool-decision-request": (m) => handleToolDecisionRequest(host, m),
    };
    return (msg: any) => {
        handlers[msg.type]?.(msg);
    };
}

// ---------- session ----------

/** Applies session state (history, sessions list, context usage) from a host message. */
function applySessionState(host: ChatRoot, msg: any) {
    const store = ChatSessionStore.instance;

    store.updateFromBackend({
        sessions: msg.sessions || [],
        activeSessionId: msg.activeSessionId || host.activeSessionId,
        history: msg.history || [],
        contextUsed: msg.contextUsed || 0,
        contextMax: msg.contextMax || 0,
    });

    host.chatContext = store.getActiveChatContext();
    host.syncMessages();

    host.sessions = store.sessions;
    host.activeSessionId = store.activeSessionId;
    host.contextUsed = store.contextUsed;
    host.contextMax = store.contextMax;
    host.contextStartIndex = msg.contextStartIndex || 0;
}

function legacyConfigFromMessage(msg: any): Partial<ChatSettings> {
    const config: Partial<ChatSettings> = {};
    if ("enableEditTools" in msg) {
        config.enableEditTools = msg.enableEditTools;
    }
    if ("enableShellTool" in msg) {
        config.enableShellTool = msg.enableShellTool;
    }
    return config;
}

function applyConfig(host: ChatRoot, msg: any) {
    host.config = {
        ...host.config,
        ...(msg.config || legacyConfigFromMessage(msg)),
    };
    if (msg.agentsMdActive !== undefined) {
        host.agentsMdActive = msg.agentsMdActive;
    }
    if (msg.memoryActive !== undefined) {
        host.memoryActive = msg.memoryActive;
    }
}

function applyState(host: ChatRoot, msg: any) {
    if (msg.autoAcceptAll !== undefined) {
        host.autoAccept = msg.autoAcceptAll;
    }
}

/** Initializes the component with session history, context usage, and session list from the host. */
function handleInit(host: ChatRoot, msg: any) {
    applySessionState(host, msg);
    applyConfig(host, msg);
    applyState(host, msg);
    logWebview(`${host.sessions.length} sessions total, active: ${host.activeSessionId}`);
}

/** Updates tool enable/disable state when config changes. */
function handleConfigUpdate(host: ChatRoot, msg: any) {
    applyConfig(host, msg);
}

/** Populates the memory viewer with the entries sent by the host. */
function handleMemoryList(host: ChatRoot, msg: any) {
    host.memoryEntries = msg.entries || [];
}

/** Replaces the full session state when the user switches sessions or sessions change on the host. */
function handleSessionsUpdate(host: ChatRoot, msg: any) {
    applySessionState(host, msg);
}

/** Replaces the full message history (e.g. after a cancel prunes incomplete tail state). */
function handleHistoryReplace(host: ChatRoot, msg: any) {
    host.chatContext?.setMessages(msg.messages || []);
    host.syncMessages();
}

// ---------- agent / streaming ----------

/** Appends a complete message (e.g. tool call/response) pushed by the agent. */
function handleAgentAddMessage(host: ChatRoot, msg: any) {
    host.chatContext?.push(msg.message);
    host.syncMessages();
}

/** Inserts a mid-run user interjection at the index the backend reserved before the next turn. */
function handleAgentInjectMessage(host: ChatRoot, msg: any) {
    host.chatContext?.replaceRange(msg.index, msg.index, [msg.message]);
    host.syncMessages();
    // The real message now renders in-stream; drop its pending banner by id.
    host.pendingIntercepts = host.pendingIntercepts.filter((p) => p.id !== msg.injectId);
}

/** Attaches tool-call metadata to the assistant message that initiated the tool run. */
function handleAgentToolCalls(host: ChatRoot, msg: any) {
    const target = host.chatContext?.getMsgByIndex(msg.index);
    if (target?.role === "assistant") {
        target.tool_calls = (msg.toolCalls || []) as ToolCall[];
        host.syncMessages();
    }
}

/** Appends a streaming text chunk to the message at the given index. */
function handleAgentChunk(host: ChatRoot, msg: any) {
    host.chatContext?.appendContent(msg.index, msg.chunk);
    host.debounceSyncMessages();
}

/** Appends a streaming reasoning chunk to the message at the given index. */
function handleAgentReasoning(host: ChatRoot, msg: any) {
    host.chatContext?.appendThinking(msg.index, msg.chunk);
    host.debounceSyncMessages();
}

/** Updates the live agent token counter during streaming. */
function handleAgentTokens(host: ChatRoot, msg: any) {
    host.agentToken = msg.tokens;
    host.hasTokenData = true;
}

/** Marks the LLM response as finished, resets loading/token state, and applies backend-computed context usage. */
function handleChatComplete(host: ChatRoot, msg: any) {
    host.isGenerating = false;
    host.isSummarizing = false;
    host.agentToken = 0;
    host.hasTokenData = false;
    // Run ended — clear any intercepts that never got drained (e.g. after a cancel).
    host.pendingIntercepts = [];
    host.contextUsed = msg.contextUsed ?? 0;
    ChatSessionStore.instance.setContextUsage(host.contextUsed, host.contextMax);
    host.completeAutoSummaryContextUpdate();
}

/** Displays the error modal with exported chat and error details when the agent throws. */
function handleAgentError(host: ChatRoot, msg: any) {
    host.isGenerating = false;
    host.isSummarizing = false;
    host.agentToken = 0;
    host.hasTokenData = false;
    host.pendingIntercepts = [];

    const errorMessage = (msg.errorMessage || "").trim().replace(/^--- ERROR ---\s*/, "");
    const history = (msg.exportedChat || "").trim();
    host.errorModalContent = `ERROR:\n${errorMessage}\n\nHISTORY:\n${history}`;
    host.activeModal = "error";
    logWebview(`Agent error: ${msg.error?.message}`);
}

// ---------- summarization ----------

/** Replaces message history with the summarized version returned by the host. */
function handleSummarized(host: ChatRoot, msg: any) {
    host.chatContext?.setMessages(msg.messages || []);
    host.syncMessages();
    if (msg.isConversation) {
        host.contextStartIndex = 0;
        host.markAutoSummaryComplete();
    } else {
        host.contextStartIndex = msg.contextStartIndex || 0;
    }
    showToast(msg.isConversation ? "Conversation summarized" : "Turn summarized");
}

/** Restores the auto-summary prompt when a forced conversation summary fails. */
function handleSummaryError(host: ChatRoot, msg: any) {
    if (msg.isConversation) {
        host.reopenAutoSummaryOnError();
    }
}

/** Shows a toast with the current summarization progress. */
function handleSummaryProgress(_host: ChatRoot, msg: any) {
    showToast(`Summarizing: ${msg.current} / ${msg.total}`);
}

/** Adjusts `contextStartIndex` when the host trims old messages to stay within the context window. */
function handleContextTrimmed(host: ChatRoot, msg: any) {
    host.contextStartIndex = msg.contextStartIndex || 0;
    if (msg.turnsRemoved > 0) {
        const turns = msg.turnsRemoved;
        showToast(`Context exceeded — ${turns} old turn${turns > 1 ? "s" : ""} removed (~${msg.tokensFreed} tokens)`);
    }
}

// ---------- tool prompts ----------

/** Shows the tool confirmation modal when the backend requests user approval. */
function handleToolConfirmRequest(host: ChatRoot, msg: any) {
    host.toolConfirmRequest = {
        id: msg.id,
        action: msg.action,
        filePath: msg.filePath,
        explanation: msg.explanation,
        dangerous: msg.dangerous,
    };
    host.activeModal = "toolConfirm";
    logWebview(`Tool confirm request: ${msg.action} ${msg.filePath}`);
    host.updateComplete.then(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => host.scrollToBottom());
        });
    });
}

/** Shows the decision modal when the agent asks the user to pick between options. */
function handleToolDecisionRequest(host: ChatRoot, msg: any) {
    host.toolDecisionRequest = { id: msg.id, question: msg.question, options: msg.options };
    host.activeModal = "toolDecision";
    logWebview(`Tool decision request: ${msg.question}`);
    host.updateComplete.then(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => host.scrollToBottom());
        });
    });
}

// ---------- context ----------

/** Forwards file/folder search results to the chat input's context tree. */
function handleContextSearchResults(host: ChatRoot, msg: any) {
    host.contextSearchResults = msg.results || [];
}

/** Adds a file/selection context sent from the editor (e.g. via "Add to Chat" command). */
function handleContextUpdate(host: ChatRoot, msg: any) {
    const newCtx = msg.context;

    // Chat-only mode embeds this content into the message and tokenizes it. Reject oversized
    // attachments here (cheap length-based estimate) so the exact, blocking encode never runs.
    const approxTokens = estTokens((newCtx.content ?? "").length);
    if (approxTokens > EXTENSION_HARD_TOKEN_CAP) {
        showToast(
            `"${newCtx.fileName}" is too large to attach (~${approxTokens} tokens, max ${EXTENSION_HARD_TOKEN_CAP})`,
        );
        logWebview(`Context rejected: ${newCtx.fileName} (~${approxTokens} tokens > ${EXTENSION_HARD_TOKEN_CAP})`);
        return;
    }

    const exists = host.currentContexts.some(
        (ctx) =>
            ctx.relativePath === newCtx.relativePath &&
            ctx.startLine === newCtx.startLine &&
            ctx.endLine === newCtx.endLine,
    );
    if (!exists) {
        host.currentContexts = [...host.currentContexts, newCtx];
        logWebview(`Context received: ${newCtx.fileName} (total: ${host.currentContexts.length})`);
    }
}
