import { css, html, LitElement } from "lit";
import { logWebview } from "../chat_container/chat_container";

export class TokenCounter extends LitElement {
    static properties = {
        agentToken: { type: Number },
    };

    agentToken!: number;

    /* ----------------------------------------------------------- */

    static styles = css`
        :host {
            display: inline-block;
        }

        .wrapper {
            display: inline-flex;
            background-color: var(--vscode-input-background);
            border-radius: 8px;
            border: 2px solid var(--vscode-commandCenter-activeBorder);
            overflow: hidden;
            font-family: monospace;
            font-size: 14px;
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        }
        .digit {
            padding: 4px 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 1ch;
        }
        .digit:not(:last-child) {
            border-right: 1px solid grey;
        }
    `;

    /* ----------------------------------------------------------- */

    render() {
        const displayValue = String(this.agentToken ?? 0)
            .slice(0, 7)
            .padStart(7, "0");

        return html`
            <div class="wrapper">
                ${displayValue
                    .split("")
                    .map((d) => html`<div class="digit" title="Current token used by tools."">${d}</div>`)}
            </div>
        `;
    }
}

customElements.define("collama-token-counter", TokenCounter);
