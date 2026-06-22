import { html, LitElement, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { themeIcons } from "../../styles";
import { buttonBoxStyles } from "./styles";

/**
 * Base for 28x28 square icon buttons. Clicking dispatches an `action` event; subclasses set
 * `defaultTitle` to fall back to a title when none is given.
 */
@customElement("collama-button-box")
export class ButtonBox extends LitElement {
    static override styles = [buttonBoxStyles];

    @query("button")
    private buttonEl!: HTMLButtonElement;

    @property({ type: String }) title = "";
    @property({ type: Boolean, reflect: true }) disabled = false;
    @property({ type: String, reflect: true }) variant = "";
    @property({ attribute: false }) icon: TemplateResult | null = null;

    protected defaultTitle = "";

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
        this.buttonEl?.focus(options);
    }

    protected override render() {
        return html`<button
            class="button-box ${this.variant}"
            title=${this.title}
            ?disabled=${this.disabled}
            @click=${this._emitAction}
        >
            ${this.icon ?? html`<slot></slot>`}
        </button>`;
    }

    private _applyDefaultTitle() {
        if (!this.hasAttribute("title") && this.defaultTitle) {
            this.title = this.defaultTitle;
        }
    }

    private _emitAction = () => {
        this.dispatchEvent(new CustomEvent("action", { bubbles: true, composed: true }));
    };
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
