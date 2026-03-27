import { html, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { AttachedContext } from "../../../../../../common/context-chat";
import { icons } from "../../../../../utils-front";
import "../context-search/context-search";
import type { ContextSearchResult } from "../context-search/context-search";
import { controlPanelButtonStyles } from "./styles";

function emit(el: HTMLElement, name: string, detail?: unknown) {
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

export class ControlPanelButtons extends LitElement {
    static styles = controlPanelButtonStyles;

    static get properties() {
        return {
            contexts: { type: Array },
            isLoading: { type: Boolean },
            agentToken: { type: Number },
            hasTokenData: { type: Boolean },
            contextSearchResults: { type: Array },
        };
    }

    @state() private autoAccept = false;
    @state() private showContextTree = false;
    @state() private searchQuery = "";

    contexts: AttachedContext[] = [];
    isLoading = false;
    agentToken = 0;
    hasTokenData = false;
    contextSearchResults: ContextSearchResult[] = [];

    private _handleAutoAccept() {
        this.autoAccept = !this.autoAccept;
        emit(this, "auto-accept", { enabled: this.autoAccept });
    }

    private _toggleContextTree() {
        this.showContextTree = !this.showContextTree;
        if (this.showContextTree) {
            this.searchQuery = "";
        }
    }

    private _closeContextTree() {
        this.showContextTree = false;
    }

    private _formatTokens(n: number): string {
        return n >= 1000 ? n.toLocaleString("de-DE") : String(n);
    }

    private _renderContexts() {
        const addedPaths = new Set(this.contexts.map((ctx) => ctx.filePath));
        return html`
            <div class="context-wrapper">
                ${this.showContextTree
                    ? html`<collama-context-search
                          .results=${this.contextSearchResults}
                          .addedPaths=${addedPaths}
                          .searchQuery=${this.searchQuery}
                          @context-search-close=${this._closeContextTree}
                          @context-search=${(e: CustomEvent) => {
                              this.searchQuery = e.detail.query;
                              emit(this, "context-search", { query: e.detail.query });
                          }}
                          @context-add-file=${(e: CustomEvent) => emit(this, "context-add-file", e.detail)}
                          @context-remove-file=${(e: CustomEvent) => {
                              const index = this.contexts.findIndex((ctx) => ctx.filePath === e.detail.filePath);
                              if (index !== -1) {
                                  emit(this, "context-cleared", { index });
                              }
                          }}
                      ></collama-context-search>`
                    : ""}
                <div class="added-contexts">
                    ${this.contexts.map((ctx, i) => {
                        const label = ctx.hasSelection
                            ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})`
                            : ctx.fileName;
                        return html`
                            <span class="context-display" title="Context attached">
                                ${label}
                                <button
                                    class="context-close"
                                    @click=${() => emit(this, "context-cleared", { index: i })}
                                    title="Remove context"
                                >
                                    ×
                                </button>
                            </span>
                        `;
                    })}
                </div>
            </div>
        `;
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
        return html`
            <button-context title="Add context" @click=${this._toggleContextTree}> ${icons.paperclip} </button-context>
        `;
    }

    private _renderGallery() {
        return html`
            <button-gallery title="Open Prompt Gallery" @click=${() => emit(this, "gallery-click")}>
                ${icons.gallery}
            </button-gallery>
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
            ${this._renderContexts()}
        `;
    }
}

customElements.define("collama-control-panel-buttons", ControlPanelButtons);
