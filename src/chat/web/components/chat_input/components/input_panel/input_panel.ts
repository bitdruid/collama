// src/chat/web/components/chat_input/components/input_panel/input_panel.ts
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { commonStyles } from "../../../shared/styles/common_styles";
import { inputPanelStyles } from "./styles";
import "./../input_area/input_area";
import "./../input_buttons/input_buttons";

@customElement("collama-input-panel")
export class InputPanel extends LitElement {
  @property({ type: String }) value = "";
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) loading = false;

  static styles = [commonStyles, inputPanelStyles];

  render() {
    return html`
      <div class="input-panel">
        <collama-input-area
          .value=${this.value}
          .disabled=${this.disabled}
          @input=${this._handleInput}
          @submit=${this._handleSubmit}
        ></collama-input-area>
        <collama-input-buttons
          .disabled=${this.disabled}
          .canSubmit=${this.value.trim().length > 0}
          @clear=${this._handleClear}
          @submit=${this._handleSubmit}
        ></collama-input-buttons>
      </div>
    `;
  }

  private _handleInput(e: CustomEvent) {
    this.value = e.detail.value;
    this.dispatchEvent(new CustomEvent("input", { detail: { value: this.value }, bubbles: true, composed: true }));
  }

  private _handleClear() {
    this.value = "";
    this.dispatchEvent(new CustomEvent("clear", { bubbles: true, composed: true }));
  }

  private _handleSubmit() {
    if (this.value.trim().length > 0) {
      this.dispatchEvent(new CustomEvent("submit", { detail: { value: this.value }, bubbles: true, composed: true }));
    }
  }

  focus() {
    const inputArea = this.shadowRoot?.querySelector("collama-input-area") as any;
    inputArea?.focus();
  }

  clear() {
    this.value = "";
  }
}
