import { html, LitElement } from "lit";
import { scrollToBottomButtonStyles } from "./styles";

export class ScrollToBottomButton extends LitElement {
    static properties = {
        visible: { type: Boolean },
    };

    visible: boolean = false;

    static styles = scrollToBottomButtonStyles;

    private _scrollToBottom() {
        this.dispatchEvent(
            new CustomEvent("scroll-to-bottom-requested", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        return html`
            <button
                class="scroll-button ${this.visible ? "visible" : ""}"
                @click=${this._scrollToBottom}
                title="Scroll to bottom"
                aria-label="Scroll to bottom"
            >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 11L3 6h2l3 3 3-3h2l-5 5z" />
                </svg>
            </button>
        `;
    }
}

customElements.define("collama-scroll-to-bottom", ScrollToBottomButton);
