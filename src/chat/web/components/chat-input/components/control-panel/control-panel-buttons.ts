import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { AttachedContext } from "../../../../../../common/context-chat";
import { icons } from "../../../../../utils-front";
import "../context-search/context-search";
import type { ContextSearchResult } from "../context-search/context-search";
import "../prompt-gallery/prompt-gallery";
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

    @state() private autoAccept = false;
    @state() private showContextTree = false;
    @state() private showGallery = false;

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
                @click=${this._handleAutoAccept}
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
        return html`
            <button-cancel title="Cancel" @click=${() => emit(this, "cancel")}> ${icons.cancel} </button-cancel>
        `;
    }

    private _renderContextButton() {
        const hasContext = this.contexts.length > 0;
        return html`
            <button-context title="Add context" data-popup-anchor @click=${this._toggleContextTree}>
                ${icons.paperclip} ${hasContext ? html`<span class="context-badge">${this.contexts.length}</span>` : ""}
            </button-context>
            ${this.showContextTree
                ? html`<collama-context-search
                      autoShow
                      .results=${this.contextSearchResults}
                      .contexts=${this.contexts}
                      @popup-close=${() => (this.showContextTree = false)}
                      @context-search=${(e: CustomEvent) => emit(this, "context-search", { query: e.detail.query })}
                      @context-add-file=${(e: CustomEvent) => emit(this, "context-add-file", e.detail)}
                      @context-remove-file=${(e: CustomEvent) => {
                          const index = this.contexts.findIndex((ctx) => ctx.filePath === e.detail.filePath);
                          if (index !== -1) {
                              emit(this, "context-cleared", { index });
                          }
                      }}
                  ></collama-context-search>`
                : ""}
        `;
    }

    private _renderGallery() {
        return html`
            <button-gallery title="Open Prompt Gallery" data-popup-anchor @click=${() => (this.showGallery = true)}>
                ${icons.gallery}
            </button-gallery>
            ${this.showGallery
                ? html`<collama-prompt-gallery
                      autoShow
                      @popup-close=${() => (this.showGallery = false)}
                      @submit-prompt=${(e: CustomEvent) => {
                          emit(this, "submit-prompt", e.detail);
                      }}
                  ></collama-prompt-gallery>`
                : ""}
        `;
    }

    private _renderCompress() {
        return html`
            <button-compress title="Summarize conversation" @click=${() => emit(this, "summarize-conversation")}>
                ${icons.compress}
            </button-compress>
        `;
    }

    private _renderSubmit() {
        return html`
            <button-submit title="Submit" @click=${() => emit(this, "submit-click")}> ${icons.enter} </button-submit>
        `;
    }

    render() {
        if (this.isLoading) {
            return html`
                <button-row>
                    ${this._renderTokenCounter()} ${this._renderAutoAccept()} ${this._renderCancel()}
                </button-row>
            `;
        }

        return html`
            <button-row>
                ${this._renderContextButton()} ${this._renderGallery()} ${this._renderCompress()}
                ${this._renderAutoAccept()} ${this._renderSubmit()}
            </button-row>
        `;
    }
}
