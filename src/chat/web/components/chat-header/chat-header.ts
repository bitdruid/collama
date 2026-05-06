// src/chat/web/components/chat-header/chat-header.ts
import { LitElement, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import "./components/context-usage-bar/context-usage-bar";
import "./components/create-chat-button/create-chat-button";
import "./components/session-button/session-button";
import "./components/settings-button/settings-button";

import { themeIcons } from "../../styles";
import { chatHeaderStyles } from "./styles";

@customElement("collama-chatheader")
export class ChatHeader extends LitElement {
    static styles = [chatHeaderStyles];

    @property({ type: Number }) contextUsed = 0;
    @property({ type: Number }) contextMax = 0;
    @property({ type: Boolean }) isGenerating = false;
    @property({ type: Boolean }) sessionDropdownOpen = false;
    @property({ type: Boolean }) settingsDropdownOpen = false;
    @property({ type: Boolean }) showSettingsBadge = false;

    private _handleNewGhostChat() {
        if (this.isGenerating) {
            return;
        }
        this.dispatchEvent(new CustomEvent("new-ghost-chat", { bubbles: true, composed: true }));
    }

    private _handleNewChat() {
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
                </div>
                <div class="header-actions">
                    <span class="usage-icon">${themeIcons.brain.large}</span>
                    <collama-context-usage-bar
                        .used=${this.contextUsed}
                        .max=${this.contextMax}
                    ></collama-context-usage-bar>
                    <collama-create-chat-button
                        kind="ghost"
                        .disabled=${this.isGenerating}
                        @new-ghost-chat=${this._handleNewGhostChat}
                    ></collama-create-chat-button>
                    <collama-create-chat-button
                        kind="normal"
                        .disabled=${this.isGenerating}
                        @new-chat=${this._handleNewChat}
                    ></collama-create-chat-button>
                </div>
            </div>
        `;
    }
}
