import { html, LitElement, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";
import { AttachedContext } from "../../../../../../common/context-chat";
import { ContextSearchResult } from "../../../../types";
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
    @property({ type: Boolean }) isLoading = false;
    @property({ type: Number }) agentToken = 0;
    @property({ type: Boolean }) hasTokenData = false;
    @property({ type: Array }) contextSearchResults: ContextSearchResult[] = [];

    //  Lifecycle

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has("isLoading") && !this.isLoading) {
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
            this._handleSubmit();
        }
    }

    private _handleSubmit() {
        if (this.isLoading) {
            return;
        }
        emit(this, "submit", { value: this.userInput, contexts: this.contexts });
        this.userInput = "";
        this.contexts = [];
        const ta = this.shadowRoot?.querySelector("textarea") as HTMLTextAreaElement | null;
        if (ta) {
            ta.rows = 1;
        }
        this.updateComplete.then(() => this._focusTextarea());
    }

    //  Helpers

    private _focusTextarea() {
        this.shadowRoot?.querySelector("textarea")?.focus();
    }

    private _adjustRows() {
        const ta = this.shadowRoot?.querySelector("textarea") as HTMLTextAreaElement | null;
        if (!ta) {
            return;
        }
        ta.rows = 1;
        const style = getComputedStyle(ta);
        const lineHeight = parseFloat(style.lineHeight);
        const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
        ta.rows = Math.max(1, Math.round((ta.scrollHeight - padding) / lineHeight));
    }

    // Render

    render() {
        return html`
            <div class="panel-content">
                <textarea
                    .value=${this.userInput}
                    @input=${this._handleInput}
                    @keydown=${this._handleKeyDown}
                    placeholder="Chat with AI..."
                    ?disabled=${this.isLoading}
                ></textarea>

                <collama-control-panel-buttons
                    .contexts=${this.contexts}
                    .isLoading=${this.isLoading}
                    .agentToken=${this.agentToken}
                    .hasTokenData=${this.hasTokenData}
                    .contextSearchResults=${this.contextSearchResults}
                    @submit-click=${this._handleSubmit}
                ></collama-control-panel-buttons>
            </div>
        `;
    }
}
