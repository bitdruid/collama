import { html, TemplateResult } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import type { AttachedContext } from "../../../../../../common/context-chat";
import type { ContextSearchResult } from "../../../../types";
import { BasePopup } from "../../../template-components/popup/base-popup";
import { basePopupStyles } from "../../../template-components/popup/styles";
import { contextTreeStyles } from "./styles";

/**
 * A context tree component for searching and adding workspace files.
 *
 * @element collama-context-search
 * @fires context-search - Dispatched when a search query is submitted (debounced).
 * @fires context-add-file - Dispatched when a file or folder is added to the context.
 * @fires popup-close - Dispatched (via BasePopup) when the popup closes.
 */
@customElement("collama-context-search")
export class ContextTree extends BasePopup {
    static styles = [basePopupStyles, contextTreeStyles];

    /** List of search results to display. */
    @property({ type: Array }) results: ContextSearchResult[] = [];
    /** Array of attached contexts (single source of truth). */
    @property({ type: Array }) contexts: AttachedContext[] = [];
    /** Current search query text. */
    @property({ type: String }) searchQuery = "";

    private _searchTimer: number | null = null;

    @query("input")
    private searchInput!: HTMLInputElement;

    // Memoized event handlers
    private handleSearchInput = (e: Event) => this._handleSearchInput(e);
    private handleClearSearch = () => this._handleClearSearch();
    private handleInputKeyDown = (e: KeyboardEvent) => this._handleInputKeyDown(e);

    /**
     * Handles search input events with a 200ms debounce.
     * @param e - The input event.
     */
    private _handleSearchInput(e: Event) {
        const query = (e.target as HTMLInputElement).value.trim();
        this.searchQuery = query;
        if (this._searchTimer !== null) {
            clearTimeout(this._searchTimer);
        }
        this._searchTimer = window.setTimeout(() => {
            this._searchTimer = null;
            this.dispatchEvent(new CustomEvent("context-search", { detail: { query }, bubbles: true, composed: true }));
        }, 200);
    }

    /**
     * Clears the search query.
     */
    private _handleClearSearch() {
        this.searchQuery = "";
        this.dispatchEvent(new CustomEvent("context-search", { detail: { query: "" }, bubbles: true, composed: true }));
        requestAnimationFrame(() => {
            this.searchInput?.focus();
        });
    }

    /**
     * Handles adding a file or folder to the context.
     * @param result - The search result to add.
     */
    private _handleAdd(result: ContextSearchResult) {
        const existingIndex = this.contexts.findIndex((ctx) => ctx.filePath === result.filePath);
        if (existingIndex !== -1) {
            // Remove context
            this.dispatchEvent(
                new CustomEvent("context-remove-file", {
                    detail: { filePath: result.filePath },
                    bubbles: true,
                    composed: true,
                }),
            );
        } else {
            // Add context
            this.dispatchEvent(
                new CustomEvent("context-add-file", {
                    detail: { filePath: result.filePath, isFolder: result.isFolder },
                    bubbles: true,
                    composed: true,
                }),
            );
        }
    }

    /**
     * Prevents Enter from propagating (BasePopup handles Escape).
     * @param e - The keyboard event.
     */
    private _handleInputKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.stopPropagation();
        }
    }

    override firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);
        requestAnimationFrame(() => {
            this.searchInput?.focus();
        });
    }

    /**
     * Converts an AttachedContext to a ContextSearchResult.
     * @param ctx - The attached context to convert.
     * @returns A context search result.
     */
    private _attachedContextToSearchResult(ctx: AttachedContext): ContextSearchResult {
        // Format filename with line numbers if there's a selection
        const fileName = ctx.hasSelection ? `${ctx.fileName} (${ctx.startLine}-${ctx.endLine})` : ctx.fileName;

        return {
            fileName,
            filePath: ctx.filePath,
            relativePath: ctx.relativePath,
            isFolder: ctx.isFolder,
        };
    }

    protected override renderContent(): TemplateResult {
        return html`
            <div class="search-bar">
                <input
                    type="text"
                    .value=${this.searchQuery}
                    placeholder="Search files and folders..."
                    @input=${this.handleSearchInput}
                    @keydown=${this.handleInputKeyDown}
                />
                ${this.searchQuery
                    ? html` <button class="clear-btn" @click=${this.handleClearSearch} title="Clear search">✕</button> `
                    : ""}
            </div>
            <div class="results">
                ${this.searchQuery
                    ? this.results.length > 0
                        ? this.results.map((r) => this._renderResult(r))
                        : html`<div class="empty-state">No results found</div>`
                    : this._renderAddedContext()}
            </div>
        `;
    }

    /**
     * Renders a single result item.
     * @param result - The result to render.
     * @returns A template result for the item.
     */
    private _renderResult(result: ContextSearchResult) {
        const isAdded = this.contexts.some((ctx) => ctx.filePath === result.filePath);
        return html`
            <div class="result-item" @click=${() => this._handleAdd(result)}>
                <div class="result-info">
                    <span class="result-name">
                        ${result.isFolder ? html`<span class="folder-icon">&#128193;</span>` : ""} ${result.fileName}
                    </span>
                    <span class="result-path">${result.relativePath}</span>
                </div>
                <button
                    class="add-btn ${isAdded ? "added" : ""}"
                    title=${isAdded ? "Remove from context" : "Add as context"}
                >
                    ${isAdded ? "✓" : "+"}
                </button>
            </div>
        `;
    }

    /**
     * Renders the list of added context items.
     * @returns A template result for the added context list.
     */
    private _renderAddedContext(): TemplateResult {
        if (this.contexts.length === 0) {
            return html`<div class="empty-state">Type to search workspace files</div>`;
        }

        // Convert AttachedContext[] to ContextSearchResult[] on the fly
        const addedResults = this.contexts.map((ctx) => this._attachedContextToSearchResult(ctx));

        return html`
            <div class="added-context-header">Added Context (${this.contexts.length})</div>
            ${addedResults.map((r) => this._renderResult(r))}
        `;
    }
}
