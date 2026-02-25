// src/chat/web/components/chat_input/components/input_area/input_area.ts
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { commonStyles } from "../../../shared/styles/common_styles";
import { inputAreaStyles } from "./styles";

@customElement("collama-input-area")
export class InputArea extends LitElement {
  @property({ type: String }) value = "";
  @property({ type: Boolean }) disabled = false;
  @property({ type: Number }) maxRows = 5;

  private textarea?: HTMLTextAreaElement;

  static styles = [commonStyles, inputAreaStyles];

  render() {
    return html`
      <div class="input-area">
        <textarea
          class="input-textarea"
          .value=${this.value}
          ?disabled=${this.disabled}
          placeholder="Type your message..."
          @input=${this._handleInput}
          @keydown=${this._handleKeyDown}
          rows="1"
        ></textarea>
      </div>
    `;
  }

  firstUpdated() {
    this.textarea = this.shadowRoot?.querySelector(".input-textarea") as HTMLTextAreaElement;
    this._autoResize();
  }

  private _handleInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this.value = target.value;
    this._autoResize();
    this.dispatchEvent(new CustomEvent("input", { detail: { value: this.value }, bubbles: true, composed: true }));
  }

  private _handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.dispatchEvent(new CustomEvent("submit", { bubbles: true, composed: true }));
    }
  }

  private _autoResize() {
    if (!this.textarea) {return};
    this.textarea.style.height = "auto";
    this.textarea.style.height = Math.min(this.textarea.scrollHeight, this.maxRows * 20) + "px";
  }

  focus() {
    this.textarea?.focus();
  }

  clear() {
    this.value = "";
    if (this.textarea) {
      this.textarea.value = "";
      this._autoResize();
    }
  }
}
