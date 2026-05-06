import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeIcons } from "../../../../styles";
import { galleryButtonStyles } from "./styles";

@customElement("prompt-gallery-buttons")
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
                <div class="row-actions">
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
                        ${themeIcons.pencil.medium}
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
                        ${themeIcons.trash.medium}
                    </button>
                </div>
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
                        ${themeIcons.check.medium}
                    </button>
                    <button
                        class="gallery-btn cancel-btn"
                        @click=${() =>
                            this.dispatchEvent(new CustomEvent("cancel-new-prompt", { bubbles: true, composed: true }))}
                    >
                        ${themeIcons.x.medium}
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
                    ${themeIcons.plus.medium}
                </button>
                <button
                    class="gallery-btn cancel-btn"
                    @click=${() =>
                        this.dispatchEvent(new CustomEvent("close-gallery", { bubbles: true, composed: true }))}
                >
                    ${themeIcons.x.medium}
                </button>
            </div>
        `;
    }
}
