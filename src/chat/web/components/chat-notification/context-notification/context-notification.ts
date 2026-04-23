import { html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { BaseNotification } from "../../template-components/notification/base-notification";

type ContextNotificationKind = "threshold" | "out-of-context";

@customElement("collama-context-notification")
export class ContextNotification extends BaseNotification {
    @property({ type: String }) kind: ContextNotificationKind = "threshold";
    @property({ type: Number }) contextUsed = 0;
    @property({ type: Number }) contextMax = 0;

    constructor() {
        super();
        this.heading = "Context";
    }

    private get contextPercent(): number {
        if (this.contextMax <= 0) {
            return 0;
        }
        return Math.min(100, Math.round((this.contextUsed / this.contextMax) * 100));
    }

    protected override renderContent() {
        if (this.kind === "out-of-context") {
            return html` <p class="notification-text">Some messages left the context<br />Consider summarizing</p> `;
        }

        const percent = this.contextPercent;
        return html`
            <p class="notification-text">
                Context filled up${percent > 0 ? html` to ${percent}%` : ""}<br />Consider summarizing
            </p>
        `;
    }
}
