import { html, LitElement } from "lit";
import { customElement } from "lit/decorators.js";

import { buttonRowStyles } from "./styles";

/**
 * Footer row for a modal's action buttons. Slot the modal's buttons in; they are laid out
 * in a right-aligned, wrapping row.
 *
 * @element collama-button-row
 * @slot - The action buttons (e.g. accept/cancel/send buttons).
 */
@customElement("collama-button-row")
export class ButtonRow extends LitElement {
    static override styles = [buttonRowStyles];

    protected override render() {
        return html`<div class="button-row"><slot></slot></div>`;
    }
}
