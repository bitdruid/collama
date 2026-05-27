import { html, TemplateResult } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseOverlay } from "../overlay/base-overlay";
import { basePopupStyles } from "./styles";

/**
 * Base popup component that can be extended for specific popup types.
 * Provides popup rendering/styling on top of the shared overlay lifecycle.
 */
@customElement("collama-base-popup")
export class BasePopup extends BaseOverlay {
    static override styles = [basePopupStyles];

    /**
     * Override this method to provide custom popup content
     */
    protected renderContent(): TemplateResult {
        return html`<slot></slot>`;
    }

    override render() {
        if (!this._open) {
            return html``;
        }

        return html`
            <div class="popup-content ${this._visible ? "fade-in" : "fade-out"}">${this.renderContent()}</div>
        `;
    }
}
