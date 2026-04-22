import { html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { buildOpenFileCommandUri } from "../../../../utils-front";
import type { ToolConfirmRequest } from "../../../types";
import { BaseModal } from "../../template-components/modal/base-modal";
import { toolConfirmStyles } from "./styles";

@customElement("collama-tool-confirm-modal")
export class ToolConfirmModal extends BaseModal {
    static override styles = [...BaseModal.styles, toolConfirmStyles];

    @property({ type: Object }) request: ToolConfirmRequest | null = null;
    @state() private _showCancelInput = false;
    @state() private _cancelReason = "";

    @query(".cancel-input")
    private cancelInput!: HTMLInputElement;

    private handleAccept = () => this._accept();
    private handleAcceptAll = () => this._acceptAll();
    private handleCancel = () => this._cancel();
    private handleSendCancel = () => this._sendCancel();
    private handleCancelInput = (e: Event) => (this._cancelReason = (e.target as HTMLInputElement).value);
    private handleCancelKeyDown = (e: KeyboardEvent) => this._cancelKeyDown(e);

    constructor() {
        super();
        this.title = "Tool Confirmation";
        this.closeOnOutsideClick = false;
    }

    override close() {
        if (!this.request) {
            super.close();
            return;
        }
        this._sendCancel();
    }

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
            this.cancelInput?.focus();
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
            e.preventDefault();
            this._showCancelInput = false;
            this._cancelReason = "";
        }
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

    protected override renderContent() {
        if (!this.request) {
            return html``;
        }

        return html`
            <div class="confirm-content">
                <div class="confirm-summary">
                    <span class="confirm-action"><b>${this.request.action}</b></span>
                    <a
                        class="confirm-filepath"
                        href="${buildOpenFileCommandUri(this.request.filePath)}"
                        title="${this.request.filePath}"
                        >${this.request.filePath}</a
                    >
                </div>

                ${this._showCancelInput
                    ? html`
                          <div class="cancel-input-row">
                              <input
                                  class="cancel-input"
                                  type="text"
                                  placeholder="What should the agent do instead?"
                                  .value=${this._cancelReason}
                                  @input=${this.handleCancelInput}
                                  @keydown=${this.handleCancelKeyDown}
                              />
                              <button class="btn-send" @click=${this.handleSendCancel}>Send</button>
                          </div>
                      `
                    : null}

                <div class="confirm-buttons">
                    <button class="confirm-btn btn-accept" @click=${this.handleAccept}>Accept</button>
                    <button class="confirm-btn btn-accept-all" @click=${this.handleAcceptAll}>Accept All</button>
                    <button class="confirm-btn btn-cancel" @click=${this.handleCancel}>Cancel</button>
                </div>
            </div>
        `;
    }
}
