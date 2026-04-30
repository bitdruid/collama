import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../../../styles/theme-icons";
import { sessionButtonStyles } from "./styles";

@customElement("collama-session-button")
export class SessionButton extends LitElement {
    @property({ type: Boolean }) disabled = false;

    static styles = [sessionButtonStyles];

    render() {
        return html`
            <button
                class="session-button"
                @click=${this._handleClick}
                title="Toggle chat history"
                ?disabled=${this.disabled}
                data-base-overlay-anchor
            >
                <span class="session-icon">${icons.history}</span>
            </button>
        `;
    }

    private _handleClick() {
        if (this.disabled) {
            return;
        }
        this.dispatchEvent(new CustomEvent("toggle-session-dropdown", { bubbles: true, composed: true }));
    }
}
