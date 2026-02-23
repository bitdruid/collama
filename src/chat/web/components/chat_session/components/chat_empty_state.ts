// src/components/chat-empty-state.ts
import { LitElement, html, css } from "lit";
import { customElement } from "lit/decorators.js";

@customElement("collama-empty-state")
export class EmptyState extends LitElement {
  static styles = css`
    .empty-state {
      padding: 1rem;
      text-align: center;
      color: var(--text-muted);
    }
  `;

  render() {
    return html`<div class="empty-state">No chat history yet</div>`;
  }
}
