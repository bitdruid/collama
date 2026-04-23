import { html, TemplateResult } from "lit";
import { customElement, property } from "lit/decorators.js";
import { icons } from "../../../../utils-front";
import { BaseOverlay } from "../overlay/base-overlay";
import { baseNotificationStyles } from "./styles";

/**
 * Base notification component that can be extended for specific notification types.
 * Provides shared overlay lifecycle while floating centered at the top of its container.
 */
@customElement("collama-base-notification")
export class BaseNotification extends BaseOverlay {
    static override styles = [baseNotificationStyles];

    @property({ type: String }) heading = "Notification";
    @property({ type: String }) text = "";

    constructor() {
        super();
        this.closeOnOutsideClick = false;
    }

    /**
     * Override this method to provide custom notification content.
     */
    protected renderContent(): TemplateResult {
        return this.text ? html`<p class="notification-text">${this.text}</p>` : html`<slot></slot>`;
    }

    override render() {
        if (!this._open) {
            return html``;
        }

        return html`
            <section class="notification-content ${this._visible ? "fade-in" : "fade-out"}">
                <h3 class="notification-heading">
                    <span class="notify-danger">${icons.alertTriangle}</span> ${this.heading}
                    <span class="notify-danger">${icons.alertTriangle}</span>
                </h3>
                ${this.renderContent()}
            </section>
        `;
    }
}
