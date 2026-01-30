import { LitElement, html, css } from "lit";
import "./chat_input";
import "./chat_output";
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
        currentContext: { state: true },
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
    `;

    messages: ChatMessage[] = [];
    sessions: ChatSession[] = [];
    activeSessionId: string = "";
    currentContext: ChatContext | null = null;

    private _onSubmit(e: CustomEvent) {
        const content = e.detail.value?.trim();
        const context: ChatContext | null = e.detail.context || null;
        if (!content) {
            return;
        }

        // Build user message with context if available
        let userContent = content;
        if (context) {
            const contextLabel = context.hasSelection
                ? `${context.fileName} (${context.startLine}-${context.endLine})`
                : context.fileName;
            userContent = `${contextLabel}\n\`\`\`\n${context.content}\n\`\`\`\n\n${content}`;
            this.currentContext = null;
        }

        const assistantIndex = this.messages.length + 1;

        this.messages = [
            ...this.messages,
            { role: "user", content: userContent },
            { role: "assistant", content: "", loading: true },
        ];

        window.vscode.postMessage({
            type: "chat-request",
            messages: this.messages,
            assistantIndex,
            sessionId: this.activeSessionId,
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
                logWebview(`${this.sessions.length} sessions total, active: ${this.activeSessionId}`);
            }

            // updates sessions list
            if (msg.type === "sessions-update") {
                this.sessions = msg.sessions || [];
                this.activeSessionId = msg.activeSessionId || "";
                this.messages = msg.history || [];
            }

            // receives new chunk of assistant response
            if (msg.type === "chunk") {
                this.messages = this.messages.map((m, i) =>
                    i === msg.index ? { ...m, content: m.content + msg.chunk, loading: false } : m,
                );
            }

            // receives context from "Send to Chat" command
            if (msg.type === "context-update") {
                this.currentContext = msg.context;
                logWebview(`Context received: ${msg.context.fileName}`);
            }
        });
    }

    private _onContextCleared() {
        this.currentContext = null;
    }

    render() {
        return html`
            <collama-chatsessions
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                @new-chat=${this._onNewChat}
                @select-session=${this._onSelectSession}
                @delete-session=${this._onDeleteSession}
            ></collama-chatsessions>
            <div class="chat-area">
                <collama-chatoutput .messages=${this.messages}></collama-chatoutput>
                <collama-chatinput
                    @submit=${this._onSubmit}
                    @context-cleared=${this._onContextCleared}
                    .context=${this.currentContext}
                ></collama-chatinput>
            </div>
        `;
    }
}

customElements.define("collama-chatcontainer", ChatContainer);
