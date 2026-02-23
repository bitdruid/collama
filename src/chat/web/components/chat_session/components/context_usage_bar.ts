// src/components/context-usage-bar.ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("collama-context-usage-bar")
export class ContextUsageBar extends LitElement {
  @property({ type: Number }) used = 0;
  @property({ type: Number }) max = 0;

  static styles = css`
    .context-usage {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .context-bar-container {
      flex: 1;
      height: 8px;
      background: var(--bar-bg);
      border-radius: 4px;
      overflow: hidden;
    }
    .context-bar {
      height: 100%;
      background: var(--bar-fill);
    }
    .danger {
      background: var(--danger-color);
    }
    .warning {
      background: var(--warning-color);
    }
    .context-text {
      font-size: 0.75rem;
    }
  `;

  render() {
    if (this.max <= 0) {return html``};
    const pct = Math.min((this.used / this.max) * 100, 100);
    const barClass = pct >= 90 ? "danger" : pct >= 70 ? "warning" : "";
    return html`
      <div class="context-usage" title="Context usage: ${this.used} / ${this.max} tokens">
        <div class="context-bar-container">
          <div class="context-bar ${barClass}" style="width: ${pct}%"></div>
        </div>
        <span class="context-text">${Math.round(pct)}%</span>
      </div>
    `;
  }
}
