import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeIcons } from "../../../../../styles";
import "../../../../../template-components/button-box";
import "../../../../../template-components/button-row";
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
                <div class="prompt-actions">
                    <span
                        class="prompt-action prompt-edit"
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
                    </span>

                    <span
                        class="prompt-action prompt-delete"
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
                    </span>
                </div>
            `;
        }

        if (this.adding) {
            return html`
                <collama-button-row>
                    <collama-accept-button
                        @action=${() =>
                            this.dispatchEvent(new CustomEvent("save-new-prompt", { bubbles: true, composed: true }))}
                    ></collama-accept-button>
                    <collama-cancel-button
                        @action=${() =>
                            this.dispatchEvent(new CustomEvent("cancel-new-prompt", { bubbles: true, composed: true }))}
                    ></collama-cancel-button>
                </collama-button-row>
            `;
        }

        return html`
            <collama-button-row>
                <collama-add-button
                    @action=${() =>
                        this.dispatchEvent(new CustomEvent("add-prompt", { bubbles: true, composed: true }))}
                ></collama-add-button>
                <collama-cancel-button
                    @action=${() =>
                        this.dispatchEvent(new CustomEvent("close-gallery", { bubbles: true, composed: true }))}
                ></collama-cancel-button>
            </collama-button-row>
        `;
    }
}
