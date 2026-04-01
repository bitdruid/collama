import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";
import { editStyles } from "./styles";

export class ChatEditMessage extends LitElement {
    static styles = editStyles;

    @property({ type: String }) content: string = "";
    @property({ type: Number }) messageIndex: number = 0;
    @state() private rows = 1;

    firstUpdated() {
        const textarea = this.shadowRoot?.querySelector(".edit-textarea") as HTMLTextAreaElement;
        if (textarea) {
            // Focus immediately when edit starts
            textarea.focus();
            // Close edit view when focus is lost
            textarea.addEventListener("blur", () => this._handleCancel());
            // Adjust initial rows based on content
            this._adjustRows();
        }
    }

    private _handleInput(e: Event) {
        this._adjustRows();
    }

    private _adjustRows() {
        const ta = this.shadowRoot?.querySelector(".edit-textarea") as HTMLTextAreaElement | null;
        if (!ta) {
            return;
        }
        ta.rows = 1;
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

    private _handleSend() {
        const textarea = this.shadowRoot?.querySelector(".edit-textarea") as HTMLTextAreaElement;
        if (!textarea) {
            return;
        }
        const newContent = textarea.value.trim();
        if (!newContent) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent("edit-send", {
                detail: { messageIndex: this.messageIndex, newContent },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleCancel() {
        this.dispatchEvent(
            new CustomEvent("edit-cancel", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        return html`
            <textarea class="edit-textarea" rows=${this.rows} @input=${this._handleInput}>${this.content}</textarea>
            <div class="edit-actions">
                <button
                    class="edit-cancel"
                    @mousedown=${(e: Event) => e.preventDefault()}
                    @click=${() => this._handleCancel()}
                >
                    Cancel
                </button>
                <button
                    class="edit-send"
                    @mousedown=${(e: Event) => e.preventDefault()}
                    @click=${() => this._handleSend()}
                >
                    Send
                </button>
            </div>
        `;
    }
}

customElements.define("collama-chatedit", ChatEditMessage);
