import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeIcons } from "../../../styles";
import { pendingInterceptStyles } from "./styles";

/**
 * Renders queued intercepts as a compact banner pinned above the composer — a lasting signal that
 * a message is waiting to be injected into the running agent loop. Display-only; the real message
 * renders in-stream once the backend drains it. Each row can be cancelled (× → `cancel-intercept`).
 */
@customElement("collama-pending-intercept")
export class PendingIntercept extends LitElement {
    static styles = pendingInterceptStyles;

    /** Queued intercepts, oldest first. */
    @property({ type: Array }) items: { id: string; text: string; contextCount: number }[] = [];

    private _cancel(id: string) {
        this.dispatchEvent(new CustomEvent("cancel-intercept", { detail: { id }, bubbles: true, composed: true }));
    }

    render() {
        if (this.items.length === 0) {
            return html``;
        }
        return html`
            ${this.items.map(
                (item) => html`
                    <div class="banner" title="Queued — intercepts the agent at the next turn">
                        <span class="banner-icon">${themeIcons.betweenHorizontalStart.medium}</span>
                        <!-- <span class="banner-label">Intercept</span> -->
                        <span class="banner-text">${item.text}</span>
                        ${item.contextCount > 0
                            ? html`<span class="banner-context" title="${item.contextCount} context attached">
                                  ${themeIcons.paperclip.small}${item.contextCount}
                              </span>`
                            : ""}
                        <button class="banner-cancel" title="Cancel" @click=${() => this._cancel(item.id)}>
                            ${themeIcons.x.small}
                        </button>
                    </div>
                `,
            )}
        `;
    }
}
