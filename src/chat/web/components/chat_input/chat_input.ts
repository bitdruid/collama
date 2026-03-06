import { LitElement, css, html, PropertyValues } from "lit";
import { ChatContext } from "../chat_container/chat_container";
import { chatInputStyles } from "./styles/chat_input_styles";
import "./components/input_buttons/input_buttons"; // Import
import "../prompt_gallery/prompt_gallery";
import { state } from "lit/decorators.js";


export class ChatInput extends LitElement {
    
    @state()
    private showGallery = false;

    static get properties() {
        return {
            userInput: { type: String },
            rows: { type: Number },
            contexts: { type: Array },
            isLoading: { type: Boolean },
        };
    }

    static styles = chatInputStyles;

    userInput = "";
    rows = 1;
    contexts: ChatContext[] = [];
    isLoading = false;

    updated(changedProperties: PropertyValues) {
        if (changedProperties.has("isLoading") && !this.isLoading) {
            this.updateComplete.then(() => {
                this.shadowRoot?.querySelector("textarea")?.focus();
            });
        }
    }

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
        this.dispatchEvent(
            new CustomEvent("submit", {
                detail: { value: this.userInput, contexts: this.contexts },
                bubbles: true,
                composed: true,
            }),
        );
        this.userInput = "";
        this.rows = 1;
        this.contexts = [];
        this.updateComplete.then(() => {
            this.shadowRoot?.querySelector("textarea")?.focus();
        });
    }

    private _handleCancel() {
        this.dispatchEvent(
            new CustomEvent("cancel", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleCompress() {
        this.dispatchEvent(
            new CustomEvent("compress", {
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _adjustRows() {
        const ta = this.shadowRoot?.querySelector("textarea") as HTMLTextAreaElement | null;
        if (!ta) {
            return;
        }
        ta.rows = 1;
        const style = getComputedStyle(ta);
        const lineHeight = parseFloat(style.lineHeight);
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);
        const verticalPadding = paddingTop + paddingBottom;
        const contentHeight = ta.scrollHeight - verticalPadding;
        const newRows = Math.max(1, Math.round(contentHeight / lineHeight));
        ta.rows = newRows;
        this.rows = newRows;
    }

    private _clearContext(index: number) {
        this.dispatchEvent(
            new CustomEvent("context-cleared", {
                detail: { index },
                bubbles: true,
                composed: true,
            }),
        );
    }

    

    private _openGallery() {
        this.showGallery = true;
    }

    private _closeGallery() {
        this.showGallery = false;
    }

    private _handlePrompt(e: CustomEvent) {
        this.userInput = e.detail.value;
        this.showGallery = false;
    }


    render() {
        return html`
            <collama-prompt-gallery
                .visible=${this.showGallery}
                @submit-prompt=${this._handlePrompt}
                @close-gallery=${this._closeGallery}>
            </collama-prompt-gallery>
            
            <textarea
                .value=${this.userInput}
                rows=${this.rows}
                @input=${this._handleInput}
                @keydown=${this._handleKeyDown}
                placeholder="Chat with AI..."
                ?disabled=${this.isLoading}
            ></textarea>
            
            <collama-chatinput-buttons
                .contexts=${this.contexts}
                .isLoading=${this.isLoading}
                @gallery-click=${this._openGallery}
                @cancel=${this._handleCancel}
                @compress=${this._handleCompress}
                @submit=${this._handleSubmit}
                @context-cleared=${(e: CustomEvent) => this._clearContext(e.detail.index)}
            ></collama-chatinput-buttons>
        `;
    }
}

customElements.define("collama-chatinput", ChatInput);
