// src/components/chat-session-item.ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

import { formatDate } from "../utils/date";

import { sessionItemCss } from "../styles/session_item_style";
import { ChatSession } from "./chat_sessions";

@customElement("collama-chat-session-item")
export class ChatSessionItem extends LitElement {
  @property({ type: Object }) session!: ChatSession;
  @property({ type: Boolean }) isActive = false;

  private editing = false;
  private inputEl?: HTMLInputElement;

  static styles = sessionItemCss;

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
          <button
            class="action-button rename-button"
            @click=${this._startRename}
            title="Rename chat"
          >
            R
          </button>
          <button
            class="action-button delete-button"
            @click=${this._handleDelete}
            title="Delete chat"
          >
            X
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
    if (!this.inputEl) {return};
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
