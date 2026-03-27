import { html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
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

    private _handleDocumentClick: ((e: MouseEvent) => void) | null = null;
    private _handleKeyDown = (e: KeyboardEvent) => {
        if (this.closeOnEscape && e.key === "Escape") {
            this.close();
        }
    };

    /**
     * Show the popup
     */
    show() {
        this._open = true;
        // Small delay to trigger fade-in animation
        requestAnimationFrame(() => {
            this._visible = true;
        });
    }

    /**
     * Close the popup
     */
    close() {
        this._visible = false;
        // Wait for fade-out animation to complete before hiding
        setTimeout(() => {
            this._open = false;
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
     * Check if click is outside the popup
     * @param e - The mouse event
     */
    private _isClickOutside(e: MouseEvent): boolean {
        const path = e.composedPath();
        return !path.includes(this);
    }

    /**
     * Handle document click events for click-outside-to-close
     * @param e - The mouse event
     */
    private _onDocumentClick(e: MouseEvent) {
        if (this.closeOnOutsideClick && this._isClickOutside(e)) {
            this.close();
        }
    }

    /**
     * Set up document click listener when connected to DOM
     */
    connectedCallback() {
        super.connectedCallback();
        if (this.closeOnOutsideClick) {
            this._handleDocumentClick = (e: MouseEvent) => this._onDocumentClick(e);
            document.addEventListener("click", this._handleDocumentClick, { capture: true });
        }
        document.addEventListener("keydown", this._handleKeyDown);
    }

    /**
     * Clean up event listeners when disconnected from DOM
     */
    disconnectedCallback() {
        super.disconnectedCallback();
        if (this._handleDocumentClick) {
            document.removeEventListener("click", this._handleDocumentClick, { capture: true });
            this._handleDocumentClick = null;
        }
        document.removeEventListener("keydown", this._handleKeyDown);
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
            <div class="popup-content ${this._visible ? "fade-in" : "fade-out"}" @keydown=${this._handleKeyDown}>
                ${this.renderContent()}
            </div>
        `;
    }
}
