import { LitElement } from "lit";
import { AttachedContext } from "../../../common/context-chat";
import { logWebview, showToast } from "../../utils-front";
import type { ChatRoot } from "./chat-root";
import { buildSelfContainedHtml } from "./html-export";
import { backendApi, buildUserContent } from "./utils";

function scrollToBottomAfterRender(host: ChatRoot) {
    host.updateComplete.then(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => host.scrollToBottom());
        });
    });
}

/** Builds user content with embedded contexts, sends the request, and adds a placeholder assistant message. */
export function onSubmit(host: ChatRoot, e: CustomEvent) {
    const content = e.detail.value?.trim();
    const contexts: AttachedContext[] = e.detail.contexts || [];
    if (!content) {
        // Clear contexts even when there's no text, so user can add new contexts
        if (contexts.length > 0) {
            host.currentContexts = [];
        }
        return;
    }

    if (contexts.length > 0) {
        host.currentContexts = [];
    }
    host.chatContext?.push({
        role: "user",
        content: buildUserContent(contexts, content),
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
    const updatedContent = buildUserContent(userContexts, newContent);

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

/** Clears all messages from the active session. */
export function onClearChat(host: ChatRoot) {
    if (host.isGenerating || !host.chatContext || host.chatContext.length() === 0) {
        return;
    }
    backendApi.clearChat();
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

/** Sends a context search query to the backend. */
export function onContextSearch(e: CustomEvent) {
    backendApi.contextSearch(e.detail.query);
}

/** Requests the backend to read and attach a file/folder as context. */
export function onContextAdd(e: CustomEvent) {
    backendApi.contextAdd(e.detail.relativePath, e.detail.isFolder);
}

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

/** Updates the scroll button visibility based on near-bottom state. */
export function onNearBottomChanged(host: ChatRoot, e: CustomEvent) {
    host.showScrollButton = !e.detail.nearBottom;
}
