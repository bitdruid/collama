import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "../../../chat-modal/chat-modal";
import { toolConfirmStyles } from "./styles";

export interface ToolConfirmRequest {
    id: string;
    action: string;
    filePath: string;
}

/**
 * Tool confirmation modal that shows Accept / Accept All / Cancel buttons.
 * Cancel reveals an input line for the user to send a rejection reason to the LLM.
 *
 * Usage:
 * ```html
 * <collama-tool-confirm
 *     .request=${this.pendingConfirm}
 *     @tool-confirm-accept=${handler}
 *     @tool-confirm-accept-all=${handler}
 *     @tool-confirm-cancel=${handler}
 * ></collama-tool-confirm>
 * ```
 */
@customElement("collama-tool-confirm")
export class ToolConfirm extends LitElement {
    static styles = toolConfirmStyles;

    @property({ type: Object }) request: ToolConfirmRequest | null = null;
    @state() private _showCancelInput = false;
    @state() private _cancelReason = "";

    private _accept() {
        this._emit("tool-confirm-accept");
    }

    private _acceptAll() {
        this._emit("tool-confirm-accept-all");
    }

    private _cancel() {
        if (this._showCancelInput) {
            this._sendCancel();
            return;
        }
        this._showCancelInput = true;
        this.updateComplete.then(() => {
            this.shadowRoot?.querySelector<HTMLInputElement>(".cancel-input")?.focus();
        });
    }

    private _sendCancel() {
        const trimmedReason = this._cancelReason.trim();
        const reason = trimmedReason
            ? `Action canceled by user. Reason: ${trimmedReason}`
            : "The user canceled this action.";
        this.dispatchEvent(
            new CustomEvent("tool-confirm-cancel", {
                detail: { id: this.request?.id, reason },
                bubbles: true,
                composed: true,
            }),
        );
        this._reset();
    }

    private _cancelKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            this._sendCancel();
        }
        if (e.key === "Escape") {
            this._showCancelInput = false;
            this._cancelReason = "";
        }
    }

    private _onModalClose() {
        this._sendCancel();
    }

    private _emit(eventName: string) {
        this.dispatchEvent(
            new CustomEvent(eventName, {
                detail: { id: this.request?.id },
                bubbles: true,
                composed: true,
            }),
        );
        this._reset();
    }

    private _reset() {
        this._showCancelInput = false;
        this._cancelReason = "";
    }

    render() {
        const open = this.request !== null;

        return html`
            <collama-chat-modal .open=${open} @modal-close=${this._onModalClose}>
                ${this.request
                    ? html`
                          <div class="confirm-header">
                              <h3>Tool Confirmation</h3>
                              <span class="confirm-action">${this.request.action}</span>
                          </div>

                          <div class="confirm-filepath">${this.request.filePath}</div>

                          ${this._showCancelInput
                              ? html`
                                    <div class="cancel-input-row">
                                        <input
                                            class="cancel-input"
                                            type="text"
                                            placeholder="What should the agent do instead?"
                                            .value=${this._cancelReason}
                                            @input=${(e: Event) =>
                                                (this._cancelReason = (e.target as HTMLInputElement).value)}
                                            @keydown=${this._cancelKeyDown}
                                        />
                                        <button class="btn-send" @click=${this._sendCancel}>Send</button>
                                    </div>
                                `
                              : null}

                          <div class="confirm-buttons">
                              <button class="confirm-btn btn-accept" @click=${this._accept}>Accept</button>
                              <button class="confirm-btn btn-accept-all" @click=${this._acceptAll}>Accept All</button>
                              <button class="confirm-btn btn-cancel" @click=${this._cancel}>Cancel</button>
                          </div>
                      `
                    : null}
            </collama-chat-modal>
        `;
    }
}
