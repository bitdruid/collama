import { html } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import "../../template-components/action-button";
import { BaseModal } from "../../template-components/modal/base-modal";
import { acquireModalStyles } from "./styles";

@customElement("collama-acquire-modal")
export class AcquireModal extends BaseModal {
    static override styles = [...BaseModal.styles, acquireModalStyles];

    @query("collama-accept-button")
    private acceptButton!: HTMLElement;

    @property({ type: String }) description = "";

    constructor() {
        super();
        this.closeOnEscape = false;
        this.closeOnOutsideClick = false;
    }

    override show(title?: string) {
        super.show(title);
        this._focusAcceptButton();
    }

    override close() {
        this._focusAcceptButton();
    }

    private _focusAcceptButton() {
        this.updateComplete.then(() => {
            this.acceptButton?.focus();
        });
    }

    private _accept() {
        this.dispatchEvent(new CustomEvent("acquire-accept", { bubbles: true, composed: true }));
    }

    private _keepFocus = (e: FocusEvent) => {
        if (e.relatedTarget && this.shadowRoot?.contains(e.relatedTarget as Node)) {
            return;
        }
        this._focusAcceptButton();
    };

    private _handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" || e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            this._focusAcceptButton();
        }
    };

    override render() {
        if (!this._open) {
            return html``;
        }

        return html`
            <div
                class="modal-content ${this._visible ? "fade-in" : "fade-out"}"
                @focusout=${this._keepFocus}
                @keydown=${this._handleKeyDown}
            >
                <div class="modal-header">
                    <h3>${this.title}</h3>
                </div>
                <div class="modal-body">${this.renderContent()}</div>
            </div>
        `;
    }

    protected override renderContent() {
        return html`
            <div class="acquire-content">
                <div class="acquire-summary">
                    <collama-accept-button title="Accept" @action=${this._accept}></collama-accept-button>
                    <span class="acquire-description">${this.description}</span>
                </div>
            </div>
        `;
    }
}
