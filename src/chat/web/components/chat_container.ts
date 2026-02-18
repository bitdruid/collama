import { LitElement, css, html } from "lit";

import { estimateTokenCount } from "../../utils";
import "./chat_input";
import "./chat_output/output";
import "./chat_sessions";
import { ChatSession } from "./chat_sessions";

declare global {
    interface Window {
        vscode: {
            postMessage(message: any): void;
            getState(): any;
            setState(state: any): void;
        };
    }
}

export {};

export function logWebview(message: string) {
    window.vscode.postMessage({
        type: "log",
        message,
    });
}

export interface ChatMessage {
    role: "user" | "assistant" | "system";
    content: string;
    loading?: boolean;
    contexts?: ChatContext[];
}

export interface ChatContext {
    fileName: string;
    hasSelection: boolean;
    startLine: number;
    endLine: number;
    content: string;
}

export class ChatContainer extends LitElement {
    static properties = {
        messages: { state: true },
        sessions: { state: true },
        activeSessionId: { state: true },
        currentContexts: { state: true },
        contextUsed: { state: true },
        contextMax: { state: true },
        contextStartIndex: { state: true },
        _toastMessage: { state: true },
    };

    static styles = css`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        collama-chatsessions {
            flex: 0 0 auto;
        }

        .chat-area {
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
            min-height: 0;
        }

        collama-chatoutput {
            flex: 1 1 auto;
            overflow-y: auto;
            height: 100%;
            margin-top: 12px;
            padding: 0px;
        }

        collama-chatinput {
            flex: 0 0 auto;
            display: flex;
            flex-direction: column;
            margin-top: 12px;
            padding: 8px;
        }

        .toast {
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: var(--vscode-editorWidget-background, #1e1e1e);
            border: 1px solid var(--vscode-editorWidget-border, #454545);
            color: var(--vscode-editorWidget-foreground, #ccc);
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            opacity: 0;
            transition: opacity 0.3s;
            pointer-events: none;
            z-index: 100;
        }

        .toast.visible {
            opacity: 1;
        }
    `;

    messages: ChatMessage[] = [];
    sessions: ChatSession[] = [];
    activeSessionId: string = "";
    currentContexts: ChatContext[] = [];
    contextUsed: number = 0;
    contextMax: number = 0;
    contextStartIndex: number = 0;
    _toastMessage: string = "";
    private _updateTimer: number | null = null;
    private _toastTimer: number | null = null;

    /**
     * Debounce UI updates during streaming to avoid excessive re-renders.
     * Schedules a re-render at approximately 30fps (33 ms) if one is not already pending.
     * This method mutates {@link _updateTimer} to track pending timeouts and forces a
     * re-render by replacing the {@link messages} array reference.
     */
    private _showToast(message: string) {
        this._toastMessage = message;
        if (this._toastTimer !== null) {
            window.clearTimeout(this._toastTimer);
        }
        this._toastTimer = window.setTimeout(() => {
            this._toastMessage = "";
            this._toastTimer = null;
        }, 2500);
    }

    private _scheduleUpdate() {
        // Debounce updates to ~30fps (33ms) during streaming
        if (this._updateTimer === null) {
            this._updateTimer = window.setTimeout(() => {
                this._updateTimer = null;
                // Trigger re-render by creating new array reference
                this.messages = [...this.messages];
            }, 33);
        }
    }

    private _onSubmit(e: CustomEvent) {
        const content = e.detail.value?.trim();
        const contexts: ChatContext[] = e.detail.contexts || [];
        if (!content) {
            return;
        }

        // Build user message with contexts if available
        let userContent = content;
        let messageContexts: ChatContext[] | undefined = undefined;
        if (contexts.length > 0) {
            // For the API request, embed all contexts in the content
            const contextBlocks = contexts
                .map((ctx) => {
                    const contextLabel = ctx.hasSelection
                        ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})`
                        : ctx.fileName;
                    return `${contextLabel}\n\`\`\`\n${ctx.content}\n\`\`\``;
                })
                .join("\n\n");
            userContent = `${contextBlocks}\n\n${content}`;
            // Store contexts metadata for UI display
            messageContexts = contexts;
            this.currentContexts = [];
        }

        const assistantIndex = this.messages.length + 1;

        this.messages = [
            ...this.messages,
            { role: "user", content: userContent, contexts: messageContexts },
            { role: "assistant", content: "", loading: true },
        ];

        window.vscode.postMessage({
            type: "chat-request",
            messages: this.messages,
            assistantIndex,
            sessionId: this.activeSessionId,
        });
    }

    private _onResendMessage(e: CustomEvent) {
        const messageIndex = e.detail.messageIndex;
        // Truncate messages to keep only up to and including the user message at messageIndex
        // Then add a new empty assistant message
        const userMessage = this.messages[messageIndex];
        if (!userMessage || userMessage.role !== "user") {
            return;
        }

        // Keep messages up to and including the user message
        const truncatedMessages = this.messages.slice(0, messageIndex + 1);
        const assistantIndex = truncatedMessages.length;

        this.messages = [...truncatedMessages, { role: "assistant", content: "", loading: true }];

        logWebview(`Resending from message ${messageIndex}`);

        window.vscode.postMessage({
            type: "chat-request",
            messages: this.messages,
            assistantIndex,
            sessionId: this.activeSessionId,
        });
    }

    private _onEditMessage(e: CustomEvent) {
        const { messageIndex, newContent } = e.detail;
        const userMessage = this.messages[messageIndex];
        if (!userMessage || userMessage.role !== "user") {
            return;
        }

        // Rebuild content: re-embed contexts if present, then the new user text
        let updatedContent = newContent;
        if (userMessage.contexts && userMessage.contexts.length > 0) {
            const contextBlocks = userMessage.contexts
                .map((ctx) => {
                    const contextLabel = ctx.hasSelection
                        ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})`
                        : ctx.fileName;
                    return `${contextLabel}\n\`\`\`\n${ctx.content}\n\`\`\``;
                })
                .join("\n\n");
            updatedContent = `${contextBlocks}\n\n${newContent}`;
        }

        // Truncate and resend with edited content
        const truncatedMessages = this.messages.slice(0, messageIndex);
        const editedMessage: ChatMessage = {
            role: "user",
            content: updatedContent,
            contexts: userMessage.contexts,
        };
        const assistantIndex = truncatedMessages.length + 1;

        this.messages = [...truncatedMessages, editedMessage, { role: "assistant", content: "", loading: true }];

        logWebview(`Editing and resending message ${messageIndex}`);

        window.vscode.postMessage({
            type: "chat-request",
            messages: this.messages,
            assistantIndex,
            sessionId: this.activeSessionId,
        });
    }

    private _onDeleteMessage(e: CustomEvent) {
        const messageIndex = e.detail.messageIndex;
        const userMessage = this.messages[messageIndex];
        if (!userMessage || userMessage.role !== "user") {
            return;
        }

        // Estimate tokens freed from the user message + its assistant response
        const deletedContent = [this.messages[messageIndex], this.messages[messageIndex + 1]]
            .filter(Boolean)
            .map((m) => m.content)
            .join("");
        const approxTokensFreed = estimateTokenCount(deletedContent);

        // Remove the user message and its following assistant response
        this.messages = [...this.messages.slice(0, messageIndex), ...this.messages.slice(messageIndex + 2)];

        this._showToast(`~${approxTokensFreed} tokens freed`);
        logWebview(`Deleted message pair at index ${messageIndex} (~${approxTokensFreed} tokens freed)`);

        window.vscode.postMessage({
            type: "update-messages",
            messages: this.messages,
            sessionId: this.activeSessionId,
            approxTokensFreed,
        });
    }

    private _onNewChat() {
        logWebview("Creating new chat");
        window.vscode.postMessage({
            type: "new-session",
        });
    }

    private _onSelectSession(e: CustomEvent) {
        const sessionId = e.detail.sessionId;
        logWebview(`Switching to session ${sessionId}`);
        window.vscode.postMessage({
            type: "switch-session",
            sessionId,
        });
    }

    private _onDeleteSession(e: CustomEvent) {
        const sessionId = e.detail.sessionId;
        logWebview(`Deleting session ${sessionId}`);
        window.vscode.postMessage({
            type: "delete-session",
            sessionId,
        });
    }

    private _onRenameSession(e: CustomEvent) {
        const { sessionId, newTitle } = e.detail;
        logWebview(`Renaming session ${sessionId} to "${newTitle}"`);
        window.vscode.postMessage({
            type: "rename-session",
            sessionId,
            newTitle,
        });
    }

    connectedCallback() {
        super.connectedCallback();

        // Send chat-ready only once when component connects
        window.vscode.postMessage({ type: "chat-ready" });

        window.addEventListener("message", (event) => {
            const msg = event.data;

            // initializes with session data
            if (msg.type === "init") {
                this.messages = msg.history || [];
                this.sessions = msg.sessions || [];
                this.activeSessionId = msg.activeSessionId || "";
                this.contextUsed = msg.contextUsed || 0;
                this.contextMax = msg.contextMax || 0;
                this.contextStartIndex = msg.contextStartIndex || 0;
                logWebview(`${this.sessions.length} sessions total, active: ${this.activeSessionId}`);
            }

            // updates sessions list
            if (msg.type === "sessions-update") {
                this.sessions = msg.sessions || [];
                this.activeSessionId = msg.activeSessionId || "";
                this.messages = msg.history || [];
                this.contextUsed = msg.contextUsed || 0;
                this.contextMax = msg.contextMax || 0;
                this.contextStartIndex = msg.contextStartIndex || 0;
            }

            // receives new chunk of assistant response
            if (msg.type === "chunk") {
                // Update content directly without creating new array (mutate in place)
                const message = this.messages[msg.index];
                if (message) {
                    message.content += msg.chunk;
                    message.loading = false;
                    // Debounce UI updates to reduce render frequency
                    this._scheduleUpdate();
                }
            }

            // context limit exceeded — old message pairs dropped from LLM context
            if (msg.type === "context-trimmed") {
                this.contextStartIndex = msg.contextStartIndex || 0;
                if (msg.pairsRemoved > 0) {
                    const pairs = msg.pairsRemoved;
                    const tokens = msg.tokensFreed;
                    this._showToast(
                        `Context exceeded — ${pairs} old pair${pairs > 1 ? "s" : ""} removed (~${tokens} tokens)`,
                    );
                }
            }

            // receives context from "Send to Chat" command
            if (msg.type === "context-update") {
                // Append new context to the list (avoid duplicates by fileName + line range)
                const newCtx = msg.context;
                const exists = this.currentContexts.some(
                    (ctx) =>
                        ctx.fileName === newCtx.fileName &&
                        ctx.startLine === newCtx.startLine &&
                        ctx.endLine === newCtx.endLine,
                );
                if (!exists) {
                    this.currentContexts = [...this.currentContexts, newCtx];
                }
                logWebview(`Context received: ${newCtx.fileName} (total: ${this.currentContexts.length})`);
            }
        });
    }

    private _onContextCleared(e: CustomEvent) {
        const index = e.detail?.index;
        if (typeof index === "number") {
            // Remove specific context
            this.currentContexts = this.currentContexts.filter((_, i) => i !== index);
        } else {
            // Clear all contexts
            this.currentContexts = [];
        }
    }

    render() {
        return html`
            <collama-chatsessions
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                .contextUsed=${this.contextUsed}
                .contextMax=${this.contextMax}
                @new-chat=${this._onNewChat}
                @select-session=${this._onSelectSession}
                @delete-session=${this._onDeleteSession}
                @rename-session=${this._onRenameSession}
            ></collama-chatsessions>
            <div class="chat-area">
                <collama-chatoutput
                    .messages=${this.messages}
                    .contextStartIndex=${this.contextStartIndex}
                    @resend-message=${this._onResendMessage}
                    @edit-message=${this._onEditMessage}
                    @delete-message=${this._onDeleteMessage}
                ></collama-chatoutput>
                <collama-chatinput
                    @submit=${this._onSubmit}
                    @context-cleared=${this._onContextCleared}
                    .contexts=${this.currentContexts}
                ></collama-chatinput>
            </div>
            <div class="toast ${this._toastMessage ? "visible" : ""}">${this._toastMessage}</div>
        `;
    }
}

customElements.define("collama-chatcontainer", ChatContainer);
