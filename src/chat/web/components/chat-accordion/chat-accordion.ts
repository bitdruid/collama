import { LitElement, html } from "lit";

import { highlightCodeBlock, icons } from "../../../utils-front";
import { accordionStyles } from "./styles";

export type AccordionType = "think" | "summary" | "code" | "tool" | "tool-group" | "context";

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
 * @property {string} code - The raw code string to display and highlight (used instead of slot).
 * @property {string} copyCode - Specific text to copy when clicking the copy button (defaults to `code`).
 * @property {string} language - The language identifier for syntax highlighting (e.g., 'typescript', 'python').
 */
export class ChatAccordion extends LitElement {
    static get properties() {
        return {
            label: { type: String },
            description: { type: String },
            type: { type: String },
            expanded: { type: Boolean },
            code: { type: String },
            copyCode: { type: String },
            language: { type: String },
        };
    }

    static styles = accordionStyles;

    label: string = "";
    description: string = "";
    type: AccordionType = "code";
    expanded: boolean = false;
    code: string = "";
    copyCode: string = "";
    language: string = "";

    private _highlighted = false;

    /**
     * Called when the element is added to the document's DOM.
     * Explicitly avoids auto-expansion logic for user code.
     */
    connectedCallback() {
        super.connectedCallback();
    }

    /**
     * Called after the element's DOM has been updated the first time.
     * Defers syntax highlighting to ensure only the final, stable instance
     * processes the code block, preventing wasted resources on temporary
     * instances created during streaming re-renders.
     */
    firstUpdated() {
        if (this.expanded && !this._highlighted) {
            setTimeout(() => {
                if (this.isConnected && !this._highlighted) {
                    this._highlightCode();
                }
            }, 500);
        }
    }

    /**
     * Toggles the expanded state of the accordion.
     * Triggers code highlighting if the accordion is being expanded for the first time.
     */
    private _toggle() {
        this.expanded = !this.expanded;
        // Highlight on first expand
        if (this.expanded && !this._highlighted) {
            this._highlightCode();
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
            const span = (e.currentTarget as HTMLElement).querySelector("span");
            if (span) {
                span.textContent = "Copied!";
                setTimeout(() => {
                    span.textContent = "Copy";
                }, 1500);
            }
        } catch (err) {
            console.error("Failed to copy:", err);
        }
    }

    /**
     * Performs syntax highlighting on the code block.
     * Runs inside requestAnimationFrame to ensure DOM readiness and prevents re-highlighting.
     */
    private _highlightCode() {
        requestAnimationFrame(() => {
            if (!this._highlighted) {
                this._highlighted = highlightCodeBlock(this.shadowRoot, "pre code", this.language || undefined);
            }
        });
    }

    /**
     * Returns the SVG icon corresponding to the current accordion type.
     * @returns The SVG string or null if no icon matches.
     */
    private _renderIcon() {
        switch (this.type) {
            case "think":
                return icons.thinking;
            case "summary":
                return icons.summary;
            case "tool":
            case "tool-group":
                return icons.tool;
            case "context":
                return icons.paperclip;
            case "code":
                return icons.code;
            default:
                return null;
        }
    }

    /**
     * Renders the copy button if the type is 'code' or 'summary' and code is present.
     * @returns A template result for the button or null.
     */
    private _renderCopyButton() {
        if ((this.type !== "code" && this.type !== "summary") || (!this.code && !this.copyCode)) {
            return null;
        }
        return html`
            <button class="copy-btn" @click=${this._handleCopy} title="Copy code">
                ${icons.copy}
                <span>Copy</span>
            </button>
        `;
    }

    render() {
        return html`
            <div class="accordion type-${this.type}">
                <button class="accordion-header" @click=${this._toggle}>
                    <span class="accordion-icon">${this._renderIcon()}</span>
                    <span class="accordion-label"
                        >${this.label}${this.description
                            ? html`<span class="accordion-description">${this.description}</span>`
                            : ""}</span
                    >
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
