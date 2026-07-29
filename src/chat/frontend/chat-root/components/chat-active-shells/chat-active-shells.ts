import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeColors } from "../../../styles";
import "../../../template-components/live-bar";
import { activeShellsStyles } from "./styles";

/**
 * Compact banner pinned above the composer showing active shell session count.
 * Visible only when shell sessions are running. Green dot + count indicator.
 */
@customElement("collama-active-shells")
export class ActiveShells extends LitElement {
    static styles = activeShellsStyles;

    @property({ type: Number }) count = 0;

    render() {
        if (this.count === 0) {
            return html``;
        }
        return html`
            <collama-livebar
                accent=${themeColors.usagePrimary.cssText}
                title="${this.count} active shell session${this.count > 1 ? "s" : ""}"
            >
                <span class="dot"></span>
                <span class="label">Shell</span>
                <span class="count">${this.count}</span>
                <span class="text">${this.count === 1 ? "session running" : "sessions running"}</span>
            </collama-livebar>
        `;
    }
}
