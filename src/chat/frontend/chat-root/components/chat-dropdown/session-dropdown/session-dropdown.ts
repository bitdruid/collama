import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { ChatSession } from "../../../../../shared";
import { BaseDropdown } from "../../../../template-components/dropdown/base-dropdown";
import { baseDropdownStyles } from "../../../../template-components/dropdown/styles";
import "./session-item";
import { sessionDropdownStyles } from "./styles";

@customElement("collama-session-dropdown")
export class SessionDropdown extends BaseDropdown {
    static override styles = css`
        ${baseDropdownStyles}
        ${sessionDropdownStyles}
    `;
    @property({ type: Array }) sessions: ChatSession[] = [];
    @property({ type: String }) activeSessionId = "";

    private handleSelect = (session: ChatSession) => {
        this.dispatchEvent(
            new CustomEvent("select-session", {
                detail: { id: session.id },
                bubbles: true,
                composed: true,
            }),
        );
        this.close();
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

    private handleExportHtml = (session: ChatSession) => {
        this.dispatchEvent(
            new CustomEvent("export-session-html", {
                detail: { id: session.id },
                bubbles: true,
                composed: true,
            }),
        );
    };

    protected override renderContent() {
        const sorted = [...this.sessions].filter((s) => !s.ghost).sort((a, b) => b.updatedAt - a.updatedAt);

        return html`
            ${sorted.length === 0
                ? html`<div style="padding: 1rem; text-align: center; opacity: 0.7;">
                      Create a new chat to store a session
                  </div>`
                : repeat(
                      sorted,
                      (session: ChatSession) => session.id,
                      (session: ChatSession) => html`
                          <collama-session-item
                              .session=${session}
                              .isActive=${session.id === this.activeSessionId}
                              @select=${() => this.handleSelect(session)}
                              @delete=${() => this.handleDelete(session)}
                              @rename=${this.handleRename}
                              @copy=${() => this.handleCopy(session)}
                              @export-html=${() => this.handleExportHtml(session)}
                          ></collama-session-item>
                      `,
                  )}
        `;
    }
}
