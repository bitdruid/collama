// src/chat/web/components/chat_session/components/popup/chat_session_item.ts
import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ChatSession } from "../../chat-session";
import { commonStyles } from "../../styles-shared";
import { sessionItemStyles } from "./styles";

function formatDate(timestamp: number): string {
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

@customElement("collama-chat-session-item")
export class ChatSessionItem extends LitElement {
    @property({ type: Object }) session!: ChatSession;
    @property({ type: Boolean }) isActive = false;

    @state() private editing = false;
    private inputEl?: HTMLInputElement;

    static styles = [commonStyles, sessionItemStyles];

    render() {
        return html`
            <div class="session-item ${this.isActive ? "active" : ""}" @click=${this._handleClick}>
                <div class="session-info">
                    ${this.editing
                        ? html`
                              <input
                                  class="session-title-input"
                                  type="text"
                                  .value=${this.session.title}
                                  @keydown=${this._onKeyDown}
                                  @blur=${this._onBlur}
                                  @click=${(e: Event) => e.stopPropagation()}
                              />
                          `
                        : html`<div class="session-title">${this.session.title}</div>`}
                    <div class="session-date">${formatDate(this.session.updatedAt)}</div>
                </div>
                <div class="session-actions">
                    <button class="action-button export-button" @click=${this._handleExport} title="Export chat (JSON)">
                        <!--  -->E
                    </button>
                    <button class="action-button rename-button" @click=${this._startRename} title="Rename chat">
                        <!--  -->R
                    </button>
                    <button class="action-button copy-button" @click=${this._handleCopy} title="Copy chat">
                        <!--  -->C
                    </button>
                    <button class="action-button delete-button" @click=${this._handleDelete} title="Delete chat">
                        <!--  -->X
                    </button>
                </div>
            </div>
        `;
    }

    /* ---------- Event‑Handlers ---------- */

    private _handleClick() {
        if (!this.editing) {
            this.dispatchEvent(new CustomEvent("select", { bubbles: true, composed: true }));
        }
    }

    private _startRename(e: Event) {
        e.stopPropagation();
        this.editing = true;
        this.updateComplete.then(() => {
            this.inputEl = this.shadowRoot?.querySelector(".session-title-input") as HTMLInputElement;
            this.inputEl?.focus();
            this.inputEl?.select();
        });
    }

    private _handleCopy(e: Event) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("copy", { bubbles: true, composed: true }));
    }

    private _handleExport(e: Event) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("export", { bubbles: true, composed: true }));
    }

    private _handleDelete(e: Event) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("delete", { bubbles: true, composed: true }));
    }

    private _onKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            this._submitRename();
        } else if (e.key === "Escape") {
            e.preventDefault();
            this.editing = false;
        }
    }

    private _onBlur() {
        this._submitRename();
    }

    private _submitRename() {
        if (!this.inputEl) {
            return;
        }
        const newTitle = this.inputEl.value.trim();
        if (newTitle && newTitle !== this.session.title) {
            this.dispatchEvent(
                new CustomEvent("rename", {
                    detail: { id: this.session.id, newTitle },
                    bubbles: true,
                    composed: true,
                }),
            );
        }
        this.editing = false;
    }
}
