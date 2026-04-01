import { html, LitElement } from "lit";
import { property } from "lit/decorators.js";
import { scrollDownButtonStyles } from "./styles";

export class ScrollDownButton extends LitElement {
    static styles = scrollDownButtonStyles;

    @property({ type: Boolean }) visible = false;

    private _onClick() {
        this.dispatchEvent(new CustomEvent("scroll-down", { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <button
                class="scroll-btn ${this.visible ? "visible" : ""}"
                @click=${this._onClick}
                title="Scroll down"
                aria-label="Scroll down"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 11L3 6h2l3 3 3-3h2l-5 5z" />
                </svg>
            </button>
        `;
    }
}

customElements.define("collama-scroll-down", ScrollDownButton);
