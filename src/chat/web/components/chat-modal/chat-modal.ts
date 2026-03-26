import { LitElement, html } from "lit";
import { customElement, state } from "lit/decorators.js";
import "./error-modal/error-modal";
import { chatModalStyles } from "./styles";

/**
 * Simple modal box that sits in chat-area like chat-input.
 * Hidden by default. Call `showError(content)` to display error content.
 */
@customElement("collama-chat-modal")
export class ChatModal extends LitElement {
    static styles = chatModalStyles;

    @state() private _open = false;
    @state() private _visible = false;
    @state() private _errorContent = "";

    showError(content: string) {
        this._errorContent = content;
        this._open = true;
        // Small delay to trigger fade-in animation
        requestAnimationFrame(() => {
            this._visible = true;
        });
    }

    private _close() {
        this._visible = false;
        // Wait for fade-out animation to complete before hiding
        setTimeout(() => {
            this._open = false;
            this._errorContent = "";
        }, 200);
    }

    render() {
        if (!this._open) {
            return html``;
        }

        return html`
            <div class="modal-content ${this._visible ? "fade-in" : "fade-out"}">
                <div class="modal-header">
                    <h3>Agent Error</h3>
                    <span class="close-btn" @click=${this._close}>&#10006;</span>
                </div>
                <collama-error-modal .content=${this._errorContent} @modal-close=${this._close}></collama-error-modal>
            </div>
        `;
    }
}
