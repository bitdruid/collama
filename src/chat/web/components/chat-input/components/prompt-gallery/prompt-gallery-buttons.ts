import { LitElement, html } from "lit";
import { property } from "lit/decorators.js";
import { icons } from "../../../../../utils-front";
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
                    class="gallery-btn edit-btn"
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
                    class="gallery-btn delete-btn"
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
                    ${icons.trash}
                </button>
            `;
        }

        if (this.adding) {
            return html`
                <div class="button-container">
                    <button
                        class="gallery-btn prompt-btn"
                        @click=${() =>
                            this.dispatchEvent(new CustomEvent("save-new-prompt", { bubbles: true, composed: true }))}
                    >
                        Save
                    </button>
                    <button
                        class="gallery-btn cancel-btn"
                        @click=${() =>
                            this.dispatchEvent(new CustomEvent("cancel-new-prompt", { bubbles: true, composed: true }))}
                    >
                        Cancel
                    </button>
                </div>
            `;
        }

        return html`
            <div class="button-container">
                <button
                    class="gallery-btn prompt-btn"
                    @click=${() => this.dispatchEvent(new CustomEvent("add-prompt", { bubbles: true, composed: true }))}
                >
                    + Add Prompt
                </button>
                <button
                    class="gallery-btn cancel-btn"
                    @click=${() =>
                        this.dispatchEvent(new CustomEvent("close-gallery", { bubbles: true, composed: true }))}
                >
                    Cancel
                </button>
            </div>
        `;
    }
}

customElements.define("prompt-gallery-buttons", PromptGalleryButtons);
