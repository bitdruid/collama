import { LitElement, html } from "lit";

import { highlightCodeBlock, icons } from "../../../utils";
import { accordionStyles } from "./styles/chat_accordion_styles";

export type AccordionType = "thinking" | "summary" | "code";

export class ChatAccordion extends LitElement {
    static get properties() {
        return {
            label: { type: String },
            type: { type: String },
            expanded: { type: Boolean },
            code: { type: String },
            copyCode: { type: String },
        };
    }

    static styles = accordionStyles

    label: string = "";
    type: AccordionType = "code";
    expanded: boolean = false;
    code: string = "";
    copyCode: string = "";

    private _highlighted = false;
    private _copyText = "Copy";

    connectedCallback() {
        super.connectedCallback();
        // No auto-expansion for user code
    }

    firstUpdated() {
        // Highlight immediately if expanded on first render
        if (this.expanded && !this._highlighted) {
            this._highlightCode();
        }
    }

    private _toggle() {
        this.expanded = !this.expanded;
        // Highlight on first expand
        if (this.expanded && !this._highlighted) {
            this._highlightCode();
        }
    }

    private async _handleCopy(e: Event) {
        e.stopPropagation();
        const textToCopy = this.copyCode || this.code;
        try {
            await navigator.clipboard.writeText(textToCopy);
            this._copyText = "Copied!";
            this.requestUpdate();
            setTimeout(() => {
                this._copyText = "Copy";
                this.requestUpdate();
            }, 1500);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    }

    private _highlightCode() {
        requestAnimationFrame(() => {
            if (!this._highlighted) {
                this._highlighted = highlightCodeBlock(this.shadowRoot);
            }
        });
    }

    private _renderIcon() {
        switch (this.type) {
            case "thinking":
                return icons.thinking;
            case "summary":
                return icons.summary;
            case "code":
                return icons.code;
            default:
                return null;
        }
    }

    private _renderCopyButton() {
        if (this.type !== "code" || (!this.code && !this.copyCode)) {
            return null;
        }
        return html`
            <button class="copy-btn" @click=${this._handleCopy} title="Copy code">
                ${icons.copy}
                <span>${this._copyText}</span>
            </button>
        `;
    }

    render() {
        return html`
            <div class="accordion type-${this.type}">
                <button class="accordion-header" @click=${this._toggle}>
                    <span class="accordion-icon">${this._renderIcon()}</span>
                    <span class="accordion-label">${this.label}</span>
                    <span class="accordion-actions">
                        ${this._renderCopyButton()}
                        <span class="accordion-arrow ${this.expanded ? "expanded" : ""}"> ${icons.chevronDown} </span>
                    </span>
                </button>
                <div class="accordion-content-wrapper ${this.expanded ? "expanded" : ""}">
                    <div class="accordion-content">
                        <div class="accordion-content-inner">
                            ${this.code ? html`<pre><code>${this.code}</code></pre>` : html`<slot></slot>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define("collama-accordion", ChatAccordion);
