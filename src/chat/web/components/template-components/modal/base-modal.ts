import { html, LitElement, TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { baseModalStyles } from "./styles";

/**
 * Base modal component that can be extended for specific modal types.
 * Provides common modal functionality: show/hide with fade animations,
 * close button, click-outside-to-close, keyboard handling, and customizable title and content.
 */
@customElement("collama-base-modal")
export class BaseModal extends LitElement {
    static styles = [baseModalStyles];

    @state() protected _open = false;
    @state() protected _visible = false;
    @property({ type: String }) title = "Modal";
    @property({ type: Boolean }) closeOnOutsideClick = true;
    @property({ type: Boolean }) closeOnEscape = true;

    private _handleDocumentClick: ((e: MouseEvent) => void) | null = null;
    private _handleKeyDown = (e: KeyboardEvent) => {
        if (this.closeOnEscape && e.key === "Escape") {
            this.close();
        }
    };

    /**
     * Show the modal with optional title override
     */
    show(title?: string) {
        if (title) {
            this.title = title;
        }
        this._open = true;
        // Small delay to trigger fade-in animation
        requestAnimationFrame(() => {
            this._visible = true;
        });
    }

    /**
     * Close the modal with fade-out animation
     */
    close() {
        this._visible = false;
        // Wait for fade-out animation to complete before hiding
        setTimeout(() => {
            this._open = false;
        }, 200);
    }

    /**
     * Check if click is outside the modal
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
     * Override this method to provide custom modal content
     */
    protected renderContent(): TemplateResult {
        return html`<slot></slot>`;
    }

    render() {
        if (!this._open) {
            return html``;
        }

        return html`
            <div class="modal-content ${this._visible ? "fade-in" : "fade-out"}" @keydown=${this._handleKeyDown}>
                <div class="modal-header">
                    <h3>${this.title}</h3>
                    <span class="close-btn" @click=${this.close}>&#10006;</span>
                </div>
                <div class="modal-body">${this.renderContent()}</div>
            </div>
        `;
    }
}
