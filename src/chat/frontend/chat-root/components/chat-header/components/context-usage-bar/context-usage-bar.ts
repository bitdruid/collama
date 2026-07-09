import { LitElement, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { contextUsageBarStyles } from "./styles";

@customElement("collama-context-usage-bar")
export class ContextUsageBar extends LitElement {
    // tokens in the live window (sent to the model)
    @property({ type: Number }) used = 0;
    // context window size
    @property({ type: Number }) max = 0;
    // auto-trimmed tokens no longer in the live window
    @property({ type: Number }) trimmed = 0;
    // transient trim annotation e.g. "−12.3k · 2 turns", empty hides
    @property({ type: String }) flash = "";

    static styles = [contextUsageBarStyles];

    /** Formats a number with locale-aware thousands separator. */
    private formatNumber(n: number): string {
        return n.toLocaleString();
    }

    render() {
        if (this.max <= 0) {
            return html``;
        }

        // overall fill = window usage (live / max), drives % text and color
        const fillPct = Math.min((this.used / this.max) * 100, 100);
        // split fill by token share so hatch shows how much passed-through context was dropped
        const total = this.used + this.trimmed;
        const trimShare = total > 0 ? this.trimmed / total : 0;
        const trimmedPct = fillPct * trimShare;
        const liveSegPct = fillPct - trimmedPct;
        const barClass = fillPct >= 90 ? "danger" : fillPct >= 75 ? "warning" : "";
        const hasTrimmed = trimmedPct > 0;

        const title = hasTrimmed
            ? `Context usage: ${this.formatNumber(this.used)} / ${this.formatNumber(this.max)} tokens · ${this.formatNumber(this.trimmed)} trimmed (dropped from context)`
            : `Context usage: ${this.formatNumber(this.used)} / ${this.formatNumber(this.max)} tokens`;

        return html`
            <div class="context-usage" title=${title}>
                <div class="context-bar-container">
                    ${hasTrimmed
                        ? html`<div class="context-seg trimmed" style="width: ${trimmedPct}%"></div>`
                        : nothing}
                    <div class="context-bar ${barClass}" style="width: ${liveSegPct}%"></div>
                    ${this.flash
                        ? html`<span class="context-flash" role="status">${this.flash}</span>`
                        : nothing}
                </div>
                <span class="context-text">${Math.round(fillPct)}%</span>
            </div>
        `;
    }
}
