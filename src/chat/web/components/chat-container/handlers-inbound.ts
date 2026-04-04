import { logWebview, showToast } from "../../../utils-front";
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
        "chat-complete": (m) => handleChatComplete(host, m),
        "summary-complete": (m) => handleSummarized(host, m),
        "context-trimmed": (m) => handleContextTrimmed(host, m),
        "context-update": (m) => handleContextUpdate(host, m),
        "context-search-results": (m) => handleContextSearchResults(host, m),
        "tool-confirm-request": (m) => handleToolConfirmRequest(host, m),
        "agent-error": (m) => handleAgentError(host, m),
    };
    return (msg: any) => handlers[msg.type]?.(msg);
}

/** Applies session state (history, sessions list, context usage) from a host message. */
function applySessionState(host: ChatContainer, msg: any) {
    const store = ChatSessionStore.instance;

    // Use store's public method to update state
    store.updateFromBackend({
        sessions: msg.sessions || [],
        activeSessionId: msg.activeSessionId || host.activeSessionId,
        history: msg.history || [],
        contextUsed: msg.contextUsed || 0,
        contextMax: msg.contextMax || 0,
    });

    // Refresh reference to store's ChatContext
    // Note: This is also handled by _onStoreChange event, but we refresh here for immediate UI update
    host.chatContext = store.getActiveChatContext();
    host.syncMessages();

    // Update host properties for UI
    host.sessions = store.sessions;
    host.activeSessionId = store.activeSessionId;
    host.contextUsed = store.contextUsed;
    host.contextMax = store.contextMax;
    host.contextStartIndex = msg.contextStartIndex || 0;

    // Sync tempChat flag from the active session
    const activeSession = store.sessions.find((s) => s.id === store.activeSessionId);
    host.tempChat = activeSession?.temporary ?? false;
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
    host.chatContext?.push(msg.message);
    host.syncMessages();
}

/** Appends a streaming text chunk to the message at the given index. */
function handleAgentChunk(host: ChatContainer, msg: any) {
    host.chatContext?.appendContent(msg.index, msg.chunk);
    host.debounceSyncMessages();
}

/** Updates the live agent token counter during streaming. */
function handleAgentTokens(host: ChatContainer, msg: any) {
    host.agentToken = msg.tokens;
    host.hasTokenData = true;
}

/** Marks the LLM response as finished, resets loading/token state, and applies backend-computed context usage. */
function handleChatComplete(host: ChatContainer, msg: any) {
    host.isLoading = false;
    host.agentToken = 0;
    host.hasTokenData = false;
    host.contextUsed = msg.contextUsed ?? 0;
    ChatSessionStore.instance.setContextUsage(host.contextUsed, host.contextMax);
}

/** Replaces message history with the summarized version returned by the host. */
function handleSummarized(host: ChatContainer, msg: any) {
    host.chatContext?.setMessages(msg.messages || []);
    host.syncMessages();
    if (msg.isConversation) {
        host.contextStartIndex = 0;
    }
    showToast(msg.isConversation ? "Conversation summarized" : "Turn summarized");
}

/** Adjusts `contextStartIndex` when the host trims old messages to stay within the context window. */
function handleContextTrimmed(host: ChatContainer, msg: any) {
    host.contextStartIndex = msg.contextStartIndex || 0;
    if (msg.turnsRemoved > 0) {
        const turns = msg.turnsRemoved;
        showToast(`Context exceeded — ${turns} old turn${turns > 1 ? "s" : ""} removed (~${msg.tokensFreed} tokens)`);
    }
}

/** Shows the tool confirmation modal when the backend requests user approval. */
function handleToolConfirmRequest(host: ChatContainer, msg: any) {
    host.toolConfirmRequest = { id: msg.id, action: msg.action, filePath: msg.filePath };
    logWebview(`Tool confirm request: ${msg.action} ${msg.filePath}`);
    host.updateComplete.then(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => host.scrollToBottom());
        });
    });
}

/** Displays the error modal with exported chat and error details when the agent throws. */
function handleAgentError(host: ChatContainer, msg: any) {
    host.isLoading = false;
    host.agentToken = 0;
    host.hasTokenData = false;

    const content = `${msg.exportedChat}${msg.errorMessage}`;

    const modal = host.shadowRoot?.querySelector("collama-error-modal") as any;
    modal?.showError(content);
    logWebview(`Agent error: ${msg.error?.message}`);
}

/** Forwards file/folder search results to the chat input's context tree. */
function handleContextSearchResults(host: ChatContainer, msg: any) {
    host.contextSearchResults = msg.results || [];
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
