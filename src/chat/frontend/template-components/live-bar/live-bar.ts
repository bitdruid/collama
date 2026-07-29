import { html, LitElement } from "lit";
import { customElement, property } from "lit/decorators.js";
import { liveBarStyles } from "./styles";

/**
 * One bar in the stack above the composer - running shells, queued intercepts, the agent's plan.
 * Each shows something true right now, unlike the transcript below.
 *
 * Row content goes in the default slot; give children `label`/`text`/`icon`/`btn` to pick up the
 * shared look. Anything in the `body` slot hangs under the row, and clicking the row emits
 * `head-click` so an expandable bar can toggle without the body counting as a hit.
 *
 * @element collama-livebar
 */
@customElement("collama-livebar")
export class LiveBar extends LitElement {
    static styles = liveBarStyles;

    /** Colour for the label, icon and anything the consumer paints with `--bar-accent`. */
    @property({ type: String }) accent = "";
    /** Breathes the border, for a bar that is waiting on something. */
    @property({ type: Boolean }) pulse = false;

    render() {
        return html`
            <div class="bar ${this.pulse ? "pulse" : ""}" style=${this.accent ? `--bar-accent: ${this.accent}` : ""}>
                <div class="head" @click=${() => this.dispatchEvent(new CustomEvent("head-click"))}>
                    <slot></slot>
                </div>
                <slot name="body"></slot>
            </div>
        `;
    }
}
