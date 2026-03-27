import { html, LitElement } from "lit";
import { contextTreeStyles } from "./styles";

/**
 * Represents a single search result item.
 */
export interface ContextSearchResult {
    /** The name of the file or folder. */
    fileName: string;
    /** The absolute path to the file or folder. */
    filePath: string;
    /** The relative path of the file or folder from the workspace root. */
    relativePath: string;
    /** Flag indicating if the result is a folder. */
    isFolder: boolean;
}

/**
 * Helper function to dispatch a custom event.
 * @param el - The element from which to dispatch the event.
 * @param name - The name of the custom event.
 * @param detail - Optional detail data to include with the event.
 */
function emit(el: HTMLElement, name: string, detail?: unknown) {
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

/**
 * A context tree component for searching and adding workspace files.
 *
 * @element collama-context-search
 * @fires context-search - Dispatched when a search query is submitted (debounced).
 * @fires context-add-file - Dispatched when a file or folder is added to the context.
 * @fires context-search-close - Dispatched when the component requests to be closed.
 */
export class ContextTree extends LitElement {
    static styles = contextTreeStyles;

    static get properties() {
        return {
            results: { type: Array },
            addedPaths: { type: Object },
            searchQuery: { type: String },
        };
    }

    /** List of search results to display. */
    results: ContextSearchResult[] = [];
    /** Set of file paths currently added to the context. */
    addedPaths: Set<string> = new Set();
    /** Current search query text. */
    searchQuery = "";

    private _searchTimer: number | null = null;
    private _handleDocumentClick: ((e: MouseEvent) => void) | null = null;

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
            emit(this, "context-search", { query });
        }, 200);
    }

    /**
     * Handles adding a file or folder to the context.
     * @param result - The search result to add.
     */
    private _handleAdd(result: ContextSearchResult) {
        if (this.addedPaths.has(result.filePath)) {
            // Remove the file from context
            this.addedPaths = new Set([...this.addedPaths].filter((p) => p !== result.filePath));
            emit(this, "context-remove-file", { filePath: result.filePath });
        } else {
            // Add the file to context
            this.addedPaths = new Set([...this.addedPaths, result.filePath]);
            emit(this, "context-add-file", { filePath: result.filePath, isFolder: result.isFolder });
        }
    }

    /**
     * Handles keyboard events.
     * Prevents Enter from propagating and closes the component on Escape.
     * @param e - The keyboard event.
     */
    private _handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.stopPropagation();
        }
        if (e.key === "Escape") {
            emit(this, "context-search-close");
        }
    }

    /**
     * Overrides LitElement to set up a document-level click listener.
     * Closes the component if the user clicks outside of it, ignoring clicks
     * on the toggle button. Uses the capture phase to ensure the event is caught early.
     */
    connectedCallback() {
        super.connectedCallback();
        this._handleDocumentClick = (e: MouseEvent) => {
            const path = e.composedPath();
            if (!path.includes(this)) {
                const isToggleButton = path.some((el) => el instanceof HTMLElement && el.tagName === "BUTTON-CONTEXT");
                if (!isToggleButton) {
                    emit(this, "context-search-close");
                }
            }
        };
        document.addEventListener("click", this._handleDocumentClick, { capture: true });
    }

    /**
     * Overrides LitElement to clean up the document click listener.
     * Prevents memory leaks by removing the event listener when the element is removed from the DOM.
     */
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._handleDocumentClick) {
            document.removeEventListener("click", this._handleDocumentClick, { capture: true });
            this._handleDocumentClick = null;
        }
    }

    /**
     * Overrides LitElement to focus the search input field after the first render.
     */
    firstUpdated() {
        const input = this.shadowRoot?.querySelector("input");
        input?.focus();
    }

    /**
     * Renders a single result item.
     * @param result - The result to render.
     * @returns A template result for the item.
     */
    private _renderResult(result: ContextSearchResult) {
        const isAdded = this.addedPaths.has(result.filePath);
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

    render() {
        return html`
            <div class="tree-popup">
                <div class="search-bar">
                    <input
                        type="text"
                        .value=${this.searchQuery}
                        placeholder="Search files and folders..."
                        @input=${this._handleSearchInput}
                        @keydown=${this._handleKeyDown}
                    />
                </div>
                <div class="results">
                    ${this.results.length > 0
                        ? this.results.map((r) => this._renderResult(r))
                        : html`<div class="empty-state">Type to search workspace files</div>`}
                </div>
            </div>
        `;
    }
}

customElements.define("collama-context-search", ContextTree);
