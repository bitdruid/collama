// src/chat/frontend/chat-root/components/chat-header/chat-header.ts
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "./components/chat-transfer-button/chat-transfer-button";
import "./components/context-usage-bar/context-usage-bar";
import "./components/create-chat-button/create-chat-button";
import "./components/session-button/session-button";
import "./components/toggle-chat-type-button/toggle-chat-type-button";
import "./components/settings-button/settings-button";

import { themeIcons } from "../../../styles";
import { chatHeaderStyles } from "./styles";

@customElement("collama-chatheader")
export class ChatHeader extends LitElement {
    static styles = [chatHeaderStyles];

    @property({ type: Number }) contextUsed = 0;
    @property({ type: Number }) contextMax = 0;
    @property({ type: Number }) contextTrimmed = 0;
    @property({ type: String }) contextFlash = "";
    @property({ type: Boolean }) isGenerating = false;
    @property({ type: Boolean }) sessionDropdownOpen = false;
    @property({ type: Boolean }) settingsDropdownOpen = false;
    @property({ type: Boolean }) showSettingsBadge = false;
    @property({ type: Number }) activeShells = 0;
    @property({ type: Boolean }) isGhost = false;

    private _handleNewChat(event: Event) {
        event.stopPropagation();
        if (this.isGenerating) {
            return;
        }
        this.dispatchEvent(new CustomEvent("new-chat", { bubbles: true, composed: true }));
    }

    render() {
        return html`
            <div class="header-bar">
                <div class="header-left">
                    <collama-session-button .disabled=${this.isGenerating}></collama-session-button>
                    <collama-settings-button
                        .disabled=${this.isGenerating}
                        .showBadge=${this.showSettingsBadge}
                    ></collama-settings-button>
                    <span
                        class="shell-indicator ${this.activeShells > 0 ? "visible" : ""}"
                        title="${this.activeShells > 0
                            ? `${this.activeShells} active shell session${this.activeShells > 1 ? "s" : ""}`
                            : ""}"
                    >
                        <span class="shell-dot"></span>
                        <span class="shell-count">${this.activeShells}</span>
                    </span>
                </div>
                <div class="header-actions">
                    <collama-context-usage-bar
                        .used=${this.contextUsed}
                        .max=${this.contextMax}
                        .trimmed=${this.contextTrimmed}
                        .flash=${this.contextFlash}
                    ></collama-context-usage-bar>
                    <collama-chat-transfer-button
                        mode="import"
                        .disabled=${this.isGenerating}
                    ></collama-chat-transfer-button>
                    <collama-chat-transfer-button
                        mode="export"
                        .disabled=${this.isGenerating}
                    ></collama-chat-transfer-button>
                    <collama-toggle-chat-button
                        ?pulse=${this.isGhost}
                        .disabled=${this.isGenerating}
                    ></collama-toggle-chat-button>
                    <collama-create-chat-button
                        .disabled=${this.isGenerating}
                        @new-chat=${this._handleNewChat}
                    ></collama-create-chat-button>
                </div>
            </div>
        `;
    }
}
