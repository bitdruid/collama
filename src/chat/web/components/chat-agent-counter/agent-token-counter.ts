import { html, LitElement } from "lit";
import { agentTokenCounterStyles } from "./styles";

export class TokenCounter extends LitElement {
    static properties = {
        agentToken: { type: Number },
        visible: { type: Boolean },
    };

    agentToken!: number;
    visible: boolean = false;

    static styles = agentTokenCounterStyles;

    private _formatTokens(n: number): string {
        if (n >= 1000) {
            return n.toLocaleString("de-DE");
        }
        return String(n);
    }

    render() {
        const displayValue = this._formatTokens(this.agentToken ?? 0);

        return html`
            <div class="box ${this.visible ? "visible" : ""}">
                <span class="label">Agent Tokens:</span>
                <span class="value">${displayValue}</span>
            </div>
        `;
    }
}

customElements.define("collama-token-counter", TokenCounter);
