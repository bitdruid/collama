import { html, LitElement } from "lit";
import { state } from "lit/decorators.js";
import { AttachedContext } from "../../../../common/context-chat";
import "./components/control-panel/control-panel";
import "./components/prompt-gallery/prompt-gallery";
import "./components/tool-confirm/tool-confirm";
import type { ToolConfirmRequest } from "./components/tool-confirm/tool-confirm";
import { chatInputStyles } from "./styles-shared";

export class ChatInput extends LitElement {
    @state()
    private showGallery = false;

    static get properties() {
        return {
            contexts: { type: Array },
            isLoading: { type: Boolean },
            agentToken: { type: Number },
            hasTokenData: { type: Boolean },
            toolConfirmRequest: { type: Object },
        };
    }

    static styles = chatInputStyles;

    contexts: AttachedContext[] = [];
    isLoading = false;
    agentToken = 0;
    hasTokenData = false;
    toolConfirmRequest: ToolConfirmRequest | null = null;

    private get _activePanel(): string {
        if (this.toolConfirmRequest !== null) {
            return "tool-confirm";
        }
        if (this.showGallery) {
            return "gallery";
        }
        return "control-panel";
    }

    private _openGallery() {
        this.showGallery = true;
    }

    private _closeGallery() {
        this.showGallery = false;
    }

    private _handlePrompt(e: CustomEvent) {
        const value = e.detail.value;
        // Close gallery first so control-panel becomes visible (display: block),
        // then set userInput after render — otherwise _adjustRows measures a hidden textarea.
        this.showGallery = false;
        this.updateComplete.then(() => {
            const cp = this.shadowRoot?.querySelector("collama-control-panel") as any;
            if (cp) {
                cp.userInput = value;
            }
        });
    }

    render() {
        const active = this._activePanel;

        return html`
            <collama-control-panel
                class="panel ${active === "control-panel" ? "active" : ""}"
                .contexts=${this.contexts}
                .isLoading=${this.isLoading}
                .agentToken=${this.agentToken}
                .hasTokenData=${this.hasTokenData}
                @gallery-click=${this._openGallery}
            ></collama-control-panel>

            <collama-prompt-gallery
                class="panel ${active === "gallery" ? "active" : ""}"
                .visible=${this.showGallery}
                @submit-prompt=${this._handlePrompt}
                @close-gallery=${this._closeGallery}
            >
            </collama-prompt-gallery>

            <collama-tool-confirm
                class="panel ${active === "tool-confirm" ? "active" : ""}"
                .request=${this.toolConfirmRequest}
            >
            </collama-tool-confirm>
        `;
    }
}

customElements.define("collama-chatinput", ChatInput);
