import { html } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import "../../../../template-components/banner";
import { BaseModal } from "../../../../template-components/modal/base-modal";
import type { ToolDecisionRequest } from "../../../../types";
import { toolDecisionStyles } from "./styles";

@customElement("collama-tool-decision-modal")
export class ToolDecisionModal extends BaseModal {
    static override styles = [...BaseModal.styles, toolDecisionStyles];

    @property({ type: Object }) request: ToolDecisionRequest | null = null;

    @query(".decision-option")
    private firstOption!: HTMLButtonElement;

    constructor() {
        super();
        this.title = "Decision";
        this.closeOnEscape = false;
        this.closeOnOutsideClick = false;
    }

    override show(title?: string) {
        super.show(title);
        this._focusFirstOption();
    }

    override close() {
        // User must pick — clicking the X is a no-op, refocus instead.
        this._focusFirstOption();
    }

    private _focusFirstOption() {
        this.updateComplete.then(() => {
            this.firstOption?.focus();
        });
    }

    private _select(option: string) {
        this.dispatchEvent(
            new CustomEvent("tool-decision-select", {
                detail: { id: this.request?.id, value: option },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _keepFocus = (e: FocusEvent) => {
        if (e.relatedTarget && this.shadowRoot?.contains(e.relatedTarget as Node)) {
            return;
        }
        this._focusFirstOption();
    };

    private _handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this._focusFirstOption();
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
        if (!this.request) {
            return html``;
        }
        return html`
            <div class="decision-content">
                <collama-info-banner .description=${this.request.question}></collama-info-banner>
                <div class="decision-options">
                    ${this.request.options.map(
                        (option) => html`
                            <button class="decision-option" @click=${() => this._select(option)}>${option}</button>
                        `,
                    )}
                </div>
            </div>
        `;
    }
}
