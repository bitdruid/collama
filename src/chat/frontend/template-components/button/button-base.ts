import { LitElement, type PropertyValues, type TemplateResult } from "lit";
import { property } from "lit/decorators.js";

/**
 * Shared base for all button-type components. Provides:
 * - `title` / `defaultTitle` fallback
 * - `disabled` property
 * - `icon` property (TemplateResult)
 * - `focus()` delegation to inner `<button>`
 * - `_emitAction()` → `action` CustomEvent
 *
 * Subclasses provide their own `render()` and `static styles`.
 */
export abstract class ButtonBase extends LitElement {
    @property({ type: String }) title = "";
    @property({ type: Boolean, reflect: true }) disabled = false;
    @property({ attribute: false }) icon: TemplateResult | null = null;

    /** Override in subclass to set a fallback title when none is given. */
    protected defaultTitle = "";

    override connectedCallback() {
        super.connectedCallback();
        this._applyDefaultTitle();
    }

    protected override updated(changedProperties: PropertyValues<this>) {
        if (changedProperties.has("title")) {
            this._applyDefaultTitle();
        }
    }

    override focus(options?: FocusOptions) {
        this.renderRoot.querySelector<HTMLButtonElement>("button")?.focus(options);
    }

    /** Dispatch an `action` event (bubbles, composed). */
    protected _emitAction = () => {
        this.dispatchEvent(new CustomEvent("action", { bubbles: true, composed: true }));
    };

    private _applyDefaultTitle() {
        if (!this.hasAttribute("title") && this.defaultTitle) {
            this.title = this.defaultTitle;
        }
    }
}
