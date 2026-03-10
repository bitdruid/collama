import { LitElement, html } from "lit";
import { property } from "lit/decorators.js";
import { icons } from "../../../../../utils-web";
import { galleryButtonStyles } from "./styles";

export class PromptGalleryButtons extends LitElement {
    static styles = galleryButtonStyles;

    /** Adding a new prompt? */
    @property({ type: Boolean })
    adding = false;

    @property({ type: Number })
    index?: number;

    render() {
        if (this.index !== undefined) {
            return html`
                <button
                    class="edit-btn"
                    title="Edit prompt"
                    @click=${() =>
                        this.dispatchEvent(
                            new CustomEvent("edit-prompt", {
                                detail: { index: this.index },
                                bubbles: true,
                                composed: true,
                            }),
                        )}
                >
                    ${icons.pencil}
                </button>

                <button
                    class="delete-btn"
                    title="Delete prompt"
                    @click=${() =>
                        this.dispatchEvent(
                            new CustomEvent("delete-prompt", {
                                detail: { index: this.index },
                                bubbles: true,
                                composed: true,
                            }),
                        )}
                >
                    🗑
                </button>
            `;
        }

        if (this.adding) {
            return html`
                <div class="button-container">
                    <button
                        @click=${() =>
                            this.dispatchEvent(new CustomEvent("save-new-prompt", { bubbles: true, composed: true }))}
                    >
                        Save
                    </button>
                    <button
                        @click=${() =>
                            this.dispatchEvent(new CustomEvent("cancel-new-prompt", { bubbles: true, composed: true }))}
                    >
                        Cancel
                    </button>
                </div>
            `;
        }

        return html`
            <button
                @click=${() => this.dispatchEvent(new CustomEvent("add-prompt", { bubbles: true, composed: true }))}
            >
                + Add Prompt
            </button>
        `;
    }
}

customElements.define("prompt-gallery-buttons", PromptGalleryButtons);
