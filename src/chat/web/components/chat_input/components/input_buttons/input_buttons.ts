import { LitElement, css, html } from "lit";
import { icons } from "../../../../../utils";
import { inputButtonsStyles } from "./styles";


export class ChatInputButtons extends LitElement {


  static styles = inputButtonsStyles;
    static get properties() {
        return {
            contexts: { type: Array },
            isLoading: { type: Boolean },
        };
    }

    contexts: any[] = [];
    isLoading = false;

    // Event Handlers
    private _handleCancel() {
        this.dispatchEvent(
            new CustomEvent("cancel", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleCompress() {
        this.dispatchEvent(
            new CustomEvent("compress", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleSubmit() {
        if (this.isLoading) {
            return;
        }
        this.dispatchEvent(
            new CustomEvent("submit", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _clearContext(index: number) {
        this.dispatchEvent(
            new CustomEvent("context-cleared", {
                detail: { index },
                bubbles: true,
                composed: true,
            }),
        );
    }

    // Render Methods
    private _renderContextButton() {
        if (this.contexts.length > 0) {
            return html`
                <div class="context-list">
                    ${this.contexts.map((ctx, index) => {
                        const label = ctx.hasSelection
                            ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})`
                            : ctx.fileName;
                        return html`
                            <span class="context-display" title="Context attached">
                                ${label}
                                <button
                                    class="context-close"
                                    @click=${() => this._clearContext(index)}
                                    title="Remove context"
                                >
                                    ×
                                </button>
                            </span>
                        `;
                    })}
                </div>
            `;
        }
        return html`<button-context title="Add context"> ${icons.paperclip} </button-context>`;
    }

    private _renderActionButtons() {
        if (this.isLoading) {
            return html`
                <button-cancel title="Cancel" @click=${this._handleCancel}>
                    ${icons.cancel}
                </button-cancel>
            `;
        }
        return html`
            <button-compress title="Compress chat" @click=${this._handleCompress}>
                ${icons.compress}
            </button-compress>
            <button-submit title="Submit" @click=${this._handleSubmit} ?disabled=${this.isLoading}>
                ${icons.enter}
            </button-submit>
        `;
    }

    render() {
        return html`
            <button-row>
                ${this._renderContextButton()}
                ${this._renderActionButtons()}
            </button-row>
        `;
    }
}

customElements.define("collama-chatinput-buttons", ChatInputButtons);
