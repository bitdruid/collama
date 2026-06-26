import { html } from "lit";
import { customElement } from "lit/decorators.js";

import { themeIcons } from "../../../styles";
import { ButtonBase } from "../button-base";
import { boxButtonStyles } from "./box-button-styles";

/**
 * Base for 28×28 square icon buttons with border style. Clicking dispatches an
 * `action` event; subclasses set `variant` (CSS class), `icon`, and `defaultTitle`.
 */
@customElement("collama-button-box")
export class ButtonBox extends ButtonBase {
    static override styles = [boxButtonStyles];

    /** CSS class name for variant coloring (e.g. "accept", "cancel"). */
    protected variant = "";

    protected override render() {
        return html`
            <button
                class="button-box ${this.variant}"
                title=${this.title}
                ?disabled=${this.disabled}
                @click=${this._emitAction}
            >
                ${this.icon ?? html`<slot></slot>`}
            </button>
        `;
    }
}

@customElement("collama-accept-button")
export class AcceptButton extends ButtonBox {
    override variant = "accept";
    override icon = themeIcons.check.large;
    protected override defaultTitle = "Accept";
}

@customElement("collama-send-button")
export class SendButton extends ButtonBox {
    override variant = "send";
    override icon = themeIcons.send.large;
    protected override defaultTitle = "Send";
}

@customElement("collama-cancel-button")
export class CancelButton extends ButtonBox {
    override variant = "cancel";
    override icon = themeIcons.x.large;
    protected override defaultTitle = "Cancel";
}

@customElement("collama-accept-all-button")
export class AcceptAllButton extends ButtonBox {
    override variant = "accept-all";
    override icon = themeIcons.checkCheck.large;
    protected override defaultTitle = "Accept All";
}

@customElement("collama-add-button")
export class AddButton extends ButtonBox {
    override variant = "add";
    override icon = themeIcons.plus.large;
    protected override defaultTitle = "Add";
}
