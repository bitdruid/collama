import { html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import type { ToolConfirmRequest } from "../../../../../shared";
import { themeIcons } from "../../../../styles";
import "../../../../template-components/banner";
import "../../../../template-components/button-box";
import "../../../../template-components/button-row";
import "../../../../template-components/text-box";
import { BaseModal } from "../../../../template-components/modal/base-modal";
import { buildOpenFileCommandUri } from "../../../utils";
import { toolConfirmStyles } from "./styles";

@customElement("collama-tool-confirm-modal")
export class ToolConfirmModal extends BaseModal {
    static override styles = [...BaseModal.styles, toolConfirmStyles];

    @property({ type: Object }) request: ToolConfirmRequest | null = null;
    @state() private _showCancelInput = false;
    @state() private _cancelReason = "";

    @query(".cancel-input")
    private cancelInput!: HTMLElement;

    private handleAccept = () => this._accept();
    private handleAcceptAll = () => this._acceptAll();
    private handleCancel = () => this._cancel();
    private handleSendCancel = () => this._sendCancel();
    private handleCancelInput = (e: CustomEvent<{ value: string }>) => (this._cancelReason = e.detail.value);
    private handleCancelDismiss = () => {
        this._showCancelInput = false;
        this._cancelReason = "";
    };

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

    protected override renderTitle() {
        if (!this.request) {
            return html`${this.title}`;
        }
        return html`<span class="confirm-action">${this.request.action}</span>`;
    }

    protected override renderHeaderExtra() {
        if (!this.request?.dangerous) {
            return html``;
        }
        return html`<collama-button-box
            variant="warning"
            .icon=${themeIcons.alertTriangle.medium}
            title="Check this shell command twice"
        ></collama-button-box>`;
    }

    protected override renderContent() {
        if (!this.request) {
            return html``;
        }

        return html`
            <div class="confirm-content">
                ${this.request.explanation
                    ? html`<collama-banner type="info" .description=${this.request.explanation}></collama-banner>`
                    : null}
                <a
                    class="confirm-filepath ${this.request.dangerous ? "danger" : ""}"
                    href="${buildOpenFileCommandUri(this.request.filePath)}"
                    title="${this.request.filePath}"
                    >${this.request.filePath}</a
                >

                ${this._showCancelInput
                    ? html`
                          <collama-textbox
                              class="cancel-input"
                              mode="input"
                              placeholder="What should the agent do instead?"
                              .value=${this._cancelReason}
                              @textbox-input=${this.handleCancelInput}
                              @textbox-submit=${this.handleSendCancel}
                              @textbox-cancel=${this.handleCancelDismiss}
                          ></collama-textbox>
                      `
                    : null}

                <collama-button-row>
                    <collama-accept-button title="Accept" @action=${this.handleAccept}></collama-accept-button>
                    <collama-accept-all-button
                        title="Accept All"
                        @action=${this.handleAcceptAll}
                    ></collama-accept-all-button>
                    <collama-cancel-button title="Cancel" @action=${this.handleCancel}></collama-cancel-button>
                    ${this._showCancelInput
                        ? html`
                              <collama-send-button
                                  title="Submit"
                                  ?disabled=${!this._cancelReason.trim()}
                                  @action=${this.handleSendCancel}
                              ></collama-send-button>
                          `
                        : null}
                </collama-button-row>
            </div>
        `;
    }
}
