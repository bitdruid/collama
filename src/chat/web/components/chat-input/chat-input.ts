import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { AttachedContext } from "../../../../common/context-chat";
import type { ContextSearchResult, ToolConfirmRequest } from "../../types";
import "./components/control-panel/control-panel";
import "./components/tool-confirm/tool-confirm";
import { chatInputStyles } from "./styles-shared";

@customElement("collama-chatinput")
export class ChatInput extends LitElement {
    static styles = chatInputStyles;

    @property({ type: Array }) contexts: AttachedContext[] = [];
    @property({ type: Boolean }) isLoading = false;
    @property({ type: Number }) agentToken = 0;
    @property({ type: Boolean }) hasTokenData = false;
    @property({ type: Object }) toolConfirmRequest: ToolConfirmRequest | null = null;
    @property({ type: Array }) contextSearchResults: ContextSearchResult[] = [];

    @state() private _activePanel: "control-panel" | "tool-confirm" = "control-panel";

    @query("collama-control-panel")
    private controlPanel!: HTMLElement;

    updated() {
        this._activePanel = this.toolConfirmRequest !== null ? "tool-confirm" : "control-panel";
    }

    private _handlePrompt(e: CustomEvent) {
        const cp = this.controlPanel as unknown as { userInput?: string };
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
