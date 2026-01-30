import { LitElement, html, css } from "lit";
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
            gap: 4px;
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

        .session-date {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
        }

        .delete-button {
            opacity: 0;
            width: 20px;
            height: 20px;
            font-size: 14px;
            color: var(--vscode-errorForeground);
        }

        .session-item:hover .delete-button {
            opacity: 1;
        }

        .empty-state {
            padding: 16px;
            text-align: center;
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
        }
    `;

    sessions: ChatSession[] = [];
    activeSessionId: string = "";
    isOpen: boolean = false;

    private _formatDate(timestamp: number): string {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        } else if (diffDays === 1) {
            return "Yesterday";
        } else if (diffDays < 7) {
            return date.toLocaleDateString([], { weekday: "short" });
        } else {
            return date.toLocaleDateString([], { month: "short", day: "numeric" });
        }
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

    private _toggleOpen() {
        this.isOpen = !this.isOpen;
    }

    private _closePopup() {
        this.isOpen = false;
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
                                  @click=${() => this._handleSelectSession(session.id)}
                              >
                                  <div class="session-info">
                                      <div class="session-title">${session.title}</div>
                                      <div class="session-date">${this._formatDate(session.updatedAt)}</div>
                                  </div>
                                  <button
                                      class="icon-button delete-button"
                                      @click=${(e: Event) => this._handleDeleteSession(e, session.id)}
                                      title="Delete chat"
                                  >
                                      ×
                                  </button>
                              </div>
                          `,
                      )}
            </div>
        `;
    }
}

customElements.define("collama-chatsessions", ChatSessions);
