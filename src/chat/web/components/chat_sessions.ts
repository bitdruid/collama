import { LitElement, css, html } from "lit";

import { logWebview } from "./chat_container";

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

export class ChatSessions extends LitElement {
    static properties = {
        sessions: { state: true },
        activeSessionId: { state: true },
        isOpen: { state: true },
        editingSessionId: { state: true },
        contextUsed: { state: true },
        contextMax: { state: true },
    };

    static styles = css`
        :host {
            display: block;
            position: relative;
        }

        .sessions-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header-left {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
        }

        .header-left:hover {
            opacity: 0.8;
        }

        .header-title {
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
            color: var(--vscode-foreground);
            opacity: 0.8;
        }

        .toggle-icon {
            font-size: 10px;
            color: var(--vscode-foreground);
            opacity: 0.6;
        }

        .header-buttons {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .icon-button {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 24px;
            height: 24px;
            padding: 0;
            border: none;
            border-radius: 4px;
            background: transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            font-size: 16px;
        }

        .icon-button:hover {
            background: var(--vscode-toolbar-hoverBackground);
        }

        .new-chat-button {
            background-color: #2277a8;
            color: #fff;
        }

        .new-chat-button:hover {
            background-color: #185d86;
        }

        .popup-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 99;
        }

        .popup-overlay.open {
            display: block;
        }

        .sessions-popup {
            display: none;
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            z-index: 100;
            background: var(--vscode-dropdown-background);
            border: 1px solid var(--vscode-dropdown-border);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-height: 300px;
            overflow-y: auto;
        }

        .sessions-popup.open {
            display: block;
        }

        .session-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            cursor: pointer;
            border-left: 3px solid transparent;
            transition: background 0.1s ease;
        }

        .session-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .session-item.active {
            background: var(--vscode-list-activeSelectionBackground);
            border-left-color: var(--vscode-focusBorder);
        }

        .session-info {
            flex: 1;
            min-width: 0;
            overflow: hidden;
        }

        .session-title {
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: var(--vscode-foreground);
        }

        .session-title-input {
            font-size: 13px;
            width: 100%;
            padding: 2px 4px;
            border: 1px solid var(--vscode-focusBorder);
            border-radius: 2px;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            outline: none;
        }

        .session-date {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
        }

        .session-actions {
            display: flex;
            gap: 2px;
            opacity: 0;
        }

        .session-item:hover .session-actions {
            opacity: 1;
        }

        .action-button {
            font-size: 14px;
        }

        .rename-button {
            color: var(--vscode-foreground);
        }

        .delete-button {
            color: var(--vscode-errorForeground);
        }

        .empty-state {
            padding: 16px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }

        .context-usage {
            display: flex;
            align-items: center;
            gap: 6px;
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
        }

        .context-bar-container {
            width: 50px;
            height: 8px;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            overflow: hidden;
        }

        .context-bar {
            height: 100%;
            background: #4ec9b0;
            border-radius: 3px;
            transition: width 0.2s ease;
        }

        .context-bar.warning {
            background: #cca700;
        }

        .context-bar.danger {
            background: #f14c4c;
        }

        .context-text {
            white-space: nowrap;
        }
    `;

    sessions: ChatSession[] = [];
    activeSessionId: string = "";
    isOpen: boolean = false;
    editingSessionId: string | null = null;
    contextUsed: number = 0;
    contextMax: number = 0;

    private _formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const today = new Date();
        const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const diffDays = (startOfDay(today) - startOfDay(date)) / 86400000;

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }

        if (diffDays === 1) {
            return "Yesterday";
        }

        if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: "short" });
        }

        return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }

    private _handleNewChat() {
        logWebview("New chat clicked");
        this.isOpen = false;
        this.dispatchEvent(
            new CustomEvent("new-chat", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleSelectSession(sessionId: string) {
        logWebview(`Selected session ${sessionId}`);
        this.isOpen = false;
        this.dispatchEvent(
            new CustomEvent("select-session", {
                detail: { sessionId },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleDeleteSession(e: Event, sessionId: string) {
        e.stopPropagation();
        logWebview(`Delete session ${sessionId}`);
        this.dispatchEvent(
            new CustomEvent("delete-session", {
                detail: { sessionId },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleRenameSession(e: Event, session: ChatSession) {
        e.stopPropagation();
        this.editingSessionId = session.id;
        // Focus input
        this.updateComplete.then(() => {
            const input = this.shadowRoot?.querySelector(".session-title-input") as HTMLInputElement;
            if (input) {
                input.focus();
                input.select();
            }
        });
    }

    private _handleRenameKeyDown(e: KeyboardEvent, session: ChatSession) {
        if (e.key === "Enter") {
            e.preventDefault();
            this._submitRename(session);
        } else if (e.key === "Escape") {
            e.preventDefault();
            this.editingSessionId = null;
        }
    }

    private _handleRenameBlur(session: ChatSession) {
        this._submitRename(session);
    }

    private _submitRename(session: ChatSession) {
        const input = this.shadowRoot?.querySelector(".session-title-input") as HTMLInputElement;
        const newTitle = input?.value?.trim();
        if (newTitle && newTitle !== session.title) {
            logWebview(`Rename session ${session.id} to "${newTitle}"`);
            this.dispatchEvent(
                new CustomEvent("rename-session", {
                    detail: { sessionId: session.id, newTitle },
                    bubbles: true,
                    composed: true,
                }),
            );
        }
        this.editingSessionId = null;
    }

    private _toggleOpen() {
        this.isOpen = !this.isOpen;
    }

    private _closePopup() {
        this.isOpen = false;
    }

    private _renderContextUsage() {
        if (this.contextMax <= 0) {
            return html``;
        }

        const percentage = Math.min((this.contextUsed / this.contextMax) * 100, 100);
        const barClass = percentage >= 90 ? "danger" : percentage >= 70 ? "warning" : "";

        return html`
            <div class="context-usage" title="Context usage: ${this.contextUsed} / ${this.contextMax} tokens">
                <div class="context-bar-container">
                    <div class="context-bar ${barClass}" style="width: ${percentage}%"></div>
                </div>
                <span class="context-text">${Math.round(percentage)}%</span>
            </div>
        `;
    }

    render() {
        const sortedSessions = [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt);

        return html`
            <div class="sessions-header">
                <div class="header-left" @click=${this._toggleOpen}>
                    <span class="header-title">Chat History</span>
                    <span class="toggle-icon">${this.isOpen ? "▲" : "▼"}</span>
                </div>
                <div class="header-buttons">
                    <span class="header-title">Context Usage</span>
                    ${this._renderContextUsage()}
                    <button class="icon-button new-chat-button" @click=${this._handleNewChat} title="New Chat">
                        +
                    </button>
                </div>
            </div>
            <div class="popup-overlay ${this.isOpen ? "open" : ""}" @click=${this._closePopup}></div>
            <div class="sessions-popup ${this.isOpen ? "open" : ""}">
                ${sortedSessions.length === 0
                    ? html`<div class="empty-state">No chat history yet</div>`
                    : sortedSessions.map(
                          (session) => html`
                              <div
                                  class="session-item ${session.id === this.activeSessionId ? "active" : ""}"
                                  @click=${() =>
                                      this.editingSessionId !== session.id && this._handleSelectSession(session.id)}
                              >
                                  <div class="session-info">
                                      ${this.editingSessionId === session.id
                                          ? html`<input
                                                class="session-title-input"
                                                type="text"
                                                .value=${session.title}
                                                @keydown=${(e: KeyboardEvent) => this._handleRenameKeyDown(e, session)}
                                                @blur=${() => this._handleRenameBlur(session)}
                                                @click=${(e: Event) => e.stopPropagation()}
                                            />`
                                          : html`<div class="session-title">${session.title}</div>`}
                                      <div class="session-date">${this._formatDate(session.updatedAt)}</div>
                                  </div>
                                  <div class="session-actions">
                                      <button
                                          class="icon-button action-button rename-button"
                                          @click=${(e: Event) => this._handleRenameSession(e, session)}
                                          title="Rename chat"
                                      >
                                          R
                                      </button>
                                      <button
                                          class="icon-button action-button delete-button"
                                          @click=${(e: Event) => this._handleDeleteSession(e, session.id)}
                                          title="Delete chat"
                                      >
                                          X
                                      </button>
                                  </div>
                              </div>
                          `,
                      )}
            </div>
        `;
    }
}

customElements.define("collama-chatsessions", ChatSessions);
