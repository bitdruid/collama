import { html } from "lit";
import { customElement } from "lit/decorators.js";
import { BaseOverlay } from "../overlay/base-overlay";
import { baseDropdownStyles } from "./styles";

/**
 * Base dropdown component that provides show/hide functionality with slide animations.
 * Extends BaseOverlay for dismissal handling.
 */
@customElement("collama-base-dropdown")
export class BaseDropdown extends BaseOverlay {
    static override styles = baseDropdownStyles;

    protected override closeEventName = "dropdown-close";

    protected renderContent() {
        return html`<slot></slot>`;
    }

    override render() {
        return html`
            <div class="dropdown-panel ${this._visible ? "open" : ""}">
                <div class="dropdown-content">${this.renderContent()}</div>
            </div>
        `;
    }
}
