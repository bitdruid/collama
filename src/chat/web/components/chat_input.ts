import { LitElement, css, html } from "lit";
import { ChatContext, logWebview } from "./chat_container";

export class ChatInput extends LitElement {
    static get properties() {
        return {
            userInput: { type: String },
            rows: { type: Number },
            context: { type: Object },
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
        button-context {
            display: inline-flex;
            align-items: center;
            justify-content: center;

            width: 24px;
            height: 24px;
            aspect-ratio: 1 / 1;

            padding: 0;
            border-radius: 50%;

            font-size: 20px;
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
        button-context {
            background-color: #4aaf50;
        }
        button-context:hover {
            background-color: #429a38;
        }
        .context-display {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            padding: 4px 8px;
            border-radius: 12px;
            background-color: #4aaf50;
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
        button-row {
            display: flex;
            justify-content: flex-end;
            margin-top: 8px;
            gap: 8px;
        }
    `;

    userInput = "";
    rows = 1;
    context: ChatContext | null = null;
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
        logWebview(`triggered in chat_input::_handleSubmit`);
        this.dispatchEvent(
            new CustomEvent("submit", {
                detail: { value: this.userInput, context: this.context },
                bubbles: true,
                composed: true,
            }),
        );
        this.userInput = "";
        this.rows = 1;
        this.context = null;
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

    private _clearContext() {
        this.context = null;
        this.dispatchEvent(
            new CustomEvent("context-cleared", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _renderContextButton() {
        if (this.context) {
            const label = this.context.hasSelection
                ? `${this.context.fileName} (${this.context.startLine}-${this.context.endLine})`
                : this.context.fileName;
            return html`<span class="context-display" title="Context attached">
                ${label}
                <button class="context-close" @click=${this._clearContext} title="Remove context">×</button>
            </span>`;
        }
        return html`<button-context title="Context">@</button-context>`;
    }

    render() {
        return html` <textarea
                .value=${this.userInput}
                rows=${this.rows}
                @input=${this._handleInput}
                @keydown=${this._handleKeyDown}
                placeholder="Chat with AI..."
            ></textarea>
            <button-row>
                ${this._renderContextButton()}
                <button-submit title="Submit" @click=${this._handleSubmit}>></button-submit>
            </button-row>`;
    }
}

customElements.define("collama-chatinput", ChatInput);
