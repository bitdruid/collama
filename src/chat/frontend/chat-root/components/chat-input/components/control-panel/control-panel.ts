import { html, LitElement, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { AttachedContext } from "../../../../../../../common/context-chat";
import { adjustTextareaRows, emit, toggleContext } from "../../../../utils";
import { type ContextSearchResult } from "../../../../../../shared";
import "../context-search/context-search";
import type { ContextSearch } from "../context-search/context-search";
import "./control-panel-buttons";
import { controlPanelStyles } from "./styles";

/** An `@token` being typed at the caret: start of input or after whitespace, no spaces inside. */
const MENTION = /(?:^|\s)@([^\s@]*)$/;

@customElement("collama-control-panel")
export class ControlPanel extends LitElement {
    static styles = controlPanelStyles;

    @property({ type: String }) userInput = "";
    @property({ type: Array }) contexts: AttachedContext[] = [];
    @property({ type: Boolean }) isGenerating = false;
    @property({ type: Boolean }) isSummarizing = false;
    @property({ type: Number }) agentToken = 0;
    @property({ type: Boolean }) hasTokenData = false;
    @property({ type: Array }) contextSearchResults: ContextSearchResult[] = [];
    @property({ type: Boolean }) autoAccept = false;

    /** The `@` query being typed, or null when no mention is active. */
    @state() private mentionQuery: string | null = null;

    @query("textarea")
    private textarea!: HTMLTextAreaElement;

    @query("collama-context-search")
    private mentionPopup?: ContextSearch;

    //  Lifecycle

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has("isGenerating") && !this.isGenerating) {
            this.updateComplete.then(() => this._focusTextarea());
        }
        if (changedProperties.has("userInput")) {
            this._adjustRows();
        }
    }

    //  Event handlers

    private _handleInput(e: Event) {
        const textarea = e.target as HTMLTextAreaElement;
        this.userInput = textarea.value;
        this._adjustRows();
        this._syncMention(e as InputEvent, textarea);
    }

    /**
     * Opens/updates/closes the mention popup from the text before the caret. Only a typed `@`
     * opens it - pasting a code block full of decorators must not flash a popup - but any edit
     * can narrow or dismiss one that is already open.
     */
    private _syncMention(e: InputEvent, textarea: HTMLTextAreaElement) {
        const query = textarea.value.slice(0, textarea.selectionStart ?? 0).match(MENTION)?.[1] ?? null;
        const typed = e.inputType === "insertText";
        if (query === null || (this.mentionQuery === null && !typed)) {
            this.mentionQuery = null;
            return;
        }
        this.mentionQuery = query;
        emit(this, "context-search", { query });
    }

    private _handleKeyDown(e: KeyboardEvent) {
        if (this.mentionQuery !== null && this._handleMentionKey(e)) {
            return;
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // swallow while summarizing so the draft survives instead of becoming an intercept
            if (this.isSummarizing) {
                return;
            }
            this._handleSubmit();
        }
    }

    /**
     * Routes navigation keys to the open mention popup. Returns true when the key was consumed,
     * so Enter never both adds a file and sends the message.
     */
    private _handleMentionKey(e: KeyboardEvent): boolean {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            this.mentionPopup?.moveActive(e.key === "ArrowDown" ? 1 : -1);
            return true;
        }
        if (e.key === "Escape") {
            this.mentionQuery = null;
            return true;
        }
        if (e.key === "Enter" && !e.shiftKey) {
            // nothing highlighted (no results yet, or search still in flight) - let Enter send
            if (!this.mentionPopup?.confirmActive()) {
                this.mentionQuery = null;
                return false;
            }
            e.preventDefault();
            return true;
        }
        return false;
    }

    /**
     * A mention pick toggles like the popup does - mentioning an attached file detaches it -
     * and always drops the typed `@token`, since the chip row is what shows the result.
     */
    private _handleMentionPick(e: CustomEvent) {
        toggleContext(this, this.contexts, e.detail);
        this._stripMention();
    }

    private _stripMention() {
        const caret = this.textarea?.selectionStart ?? this.userInput.length;
        const before = this.userInput.slice(0, caret).replace(MENTION, (m) => (m.startsWith("@") ? "" : " "));
        this.userInput = before + this.userInput.slice(caret);
        this.mentionQuery = null;
        this.updateComplete.then(() => {
            this._focusTextarea();
            this.textarea?.setSelectionRange(before.length, before.length);
        });
    }

    private _handleSubmit() {
        // While generating, this emits an intercept; onSubmit branches on isGenerating.
        emit(this, "submit", { value: this.userInput, contexts: this.contexts });
        this.userInput = "";
        this.contexts = [];
        if (this.textarea) {
            this.textarea.rows = 1;
        }
        this.updateComplete.then(() => this._focusTextarea());
    }

    private _focusTextarea() {
        this.textarea?.focus();
    }

    private _adjustRows() {
        if (!this.textarea) {
            return;
        }
        adjustTextareaRows(this.textarea);
    }

    private _placeholder() {
        if (this.isSummarizing) {
            return "Summarizing… messages can't be queued";
        }
        return this.isGenerating ? "Add to the running agent…" : "Chat with AI...";
    }

    // Render

    render() {
        return html`
            <div class="panel-content">
                ${this.mentionQuery !== null
                    ? html`<collama-context-search
                          inline
                          autoShow
                          .closeOnOutsideClick=${true}
                          .results=${this.contextSearchResults}
                          .contexts=${this.contexts}
                          .searchQuery=${this.mentionQuery}
                          @context-pick=${this._handleMentionPick}
                          @overlay-close=${() => (this.mentionQuery = null)}
                      ></collama-context-search>`
                    : ""}
                <textarea
                    .value=${this.userInput}
                    @input=${this._handleInput}
                    @keydown=${this._handleKeyDown}
                    placeholder=${this._placeholder()}
                ></textarea>

                <collama-control-panel-buttons
                    .contexts=${this.contexts}
                    .hasInput=${this.userInput.trim().length > 0}
                    .isGenerating=${this.isGenerating}
                    .isSummarizing=${this.isSummarizing}
                    .agentToken=${this.agentToken}
                    .hasTokenData=${this.hasTokenData}
                    .contextSearchResults=${this.contextSearchResults}
                    .autoAccept=${this.autoAccept}
                    @submit-click=${this._handleSubmit}
                ></collama-control-panel-buttons>
            </div>
        `;
    }
}
