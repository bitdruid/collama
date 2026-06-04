import { LitElement, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { highlightCodeBlock } from "../../utils";
import { themeIcons } from "../../../styles";
import { accordionStyles } from "./styles";
import "../../../template-components/banner";
import type { BannerType } from "../../../template-components/banner";

/** Accordion types are the banner types minus the standalone-only ones. */
export type AccordionType = Exclude<BannerType, "info" | "banner">;

/**
 * A collapsible accordion component for displaying structured chat content.
 *
 * This component supports various content types such as code blocks, thoughts,
 * summaries, and tool outputs. It handles syntax highlighting for code
 * and provides a copy-to-clipboard functionality.
 *
 * @element collama-accordion
 *
 * @property {string} label - The title text displayed in the accordion header.
 * @property {string} description - Optional subtitle or description text.
 * @property {AccordionType} type - The type of accordion, dictating the icon and behavior.
 * @property {boolean} expanded - Whether the accordion content is currently visible.
 * @property {string} code - The raw code string to display and highlight (rendered as <pre><code>).
 *                          If empty, the default <slot> is used for arbitrary slotted content.
 * @property {string} copyCode - Specific text to copy when clicking the copy button (defaults to `code`).
 * @property {string} language - The language identifier for syntax highlighting (e.g., 'typescript', 'python').
 */
@customElement("collama-accordion")
export class ChatAccordion extends LitElement {
    static styles = accordionStyles;

    @property({ type: String }) label: string = "";
    @property({ type: String }) description: string = "";
    @property({ type: String }) type: AccordionType = "code";
    @state() expanded: boolean = false;
    @property({ type: String }) code: string = "";
    @property({ type: String }) copyCode: string = "";
    @property({ type: String }) language: string = "";

    private _highlighted = false;
    private _copyText = "Copy";
    private _copyResetTimer: number | undefined;

    connectedCallback() {
        super.connectedCallback();
        if (this.type === "code") {
            this.expanded = true;
        }
    }

    disconnectedCallback() {
        if (this._copyResetTimer !== undefined) {
            clearTimeout(this._copyResetTimer);
            this._copyResetTimer = undefined;
        }
        super.disconnectedCallback();
    }

    /**
     * Public entry point. Called by chat-output once per accordion after
     * streaming ends or on history mount. Idempotent.
     */
    public async highlight() {
        if (this._highlighted) {
            return;
        }
        await this.updateComplete;
        if (!this._highlighted) {
            this._highlighted = highlightCodeBlock(this.shadowRoot, "pre code", this.language || undefined);
        }
    }

    private _toggle() {
        this.expanded = !this.expanded;
        if (this.expanded && !this._highlighted) {
            this.highlight();
        }
    }

    /**
     * Copies the code content to the clipboard and updates the button label temporarily.
     * @param e - The click event.
     */
    private async _handleCopy(e: Event) {
        e.stopPropagation();
        const textToCopy = this.copyCode || this.code;
        try {
            await navigator.clipboard.writeText(textToCopy);
            this._copyText = "Copied!";
            this.requestUpdate();
            this._copyResetTimer = window.setTimeout(() => {
                this._copyText = "Copy";
                this.requestUpdate();
                this._copyResetTimer = undefined;
            }, 1500);
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    }

    /**
     * Renders the copy button if the type is 'code' and code is present.
     * @returns A template result for the button or null.
     */
    private _renderCopyButton() {
        if (this.type !== "code" || (!this.code && !this.copyCode)) {
            return null;
        }
        return html`
            <button slot="actions" class="copy-btn" @click=${this._handleCopy} title="Copy code">
                ${themeIcons.copy.medium}
                <span>${this._copyText}</span>
            </button>
        `;
    }

    render() {
        return html`
            <div class="accordion type-${this.type}">
                <collama-banner
                    .type=${this.type}
                    .label=${this.label}
                    .description=${this.description}
                    .expanded=${this.expanded}
                    ?collapsible=${true}
                    @click=${this._toggle}
                >
                    ${this._renderCopyButton()}
                </collama-banner>
                <div class="accordion-body ${this.expanded ? "expanded" : ""}">
                    <div class="accordion-body-clip">
                        <div class="accordion-body-content">
                            ${this.code ? html`<pre><code>${this.code}</code></pre>` : html`<slot></slot>`}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
