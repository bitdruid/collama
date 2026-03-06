import { LitElement, css, html } from "lit";
import { editStyles } from "./styles/edit_styles";

export class ChatEditMessage extends LitElement {
    firstUpdated() {
        const textarea = this.shadowRoot?.querySelector(".edit-textarea") as HTMLTextAreaElement;
        if (textarea) {
            // Focus immediately when edit starts
            textarea.focus();
            // Close edit view when focus is lost
            textarea.addEventListener("blur", () => this._handleCancel());
        }
    }
    static properties = {
        content: { type: String },
        messageIndex: { type: Number },
    };

    static styles = editStyles;

    content: string = "";
    messageIndex: number = 0;

    private _handleSend() {
        const textarea = this.shadowRoot?.querySelector(".edit-textarea") as HTMLTextAreaElement;
        if (!textarea) {
            return;
        }
        const newContent = textarea.value.trim();
        if (!newContent) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent("edit-send", {
                detail: { messageIndex: this.messageIndex, newContent },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleCancel() {
        this.dispatchEvent(
            new CustomEvent("edit-cancel", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    render() {
        return html`
            <textarea class="edit-textarea">${this.content}</textarea>
            <div class="edit-actions">
                <button class="edit-cancel" @click=${() => this._handleCancel()}>Cancel</button>
                <button class="edit-send" @click=${() => this._handleSend()}>Send</button>
            </div>
        `;
    }
}

customElements.define("collama-chatedit", ChatEditMessage);
