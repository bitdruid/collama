import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { AttachedContext } from "../../../../../../../common/context-chat";
import { type ContextSearchResult } from "../../../../../../shared";
import "../../../../../template-components/button";
import "./clear-chat-confirm/clear-chat-confirm";
import "./convert-ghost-confirm/convert-ghost-confirm";
import { controlPanelButtonStyles } from "./styles";

function emit(el: HTMLElement, name: string, detail?: unknown) {
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

@customElement("collama-control-panel-buttons")
export class ControlPanelButtons extends LitElement {
    static styles = controlPanelButtonStyles;

    @property({ type: Array }) contexts: AttachedContext[] = [];
    @property({ type: Boolean }) isGenerating = false;
    @property({ type: Boolean }) isSummarizing = false;
    @property({ type: Number }) agentToken = 0;
    @property({ type: Boolean }) hasTokenData = false;
    @property({ type: Boolean }) isGhost = false;
    @property({ type: Array }) contextSearchResults: ContextSearchResult[] = [];

    @property({ type: Boolean }) autoAccept = false;
    @property({ type: Boolean }) hasInput = false;
    @state() private showContextTree = false;
    @state() private showGallery = false;
    @state() private showClearConfirm = false;
    @state() private showConvertGhostConfirm = false;
    @state() private agentDuration = 0;
    private _durationInterval: number | null = null;

    @query("collama-context-search")
    private contextSearch!: HTMLElement;

    @query("collama-prompt-gallery")
    private promptGallery!: HTMLElement;

    private handleAutoAccept = () => this._handleAutoAccept();
    private handleConvertToGhost = () => {
        if (this.isGenerating) {
            return;
        }
        if (this.isGhost) {
            emit(this, "convert-to-ghost");
        } else {
            this.showConvertGhostConfirm = true;
        }
    };
    private handleConvertGhostConfirmed = () => emit(this, "convert-to-ghost");
    private handleConvertGhostClose = () => (this.showConvertGhostConfirm = false);
    private handleClearChat = () => {
        if (this.isGenerating) {
            return;
        }
        this.showClearConfirm = true;
    };
    private handleClearChatConfirmed = () => emit(this, "clear-chat");
    private handleClearConfirmClose = () => (this.showClearConfirm = false);
    private handleToggleContextTree = () => this._toggleContextTree();
    private handleCancel = () => {
        if (this.isSummarizing) {
            return;
        }
        emit(this, "cancel");
    };
    private handleToggleGallery = () => (this.showGallery = true);
    private handleSummarizeConversation = () => {
        if (this.isGenerating) {
            return;
        }
        emit(this, "summarize-conversation");
    };
    private handleSubmitClick = () => emit(this, "submit-click");
    private handlePopupClose = () => (this.showContextTree = false);
    private handleGalleryPopupClose = () => (this.showGallery = false);
    private handleContextSearch = (e: CustomEvent) => emit(this, "context-search", { query: e.detail.query });
    private handleContextAdd = (e: CustomEvent) => emit(this, "context-add", e.detail);
    private handleContextRemoveFile = (e: CustomEvent) => {
        const index = this.contexts.findIndex((ctx) => ctx.relativePath === e.detail.relativePath);
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

    override willUpdate(changedProperties: Map<PropertyKey, unknown>) {
        if (changedProperties.has("isGenerating")) {
            if (this._durationInterval) {
                clearInterval(this._durationInterval);
            }
            if (this.isGenerating) {
                this.agentDuration = 0;
                this._durationInterval = window.setInterval(() => this.agentDuration++, 1000);
            } else {
                this._durationInterval = null;
            }
        }
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        if (this._durationInterval) {
            clearInterval(this._durationInterval);
        }
    }

    private _renderAutoAccept() {
        return html`
            <collama-auto-accept-button
                ?active=${this.autoAccept}
                @action=${this.handleAutoAccept}
            ></collama-auto-accept-button>
        `;
    }

    private _renderTokenCounter() {
        if (!this.hasTokenData) {
            return "";
        }
        return html` <collama-token-counter .value=${this.agentToken}></collama-token-counter> `;
    }

    private _renderDurationCounter() {
        return html` <collama-duration-counter .value=${this.agentDuration}></collama-duration-counter> `;
    }

    private _renderCancel() {
        return html`
            <collama-input-cancel-button ?disabled=${this.isSummarizing} @action=${this.handleCancel}></collama-cancel-button>
        `;
    }

    private _renderContextButton() {
        return html`
            <collama-context-button
                data-base-overlay-anchor
                .badge=${this.contexts.length}
                @action=${this.handleToggleContextTree}
            ></collama-context-button>
            ${this.showContextTree
                ? html`<collama-context-search
                      autoShow
                      .results=${this.contextSearchResults}
                      .contexts=${this.contexts}
                      @overlay-close=${this.handlePopupClose}
                      @context-search=${this.handleContextSearch}
                      @context-add=${this.handleContextAdd}
                      @context-remove-file=${this.handleContextRemoveFile}
                  ></collama-context-search>`
                : ""}
        `;
    }

    private _renderGallery() {
        return html`
            <collama-gallery-button
                data-base-overlay-anchor
                @action=${this.handleToggleGallery}
            ></collama-gallery-button>
            ${this.showGallery
                ? html`<collama-prompt-gallery
                      autoShow
                      @overlay-close=${this.handleGalleryPopupClose}
                      @submit-prompt=${this.handleSubmitPrompt}
                  ></collama-prompt-gallery>`
                : ""}
        `;
    }

    private _renderGhostChat() {
        return html`
            <collama-ghost-chat-button
                data-base-overlay-anchor
                ?active=${this.isGhost}
                ?disabled=${this.isGenerating}
                @action=${this.handleConvertToGhost}
            ></collama-ghost-chat-button>
            ${this.showConvertGhostConfirm
                ? html`<collama-convert-ghost-confirm
                      autoShow
                      @overlay-close=${this.handleConvertGhostClose}
                      @convert-ghost-confirmed=${this.handleConvertGhostConfirmed}
                  ></collama-convert-ghost-confirm>`
                : ""}
        `;
    }

    private _renderClearChat() {
        return html`
            <collama-clear-chat-button
                data-base-overlay-anchor
                ?disabled=${this.isGenerating}
                @action=${this.handleClearChat}
            ></collama-clear-chat-button>
            ${this.showClearConfirm
                ? html`<collama-clear-chat-confirm
                      autoShow
                      @overlay-close=${this.handleClearConfirmClose}
                      @clear-chat-confirmed=${this.handleClearChatConfirmed}
                  ></collama-clear-chat-confirm>`
                : ""}
        `;
    }

    private _renderCompress() {
        return html`
            <collama-compress-button
                ?disabled=${this.isGenerating}
                @action=${this.handleSummarizeConversation}
            ></collama-compress-button>
        `;
    }

    private _renderSubmit() {
        return html` <collama-submit-button @action=${this.handleSubmitClick}></collama-submit-button> `;
    }

    private _renderIntercept() {
        return html` <collama-intercept-button @action=${this.handleSubmitClick}></collama-intercept-button> `;
    }

    /**
     * Rightmost action button morphs by state: submit when idle, intercept while streaming with
     * text typed (queue it into the loop), otherwise cancel to stop the run.
     */
    private _renderActionButton() {
        if (!this.isGenerating) {
            return this._renderSubmit();
        }
        if (this.hasInput && !this.isSummarizing) {
            return this._renderIntercept();
        }
        return this._renderCancel();
    }

    render() {
        // One stable row in all states; unusable buttons are disabled/greyed rather than removed,
        // and the trailing action button morphs (submit ↔ cancel ↔ intercept).
        return html`
            <button-row>
                ${this._renderGhostChat()} ${this._renderClearChat()} <span class="spacer"></span>
                ${this.isGenerating ? html`${this._renderTokenCounter()} ${this._renderDurationCounter()}` : ""}
                ${this._renderContextButton()} ${this._renderGallery()} ${this._renderCompress()}
                ${this._renderAutoAccept()} ${this._renderActionButton()}
            </button-row>
        `;
    }
}
