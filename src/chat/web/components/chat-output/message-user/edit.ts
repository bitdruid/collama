import { LitElement, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { editStyles } from "./styles";

/**
 * A component that provides an inline editing interface for chat messages.
 * Allows users to modify message content with auto-resizing textarea,
 * send/cancel actions, and proper focus management.
 */
@customElement("collama-chatedit")
export class ChatEditMessage extends LitElement {
    static styles = editStyles;

    @property({ type: String }) content: string = "";
    @property({ type: Number }) messageIndex: number = 0;
    @state() private rows = 1;
    @query(".edit-textarea")
    private textarea!: HTMLTextAreaElement;

    /**
     * Memoized event handlers to prevent recreation on each render.
     * These are bound once at class initialization for optimal performance.
     */
    private handleInput = () => this._handleInput();
    private handleSend = () => this._handleSend();
    private handleCancel = () => this._handleCancel();
    private handleMouseDown = (e: Event) => e.preventDefault();

    /**
     * Called after the component's DOM has been updated the first time.
     * Initializes the textarea with focus and adjusts the initial row count
     * based on content.
     */
    firstUpdated() {
        if (this.textarea) {
            this.textarea.focus();
            this._adjustRows();
        }
    }

    /**
     * Handles textarea input events.
     * Triggers row adjustment to accommodate new content.
     */
    private _handleInput() {
        this._adjustRows();
    }

    /**
     * Dynamically adjusts the textarea row count based on content height.
     * Calculates the required rows by measuring scroll height against line height,
     * accounting for vertical padding. Ensures a minimum of 1 row.
     */
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

    /**
     * Handles the send action when user submits edited content.
     * Validates that content is not empty, then dispatches a custom event
     * with the message index and new content for parent components to handle.
     */
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

    /**
     * Handles the cancel action when user aborts editing.
     * Dispatches a custom event to notify parent components to close the edit view.
     */
    private _handleCancel() {
        this.dispatchEvent(
            new CustomEvent("edit-cancel", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    /**
     * Renders the edit interface with a textarea and action buttons.
     * The textarea auto-resizes based on content, and buttons provide
     * send/cancel functionality.
     */
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
