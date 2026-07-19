import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeIcons } from "../../../../../styles";
import { toggleChatTypeButtonStyles } from "./styles";

/** Toggles the active session between temp (ghost) and stored, pulses while temp. */
@customElement("collama-toggle-chat-button")
export class ToggleChatTypeButton extends LitElement {
    @property({ type: Boolean }) disabled = false;
    @property({ type: Boolean, reflect: true }) pulse = false;

    static styles = [toggleChatTypeButtonStyles];

    render() {
        return html`
            <button
                class="icon-button toggle-chat-type-button"
                @click=${this._handleClick}
                title=${this.pulse ? "Convert to stored chat" : "Convert to temp chat"}
                ?disabled=${this.disabled}
            >
                ${themeIcons.ghostChat.large}
            </button>
        `;
    }

    private _handleClick() {
        if (this.disabled) {
            return;
        }
        this.dispatchEvent(new CustomEvent("toggle-ghost", { bubbles: true, composed: true }));
    }
}
