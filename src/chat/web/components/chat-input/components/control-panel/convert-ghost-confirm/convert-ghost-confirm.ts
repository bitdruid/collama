import { html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import "../../../../template-components/action-button";
import { BasePopup } from "../../../../template-components/popup/base-popup";
import { basePopupStyles } from "../../../../template-components/popup/styles";
import { convertGhostConfirmStyles } from "./styles";

@customElement("collama-convert-ghost-confirm")
export class ConvertGhostConfirm extends BasePopup {
    static styles = [basePopupStyles, convertGhostConfirmStyles];

    protected override renderContent(): TemplateResult {
        return html`
            <div class="confirm-content">
                <div class="confirm-text">Are you sure?</div>
                <div class="confirm-actions">
                    <collama-accept-button title="Convert" @action=${this._handleConfirm}></collama-accept-button>
                    <collama-cancel-button title="Cancel" @action=${this._handleCancel}></collama-cancel-button>
                </div>
            </div>
        `;
    }

    private _handleCancel = () => {
        this.close();
    };

    private _handleConfirm = () => {
        this.dispatchEvent(new CustomEvent("convert-ghost-confirmed", { bubbles: true, composed: true }));
        this.close();
    };
}
