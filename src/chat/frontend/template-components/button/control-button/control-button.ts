import { html, type PropertyValues, type TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";

import { themeColors, themeIcons } from "../../../styles";
import { ButtonBase } from "../button-base";
import { controlButtonStyles } from "./control-button-styles";

/**
 * Base class for round filled 28×28 control buttons. Subclasses set their own
 * `bg`/`bgHover` colors, `icon`, and `defaultTitle`. Clicking dispatches an
 * `action` event.
 *
 * Use `pulse` attribute to enable the loading-pulse animation.
 * Use `badge` property to show a numeric badge (e.g. context count).
 */
@customElement("collama-control-button")
export class ControlButton extends ButtonBase {
    static override styles = [controlButtonStyles];

    @property({ type: Boolean, reflect: true }) pulse = false;
    @property({ type: Number }) badge = 0;

    /** Override in subclass. */
    protected bg = "";
    protected bgHover = "";

    override connectedCallback() {
        super.connectedCallback();
        this._applyColors();
    }

    protected override render() {
        return html`
            <button class="control-button" title=${this.title} ?disabled=${this.disabled} @click=${this._emitAction}>
                ${this.icon ?? html`<slot></slot>`}
                ${this.badge > 0 ? html`<span class="badge">${this.badge}</span>` : ""}
            </button>
        `;
    }

    private _applyColors() {
        if (this.bg) {
            this.style.setProperty("--btn-bg", this.bg);
        }
        if (this.bgHover) {
            this.style.setProperty("--btn-bg-hover", this.bgHover);
        }
    }
}

// ── Concrete subclasses ──────────────────────────────────────────────────────

@customElement("collama-submit-button")
export class SubmitButton extends ControlButton {
    protected bg = themeColors.submit.cssText;
    protected bgHover = themeColors.submitHover.cssText;
    override icon = themeIcons.enter.medium;
    protected override defaultTitle = "Submit";
}

@customElement("collama-intercept-button")
export class InterceptButton extends ControlButton {
    protected bg = themeColors.submit.cssText;
    protected bgHover = themeColors.submitHover.cssText;
    override icon = themeIcons.betweenHorizontalStart.medium;
    protected override defaultTitle = "Intercept with a follow-up message";
    override pulse = true;
}

@customElement("collama-input-cancel-button")
export class InputCancelButton extends ControlButton {
    protected bg = themeColors.cancel.cssText;
    protected bgHover = themeColors.cancelHover.cssText;
    override icon = themeIcons.x.medium;
    protected override defaultTitle = "Cancel";
    override pulse = true;
}

@customElement("collama-context-button")
export class ContextButton extends ControlButton {
    protected bg = themeColors.context.cssText;
    protected bgHover = themeColors.contextHover.cssText;
    override icon = themeIcons.paperclip.medium;
    protected override defaultTitle = "Add context";
}

@customElement("collama-compress-button")
export class CompressButton extends ControlButton {
    protected bg = themeColors.compress.cssText;
    protected bgHover = themeColors.compressHover.cssText;
    override icon = themeIcons.compress.medium;
    protected override defaultTitle = "Summarize conversation";
}

@customElement("collama-gallery-button")
export class GalleryButton extends ControlButton {
    protected bg = themeColors.gallery.cssText;
    protected bgHover = themeColors.galleryHover.cssText;
    override icon = themeIcons.gallery.medium;
    protected override defaultTitle = "Open Prompt Gallery";
}

@customElement("collama-auto-accept-button")
export class AutoAcceptButton extends ControlButton {
    protected bg = themeColors.autoAccept.cssText;
    protected bgHover = themeColors.autoAcceptHover.cssText;
    protected override defaultTitle = "Turn on auto-accept edits";

    @property({ type: Boolean, reflect: true }) active = false;

    protected override willUpdate(changedProperties: PropertyValues<this>) {
        if (changedProperties.has("active")) {
            this.pulse = this.active;
            this.icon = this.active ? themeIcons.alertTriangle.medium : themeIcons.circleCheckBig.medium;
            this.title = this.active ? "Turn off auto-accept edits" : "Turn on auto-accept edits";
        }
    }
}

/**
 * Token counter — displays a formatted number. Not a real button (no action).
 */
@customElement("collama-token-counter")
export class TokenCounter extends ControlButton {
    protected bg = themeColors.submit.cssText;
    protected bgHover = themeColors.submit.cssText;
    protected override defaultTitle = "Agent token usage";

    @property({ type: Number }) value = 0;

    private _formatted = "";

    protected override willUpdate(changedProperties: PropertyValues<this>) {
        if (changedProperties.has("value")) {
            this._formatted = this.value >= 1000 ? this.value.toLocaleString("de-DE") : String(this.value);
        }
    }

    protected override render() {
        return html`<button class="control-button counter" title=${this.title} disabled>${this._formatted}</button>`;
    }
}

/**
 * Duration counter — displays mm:ss. Not a real button (no action).
 */
@customElement("collama-duration-counter")
export class DurationCounter extends ControlButton {
    protected bg = themeColors.submit.cssText;
    protected bgHover = themeColors.submit.cssText;
    protected override defaultTitle = "Agent duration";

    @property({ type: Number }) value = 0;

    private _formatted = "";

    protected override willUpdate(changedProperties: PropertyValues<this>) {
        if (changedProperties.has("value")) {
            const mins = Math.floor(this.value / 60);
            const secs = this.value % 60;
            this._formatted = `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
        }
    }

    protected override render() {
        return html`<button class="control-button counter" title=${this.title} disabled>${this._formatted}</button>`;
    }
}
