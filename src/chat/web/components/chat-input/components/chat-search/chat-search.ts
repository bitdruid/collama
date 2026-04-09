import { html } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { icons } from "../../../../../utils-front";
import { BaseModal } from "../../../template-components/modal/base-modal";
import { baseModalStyles } from "../../../template-components/modal/styles";
import { chatSearchStyles } from "./styles";

export interface SearchResult {
    messageIndex: number;
    messageId: string;
}

function emit(el: HTMLElement, name: string, detail?: unknown) {
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

@customElement("collama-chat-search")
export class ChatSearch extends BaseModal {
    static override styles = [baseModalStyles, chatSearchStyles];

    @state() private _results: SearchResult[] = [];
    @state() private _currentIndex = 0;
    @state() private _query = "";

    @query(".search-input") private _input!: HTMLInputElement;

    constructor() {
        super();
        this.title = "Search Chat";
    }

    override show(title?: string) {
        super.show(title);
        requestAnimationFrame(() => {
            this._input?.focus();
        });
    }

    override close() {
        this._query = "";
        this._results = [];
        this._currentIndex = 0;
        emit(this, "search-clear");
        super.close();
    }

    setResults(results: SearchResult[]) {
        this._results = results;
        // Keep current index in bounds
        if (this._currentIndex >= results.length) {
            this._currentIndex = Math.max(0, results.length - 1);
        }
        if (results.length > 0) {
            this._emitNavigate();
        }
    }

    private _handleInput(e: InputEvent) {
        const target = e.target as HTMLInputElement;
        this._query = target.value;
        this._currentIndex = 0;
        emit(this, "search-query", { query: this._query });
    }

    private _handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) {
                this._prev();
            } else {
                this._next();
            }
        }
        if (e.key === "Escape") {
            e.preventDefault();
            this.close();
        }
    }

    private _prev() {
        if (this._results.length === 0) {
            return;
        }
        this._currentIndex = (this._currentIndex - 1 + this._results.length) % this._results.length;
        this._emitNavigate();
    }

    private _next() {
        if (this._results.length === 0) {
            return;
        }
        this._currentIndex = (this._currentIndex + 1) % this._results.length;
        this._emitNavigate();
    }

    private _emitNavigate() {
        const result = this._results[this._currentIndex];
        if (result) {
            emit(this, "search-navigate", {
                index: this._currentIndex,
                messageIndex: result.messageIndex,
                messageId: result.messageId,
            });
        }
    }

    private _getInfoText(): string {
        if (!this._query) {
            return "0";
        }
        if (this._results.length === 0) {
            return "0 results";
        }
        return `${this._currentIndex + 1} / ${this._results.length}`;
    }

    protected override renderContent() {
        const noResults = this._results.length === 0;
        return html`
            <div class="search-body">
                <input
                    class="search-input"
                    type="text"
                    placeholder="Search messages..."
                    .value=${this._query}
                    @input=${this._handleInput}
                    @keydown=${this._handleKeyDown}
                />
                <span class="search-info">${this._getInfoText()}</span>
                <div class="search-nav">
                    <button @click=${this._prev} ?disabled=${noResults} title="Previous (Shift+Enter)">
                        ${icons.chevronUp}
                    </button>
                    <button @click=${this._next} ?disabled=${noResults} title="Next (Enter)">
                        ${icons.chevronDown}
                    </button>
                </div>
            </div>
        `;
    }
}
