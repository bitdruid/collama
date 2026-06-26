import { html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import type { ToolDecisionRequest } from "../../../../../shared";
import "../../../../template-components/banner";
import "../../../../template-components/button";
import "../../../../template-components/button-row";
import { BaseModal } from "../../../../template-components/modal/base-modal";
import "../../../../template-components/text-box";
import { toolDecisionStyles } from "./styles";

@customElement("collama-tool-decision-modal")
export class ToolDecisionModal extends BaseModal {
    static override styles = [...BaseModal.styles, toolDecisionStyles];

    @property({ type: Object }) request: ToolDecisionRequest | null = null;

    @state() private _showCustomInput = false;
    @state() private _customValue = "";
    @state() private _selectedOption: string | null = null;

    @query("collama-textbox")
    private firstOption!: HTMLElement;

    @query(".custom-textbox")
    private customTextarea!: HTMLElement;

    constructor() {
        super();
        this.title = "Decision";
        this.closeOnEscape = false;
        this.closeOnOutsideClick = false;
    }

    override show(title?: string) {
        this._showCustomInput = false;
        this._customValue = "";
        this._selectedOption = null;
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

    private _selectOption(option: string) {
        this._selectedOption = option;
        this._showCustomInput = false;
    }

    private _openCustomInput() {
        this._showCustomInput = true;
        this._selectedOption = null;
        this._focusFirstOption();
    }

    /** The value the Submit button would commit: the typed "other", or the selected option. */
    private get _pendingValue(): string | null {
        if (this._showCustomInput) {
            return this._customValue.trim() || null;
        }
        return this._selectedOption;
    }

    private _submit() {
        const value = this._pendingValue;
        if (value) {
            this._select(value);
        }
    }

    private _onCustomInput(e: CustomEvent<{ value: string }>) {
        this._customValue = e.detail.value;
    }

    private _closeCustomInput() {
        this._showCustomInput = false;
        this._focusFirstOption();
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
                            <collama-textbox
                                ?selected=${this._selectedOption === option}
                                @action=${() => this._selectOption(option)}
                            >
                                ${option}
                            </collama-textbox>
                        `,
                    )}
                    <collama-textbox
                        class="decision-other ${classMap({ hidden: this._showCustomInput })}"
                        @action=${this._openCustomInput}
                    >
                        Describe other...
                    </collama-textbox>
                    <div class="custom-input-area ${classMap({ visible: this._showCustomInput })}">
                        <collama-textbox
                            class="custom-textbox"
                            mode="input"
                            .value=${this._customValue}
                            placeholder="Describe other..."
                            @textbox-input=${this._onCustomInput}
                            @textbox-submit=${this._submit}
                            @textbox-cancel=${this._closeCustomInput}
                        ></collama-textbox>
                    </div>
                </div>
                <collama-button-row>
                    <collama-send-button
                        title="Submit"
                        ?disabled=${!this._pendingValue}
                        @action=${this._submit}
                    ></collama-send-button>
                </collama-button-row>
            </div>
        `;
    }
}
