import { html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { DismissalController } from "../controllers/dismissal-controller";
import { basePopupStyles } from "./styles";

/**
 * Base popup component that can be extended for specific popup types.
 * Provides common popup functionality: show/hide with fade animations,
 * click-outside-to-close, keyboard handling (Escape to close), and customizable content.
 */
@customElement("collama-base-popup")
export class BasePopup extends LitElement {
    static styles = [basePopupStyles];

    @state() protected _open = false;
    @state() protected _visible = false;
    @property({ type: Boolean }) closeOnOutsideClick = true;
    @property({ type: Boolean }) closeOnEscape = true;
    @property({ type: Boolean }) autoShow = false;

    private _dismissalController: DismissalController;

    /**
     * Show the popup
     */
    show() {
        this._open = true;
        // Small delay to trigger fade-in animation
        requestAnimationFrame(() => {
            this._visible = true;
        });
        // Update controller options when showing
        this._dismissalController.setOptions({
            closeOnOutsideClick: this.closeOnOutsideClick,
            closeOnEscape: this.closeOnEscape,
        });
    }

    /**
     * Close the popup
     */
    close() {
        this._visible = false;
        setTimeout(() => {
            this._open = false;
            this.dispatchEvent(new CustomEvent("popup-close", { bubbles: true, composed: true }));
        }, 200);
    }

    /**
     * Toggle the popup visibility
     */
    toggle() {
        if (this._open) {
            this.close();
        } else {
            this.show();
        }
    }

    /**
     * Handle document click events.
     * Clicks on data-popup-anchor elements always close the popup (toggle button).
     * Other outside clicks close the popup if closeOnOutsideClick is enabled.
     */
    private _onDocumentClick(e: MouseEvent) {
        const path = e.composedPath();
        if (path.some((el) => el instanceof Element && el.hasAttribute("data-popup-anchor"))) {
            this.close();
            return;
        }
        if (this.closeOnOutsideClick && !path.includes(this)) {
            this.close();
        }
    }

    constructor() {
        super();
        this._dismissalController = new DismissalController(this, {
            closeOnOutsideClick: this.closeOnOutsideClick,
            closeOnEscape: this.closeOnEscape,
            onDismiss: () => this.close(),
            onDocumentClick: (e: MouseEvent) => this._onDocumentClick(e),
        });
    }

    firstUpdated(changedProperties: Map<PropertyKey, unknown>) {
        super.firstUpdated(changedProperties);
        if (this.autoShow) {
            this.show();
        }
    }

    /**
     * Override this method to provide custom popup content
     */
    protected renderContent(): TemplateResult {
        return html`<slot></slot>`;
    }

    render() {
        if (!this._open) {
            return html``;
        }

        return html`
            <div class="popup-content ${this._visible ? "fade-in" : "fade-out"}">${this.renderContent()}</div>
        `;
    }
}
