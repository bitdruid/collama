import { LitElement, html } from "lit";
import { property, state } from "lit/decorators.js";

import "./prompt-gallery-buttons";
import { galleryStyles } from "./styles";

export class PromptGallery extends LitElement {
    static styles = galleryStyles;

    @property({ type: Boolean })
    visible = false;

    @property({ type: Array })
    private customPrompts: string[] = [];

    @state()
    private _adding = false;

    @state()
    private _newPrompt = "";

    //##### Gallery Handling #####
    private _close() {
        this.dispatchEvent(new CustomEvent("close-gallery"));
    }

    private _selectPrompt(prompt: string) {
        this.dispatchEvent(
            new CustomEvent("submit-prompt", {
                detail: { value: prompt },
            }),
        );
    }
    //##### Prompt Handling #####
    connectedCallback() {
        super.connectedCallback();
        this._loadPrompts();
        window.addEventListener("keydown", this._handleKeyDown);
    }

    private _loadPrompts() {
        const saved = localStorage.getItem("collama-custom-prompts");
        if (saved) {
            this.customPrompts = JSON.parse(saved);
        }
    }

    private _savePrompts() {
        localStorage.setItem("collama-custom-prompts", JSON.stringify(this.customPrompts));
    }

    private _saveNewPrompt() {
        if (!this._newPrompt.trim()) {
            return;
        }

        if (this._editingIndex !== undefined) {
            //edit existing prompt
            this.customPrompts[this._editingIndex] = this._newPrompt.trim();
            this._editingIndex = undefined;
        } else {
            // new prompt
            this.customPrompts = [...this.customPrompts, this._newPrompt.trim()];
        }

        this._savePrompts();
        this._newPrompt = "";
        this._adding = false;
    }

    private _deletePrompt(index: number) {
        this.customPrompts = this.customPrompts.filter((_, i) => i !== index);
        this._savePrompts();
    }

    private _editPrompt(index: number) {
        this._newPrompt = this.customPrompts[index];
        this._adding = true;
        this._editingIndex = index;
    }

    private _editingIndex?: number;

    disconnectedCallback() {
        window.removeEventListener("keydown", this._handleKeyDown);
        super.disconnectedCallback();
    }

    private _handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && this.visible) {
            this._close();
        }
    };

    render() {
        if (!this.visible) {
            return html``;
        }

        return html`
            <div class="modal" @click=${this._close}>
                <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
                    <h3>Prompt Gallery</h3>

                    <div class="prompt-list">
                        ${this.customPrompts.map(
                            (p, index) => html`
                                <div class="prompt-item">
                                    <div class="prompt-text" @click=${() => this._selectPrompt(p)}>${p}</div>

                                    <div class="prompt-actions">
                                        <prompt-gallery-buttons
                                            .index=${index}
                                            @delete-prompt=${(e: CustomEvent) => this._deletePrompt(e.detail.index)}
                                            @edit-prompt=${(e: CustomEvent) => this._editPrompt(e.detail.index)}
                                        ></prompt-gallery-buttons>
                                    </div>
                                </div>
                            `,
                        )}
                    </div>

                    <div class="prompt-add-section">
                        ${this._adding
                            ? html`
                                  <textarea
                                      rows="3"
                                      class="custom-prompt-input"
                                      .value=${this._newPrompt}
                                      @input=${(e: any) => (this._newPrompt = e.target.value)}
                                      placeholder="Enter your custom prompt..."
                                  ></textarea>
                              `
                            : null}

                        <prompt-gallery-buttons
                            .adding=${this._adding}
                            @add-prompt=${() => (this._adding = true)}
                            @save-new-prompt=${this._saveNewPrompt}
                            @cancel-new-prompt=${() => (this._adding = false)}
                        ></prompt-gallery-buttons>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define("collama-prompt-gallery", PromptGallery);
