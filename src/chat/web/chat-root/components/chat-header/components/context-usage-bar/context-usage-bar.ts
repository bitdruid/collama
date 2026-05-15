import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { contextUsageBarStyles } from "./styles";

@customElement("collama-context-usage-bar")
export class ContextUsageBar extends LitElement {
    @property({ type: Number }) used = 0;
    @property({ type: Number }) max = 0;

    static styles = [contextUsageBarStyles];

    render() {
        if (this.max <= 0) {
            return html``;
        }
        const pct = Math.min((this.used / this.max) * 100, 100);
        const barClass = pct >= 90 ? "danger" : pct >= 75 ? "warning" : "";
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
