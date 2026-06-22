import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { scrollDownButtonStyles } from "./styles";

@customElement("collama-scroll-down")
export class ScrollDownButton extends LitElement {
    static styles = scrollDownButtonStyles;

    @property({ type: Boolean, reflect: true }) visible = false;
    @property({ type: Boolean, reflect: true }) isGenerating = false;

    private _onClick() {
        this.dispatchEvent(new CustomEvent("scroll-down", { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <div class="scroll-wrap">
                ${this.isGenerating
                    ? html`<svg class="ring" viewBox="0 0 40 40" aria-hidden="true">
                          <circle cx="20" cy="20" r="18" />
                      </svg>`
                    : ""}
                <button class="scroll-btn" @click=${this._onClick} title="Scroll down">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 11L3 6h2l3 3 3-3h2l-5 5z" />
                    </svg>
                </button>
            </div>
        `;
    }
}
