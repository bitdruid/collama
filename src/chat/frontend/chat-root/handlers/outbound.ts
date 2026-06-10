import { LitElement } from "lit";
import { AttachedContext, ChatHistory } from "../../../../common/context-chat";
import type { ChatSettings } from "../../../shared";
import { buildSelfContainedHtml } from "../html-export";
import { buildUserContent, logWebview, showToast } from "../utils";
import type { ChatRoot } from "../chat-root";

declare global {
    interface Window {
        vscode: {
            postMessage(message: any): void;
            getState(): any;
            setState(state: any): void;
        };
    }
}

/** Typed wrappers for all outbound postMessage calls to the VS Code host. */
const backendApi = {
    ready: () => window.vscode.postMessage({ type: "chat-ready" }),
    sendChatRequest: (messages: ChatHistory[], sessionId: string) =>
        window.vscode.postMessage({ type: "chat-request", messages, sessionId }),
    intercept: (content: string, contexts: AttachedContext[], id: string) =>
        window.vscode.postMessage({ type: "chat-intercept", content, contexts, id }),
    cancelIntercept: (id: string) => window.vscode.postMessage({ type: "chat-intercept-cancel", id }),
    cancel: () => window.vscode.postMessage({ type: "chat-cancel" }),
    summarize: (turnStart: number, turnEnd: number, sessionId: string) =>
        window.vscode.postMessage({ type: "summarize-request", turnStart, turnEnd, sessionId }),
    deleteMessages: (turnStart: number, turnEnd: number, sessionId: string) =>
        window.vscode.postMessage({ type: "delete-messages", turnStart, turnEnd, sessionId }),
    newSession: () => window.vscode.postMessage({ type: "new-session" }),
    newGhostSession: () => window.vscode.postMessage({ type: "new-ghost-session" }),
    switchSession: (sessionId: string) => window.vscode.postMessage({ type: "switch-session", sessionId }),
    deleteSession: (sessionId: string) => window.vscode.postMessage({ type: "delete-session", sessionId }),
    renameSession: (sessionId: string, newTitle: string) =>
        window.vscode.postMessage({ type: "rename-session", sessionId, newTitle }),
    copySession: (sessionId: string) => window.vscode.postMessage({ type: "copy-session", sessionId }),
    autoAcceptAll: (enabled: boolean) => window.vscode.postMessage({ type: "auto-accept-all", enabled }),
    convertToGhost: () => window.vscode.postMessage({ type: "convert-to-ghost" }),
    clearChat: () => window.vscode.postMessage({ type: "clear-chat" }),
    exportSession: (sessionId: string) => window.vscode.postMessage({ type: "export-session", sessionId }),
    exportSessionHtml: (sessionId: string, title: string, html: string) =>
        window.vscode.postMessage({ type: "export-session-html", sessionId, title, html }),
    importSession: () => window.vscode.postMessage({ type: "import-session" }),
    toolConfirmResponse: (id: string, value: string, reason: string) =>
        window.vscode.postMessage({ type: "tool-confirm-response", id, value, reason }),
    toolDecisionResponse: (id: string, value: string) =>
        window.vscode.postMessage({ type: "tool-decision-response", id, value }),
    contextSearch: (query: string) => window.vscode.postMessage({ type: "context-search", query }),
    contextAdd: (relativePath: string, isFolder?: boolean) =>
        window.vscode.postMessage({ type: "context-add", relativePath, isFolder }),
    updateConfig: (key: string, value: unknown) =>
        window.vscode.postMessage({ type: "config-update-request", key, value }),
};

/** Signals the host that the webview is ready to receive the initial state. */
export function onChatReady() {
    backendApi.ready();
}

/** Applies a settings change locally and persists it on the host. */
export function onSettingsUpdate(host: ChatRoot, e: CustomEvent) {
    const { key, value } = e.detail as { key: keyof ChatSettings; value: ChatSettings[keyof ChatSettings] };
    host.config = { ...host.config, [key]: value };
    backendApi.updateConfig(key, value);
}

function scrollToBottomAfterRender(host: ChatRoot) {
    host.updateComplete.then(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => host.scrollToBottom());
        });
    });
}

// ---------- chat send / edit / delete ----------

/** Builds user content with embedded contexts, sends the request, and adds a placeholder assistant message. */
export function onSubmit(host: ChatRoot, e: CustomEvent) {
    const content = e.detail.value?.trim();
    const contexts: AttachedContext[] = e.detail.contexts || [];
    if (!content) {
        if (contexts.length > 0) {
            host.currentContexts = [];
        }
        return;
    }

    // While the agent is running, route the message into the live loop instead of starting a
    // new run. It is inserted at the next turn boundary and rendered via `agent-inject-message`.
    if (host.isGenerating) {
        if (contexts.length > 0) {
            host.currentContexts = [];
        }
        const id = crypto.randomUUID();
        backendApi.intercept(buildUserContent(contexts, content, host.config.agenticMode), contexts, id);
        // Show a pending banner until the backend drains it (see handleAgentInjectMessage).
        host.pendingIntercepts = [...host.pendingIntercepts, { id, text: content, contextCount: contexts.length }];
        logWebview("Intercept queued into running agent loop");
        return;
    }

    if (contexts.length > 0) {
        host.currentContexts = [];
    }
    host.chatContext?.push({
        role: "user",
        content: buildUserContent(contexts, content, host.config.agenticMode),
        customKeys: contexts.length > 0 ? { contexts } : undefined,
    });
    const messagesToSend = [...(host.chatContext?.getMessages() || [])];
    host.chatContext?.push({ role: "assistant", content: "" });
    host.syncMessages();

    host.isGenerating = true;

    backendApi.sendChatRequest(messagesToSend, host.activeSessionId);
    scrollToBottomAfterRender(host);
}

/** Signals the host to abort the in-flight LLM request. */
export function onCancel(host: ChatRoot) {
    if (!host.isGenerating || host.isSummarizing) {
        return;
    }
    backendApi.cancel();
}

/** Truncates history after the selected user message and re-sends from that point. */
export function onResendMessage(host: ChatRoot, e: CustomEvent) {
    if (host.isGenerating) {
        return;
    }
    const messageIndex = e.detail.messageIndex;
    const msgs = host.chatContext?.getMessages() || [];
    if (!msgs[messageIndex] || msgs[messageIndex].role !== "user") {
        return;
    }

    host.chatContext?.truncate(messageIndex + 1);
    const messagesToSend = [...(host.chatContext?.getMessages() || [])];
    host.chatContext?.push({ role: "assistant", content: "" });
    host.syncMessages();

    host.isGenerating = true;

    logWebview(`Resending from message ${messageIndex}`);
    backendApi.sendChatRequest(messagesToSend, host.activeSessionId);
    scrollToBottomAfterRender(host);
}

/** Replaces a user message with edited text, re-embeds its original contexts, and re-sends. */
export function onEditMessage(host: ChatRoot, e: CustomEvent) {
    if (host.isGenerating) {
        return;
    }
    const { messageIndex, newContent } = e.detail;
    const msgs = host.chatContext?.getMessages() || [];
    if (!msgs[messageIndex] || msgs[messageIndex].role !== "user") {
        return;
    }

    const userContexts = msgs[messageIndex].customKeys?.contexts ?? [];
    const updatedContent = buildUserContent(userContexts, newContent, host.config.agenticMode);

    host.chatContext?.truncate(messageIndex);
    host.chatContext?.push({
        role: "user",
        content: updatedContent,
        customKeys: userContexts.length > 0 ? { contexts: userContexts } : undefined,
    });
    const messagesToSend = [...(host.chatContext?.getMessages() || [])];
    host.chatContext?.push({ role: "assistant", content: "" });
    host.syncMessages();

    host.isGenerating = true;

    logWebview(`Editing and resending message ${messageIndex}`);
    backendApi.sendChatRequest(messagesToSend, host.activeSessionId);
    scrollToBottomAfterRender(host);
}

/** Removes a user message and its entire turn (assistant + tool responses), then notifies the host. */
export function onDeleteMessage(host: ChatRoot, e: CustomEvent) {
    if (host.isGenerating) {
        return;
    }
    const messageIndex = e.detail.messageIndex;
    const msgs = host.chatContext?.getMessages() || [];
    if (!msgs[messageIndex] || msgs[messageIndex].role !== "user") {
        return;
    }

    const turnEnd = host.chatContext?.getTurnEnd(messageIndex) ?? messageIndex;
    const approxTokensFreed = host.chatContext?.sumTokensInRange(messageIndex, turnEnd) ?? 0;

    host.chatContext?.removeRange(messageIndex, turnEnd);
    host.syncMessages();

    showToast(`~${approxTokensFreed} tokens freed`);
    logWebview(`Deleted message pair at index ${messageIndex} (~${approxTokensFreed} tokens freed)`);
    backendApi.deleteMessages(messageIndex, turnEnd, host.activeSessionId);
}

/** Clears all messages from the active session. */
export function onClearChat(host: ChatRoot) {
    if (host.isGenerating || !host.chatContext || host.chatContext.length() === 0) {
        return;
    }
    backendApi.clearChat();
}

/** Cancels a still-queued intercept (drops the pending banner and dequeues it on the backend). */
export function onInterceptCancel(host: ChatRoot, e: CustomEvent) {
    const id = e.detail?.id as string;
    if (!id) {
        return;
    }
    host.pendingIntercepts = host.pendingIntercepts.filter((p) => p.id !== id);
    backendApi.cancelIntercept(id);
}

/** Removes a single attached context by index, or clears all if no index is provided. */
export function onContextCleared(host: ChatRoot, e: CustomEvent) {
    const index = e.detail?.index;
    if (typeof index === "number") {
        host.currentContexts = host.currentContexts.filter((_, i) => i !== index);
    } else {
        host.currentContexts = [];
    }
}

// ---------- summarization ----------

/** Appends a summarization prompt and sends the full history for conversation summarization. */
export function onSummarizeConversation(host: ChatRoot) {
    if (host.isGenerating || !host.chatContext || host.chatContext.length() === 0) {
        return;
    }

    const totalMessages = host.chatContext.length();

    host.isGenerating = true;
    host.isSummarizing = true;

    showToast("Summarizing conversation...");
    backendApi.summarize(0, totalMessages, host.activeSessionId);
}

/** Accepts the forced auto-summary prompt and starts conversation summarization. */
export function onAcquireAutoSummaryAccept(host: ChatRoot) {
    host.activeModal = "";
    host.beginAutoSummary();
    onSummarizeConversation(host);
}

/** Sends a single turn (user message + responses) to the backend for summarization. */
export function onSummarizeTurn(host: ChatRoot, e: CustomEvent) {
    if (host.isGenerating) {
        return;
    }
    const messageIndex = e.detail.messageIndex;
    const msgs = host.chatContext?.getMessages() || [];
    if (!msgs[messageIndex] || msgs[messageIndex].role !== "user") {
        return;
    }

    const turnEnd = host.chatContext?.getTurnEnd(messageIndex) ?? messageIndex;

    host.isGenerating = true;
    host.isSummarizing = true;

    showToast("Summarizing turn...");
    logWebview(`Summarizing turn at index ${messageIndex}`);
    backendApi.summarize(messageIndex, turnEnd, host.activeSessionId);
}

// ---------- sessions ----------

/** Exports a session's chat history as raw JSON to a preview window. */
export function onExportSession(host: ChatRoot, e: CustomEvent) {
    const sessionId = e.detail?.id || host.activeSessionId;
    logWebview(`Exporting session ${sessionId}`);
    backendApi.exportSession(sessionId);
}

/**
 * Exports a session's chat as a self-contained HTML file.
 *
 * Switches to the target session first (so its messages are rendered into the
 * live DOM), waits for paint, then serializes `collama-chatoutput` — including
 * shadow roots and snapshotted CSS variables — and sends the document to the
 * backend, which prompts a save dialog.
 */
export async function onExportSessionHtml(host: ChatRoot, e: CustomEvent) {
    const sessionId = e.detail?.id || host.activeSessionId;
    const session = host.sessions.find((s) => s.id === sessionId);
    if (!session) {
        return;
    }
    logWebview(`Exporting session ${sessionId} as HTML`);

    if (sessionId !== host.activeSessionId) {
        backendApi.switchSession(sessionId);
        const switched = await waitFor(() => host.activeSessionId === sessionId, 3000);
        if (!switched) {
            showToast("Could not switch to session for export");
            return;
        }
    }

    await host.updateComplete;
    const chatOutput = host.shadowRoot?.querySelector("collama-chatoutput") as LitElement | null;
    if (!chatOutput) {
        showToast("Chat output not ready");
        return;
    }
    await chatOutput.updateComplete;

    const htmlDoc = buildSelfContainedHtml(chatOutput, session.title);
    backendApi.exportSessionHtml(sessionId, session.title, htmlDoc);
}

function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
    return new Promise((resolve) => {
        if (predicate()) {
            resolve(true);
            return;
        }
        const start = Date.now();
        const interval = window.setInterval(() => {
            if (predicate()) {
                window.clearInterval(interval);
                resolve(true);
            } else if (Date.now() - start >= timeoutMs) {
                window.clearInterval(interval);
                resolve(false);
            }
        }, 30);
    });
}

/** Opens the host file dialog to import a chat JSON as a new session. */
export function onImportSession() {
    logWebview("Importing session from file");
    backendApi.importSession();
}

/** Creates a new chat session. */
export function onNewChat() {
    logWebview("Creating new chat");
    backendApi.newSession();
}

/** Creates a new ghost (temporary, unlisted) chat session. */
export function onNewGhostChat() {
    logWebview("Creating new ghost chat");
    backendApi.newGhostSession();
}

/** Switches to the selected session. */
export function onSelectSession(e: CustomEvent) {
    logWebview(`Switching to session ${e.detail.id}`);
    backendApi.switchSession(e.detail.id);
}

/** Deletes the selected session. */
export function onDeleteSession(e: CustomEvent) {
    logWebview(`Deleting session ${e.detail.id}`);
    backendApi.deleteSession(e.detail.id);
}

/** Renames the selected session. */
export function onRenameSession(e: CustomEvent) {
    logWebview(`Renaming session ${e.detail.id} to "${e.detail.newTitle}"`);
    backendApi.renameSession(e.detail.id, e.detail.newTitle);
}

/** Copies the selected session. */
export function onCopySession(e: CustomEvent) {
    logWebview(`Copying session ${e.detail.id}`);
    backendApi.copySession(e.detail.id);
}

/** Toggles the auto-accept-all flag on the backend. */
export function onAutoAccept(e: CustomEvent) {
    backendApi.autoAcceptAll(e.detail.enabled);
}

/** Converts the active session to a ghost (temporary, unlisted) session. */
export function onConvertToGhost() {
    logWebview("Converting session to ghost");
    backendApi.convertToGhost();
}

// ---------- context ----------

/** Sends a context search query to the backend. */
export function onContextSearch(e: CustomEvent) {
    backendApi.contextSearch(e.detail.query);
}

/** Requests the backend to read and attach a file/folder as context. */
export function onContextAdd(e: CustomEvent) {
    backendApi.contextAdd(e.detail.relativePath, e.detail.isFolder);
}

// ---------- tool prompts ----------

/** Responds to a tool confirmation with "accept". */
export function onToolConfirmAccept(host: ChatRoot, e: CustomEvent) {
    const id = e.detail.id;
    host.toolConfirmRequest = null;
    host.activeModal = "";
    logWebview(`Tool confirm accept: ${id}`);
    backendApi.toolConfirmResponse(id, "accept", "User accepted the action");
}

/** Responds to a tool confirmation with "acceptAll". */
export function onToolConfirmAcceptAll(host: ChatRoot, e: CustomEvent) {
    const id = e.detail.id;
    host.toolConfirmRequest = null;
    host.activeModal = "";
    logWebview(`Tool confirm accept-all: ${id}`);
    backendApi.toolConfirmResponse(id, "acceptAll", "User accepted all actions");
}

/** Responds to a tool confirmation with cancel + optional reason. */
export function onToolConfirmCancel(host: ChatRoot, e: CustomEvent) {
    const { id, reason } = e.detail;
    host.toolConfirmRequest = null;
    host.activeModal = "";
    logWebview(`Tool confirm cancel: ${id}`);
    backendApi.toolConfirmResponse(id, "cancel", reason);
}

/** Responds to a decision request with the user's chosen option. */
export function onToolDecisionSelect(host: ChatRoot, e: CustomEvent) {
    const { id, value } = e.detail;
    host.toolDecisionRequest = null;
    host.activeModal = "";
    logWebview(`Tool decision select: ${id} → ${value}`);
    backendApi.toolDecisionResponse(id, value);
}

// ---------- ui ----------

/** Updates the scroll button visibility based on near-bottom state. */
export function onNearBottomChanged(host: ChatRoot, e: CustomEvent) {
    host.showScrollButton = !e.detail.nearBottom;
}
