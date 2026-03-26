import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { errorModalStyles } from "./error-modal-styles";

/**
 * Error content panel for chat-modal.
 * Displays exported chat + error JSON with copy/close actions.
 * Slotted into `<collama-chat-modal>` by the parent.
 */
@customElement("collama-error-modal")
export class ErrorModal extends LitElement {
    static styles = errorModalStyles;

    @property({ type: String }) content = "";
    @state() private _copyLabel = "Copy";

    private async _copy() {
        try {
            await navigator.clipboard.writeText(this.content);
            this._copyLabel = "Copied!";
            setTimeout(() => {
                this._copyLabel = "Copy";
            }, 1500);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    }

    private _close() {
        this.dispatchEvent(new CustomEvent("modal-close", { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <pre class="error-content">${this.content}</pre>
            <div class="error-actions">
                <button class="btn-copy" @click=${this._copy}>${this._copyLabel}</button>
                <button class="btn-close" @click=${this._close}>Close</button>
            </div>
        `;
    }
}
