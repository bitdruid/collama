import { LitElement, css, html } from "lit";

export class ChatEditMessage extends LitElement {
    static properties = {
        content: { type: String },
        messageIndex: { type: Number },
    };

    static styles = css`
        :host {
            display: block;
        }

        .edit-textarea {
            width: 100%;
            min-height: 60px;
            padding: 8px;
            margin-top: 4px;
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 4px;
            background: var(--vscode-input-background, #1e1e1e);
            color: var(--vscode-input-foreground, #ccc);
            font-family: inherit;
            font-size: 13px;
            resize: vertical;
            box-sizing: border-box;
        }

        .edit-textarea:focus {
            outline: 1px solid var(--vscode-focusBorder, #007fd4);
        }

        .edit-actions {
            display: flex;
            gap: 6px;
            margin-top: 6px;
            justify-content: flex-end;
        }

        .edit-send {
            padding: 4px 12px;
            border: none;
            border-radius: 4px;
            background: #2277a8;
            color: #fff;
            font-size: 12px;
            cursor: pointer;
        }

        .edit-send:hover {
            background: #1b6090;
        }

        .edit-cancel {
            padding: 4px 12px;
            border: 1px solid var(--vscode-input-border, #3c3c3c);
            border-radius: 4px;
            background: transparent;
            color: var(--vscode-foreground, #ccc);
            font-size: 12px;
            cursor: pointer;
        }

        .edit-cancel:hover {
            background: rgba(255, 255, 255, 0.1);
        }
    `;

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
