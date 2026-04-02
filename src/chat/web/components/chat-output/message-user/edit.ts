import { LitElement, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { editStyles } from "./styles";

@customElement("collama-chatedit")
export class ChatEditMessage extends LitElement {
    static styles = editStyles;

    @property({ type: String }) content: string = "";
    @property({ type: Number }) messageIndex: number = 0;
    @state() private rows = 1;

    @query(".edit-textarea")
    private textarea!: HTMLTextAreaElement;

    // Memoized event handlers
    private handleInput = () => this._handleInput();
    private handleSend = () => this._handleSend();
    private handleCancel = () => this._handleCancel();
    private handleMouseDown = (e: Event) => e.preventDefault();

    firstUpdated() {
        if (this.textarea) {
            // Focus immediately when edit starts
            this.textarea.focus();
            // Close edit view when focus is lost
            this.textarea.addEventListener("blur", () => this._handleCancel());
            // Adjust initial rows based on content
            this._adjustRows();
        }
    }

    private _handleInput() {
        this._adjustRows();
    }

    private _adjustRows() {
        if (!this.textarea) {
            return;
        }
        this.textarea.rows = 1;
        const style = getComputedStyle(this.textarea);
        const lineHeight = parseFloat(style.lineHeight);
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);
        const verticalPadding = paddingTop + paddingBottom;
        const contentHeight = this.textarea.scrollHeight - verticalPadding;
        const newRows = Math.max(1, Math.round(contentHeight / lineHeight));
        this.textarea.rows = newRows;
        this.rows = newRows;
    }

    private _handleSend() {
        if (!this.textarea) {
            return;
        }
        const newContent = this.textarea.value.trim();
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
            <textarea class="edit-textarea" rows=${this.rows} @input=${this.handleInput}>${this.content}</textarea>
            <div class="edit-actions">
                <button class="edit-cancel" @mousedown=${this.handleMouseDown} @click=${this.handleCancel}>
                    Cancel
                </button>
                <button class="edit-send" @mousedown=${this.handleMouseDown} @click=${this.handleSend}>Send</button>
            </div>
        `;
    }
}
