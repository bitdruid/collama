import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { chatModalStyles } from "./styles";

/**
 * Reusable slide-up modal shell.
 *
 * Provides the visual container (background, border, animations, close button)
 * and behavioral logic (outside-click, Escape key, animated close).
 * Content is projected via the default `<slot>`.
 *
 * Usage:
 * ```html
 * <collama-chat-modal .open=${this.showModal} @modal-close=${this._onClose}>
 *     <h3>Title</h3>
 *     <p>Any content here</p>
 * </collama-chat-modal>
 * ```
 */
@customElement("collama-chat-modal")
export class ChatModal extends LitElement {
    static styles = chatModalStyles;

    @property({ type: Boolean }) open = false;
    @state() private _closing = false;

    close() {
        if (this._closing) {
            return;
        }
        this._closing = true;

        const modal = this.shadowRoot?.querySelector(".modal") as HTMLElement | null;
        if (modal) {
            modal.addEventListener(
                "transitionend",
                () => {
                    this._closing = false;
                    this.dispatchEvent(new CustomEvent("modal-close", { bubbles: true, composed: true }));
                },
                { once: true },
            );
        } else {
            this._closing = false;
            this.dispatchEvent(new CustomEvent("modal-close", { bubbles: true, composed: true }));
        }
    }

    updated(changed: Map<string, unknown>) {
        if (changed.has("open")) {
            if (this.open) {
                requestAnimationFrame(() => {
                    window.addEventListener("click", this._handleOutsideClick);
                });
                window.addEventListener("keydown", this._handleKeyDown);
            } else {
                window.removeEventListener("click", this._handleOutsideClick);
                window.removeEventListener("keydown", this._handleKeyDown);
            }
        }
    }

    disconnectedCallback() {
        window.removeEventListener("click", this._handleOutsideClick);
        window.removeEventListener("keydown", this._handleKeyDown);
        super.disconnectedCallback();
    }

    private _handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape" && this.open) {
            this.close();
        }
    };

    private _handleOutsideClick = (e: MouseEvent) => {
        if (!this.open) {
            return;
        }
        const path = e.composedPath();
        if (!path.includes(this)) {
            this.close();
        }
    };

    render() {
        if (!this.open) {
            return html``;
        }

        return html`
            <div class="modal ${this._closing ? "closing" : ""}">
                <div class="modal-content">
                    <span class="close-btn" @click=${this.close}>&times;</span>
                    <slot></slot>
                </div>
            </div>
        `;
    }
}
