import { LitElement, css, html } from "lit";

import { highlightCodeBlock, hljsStyles, icons } from "../../utils";

export type AccordionType = "think" | "summary" | "code" | "tool";

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

    static styles = [
        ...hljsStyles,
        css`
            :host {
                display: block;
                margin: 8px 0;
                position: relative;
                z-index: 0;
            }

            .accordion {
                border: 1px solid var(--vscode-commandCenter-activeBorder);
                border-radius: 6px;
                overflow: hidden;
                position: relative;
            }

            .accordion-header {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 10px;
                background: var(--vscode-textCodeBlock-background);
                color: var(--vscode-descriptionForeground);
                cursor: pointer;
                user-select: none;
                font-size: 0.9em;
                border: none;
                width: 100%;
                text-align: left;
                transition: background 0.15s;
            }

            .accordion-header:hover {
                background: var(--vscode-toolbar-hoverBackground);
            }

            .accordion-arrow {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
                transition: transform 0.2s ease;
            }

            .accordion-arrow.expanded {
                transform: rotate(180deg);
            }

            .accordion-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 16px;
                height: 16px;
            }

            .accordion-label {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            /* Smooth animation using CSS grid trick */
            .accordion-content-wrapper {
                display: grid;
                grid-template-rows: 0fr;
                transition: grid-template-rows 0.25s ease-out;
            }

            .accordion-content-wrapper.expanded {
                grid-template-rows: 1fr;
            }

            .accordion-content {
                overflow: hidden;
            }

            .accordion-content-inner {
                background: var(--vscode-editor-background);
                border-top: 1px solid var(--vscode-commandCenter-activeBorder);
                max-height: min(300px, 40vh);
                overflow: auto;
            }

            .accordion-content-wrapper:not(.expanded) .accordion-content-inner {
                border-top: none;
            }

            .accordion-content pre {
                margin: 0;
                min-width: max-content;
            }

            .accordion-content pre code {
                padding: 8px 10px;
                white-space: pre;
                display: block;
            }

            .accordion-content pre code.hljs {
                overflow-x: visible;
            }

            /* Type-specific styling */
            .accordion.type-think .accordion-header {
                border-left: 3px solid #2277a8;
            }

            .accordion.type-summary .accordion-header {
                border-left: 3px solid #e9a849;
            }

            .accordion.type-tool .accordion-header {
                border-left: 3px solid #d87979;
            }

            .accordion.type-code .accordion-header {
                border-left: none;
            }

            .accordion-actions {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .copy-btn {
                display: flex;
                align-items: center;
                gap: 4px;
                background: transparent;
                border: none;
                color: var(--vscode-descriptionForeground);
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
                font-size: 0.85em;
                transition:
                    background 0.15s,
                    color 0.15s;
            }

            .copy-btn:hover {
                background: var(--vscode-toolbar-hoverBackground);
                color: var(--vscode-foreground);
            }

            .copy-btn:active {
                background: var(--vscode-toolbar-activeBackground);
            }
        `,
    ];

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
            case "think":
                return icons.thinking;
            case "summary":
                return icons.summary;
            case "code":
                return icons.code;
            case "tool":
                return icons.tool;
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
