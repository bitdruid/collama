import { html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { themeIcons } from "../../styles";
import { BaseOverlay } from "../overlay/base-overlay";
import { baseModalStyles } from "./styles";

/**
 * Base modal component that can be extended for specific modal types.
 * Provides common modal functionality: show/hide with fade animations,
 * close button, click-outside-to-close, keyboard handling, and customizable title and content.
 */
@customElement("collama-base-modal")
export class BaseModal extends BaseOverlay {
    static override styles = [baseModalStyles];
    @property({ type: String }) title = "Modal";

    /**
     * Show the modal with optional title override
     */
    override show(title?: string) {
        if (title) {
            this.title = title;
        }
        super.show();
    }

    toggle(title?: string) {
        if (title) {
            this.title = title;
        }
        super.toggle();
    }

    /**
     * Override this method to provide custom modal content
     */
    protected renderContent(): TemplateResult {
        return html`<slot></slot>`;
    }

    /**
     * Override this method to render extra content next to the title (e.g. a warning sign)
     */
    protected renderHeaderExtra(): TemplateResult {
        return html``;
    }

    /**
     * Override this method to customize the title content (defaults to the plain title text)
     */
    protected renderTitle(): TemplateResult {
        return html`${this.title}`;
    }

    override render() {
        if (!this._open) {
            return html``;
        }

        return html`
            <div class="modal-content ${this._visible ? "fade-in" : "fade-out"}">
                <div class="modal-header">
                    <div class="modal-title">
                        <h3>${this.renderTitle()}</h3>
                        ${this.renderHeaderExtra()}
                    </div>
                    <span class="close-btn" @click=${this.close}>${themeIcons.x.large}</span>
                </div>
                <div class="modal-body">${this.renderContent()}</div>
            </div>
        `;
    }
}
