import { LitElement, html } from "lit";
import { icons } from "../../../../../utils-front";
import { inputButtonsStyles } from "./styles";

export class ChatInputButtons extends LitElement {
    static styles = inputButtonsStyles;
    static get properties() {
        return {
            contexts: { type: Array },
            isLoading: { type: Boolean },
            autoAccept: { type: Boolean },
        };
    }

    contexts: any[] = [];
    isLoading = false;
    autoAccept = false;

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

    private _handleGalleryClick() {
        this.dispatchEvent(new CustomEvent("gallery-click"));
    }

    private _handleAutoAccept() {
        this.dispatchEvent(new CustomEvent("auto-accept"));
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

    private _renderGalleryButton() {
        return html`<button-gallery title="Open Prompt Gallery" @click=${this._handleGalleryClick}>
            ${icons.gallery}
        </button-gallery>`;
    }

    private _renderCompressButton() {
        return html`<button-compress title="Compress chat" @click=${this._handleCompress}>
            ${icons.compress}
        </button-compress>`;
    }

    private _renderAutoAcceptButton() {
        return html`<button-auto-accept
            title="Auto accept all edits"
            @click=${this._handleAutoAccept}
            ?active=${this.autoAccept}
        >
            ${this.autoAccept ? icons.alertTriangle : icons.checkCircle}
        </button-auto-accept>`;
    }

    private _renderSubmitButton() {
        return html`<button-submit title="Submit" @click=${this._handleSubmit} ?disabled=${this.isLoading}>
            ${icons.enter}
        </button-submit>`;
    }

    private _renderCancelButton() {
        return html`<button-cancel title="Cancel" @click=${this._handleCancel}> ${icons.cancel} </button-cancel>`;
    }

    render() {
        if (this.isLoading) {
            return html`
                <button-row>
                    ${this._renderAutoAcceptButton()}<!--
                    -->${this._renderCancelButton()}
                </button-row>
            `;
        }
        return html`
            <button-row>
                ${this._renderContextButton()}<!--
                -->${this._renderGalleryButton()}<!--
                -->${this._renderCompressButton()}<!--
                -->${this._renderAutoAcceptButton()}<!--
                -->${this._renderSubmitButton()}
            </button-row>
        `;
    }
}

customElements.define("collama-chatinput-buttons", ChatInputButtons);
