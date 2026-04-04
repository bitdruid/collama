// src/chat/web/components/chat_session/components/dropdown/chat_session_dropdown.ts
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { ChatSession } from "../../../../types";
import "./chat-session-empty";
import "./chat-session-item";
import { dropdownStyles } from "./styles";

@customElement("collama-chatsessions-dropdown")
export class ChatSessionsDropdown extends LitElement {
    @property({ type: Boolean }) isOpen = false;
    @property({ type: Array }) sessions: ChatSession[] = [];
    @property({ type: String }) activeSessionId = "";

    static styles = dropdownStyles;

    // Memoized event handlers
    private handleSelect = (session: ChatSession) => {
        this.dispatchEvent(
            new CustomEvent("select-session", {
                detail: { id: session.id },
                bubbles: true,
                composed: true,
            }),
        );
    };

    private handleDelete = (session: ChatSession) => {
        this.dispatchEvent(
            new CustomEvent("delete-session", {
                detail: { id: session.id },
                bubbles: true,
                composed: true,
            }),
        );
    };

    private handleRename = (e: CustomEvent) => {
        this.dispatchEvent(
            new CustomEvent("rename-session", {
                detail: { id: e.detail.id, newTitle: e.detail.newTitle },
                bubbles: true,
                composed: true,
            }),
        );
    };

    private handleCopy = (session: ChatSession) => {
        this.dispatchEvent(
            new CustomEvent("copy-session", {
                detail: { id: session.id },
                bubbles: true,
                composed: true,
            }),
        );
    };

    private handleExport = (session: ChatSession) => {
        this.dispatchEvent(
            new CustomEvent("export-session", {
                detail: { id: session.id },
                bubbles: true,
                composed: true,
            }),
        );
    };

    render() {
        const sorted = [...this.sessions].filter((s) => !s.ghost).sort((a, b) => b.updatedAt - a.updatedAt);

        return html`
            <div class="sessions-dropdown ${this.isOpen ? "open" : ""}">
                ${sorted.length === 0
                    ? html`<collama-empty-state></collama-empty-state>`
                    : repeat(
                          sorted,
                          (session: ChatSession) => session.id,
                          (session: ChatSession) => html`
                              <collama-chat-session-item
                                  .session=${session}
                                  .isActive=${session.id === this.activeSessionId}
                                  @select=${() => this.handleSelect(session)}
                                  @delete=${() => this.handleDelete(session)}
                                  @rename=${this.handleRename}
                                  @copy=${() => this.handleCopy(session)}
                                  @export=${() => this.handleExport(session)}
                              ></collama-chat-session-item>
                          `,
                      )}
            </div>
        `;
    }
}
