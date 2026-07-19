import { css, html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import "../button";
import { themeColors } from "../../styles";
import { BasePopup } from "./base-popup";
import { basePopupStyles } from "./styles";

const confirmPopupStyles = css`
    :host {
        right: auto;
        left: 0;
    }

    .confirm-content {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .confirm-text {
        color: ${themeColors.uiFont};
        font-size: 12px;
        text-align: center;
    }

    .confirm-actions {
        display: flex;
        justify-content: center;
        gap: 8px;
    }
`;

/**
 * Generic confirm popup: shows `text` with accept/cancel buttons and emits
 * `confirm` on accept. Anchor it like any BasePopup.
 */
@customElement("collama-confirm-popup")
export class ConfirmPopup extends BasePopup {
    static styles = [basePopupStyles, confirmPopupStyles];

    @property({ type: String }) text = "Are you sure?";
    @property({ type: String }) acceptTitle = "Confirm";

    protected override renderContent(): TemplateResult {
        return html`
            <div class="confirm-content">
                <div class="confirm-text">${this.text}</div>
                <div class="confirm-actions">
                    <collama-accept-button title=${this.acceptTitle} @action=${this._handleConfirm}></collama-accept-button>
                    <collama-cancel-button title="Cancel" @action=${this._handleCancel}></collama-cancel-button>
                </div>
            </div>
        `;
    }

    private _handleCancel = () => {
        this.close();
    };

    private _handleConfirm = () => {
        this.dispatchEvent(new CustomEvent("confirm", { bubbles: true, composed: true }));
        this.close();
    };
}
