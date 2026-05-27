import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeIcons } from "../../../../../styles";
import { chatTransferButtonStyles } from "./styles";

export type ChatTransferMode = "import" | "export";

/**
 * Header button for moving chats in/out as JSON files. `import` pulls a chat
 * into the app (download icon); `export` sends the active chat out (upload icon).
 */
@customElement("collama-chat-transfer-button")
export class ChatTransferButton extends LitElement {
    @property({ type: String }) mode: ChatTransferMode = "import";
    @property({ type: Boolean }) disabled = false;

    static styles = [chatTransferButtonStyles];

    render() {
        const isImport = this.mode === "import";
        return html`
            <button
                class="icon-button transfer-button"
                @click=${this._handleClick}
                title=${isImport ? "Import chat from file" : "Export chat to file"}
                ?disabled=${this.disabled}
            >
                ${isImport ? themeIcons.download.large : themeIcons.upload.large}
            </button>
        `;
    }

    private _handleClick() {
        if (this.disabled) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent(this.mode === "import" ? "import-session" : "export-session", {
                bubbles: true,
                composed: true,
            }),
        );
    }
}
