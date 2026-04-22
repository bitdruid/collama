import { html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { BaseModal } from "../../template-components/modal/base-modal";
import { errorModalStyles } from "./styles";

/**
 * Error modal component extending BaseModal.
 * Displays exported chat + error JSON with copy/close actions.
 *
 * @element collama-error-modal
 * @fires overlay-close - Dispatched when the overlay closes.
 */
@customElement("collama-error-modal")
export class ErrorModal extends BaseModal {
    static styles = [...BaseModal.styles, errorModalStyles];

    @property({ type: String }) content = "";
    @state() private _copyLabel = "Copy";

    constructor() {
        super();
        this.title = "Agent Error";
    }

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

    protected renderContent() {
        return html`
            <pre class="error-content">${this.content}</pre>
            <div class="error-actions">
                <button class="btn-copy" @click=${this._copy}>${this._copyLabel}</button>
                <button class="btn-close" @click=${this.close}>Close</button>
            </div>
        `;
    }
}
