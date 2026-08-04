import { html, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import type { AttachedContext } from "../../../../../../../common/context-chat";
import { themeIcons } from "../../../../../styles";
import { BasePopup } from "../../../../../template-components/popup/base-popup";
import { basePopupStyles } from "../../../../../template-components/popup/styles";
import type { ContextSearchResult } from "../../../../../../shared";
import { emit, samePath } from "../../../../utils";
import { contextSearchStyles } from "./styles";

/**
 * Searches workspace files and folders and reports which row the user picked. Adding, removing
 * and any text handling are the host's business - this component only lists and highlights.
 *
 * @element collama-context-search
 * @fires context-search - Dispatched when a search query is submitted (debounced).
 * @fires context-pick - Dispatched with `{ relativePath, isFolder, isAdded }` when a row is chosen.
 * @fires overlay-close - Dispatched (via BasePopup) when the overlay closes.
 */
@customElement("collama-context-search")
export class ContextSearch extends BasePopup {
    static styles = [basePopupStyles, contextSearchStyles];

    /** List of search results to display. */
    @property({ type: Array }) results: ContextSearchResult[] = [];
    /** Array of attached contexts (single source of truth). */
    @property({ type: Array }) contexts: AttachedContext[] = [];
    /** Current search query text. */
    @property({ type: String }) searchQuery = "";
    /** Inline mode: no own search bar and no focus steal - the host drives the query and keys. */
    @property({ type: Boolean }) inline = false;

    /** Index of the keyboard-highlighted row within {@link _visibleResults}. */
    @state() private activeIndex = 0;

    private _searchTimer: number | null = null;

    @query("input")
    private searchInput!: HTMLInputElement;

    /**
     * Handles search input events with a 200ms debounce. The raw value is kept so typing a
     * space isn't undone by the `.value` binding; only the outgoing query is trimmed.
     * @param e - The input event.
     */
    private _handleSearchInput(e: Event) {
        this.searchQuery = (e.target as HTMLInputElement).value;
        const query = this.searchQuery.trim();
        if (this._searchTimer !== null) {
            clearTimeout(this._searchTimer);
        }
        this._searchTimer = window.setTimeout(() => {
            this._searchTimer = null;
            emit(this, "context-search", { query });
        }, 200);
    }

    /**
     * Clears the search query.
     */
    private _handleClearSearch() {
        this.searchQuery = "";
        emit(this, "context-search", { query: "" });
        requestAnimationFrame(() => {
            this.searchInput?.focus();
        });
    }

    /**
     * Reports the picked row. Whether that adds, removes or also edits the prompt text is the
     * host's call - `isAdded` tells it which state the row is in.
     * @param result - The picked search result.
     */
    private _handlePick(result: ContextSearchResult) {
        emit(this, "context-pick", {
            relativePath: result.relativePath,
            isFolder: result.isFolder,
            isAdded: this.contexts.some((ctx) => samePath(ctx.relativePath, result.relativePath)),
        });
    }

    /**
     * Arrow keys move the highlight, Enter adds the highlighted row (BasePopup handles Escape).
     * @param e - The keyboard event.
     */
    private _handleInputKeyDown(e: KeyboardEvent) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            this.moveActive(e.key === "ArrowDown" ? 1 : -1);
            return;
        }
        if (e.key === "Enter") {
            e.stopPropagation();
            e.preventDefault();
            this.confirmActive();
        }
    }

    /** The rows currently on screen: search hits while querying, else the already-added context. */
    private _visibleResults(): ContextSearchResult[] {
        return this.searchQuery ? this.results : this.contexts.map((ctx) => this._attachedContextToSearchResult(ctx));
    }

    /** Moves the highlight by `delta`, wrapping at both ends. Public so an inline host can drive it. */
    moveActive(delta: number) {
        const count = this._visibleResults().length;
        if (count === 0) {
            return;
        }
        this.activeIndex = (this.activeIndex + delta + count) % count;
        this.updateComplete.then(() => {
            this.renderRoot.querySelector(".result-item.active")?.scrollIntoView({ block: "nearest" });
        });
    }

    /** Picks the highlighted row. Returns false when there is nothing highlighted. */
    confirmActive(): boolean {
        const result = this._visibleResults()[this.activeIndex];
        if (!result) {
            return false;
        }
        this._handlePick(result);
        return true;
    }

    override willUpdate(changedProperties: Map<PropertyKey, unknown>) {
        // a new result set invalidates the old highlight - always start at the best match
        if (changedProperties.has("results") || changedProperties.has("searchQuery")) {
            this.activeIndex = 0;
        }
    }

    override firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);
        if (this.inline) {
            return;
        }
        requestAnimationFrame(() => {
            this.searchInput?.focus();
        });
    }

    override disconnectedCallback() {
        super.disconnectedCallback();
        if (this._searchTimer !== null) {
            clearTimeout(this._searchTimer);
        }
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
            relativePath: ctx.relativePath,
            isFolder: ctx.isFolder,
        };
    }

    protected override renderContent(): TemplateResult {
        // one list drives both the rendering and the highlight, so they cannot index differently
        const rows = this._visibleResults();
        return html`
            ${this.inline ? "" : this._renderSearchBar()}
            <div class="results">
                ${!this.searchQuery && rows.length
                    ? html`<div class="added-context-header">Added Context (${rows.length})</div>`
                    : ""}
                ${rows.length
                    ? rows.map((r, i) => this._renderResult(r, i))
                    : html`<div class="empty-state">
                          ${this.searchQuery ? "No results found" : "Type to search workspace files"}
                      </div>`}
            </div>
        `;
    }

    private _renderSearchBar(): TemplateResult {
        return html`
            <div class="search-bar">
                <input
                    type="text"
                    .value=${this.searchQuery}
                    placeholder="Search files and folders..."
                    @input=${this._handleSearchInput}
                    @keydown=${this._handleInputKeyDown}
                />
                ${this.searchQuery
                    ? html`
                          <button class="clear-btn" @click=${this._handleClearSearch} title="Clear search">
                              ${themeIcons.x.medium}
                          </button>
                      `
                    : ""}
            </div>
        `;
    }

    /**
     * Renders a single result item.
     * @param result - The result to render.
     * @returns A template result for the item.
     */
    private _renderResult(result: ContextSearchResult, index: number) {
        const isAdded = this.contexts.some((ctx) => samePath(ctx.relativePath, result.relativePath));
        return html`
            <div
                class="result-item ${index === this.activeIndex ? "active" : ""}"
                @click=${() => this._handlePick(result)}
            >
                <div class="result-info">
                    <span class="result-name">
                        ${result.isFolder ? html`<span class="folder-icon">${themeIcons.folder.medium}</span>` : ""}
                        ${result.fileName}
                    </span>
                    <span class="result-path">${result.relativePath}</span>
                </div>
                <button
                    class="add-btn ${isAdded ? "added" : ""}"
                    title=${isAdded ? "Remove from context" : "Add as context"}
                >
                    ${isAdded ? themeIcons.check.medium : themeIcons.plus.medium}
                </button>
            </div>
        `;
    }

}
