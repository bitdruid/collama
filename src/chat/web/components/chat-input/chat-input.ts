import { html, LitElement } from "lit";
import { customElement, property, query } from "lit/decorators.js";
import { AttachedContext } from "../../../../common/context-chat";
import { defaultChatConfig, type ChatConfig, type ContextSearchResult } from "../../types";
import "./components/control-panel/control-panel";
import { chatInputStyles } from "./styles-shared";

@customElement("collama-chatinput")
export class ChatInput extends LitElement {
    static styles = chatInputStyles;

    @property({ type: Array }) contexts: AttachedContext[] = [];
    @property({ type: Boolean }) isLoading = false;
    @property({ type: Number }) agentToken = 0;
    @property({ type: Boolean }) hasTokenData = false;
    @property({ type: Boolean }) isGhost = false;
    @property({ type: Array }) contextSearchResults: ContextSearchResult[] = [];
    @property({ type: Object }) config: ChatConfig = defaultChatConfig;

    @query("collama-control-panel")
    private controlPanel!: HTMLElement;

    private _handlePrompt(e: CustomEvent) {
        const cp = this.controlPanel as unknown as { userInput?: string };
        if (cp) {
            cp.userInput = e.detail.value;
        }
    }

    render() {
        return html`
            <collama-control-panel
                class="panel active"
                .contexts=${this.contexts}
                .isLoading=${this.isLoading}
                .agentToken=${this.agentToken}
                .hasTokenData=${this.hasTokenData}
                .isGhost=${this.isGhost}
                .contextSearchResults=${this.contextSearchResults}
                .config=${this.config}
                @submit-prompt=${this._handlePrompt}
            ></collama-control-panel>
        `;
    }
}
