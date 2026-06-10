import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { AttachedContext } from "../../../../../../../common/context-chat";
import { themeIcons } from "../../../../../styles";
import { type ContextSearchResult } from "../../../../../../shared";
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

    private _formatTokens(n: number): string {
        return n >= 1000 ? n.toLocaleString("de-DE") : String(n);
    }

    private _formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
            <button-auto-accept
                title=${this.autoAccept ? "Turn off auto-accept edits" : "Turn on auto-accept edits"}
                @click=${this.handleAutoAccept}
                ?active=${this.autoAccept}
            >
                ${this.autoAccept ? themeIcons.alertTriangle.medium : themeIcons.circleCheckBig.medium}
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

    private _renderDurationCounter() {
        return html`
            <button-duration-counter title="Agent duration">
                ${this._formatDuration(this.agentDuration)}
            </button-duration-counter>
        `;
    }

    private _renderCancel() {
        return html`
            <button-cancel title="Cancel" ?disabled=${this.isSummarizing} @click=${this.handleCancel}>
                ${themeIcons.x.medium}
            </button-cancel>
        `;
    }

    private _renderContextButton() {
        const hasContext = this.contexts.length > 0;
        return html`
            <button-context title="Add context" data-base-overlay-anchor @click=${this.handleToggleContextTree}>
                ${themeIcons.paperclip.medium}
                ${hasContext ? html`<span class="button-badge">${this.contexts.length}</span>` : ""}
            </button-context>
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
            <button-gallery title="Open Prompt Gallery" data-base-overlay-anchor @click=${this.handleToggleGallery}>
                ${themeIcons.gallery.medium}
            </button-gallery>
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
            <button-ghost-chat
                title=${this.isGhost ? "Convert to stored chat" : "Convert to temp chat"}
                data-base-overlay-anchor
                ?active=${this.isGhost}
                ?disabled=${this.isGenerating}
                @click=${this.handleConvertToGhost}
            >
                ${themeIcons.ghostChat.medium}
            </button-ghost-chat>
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
            <button-clear-chat
                title="Clear conversation"
                data-base-overlay-anchor
                ?disabled=${this.isGenerating}
                @click=${this.handleClearChat}
            >
                ${themeIcons.trash.medium}
            </button-clear-chat>
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
            <button-compress
                title="Summarize conversation"
                ?disabled=${this.isGenerating}
                @click=${this.handleSummarizeConversation}
            >
                ${themeIcons.compress.medium}
            </button-compress>
        `;
    }

    private _renderSubmit() {
        return html`
            <button-submit title="Submit" @click=${this.handleSubmitClick}> ${themeIcons.enter.medium} </button-submit>
        `;
    }

    private _renderIntercept() {
        return html`
            <button-intercept title="Intercept with a follow-up message" @click=${this.handleSubmitClick}>
                ${themeIcons.betweenHorizontalStart.medium}
            </button-intercept>
        `;
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
