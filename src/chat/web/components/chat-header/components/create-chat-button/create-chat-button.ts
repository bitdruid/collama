import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../../../styles/theme-icons";
import { createChatButtonStyles } from "./styles";

export type CreateChatButtonKind = "normal" | "ghost";

@customElement("collama-create-chat-button")
export class CreateChatButton extends LitElement {
    @property({ type: String }) kind: CreateChatButtonKind = "normal";
    @property({ type: Boolean }) disabled = false;

    static styles = [createChatButtonStyles];

    render() {
        const isGhost = this.kind === "ghost";
        return html`
            <button
                class="icon-button create-chat-button ${isGhost ? "ghost" : "normal"}"
                @click=${this._handleClick}
                title=${isGhost ? "New Temporary Chat" : "New Chat"}
                ?disabled=${this.disabled}
            >
                ${isGhost ? icons.ghostChat : icons.plus}
            </button>
        `;
    }

    private _handleClick() {
        if (this.disabled) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent(this.kind === "ghost" ? "new-ghost-chat" : "new-chat", {
                bubbles: true,
                composed: true,
            }),
        );
    }
}
