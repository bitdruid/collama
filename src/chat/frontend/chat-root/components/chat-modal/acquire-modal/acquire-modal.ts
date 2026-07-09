import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../../../../template-components/button";
import { BaseModal } from "../../../../template-components/modal/base-modal";
import { acquireModalStyles } from "./styles";

@customElement("collama-acquire-modal")
export class AcquireModal extends BaseModal {
    static override styles = [...BaseModal.styles, acquireModalStyles];

    @property({ type: String }) description = "";

    private _accept() {
        this.dispatchEvent(new CustomEvent("acquire-accept", { bubbles: true, composed: true }));
    }

    // recommendation only, dismissing just closes the modal
    private _dismiss() {
        this.close();
    }

    protected override renderContent() {
        return html`
            <div class="acquire-content">
                <span class="acquire-description">${this.description}</span>
                <div class="acquire-actions">
                    <collama-cancel-button title="Dismiss" @action=${this._dismiss}></collama-cancel-button>
                    <collama-accept-button title="Summarize" @action=${this._accept}></collama-accept-button>
                </div>
            </div>
        `;
    }
}
