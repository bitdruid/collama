import { html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import "../../../../template-components/action-button";
import { BasePopup } from "../../../../template-components/popup/base-popup";
import { basePopupStyles } from "../../../../template-components/popup/styles";
import { clearChatConfirmStyles } from "./styles";

@customElement("collama-clear-chat-confirm")
export class ClearChatConfirm extends BasePopup {
    static styles = [basePopupStyles, clearChatConfirmStyles];

    protected override renderContent(): TemplateResult {
        return html`
            <div class="confirm-content">
                <div class="confirm-text">Are you sure?</div>
                <div class="confirm-actions">
                    <collama-accept-button title="Clear conversation" @action=${this._handleConfirm}></collama-accept-button>
                    <collama-cancel-button title="Cancel" @action=${this._handleCancel}></collama-cancel-button>
                </div>
            </div>
        `;
    }

    private _handleCancel = () => {
        this.close();
    };

    private _handleConfirm = () => {
        this.dispatchEvent(new CustomEvent("clear-chat-confirmed", { bubbles: true, composed: true }));
        this.close();
    };
}
