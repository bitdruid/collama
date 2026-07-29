import { html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { AttachedContext } from "../../../../../../../common/context-chat";
import { adjustTextareaRows } from "../../../../utils";
import { type ContextSearchResult } from "../../../../../../shared";
import "./control-panel-buttons";
import { controlPanelStyles } from "./styles";

function emit(el: HTMLElement, name: string, detail?: unknown) {
    el.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
}

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

    @query("textarea")
    private textarea!: HTMLTextAreaElement;

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
        this.userInput = (e.target as HTMLTextAreaElement).value;
        this._adjustRows();
    }

    private _handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            // swallow while summarizing so the draft survives instead of becoming an intercept
            if (this.isSummarizing) {
                return;
            }
            this._handleSubmit();
        }
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
