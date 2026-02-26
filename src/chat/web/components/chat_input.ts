import { LitElement, css, html } from "lit";

import { icons } from "../../utils";
import { ChatContext } from "./chat_container";

export class ChatInput extends LitElement {
    static get properties() {
        return {
            userInput: { type: String },
            rows: { type: Number },
            contexts: { type: Array },
            isLoading: { type: Boolean },
        };
    }

    static styles = css`
        :host {
            border-radius: 8px;
            border: 2px solid var(--vscode-commandCenter-activeBorder);
            background: var(--vscode-input-background);
        }
        textarea {
            flex: 1;
            width: 100%;
            font-size: 14px;
            padding: 8px;
            border-radius: 8px;
            border: none;
            color: var(--vscode-editor-foreground);
            background: transparent;
            resize: none;
            overflow: hidden;
            line-height: 1.2em;
            box-sizing: border-box;
        }
        button-submit,
        button-context,
        button-cancel,
        button-compress {
            display: inline-flex;
            align-items: center;
            justify-content: center;

            width: 28px;
            height: 28px;
            aspect-ratio: 1 / 1;

            padding: 0;
            border-radius: 50%;

            line-height: 1;

            color: #fff;
            border: none;
            cursor: pointer;
            box-sizing: border-box;
        }
        button-submit {
            background-color: #2277a8;
        }
        button-submit:hover {
            background-color: #185d86;
        }
        button-submit:disabled {
            background-color: #555;
            cursor: not-allowed;
            opacity: 0.5;
        }
        button-context {
            background-color: #2277a8;
        }
        button-context:hover {
            background-color: #185d86;
        }
        button-cancel {
            background-color: #a82222;
        }
        button-cancel:hover {
            background-color: #861818;
        }
        button-compress {
            background-color: #7a6030;
        }
        button-compress:hover {
            background-color: #5a4622;
        }
        .context-display {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 12px;
            background-color: #2277a8;
            color: #fff;
            font-size: 12px;
            white-space: nowrap;
        }
        .context-close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
            height: 14px;
            margin-left: 4px;
            border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            border: none;
            color: #fff;
            font-size: 10px;
            line-height: 1;
            cursor: pointer;
            padding: 0;
        }
        .context-close:hover {
            background: rgba(255, 255, 255, 0.4);
        }
        .context-list {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
        button-row {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            gap: 8px;
        }
    `;

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
