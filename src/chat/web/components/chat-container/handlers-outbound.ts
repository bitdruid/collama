import { AttachedContext } from "../../../../common/context-chat";
import { logWebview, showToast } from "../../../utils-front";
import type { ChatContainer } from "./chat-container";
import { backendApi, buildUserContent } from "./utils";

/** Builds user content with embedded contexts, sends the request, and adds a placeholder assistant message. */
export function onSubmit(host: ChatContainer, e: CustomEvent) {
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
    host.wvChatContext.push({
        role: "user",
        content: buildUserContent(contexts, content),
        customKeys: contexts.length > 0 ? { contexts } : undefined,
    });
    const messagesToSend = [...host.wvChatContext.getMessages()];
    host.wvChatContext.push({ role: "assistant", content: "" });
    host.syncMessages();

    host.isLoading = true;

    backendApi.sendChatRequest(messagesToSend, host.activeSessionId);
    host.updateComplete.then(() => {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => host.scrollToBottom());
        });
    });
}

/** Signals the host to abort the in-flight LLM request. */
export function onCancel(host: ChatContainer) {
    if (!host.isLoading) {
        return;
    }
    backendApi.cancel();
}

/** Appends a summarization prompt and sends the full history for conversation summarization. */
export function onSummarizeConversation(host: ChatContainer) {
    if (host.isLoading || host.wvChatContext.length() === 0) {
        return;
    }

    const totalMessages = host.wvChatContext.length();

    host.wvChatContext.push({ role: "user", content: "Context summary:" });
    host.wvChatContext.push({ role: "assistant", content: "" });
    host.syncMessages();

    host.isLoading = true;

    showToast("Summarizing conversation...");
    backendApi.summarize(0, totalMessages, host.activeSessionId);
}

/** Truncates history after the selected user message and re-sends from that point. */
export function onResendMessage(host: ChatContainer, e: CustomEvent) {
    const messageIndex = e.detail.messageIndex;
    const msgs = host.wvChatContext.getMessages();
    if (!msgs[messageIndex] || msgs[messageIndex].role !== "user") {
        return;
    }

    host.wvChatContext.truncate(messageIndex + 1);
    const messagesToSend = [...host.wvChatContext.getMessages()];
    host.wvChatContext.push({ role: "assistant", content: "" });
    host.syncMessages();

    host.isLoading = true;

    logWebview(`Resending from message ${messageIndex}`);
    backendApi.sendChatRequest(messagesToSend, host.activeSessionId);
}

/** Replaces a user message with edited text, re-embeds its original contexts, and re-sends. */
export function onEditMessage(host: ChatContainer, e: CustomEvent) {
    const { messageIndex, newContent } = e.detail;
    const msgs = host.wvChatContext.getMessages();
    if (!msgs[messageIndex] || msgs[messageIndex].role !== "user") {
        return;
    }

    const userContexts = msgs[messageIndex].customKeys?.contexts ?? [];
    const updatedContent = buildUserContent(userContexts, newContent);

    host.wvChatContext.truncate(messageIndex);
    host.wvChatContext.push({
        role: "user",
        content: updatedContent,
        customKeys: userContexts.length > 0 ? { contexts: userContexts } : undefined,
    });
    const messagesToSend = [...host.wvChatContext.getMessages()];
    host.wvChatContext.push({ role: "assistant", content: "" });
    host.syncMessages();

    host.isLoading = true;

    logWebview(`Editing and resending message ${messageIndex}`);
    backendApi.sendChatRequest(messagesToSend, host.activeSessionId);
}

/** Removes a user message and its entire turn (assistant + tool responses), then notifies the host. */
export function onDeleteMessage(host: ChatContainer, e: CustomEvent) {
    const messageIndex = e.detail.messageIndex;
    const msgs = host.wvChatContext.getMessages();
    if (!msgs[messageIndex] || msgs[messageIndex].role !== "user") {
        return;
    }

    const turnEnd = host.wvChatContext.getTurnEnd(messageIndex);
    const approxTokensFreed = host.wvChatContext.sumTokensInRange(messageIndex, turnEnd);

    host.wvChatContext.removeRange(messageIndex, turnEnd);
    host.syncMessages();

    host.contextUsed = host.wvChatContext.sumTokens();

    showToast(`~${approxTokensFreed} tokens freed`);
    logWebview(`Deleted message pair at index ${messageIndex} (~${approxTokensFreed} tokens freed)`);
    backendApi.deleteMessages(messageIndex, turnEnd, host.activeSessionId);
}

/** Sends a single turn (user message + responses) to the backend for summarization. */
export function onSummarizeTurn(host: ChatContainer, e: CustomEvent) {
    if (host.isLoading) {
        return;
    }
    const messageIndex = e.detail.messageIndex;
    const msgs = host.wvChatContext.getMessages();
    if (!msgs[messageIndex] || msgs[messageIndex].role !== "user") {
        return;
    }

    const turnEnd = host.wvChatContext.getTurnEnd(messageIndex);

    host.isLoading = true;

    showToast("Summarizing turn...");
    logWebview(`Summarizing turn at index ${messageIndex}`);
    backendApi.summarize(messageIndex, turnEnd, host.activeSessionId);
}

/** Exports a session's chat history as raw JSON to a preview window. */
export function onExportSession(host: ChatContainer, e: CustomEvent) {
    const sessionId = e.detail?.id || host.activeSessionId;
    logWebview(`Exporting session ${sessionId}`);
    backendApi.exportSession(sessionId);
}

/** Creates a new chat session. */
export function onNewChat() {
    logWebview("Creating new chat");
    backendApi.newSession();
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

/** Removes a single attached context by index, or clears all if no index is provided. */
export function onContextCleared(host: ChatContainer, e: CustomEvent) {
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
export function onContextAddFile(e: CustomEvent) {
    backendApi.contextAddFile(e.detail.filePath, e.detail.isFolder);
}

/** Responds to a tool confirmation with "accept". */
export function onToolConfirmAccept(host: ChatContainer, e: CustomEvent) {
    const id = e.detail.id;
    host.toolConfirmRequest = null;
    logWebview(`Tool confirm accept: ${id}`);
    backendApi.toolConfirmResponse(id, "accept", "User accepted the action");
}

/** Responds to a tool confirmation with "acceptAll". */
export function onToolConfirmAcceptAll(host: ChatContainer, e: CustomEvent) {
    const id = e.detail.id;
    host.toolConfirmRequest = null;
    logWebview(`Tool confirm accept-all: ${id}`);
    backendApi.toolConfirmResponse(id, "acceptAll", "User accepted all actions");
}

/** Responds to a tool confirmation with cancel + optional reason. */
export function onToolConfirmCancel(host: ChatContainer, e: CustomEvent) {
    const { id, reason } = e.detail;
    host.toolConfirmRequest = null;
    logWebview(`Tool confirm cancel: ${id}`);
    backendApi.toolConfirmResponse(id, "cancel", reason);
}

/** Updates the scroll button visibility based on near-bottom state. */
export function onNearBottomChanged(host: ChatContainer, e: CustomEvent) {
    host.showScrollButton = !e.detail.nearBottom;
}
