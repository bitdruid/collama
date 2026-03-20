import { LitElement, html } from "lit";
import { state } from "lit/decorators.js";

import "./prompt-gallery-buttons";
import { galleryStyles } from "./styles";

export class PromptGallery extends LitElement {
    static styles = galleryStyles;

    @state() visible = false;
    @state() private _customPrompts: string[] = [];
    @state() private _adding = false;
    @state() private _newPrompt = "";
    private _editingIndex?: number;

    private _close() {
        this._adding = false;
        this._newPrompt = "";
        this._editingIndex = undefined;
        this.dispatchEvent(new CustomEvent("close-gallery"));
    }

    private _selectPrompt(prompt: string) {
        this.dispatchEvent(new CustomEvent("submit-prompt", { detail: { value: prompt } }));
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadPrompts();
        window.addEventListener("keydown", this._handleKeyDown);
    }

    disconnectedCallback() {
        window.removeEventListener("keydown", this._handleKeyDown);
        super.disconnectedCallback();
    }

    private _loadPrompts() {
        const saved = localStorage.getItem("collama-custom-prompts");
        if (saved) {
            this._customPrompts = JSON.parse(saved);
        }
    }

    private _savePrompts() {
        localStorage.setItem("collama-custom-prompts", JSON.stringify(this._customPrompts));
    }

    private _saveNewPrompt() {
        const trimmed = this._newPrompt.trim();
        if (!trimmed) {
            return;
        }

        if (this._editingIndex !== undefined) {
            this._customPrompts = this._customPrompts.map((p, i) => (i === this._editingIndex ? trimmed : p));
            this._editingIndex = undefined;
        } else {
            this._customPrompts = [...this._customPrompts, trimmed];
        }

        this._savePrompts();
        this._newPrompt = "";
        this._adding = false;
    }

    private _deletePrompt(index: number) {
        this._customPrompts = this._customPrompts.filter((_, i) => i !== index);
        this._savePrompts();
    }

    private _editPrompt(index: number) {
        this._newPrompt = this._customPrompts[index];
        this._editingIndex = index;
        this._adding = true;
    }

    private _startAdding() {
        this._newPrompt = "";
        this._adding = true;
    }

    private _cancelAdding() {
        this._newPrompt = "";
        this._adding = false;
        this._editingIndex = undefined;
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
                        ${this._customPrompts.map(
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
                            @add-prompt=${this._startAdding}
                            @save-new-prompt=${this._saveNewPrompt}
                            @cancel-new-prompt=${this._cancelAdding}
                        ></prompt-gallery-buttons>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define("collama-prompt-gallery", PromptGallery);
