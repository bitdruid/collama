import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { baseDropdownStyles } from "./styles";

/**
 * Base dropdown component that provides show/hide functionality with slide animations.
 * Extend this class or use it directly with slot content.
 */
@customElement("collama-base-dropdown")
export class BaseDropdown extends LitElement {
    static styles = baseDropdownStyles;

    @state() protected _open = false;
    @state() protected _visible = false;
    @property({ type: Boolean }) closeOnOutsideClick = true;
    @property({ type: Boolean }) closeOnEscape = true;

    protected closeEventName = "dropdown-close";

    /** Returns whether the dropdown is currently open */
    get isOpen(): boolean {
        return this._open;
    }

    private _handleDocumentClick = (e: MouseEvent) => {
        if (!this._open || !this.closeOnOutsideClick) {
            return;
        }
        const path = e.composedPath();
        // Don't close if clicking on the anchor element
        if (path.some((el) => el instanceof Element && el.hasAttribute("data-base-dropdown-anchor"))) {
            return;
        }
        // Close if clicking outside the dropdown
        if (!path.includes(this)) {
            this.close();
        }
    };

    connectedCallback() {
        super.connectedCallback();
        document.addEventListener("click", this._handleDocumentClick, true);
        document.addEventListener("keydown", this._handleKeyDown);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        document.removeEventListener("click", this._handleDocumentClick, true);
        document.removeEventListener("keydown", this._handleKeyDown);
    }

    private _handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && this._open && this.closeOnEscape) {
            this.close();
        }
    };

    show() {
        this._open = true;
        requestAnimationFrame(() => {
            this._visible = true;
        });
    }

    close() {
        if (!this._open) {
            return;
        }
        this._visible = false;
        setTimeout(() => {
            this._open = false;
            this.dispatchEvent(new CustomEvent(this.closeEventName, { bubbles: true, composed: true }));
        }, 250);
    }

    toggle() {
        if (this._open) {
            this.close();
            return;
        }
        this.show();
    }

    protected renderContent() {
        return html`<slot></slot>`;
    }

    override render() {
        return html`
            <div class="dropdown-overlay ${this._visible ? "open" : ""}" @click=${this.close}></div>
            <div class="dropdown-panel ${this._visible ? "open" : ""}">
                <div class="dropdown-content">${this.renderContent()}</div>
            </div>
        `;
    }
}
