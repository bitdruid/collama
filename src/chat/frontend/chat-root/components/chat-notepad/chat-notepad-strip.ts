import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { themeColors, themeIcons } from "../../../styles";
import "../../../template-components/live-bar";
import "../chat-output/notepad";
import type { PlanStep } from "../chat-output/notepad";
import { notepadStripStyles } from "./styles";

/**
 * Pinned plan strip above the composer, collapsed to progress plus the step in flight.
 * Facts stay out: they are as long as they need to be and a pinned bar cannot grow for them.
 * The pad is live session state, not history, so this survives a summary. Display only.
 *
 * @element collama-notepad-strip
 */
@customElement("collama-notepad-strip")
export class NotepadStrip extends LitElement {
    static styles = notepadStripStyles;

    @property({ type: Array }) plan: PlanStep[] = [];
    @property({ type: Number }) factCount = 0;
    @property({ type: Boolean }) generating = false;
    @state() private _open = false;

    private _clear(e: Event) {
        e.stopPropagation();
        this.dispatchEvent(new CustomEvent("notepad-clear", { bubbles: true, composed: true }));
    }

    render() {
        if (!this.plan.length) {
            return html``;
        }
        const done = this.plan.filter((s) => s.done).length;
        const current = this.plan.find((s) => !s.done);
        const percent = (done / this.plan.length) * 100;

        return html`
            <collama-livebar
                accent=${themeColors.gallery.cssText}
                title="Agent plan"
                @head-click=${() => (this._open = !this._open)}
            >
                <span class="label">Plan</span>
                <span class="count">${done}/${this.plan.length}</span>
                <span class="text ${current ? "" : "complete"}">${current?.text ?? "plan complete"}</span>
                ${this.factCount ? html`<span class="facts">${this.factCount} facts</span>` : ""}
                ${this.generating
                    ? ""
                    : html`<button class="btn" @click=${this._clear} title="Drop this plan">
                          ${themeIcons.x.small}
                      </button>`}
                <span class="chevron ${this._open ? "open" : ""}">${themeIcons.chevronDown.medium}</span>
                <div slot="body">
                    <div class="progress"><div class="progress-fill" style="width: ${percent}%"></div></div>
                    ${this._open
                        ? html`<div class="body">
                              <collama-notepad .plan=${this.plan}></collama-notepad>
                          </div>`
                        : ""}
                </div>
            </collama-livebar>
        `;
    }
}
