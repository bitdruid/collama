import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { AttachedContext } from "../../../../../../common/context-chat";
import { icons } from "../../../../../utils-front";
import type { ContextSearchResult } from "../../../../types";
import "./clear-chat-confirm/clear-chat-confirm";
import { controlPanelButtonStyles } from "./styles";

function emit(el: HTMLElement, name: string, detail?: unknown) {
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

@customElement("collama-control-panel-buttons")
export class ControlPanelButtons extends LitElement {
    static styles = controlPanelButtonStyles;

    @property({ type: Array }) contexts: AttachedContext[] = [];
    @property({ type: Boolean }) isLoading = false;
    @property({ type: Number }) agentToken = 0;
    @property({ type: Boolean }) hasTokenData = false;
    @property({ type: Array }) contextSearchResults: ContextSearchResult[] = [];

    @property({ type: Boolean }) tempChat = false;

    @state() private autoAccept = false;
    @state() private showContextTree = false;
    @state() private showGallery = false;
    @state() private showClearConfirm = false;

    @query("collama-context-search")
    private contextSearch!: HTMLElement;

    @query("collama-prompt-gallery")
    private promptGallery!: HTMLElement;

    private handleAutoAccept = () => this._handleAutoAccept();
    private handleTempChat = () => emit(this, "temp-chat");
    private handleClearChat = () => (this.showClearConfirm = true);
    private handleClearChatConfirmed = () => emit(this, "clear-chat");
    private handleClearConfirmClose = () => (this.showClearConfirm = false);
    private handleToggleContextTree = () => this._toggleContextTree();
    private handleCancel = () => emit(this, "cancel");
    private handleToggleGallery = () => (this.showGallery = true);
    private handleSummarizeConversation = () => emit(this, "summarize-conversation");
    private handleSubmitClick = () => emit(this, "submit-click");
    private handlePopupClose = () => (this.showContextTree = false);
    private handleGalleryPopupClose = () => (this.showGallery = false);
    private handleContextSearch = (e: CustomEvent) => emit(this, "context-search", { query: e.detail.query });
    private handleContextAddFile = (e: CustomEvent) => emit(this, "context-add-file", e.detail);
    private handleContextRemoveFile = (e: CustomEvent) => {
        const index = this.contexts.findIndex((ctx) => ctx.filePath === e.detail.filePath);
        if (index !== -1) {
            emit(this, "context-cleared", { index });
        }
    };
    private handleSubmitPrompt = (e: CustomEvent) => emit(this, "submit-prompt", e.detail);

    private _handleAutoAccept() {
        this.autoAccept = !this.autoAccept;
        emit(this, "auto-accept", { enabled: this.autoAccept });
    }

    private _toggleContextTree() {
        this.showContextTree = true;
    }

    private _formatTokens(n: number): string {
        return n >= 1000 ? n.toLocaleString("de-DE") : String(n);
    }

    private _renderAutoAccept() {
        return html`
            <button-auto-accept
                title="Auto accept all edits"
                @click=${this.handleAutoAccept}
                ?active=${this.autoAccept}
            >
                ${this.autoAccept ? icons.alertTriangle : icons.checkCircle}
            </button-auto-accept>
        `;
    }

    private _renderTokenCounter() {
        if (!this.hasTokenData) {
            return "";
        }
        return html`
            <button-token-counter title="Agent token usage">
                ${this._formatTokens(this.agentToken)}
            </button-token-counter>
        `;
    }

    private _renderCancel() {
        return html` <button-cancel title="Cancel" @click=${this.handleCancel}> ${icons.x} </button-cancel> `;
    }

    private _renderContextButton() {
        const hasContext = this.contexts.length > 0;
        return html`
            <button-context title="Add context" data-popup-anchor @click=${this.handleToggleContextTree}>
                ${icons.paperclip} ${hasContext ? html`<span class="context-badge">${this.contexts.length}</span>` : ""}
            </button-context>
            ${this.showContextTree
                ? html`<collama-context-search
                      autoShow
                      .results=${this.contextSearchResults}
                      .contexts=${this.contexts}
                      @popup-close=${this.handlePopupClose}
                      @context-search=${this.handleContextSearch}
                      @context-add-file=${this.handleContextAddFile}
                      @context-remove-file=${this.handleContextRemoveFile}
                  ></collama-context-search>`
                : ""}
        `;
    }

    private _renderGallery() {
        return html`
            <button-gallery title="Open Prompt Gallery" data-popup-anchor @click=${this.handleToggleGallery}>
                ${icons.gallery}
            </button-gallery>
            ${this.showGallery
                ? html`<collama-prompt-gallery
                      autoShow
                      @popup-close=${this.handleGalleryPopupClose}
                      @submit-prompt=${this.handleSubmitPrompt}
                  ></collama-prompt-gallery>`
                : ""}
        `;
    }

    private _renderTempChat() {
        return html`
            <button-temp-chat
                title="Temporary chat (auto-deletes on switch)"
                @click=${this.handleTempChat}
                ?active=${this.tempChat}
            >
                ${icons.tempChat}
            </button-temp-chat>
        `;
    }

    private _renderClearChat() {
        return html`
            <button-clear-chat title="Clear conversation" data-popup-anchor @click=${this.handleClearChat}>
                ${icons.trash}
            </button-clear-chat>
            ${this.showClearConfirm
                ? html`<collama-clear-chat-confirm
                      autoShow
                      @popup-close=${this.handleClearConfirmClose}
                      @clear-chat-confirmed=${this.handleClearChatConfirmed}
                  ></collama-clear-chat-confirm>`
                : ""}
        `;
    }

    private _renderCompress() {
        return html`
            <button-compress title="Summarize conversation" @click=${this.handleSummarizeConversation}>
                ${icons.compress}
            </button-compress>
        `;
    }

    private _renderSubmit() {
        return html` <button-submit title="Submit" @click=${this.handleSubmitClick}> ${icons.enter} </button-submit> `;
    }

    render() {
        if (this.isLoading) {
            return html`
                <button-row>
                    <span class="spacer"></span>
                    ${this._renderTokenCounter()} ${this._renderAutoAccept()} ${this._renderCancel()}
                </button-row>
            `;
        }

        return html`
            <button-row>
                ${this._renderTempChat()} ${this._renderClearChat()}
                <span class="spacer"></span>
                ${this._renderContextButton()} ${this._renderGallery()} ${this._renderCompress()}
                ${this._renderAutoAccept()} ${this._renderSubmit()}
            </button-row>
        `;
    }
}
