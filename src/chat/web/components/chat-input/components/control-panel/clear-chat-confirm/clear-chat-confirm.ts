import { html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { icons } from "../../../../../../utils-front";
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
                    <button class="confirm-btn ok-btn" title="Clear conversation" @click=${this._handleConfirm}>
                        ${icons.check}
                    </button>
                    <button class="confirm-btn cancel-btn" title="Cancel" @click=${this._handleCancel}>
                        ${icons.x}
                    </button>
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
