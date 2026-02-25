// src/chat/web/components/chat_session/components/popup/chat_empty_state.ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { commonStyles } from "../../../shared/styles/common_styles";
import { emptyStateStyles } from "./styles";

@customElement("collama-empty-state")
export class EmptyState extends LitElement {
  static styles = [commonStyles, emptyStateStyles];

  render() {
    return html`<div class="empty-state">Hey, wanna code with me?</div>`;
  }
}
