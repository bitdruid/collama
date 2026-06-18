import { html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import type { ToolDecisionRequest } from "../../../../../shared";
import "../../../../template-components/banner";
import { BaseModal } from "../../../../template-components/modal/base-modal";
import { toolDecisionStyles } from "./styles";

@customElement("collama-tool-decision-modal")
export class ToolDecisionModal extends BaseModal {
    static override styles = [...BaseModal.styles, toolDecisionStyles];

    @property({ type: Object }) request: ToolDecisionRequest | null = null;

    @state() private _showCustomInput = false;
    @state() private _customValue = "";

    @query(".decision-option")
    private firstOption!: HTMLButtonElement;

    @query(".custom-textarea")
    private customTextarea!: HTMLTextAreaElement;

    constructor() {
        super();
        this.title = "Decision";
        this.closeOnEscape = false;
        this.closeOnOutsideClick = false;
    }

    override show(title?: string) {
        this._showCustomInput = false;
        this._customValue = "";
        super.show(title);
        this._focusFirstOption();
    }

    override close() {
        // User must pick — clicking the X is a no-op, refocus instead.
        this._focusFirstOption();
    }

    private _focusFirstOption() {
        this.updateComplete.then(() => {
            if (this._showCustomInput) {
                this.customTextarea?.focus();
            } else {
                this.firstOption?.focus();
            }
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

    private _openCustomInput() {
        this._showCustomInput = true;
        this._focusFirstOption();
    }

    private _submitCustom() {
        const value = this._customValue.trim();
        if (value) {
            this._select(value);
        }
    }

    private _onCustomKeydown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this._submitCustom();
        }
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this._showCustomInput = false;
            this._focusFirstOption();
        }
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
            if (this._showCustomInput) {
                this._showCustomInput = false;
            }
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
                <collama-banner type="info" .description=${this.request.question}></collama-banner>
                <div class="decision-options">
                    ${this.request.options.map(
                        (option) => html`
                            <button class="decision-option" @click=${() => this._select(option)}>${option}</button>
                        `,
                    )}
                    <button
                        class="decision-option decision-other ${classMap({ hidden: this._showCustomInput })}"
                        @click=${this._openCustomInput}
                    >
                        Describe other...
                    </button>
                </div>
                <div class="custom-input-area ${classMap({ visible: this._showCustomInput })}">
                    <div class="custom-input-row">
                        <textarea
                            class="custom-textarea"
                            .value=${this._customValue}
                            @input=${(e: InputEvent) => {
                                this._customValue = (e.target as HTMLTextAreaElement).value;
                            }}
                            @keydown=${this._onCustomKeydown}
                            placeholder="Describe your own option..."
                            rows="1"
                        ></textarea>
                        <collama-accept-button
                            title="Submit"
                            ?disabled=${!this._customValue.trim()}
                            @action=${this._submitCustom}
                        ></collama-accept-button>
                    </div>
                </div>
            </div>
        `;
    }
}
