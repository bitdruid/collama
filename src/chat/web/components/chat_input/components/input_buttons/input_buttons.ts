// src/chat/web/components/chat_input/components/input_buttons/input_buttons.ts
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { commonStyles } from "../../../shared/styles/common_styles";
import { inputButtonsStyles } from "./styles";

@customElement("collama-input-buttons")
export class InputButtons extends LitElement {
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) canSubmit = false;

  static styles = [commonStyles, inputButtonsStyles];

  render() {
    return html`
      <div class="input-buttons">
        <button
          class="icon-button clear-button"
          ?disabled=${this.disabled}
          @click=${this._handleClear}
          title="Clear input"
        >
          ×
        </button>
        <button
          class="icon-button primary-button submit-button"
          ?disabled=${this.disabled || !this.canSubmit}
          @click=${this._handleSubmit}
          title="Send message"
        >
          →
        </button>
      </div>
    `;
  }

  private _handleClear() {
    this.dispatchEvent(new CustomEvent("clear", { bubbles: true, composed: true }));
  }

  private _handleSubmit() {
    if (this.canSubmit) {
      this.dispatchEvent(new CustomEvent("submit", { bubbles: true, composed: true }));
    }
  }
}
