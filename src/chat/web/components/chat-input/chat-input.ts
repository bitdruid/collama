import { html, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { AttachedContext } from "../../../../common/context-chat";
import type { ContextSearchResult } from "./components/context-search/context-search";
import "./components/control-panel/control-panel";
import "./components/tool-confirm/tool-confirm";
import type { ToolConfirmRequest } from "./components/tool-confirm/tool-confirm";
import { chatInputStyles } from "./styles-shared";

export class ChatInput extends LitElement {
    static get properties() {
        return {
            contexts: { type: Array },
            isLoading: { type: Boolean },
            agentToken: { type: Number },
            hasTokenData: { type: Boolean },
            toolConfirmRequest: { type: Object },
            contextSearchResults: { type: Array },
        };
    }

    static styles = chatInputStyles;

    contexts: AttachedContext[] = [];
    isLoading = false;
    agentToken = 0;
    hasTokenData = false;
    toolConfirmRequest: ToolConfirmRequest | null = null;
    contextSearchResults: ContextSearchResult[] = [];

    @state() private _activePanel: "control-panel" | "tool-confirm" = "control-panel";

    updated() {
        this._activePanel = this.toolConfirmRequest !== null ? "tool-confirm" : "control-panel";
    }

    private _handlePrompt(e: CustomEvent) {
        const cp = this.shadowRoot?.querySelector("collama-control-panel") as any;
        if (cp) {
            cp.userInput = e.detail.value;
        }
    }

    render() {
        return html`
            <collama-control-panel
                class="panel ${this._activePanel === "control-panel" ? "active" : ""}"
                .contexts=${this.contexts}
                .isLoading=${this.isLoading}
                .agentToken=${this.agentToken}
                .hasTokenData=${this.hasTokenData}
                .contextSearchResults=${this.contextSearchResults}
                @submit-prompt=${this._handlePrompt}
            ></collama-control-panel>

            <collama-tool-confirm
                class="panel ${this._activePanel === "tool-confirm" ? "active" : ""}"
                .request=${this.toolConfirmRequest}
            ></collama-tool-confirm>
        `;
    }
}

customElements.define("collama-chatinput", ChatInput);
