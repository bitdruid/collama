import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeIcons } from "../../../../../styles";
import { createChatButtonStyles } from "./styles";

@customElement("collama-create-chat-button")
export class CreateChatButton extends LitElement {
    @property({ type: Boolean }) disabled = false;

    static styles = [createChatButtonStyles];

    render() {
        return html`
            <button
                class="icon-button create-chat-button"
                @click=${this._handleClick}
                title="New Chat"
                ?disabled=${this.disabled}
            >
                ${themeIcons.plus.large}
            </button>
        `;
    }

    private _handleClick() {
        if (this.disabled) {
            return;
        }
        this.dispatchEvent(new CustomEvent("new-chat", { bubbles: true, composed: true }));
    }
}
