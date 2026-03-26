// src/components/context-usage-bar.ts
import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeColors } from "../../styles/theme-colors";
import { themeFonts } from "../../styles/theme-fonts";

@customElement("collama-context-usage-bar")
export class ContextUsageBar extends LitElement {
    @property({ type: Number }) used = 0;
    @property({ type: Number }) max = 0;

    static styles = css`
        :host {
            --bar-bg: rgba(255, 255, 255, 0.15);
            display: block;
        }
        .context-usage {
            display: flex;
            align-items: center;
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
            background: ${themeColors.usagePrimary};
            border-radius: 2px;
            transition: width 0.3s ease;
            min-width: 1px;
        }
        .context-bar.danger {
            background: ${themeColors.usageDanger};
        }
        .context-bar.warning {
            background: ${themeColors.usageWarning};
        }
        .context-text {
            font-size: ${themeFonts.medium};
            color: ${themeColors.uiFont};
            white-space: nowrap;
            margin-left: 8px;
        }
    `;

    render() {
        if (this.max <= 0) {
            return html``;
        }
        const pct = Math.min((this.used / this.max) * 100, 100);
        const barClass = pct >= 90 ? "danger" : pct >= 70 ? "warning" : "";
        return html`
            <div class="context-usage" title="~ Context usage: ${this.used} / ${this.max} tokens">
                <div class="context-bar-container">
                    <div class="context-bar ${barClass}" style="width: ${pct}%"></div>
                </div>
                <span class="context-text">${Math.round(pct)}%</span>
            </div>
        `;
    }
}
