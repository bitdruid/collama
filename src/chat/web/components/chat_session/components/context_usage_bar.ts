// src/components/context-usage-bar.ts
import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("collama-context-usage-bar")
export class ContextUsageBar extends LitElement {
  @property({ type: Number }) used = 0;
  @property({ type: Number }) max = 0;

  static styles = css`
    :host {
      --bar-bg: rgba(255, 255, 255, 0.15);
      --bar-fill: #4ec9b0;
      --danger-color: #f14c4c;
      --warning-color: #cca700;
      display: block;
    }
    .context-usage {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 120px;
    }
    .context-bar-container {
      flex: 1;
      min-width: 50px;
      height: 6px;
      background: var(--bar-bg);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      overflow: hidden;
      position: relative;
    }
    .context-bar {
      height: 100%;
      background: var(--bar-fill);
      border-radius: 2px;
      transition: width 0.3s ease;
      min-width: 1px;
    }
    .context-bar.danger {
      background: var(--danger-color);
    }
    .context-bar.warning {
      background: var(--warning-color);
    }
    .context-text {
      font-size: 11px;
      color: var(--vscode-descriptionForeground, #cccccc);
      white-space: nowrap;
      min-width: 35px;
      text-align: right;
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
