import { LitElement, css, html } from "lit";

import { icons } from "../../../utils";
import { ChatContext } from "../chat_container/chat_container";
import { chatInputStyles } from "./styles/chat_input_styles";

export class ChatInput extends LitElement {
    static get properties() {
        return {
            userInput: { type: String },
            rows: { type: Number },
            contexts: { type: Array },
            isLoading: { type: Boolean },
        };
    }

    
    static styles = chatInputStyles

    userInput = "";
    rows = 1;
    contexts: ChatContext[] = [];
    isLoading = false;

    private _handleInput(e: Event) {
        this.userInput = (e.target as HTMLTextAreaElement).value;
        this._adjustRows();
    }

    private _handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this._handleSubmit();
        }
    }

    private _handleSubmit() {
        if (this.isLoading) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent("submit", {
                detail: { value: this.userInput, contexts: this.contexts },
                bubbles: true,
                composed: true,
            }),
        );
        this.userInput = "";
        this.rows = 1;
        this.contexts = [];
    }

    private _handleCancel() {
        this.dispatchEvent(
            new CustomEvent("cancel", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleCompress() {
        this.dispatchEvent(
            new CustomEvent("compress", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _adjustRows() {
        const ta = this.shadowRoot?.querySelector("textarea") as HTMLTextAreaElement | null;
        if (!ta) {
            return;
        }
        ta.rows = 1; // reset so it can shrink
        const style = getComputedStyle(ta);
        const lineHeight = parseFloat(style.lineHeight);
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);
        const verticalPadding = paddingTop + paddingBottom;
        const contentHeight = ta.scrollHeight - verticalPadding;
        const newRows = Math.max(1, Math.round(contentHeight / lineHeight));
        ta.rows = newRows;
        this.rows = newRows;
    }

    private _clearContext(index: number) {
        this.dispatchEvent(
            new CustomEvent("context-cleared", {
                detail: { index },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _renderContextButton() {
        if (this.contexts.length > 0) {
            return html`
                <div class="context-list">
                    ${this.contexts.map((ctx, index) => {
                        const label = ctx.hasSelection
                            ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})`
                            : ctx.fileName;
                        return html`
                            <span class="context-display" title="Context attached">
                                ${label}
                                <button
                                    class="context-close"
                                    @click=${() => this._clearContext(index)}
                                    title="Remove context"
                                >
                                    ×
                                </button>
                            </span>
                        `;
                    })}
                </div>
            `;
        }
        return html`<button-context title="Add context"> ${icons.paperclip} </button-context>`;
    }

    render() {
        return html` <textarea
                .value=${this.userInput}
                rows=${this.rows}
                @input=${this._handleInput}
                @keydown=${this._handleKeyDown}
                placeholder="Chat with AI..."
                ?disabled=${this.isLoading}
            ></textarea>
            <button-row>
                ${this._renderContextButton()}
                ${this.isLoading
                    ? html`<button-cancel title="Cancel" @click=${this._handleCancel}> ${icons.cancel} </button-cancel>`
                    : html`
                          <button-compress title="Compress chat" @click=${this._handleCompress}>
                              ${icons.compress}
                          </button-compress>
                          <button-submit title="Submit" @click=${this._handleSubmit} ?disabled=${this.isLoading}>
                              ${icons.enter}
                          </button-submit>
                      `}
            </button-row>`;
    }
}

customElements.define("collama-chatinput", ChatInput);
