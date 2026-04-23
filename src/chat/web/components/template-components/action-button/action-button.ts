import { html, LitElement, type PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { icons } from "../../../../utils-front";
import { actionButtonStyles, type ActionButtonVariant } from "./styles";

export class ActionButton extends LitElement {
    static override styles = [actionButtonStyles];

    @property({ type: String }) title = "";
    @property({ type: Boolean, reflect: true }) disabled = false;

    @query("button")
    private button!: HTMLButtonElement;

    protected variant: ActionButtonVariant = "accept";
    protected icon = icons.check;
    protected defaultTitle = "Accept";

    override connectedCallback() {
        super.connectedCallback();
        this._applyDefaultTitle();
    }

    protected override updated(changedProperties: PropertyValues<this>) {
        if (changedProperties.has("title")) {
            this._applyDefaultTitle();
        }
    }

    override focus(options?: FocusOptions) {
        this.button?.focus(options);
    }

    protected override render() {
        return html`
            <button
                class="action-button ${this.variant}"
                title=${this.title}
                ?disabled=${this.disabled}
                @click=${this._emitAction}
            >
                ${this.icon}
            </button>
        `;
    }

    private _applyDefaultTitle() {
        if (!this.hasAttribute("title")) {
            this.title = this.defaultTitle;
        }
    }

    private _emitAction = () => {
        this.dispatchEvent(new CustomEvent("action", { bubbles: true, composed: true }));
    };
}

@customElement("collama-accept-button")
export class AcceptButton extends ActionButton {
    protected override variant: ActionButtonVariant = "accept";
    protected override icon = icons.check;
    protected override defaultTitle = "Accept";
}

@customElement("collama-cancel-button")
export class CancelButton extends ActionButton {
    protected override variant: ActionButtonVariant = "cancel";
    protected override icon = icons.x;
    protected override defaultTitle = "Cancel";
}
