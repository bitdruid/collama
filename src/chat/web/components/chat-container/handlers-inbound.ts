import { estimateTokens, logWebview } from "../../../utils-front";
import { ChatSessionStore } from "../chat-session/chat-session-store";
import type { ChatContainer } from "./chat-container";

/** Creates a dispatcher function that routes inbound host messages to their handlers. */
export function createInboundDispatcher(host: ChatContainer) {
    const handlers: Record<string, (m: any) => void> = {
        init: (m) => handleInit(host, m),
        "sessions-update": (m) => handleSessionsUpdate(host, m),
        "agent-add-message": (m) => handleAgentAddMessage(host, m),
        "agent-chunk": (m) => handleAgentChunk(host, m),
        "agent-tokens": (m) => handleAgentTokens(host, m),
        "chat-complete": () => handleChatComplete(host),
        "conversation-summarized": (m) => handleConversationSummarized(host, m),
        "turn-summarized": (m) => handleTurnSummarized(host, m),
        "context-trimmed": (m) => handleContextTrimmed(host, m),
        "context-update": (m) => handleContextUpdate(host, m),
    };
    return (msg: any) => handlers[msg.type]?.(msg);
}

/** Applies session state (history, sessions list, context usage) from a host message. */
function applySessionState(host: ChatContainer, msg: any) {
    host.wvChatContext.setMessages(msg.history || []);
    host.syncMessages();
    host.sessions = msg.sessions || [];
    host.activeSessionId = msg.activeSessionId || "";
    host.contextUsed = estimateTokens(msg.history || []);
    host.contextMax = msg.contextMax || 0;
    host.contextStartIndex = msg.contextStartIndex || 0;

    ChatSessionStore.instance.loadFromBackend({
        sessions: host.sessions,
        activeSessionId: host.activeSessionId,
        contextUsed: host.contextUsed,
        contextMax: host.contextMax,
    });
}

/** Initializes the component with session history, context usage, and session list from the host. */
function handleInit(host: ChatContainer, msg: any) {
    applySessionState(host, msg);
    logWebview(`${host.sessions.length} sessions total, active: ${host.activeSessionId}`);
}

/** Replaces the full session state when the user switches sessions or sessions change on the host. */
function handleSessionsUpdate(host: ChatContainer, msg: any) {
    applySessionState(host, msg);
}

/** Appends a complete message (e.g. tool call/response) pushed by the agent. */
function handleAgentAddMessage(host: ChatContainer, msg: any) {
    host.wvChatContext.push(msg.message);
    host.syncMessages();
}

/** Appends a streaming text chunk to the message at the given index. */
function handleAgentChunk(host: ChatContainer, msg: any) {
    host.wvChatContext.appendContent(msg.index, msg.chunk);
    host.clearLoadingTimeout();
    host.debounceSyncMessages();
}

/** Updates the live agent token counter during streaming. */
function handleAgentTokens(host: ChatContainer, msg: any) {
    host.agent_token = msg.tokens;
    host.hasTokenData = true;
}

/** Marks the LLM response as finished, resets loading/token state, and recalculates context usage. */
function handleChatComplete(host: ChatContainer) {
    host.isLoading = false;
    host.clearLoadingTimeout();
    host.agent_token = 0;
    host.hasTokenData = false;
    host.contextUsed = estimateTokens(host.wvChatContext.getMessages());
    ChatSessionStore.instance.setContextUsage(host.contextUsed, host.contextMax);
}

/** Replaces message history with the summarized conversation returned by the host. */
function handleConversationSummarized(host: ChatContainer, msg: any) {
    host.wvChatContext.setMessages(msg.messages || []);
    host.syncMessages();
    host.contextStartIndex = 0;
    host.showToast("Conversation summarized");
}

/** Replaces message history with the version containing the summarized turn. */
function handleTurnSummarized(host: ChatContainer, msg: any) {
    host.wvChatContext.setMessages(msg.messages || []);
    host.syncMessages();
    host.contextUsed = estimateTokens(msg.messages || []);
    ChatSessionStore.instance.setContextUsage(host.contextUsed, host.contextMax);
    host.showToast("Turn summarized");
}

/** Adjusts `contextStartIndex` when the host trims old messages to stay within the context window. */
function handleContextTrimmed(host: ChatContainer, msg: any) {
    host.contextStartIndex = msg.contextStartIndex || 0;
    if (msg.turnsRemoved > 0) {
        const turns = msg.turnsRemoved;
        host.showToast(
            `Context exceeded — ${turns} old turn${turns > 1 ? "s" : ""} removed (~${msg.tokensFreed} tokens)`,
        );
    }
}

/** Adds a file/selection context sent from the editor (e.g. via "Add to Chat" command). */
function handleContextUpdate(host: ChatContainer, msg: any) {
    const newCtx = msg.context;
    const exists = host.currentContexts.some(
        (ctx) =>
            ctx.fileName === newCtx.fileName && ctx.startLine === newCtx.startLine && ctx.endLine === newCtx.endLine,
    );
    if (!exists) {
        host.currentContexts = [...host.currentContexts, newCtx];
    }
    logWebview(`Context received: ${newCtx.fileName} (total: ${host.currentContexts.length})`);
}
