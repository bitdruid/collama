import { html, TemplateResult } from "lit";
import { customElement, query, state } from "lit/decorators.js";
import { BasePopup } from "../../../template-components/popup/base-popup";
import { basePopupStyles } from "../../../template-components/popup/styles";

import "./prompt-gallery-buttons";
import { galleryStyles } from "./styles";

@customElement("collama-prompt-gallery")
export class PromptGallery extends BasePopup {
    static styles = [basePopupStyles, galleryStyles];

    @state() private _customPrompts: string[] = [];
    @state() private _adding = false;
    @state() private _newPrompt = "";
    private _editingIndex?: number;

    @query(".custom-prompt-input")
    private customPromptInput!: HTMLTextAreaElement;

    // Memoized event handlers
    private handleClose = () => this.close();
    private handleDeletePrompt = (e: CustomEvent) => this._deletePrompt(e.detail.index);
    private handleEditPrompt = (e: CustomEvent) => this._editPrompt(e.detail.index);
    private handleInput = (e: Event) => (this._newPrompt = (e.target as HTMLTextAreaElement).value);
    private handleStartAdding = () => this._startAdding();
    private handleSaveNewPrompt = () => this._saveNewPrompt();
    private handleCancelAdding = () => this._cancelAdding();
    private handleCloseGallery = () => this.close();

    private _selectPrompt(prompt: string) {
        this.dispatchEvent(new CustomEvent("submit-prompt", { detail: { value: prompt } }));
        this.close();
    }

    connectedCallback() {
        super.connectedCallback();
        this._loadPrompts();
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
        this._openEditor();
    }

    private _startAdding() {
        this._newPrompt = "";
        this._openEditor();
    }

    private _openEditor() {
        this._adding = true;
        this.updateComplete.then(() => {
            requestAnimationFrame(() => {
                this.customPromptInput?.focus();
            });
        });
    }

    private _cancelAdding() {
        this._newPrompt = "";
        this._adding = false;
        this._editingIndex = undefined;
    }

    protected override renderContent(): TemplateResult {
        return html`
            <div class="panel-header">
                <h3>Prompt Gallery</h3>
                <span class="close-btn" @click=${this.handleClose}>&#10006;</span>
            </div>

            <div class="prompt-list">
                ${this._customPrompts.map(
                    (p, index) => html`
                        <div class="prompt-item">
                            <div class="prompt-text" @click=${() => this._selectPrompt(p)}>${p}</div>
                            <div class="prompt-actions">
                                <prompt-gallery-buttons
                                    .index=${index}
                                    @delete-prompt=${this.handleDeletePrompt}
                                    @edit-prompt=${this.handleEditPrompt}
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
                              @input=${this.handleInput}
                              placeholder="Enter your custom prompt..."
                          ></textarea>
                      `
                    : null}

                <prompt-gallery-buttons
                    .adding=${this._adding}
                    @add-prompt=${this.handleStartAdding}
                    @save-new-prompt=${this.handleSaveNewPrompt}
                    @cancel-new-prompt=${this.handleCancelAdding}
                    @close-gallery=${this.handleCloseGallery}
                ></prompt-gallery-buttons>
            </div>
        `;
    }
}
