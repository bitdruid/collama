import { html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { textboxStyles } from "./styles";

export type TextBoxMode = "box" | "input";

/**
 * Dual-purpose text box sharing one design:
 *  - `mode="box"` (default): a full-width bordered box wrapping slotted text. Clicking dispatches
 *    an `action` event. Supports `selected` (highlighted) and `disabled`.
 *  - `mode="input"`: an editable single-row field with the same box dimensions. Typing dispatches
 *    `textbox-input` (detail `{ value }`), Enter dispatches `textbox-submit`, Escape dispatches
 *    `textbox-cancel`.
 *
 * Submit/confirm buttons live outside the textbox (e.g. in a collama-button-row).
 */
@customElement("collama-textbox")
export class TextBox extends LitElement {
    static override styles = [textboxStyles];

    @property({ type: String }) mode: TextBoxMode = "box";
    @property({ type: Boolean, reflect: true }) selected = false;
    @property({ type: Boolean, reflect: true }) disabled = false;
    @property({ type: String }) value = "";
    @property({ type: String }) placeholder = "";

    @query("button, textarea")
    private control!: HTMLElement;

    override focus(options?: FocusOptions) {
        this.control?.focus(options);
    }

    protected override firstUpdated() {
        this._autoResize();
    }

    protected override render() {
        if (this.mode === "input") {
            return html`<textarea
                class="textbox-input"
                rows="1"
                .value=${this.value}
                placeholder=${this.placeholder}
                ?disabled=${this.disabled}
                @input=${this._onInput}
                @keydown=${this._onKeydown}
            ></textarea>`;
        }
        return html`<button
            class="textbox ${classMap({ selected: this.selected })}"
            ?disabled=${this.disabled}
            @click=${this._emitAction}
        >
            <slot></slot>
        </button>`;
    }

    private _emitAction = () => {
        this.dispatchEvent(new CustomEvent("action", { bubbles: true, composed: true }));
    };

    private _autoResize() {
        const ta = this.shadowRoot?.querySelector("textarea");
        if (ta) {
            ta.style.height = "auto";
            ta.style.height = `${ta.scrollHeight}px`;
        }
    }

    private _onInput = (e: InputEvent) => {
        // Stop the native input from leaking past the shadow boundary; re-emit with the value.
        e.stopPropagation();
        this.value = (e.target as HTMLTextAreaElement).value;
        this._autoResize();
        this.dispatchEvent(
            new CustomEvent("textbox-input", { detail: { value: this.value }, bubbles: true, composed: true }),
        );
    };

    private _onKeydown = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.dispatchEvent(new CustomEvent("textbox-submit", { bubbles: true, composed: true }));
        }
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            this.dispatchEvent(new CustomEvent("textbox-cancel", { bubbles: true, composed: true }));
        }
    };
}
