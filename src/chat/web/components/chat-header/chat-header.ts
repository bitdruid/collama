// src/chat/web/components/chat-header/chat-header.ts
import { LitElement, PropertyValues, html } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { icons } from "../../styles/theme-icons";
import "./components/context-usage-bar/context-usage-bar";
import "./components/create-chat-button/create-chat-button";
import "./components/session-button/session-button";
import "./components/session-dropdown/session-dropdown";
import "./components/session-dropdown/session-empty";
import "./components/session-dropdown/session-item";

import type { ChatSession } from "../../types";
import { BaseDropdown } from "../template-components/dropdown/base-dropdown";
import { ChatSessionStore } from "./chat-session-store";
import { chatHeaderStyles } from "./styles";

@customElement("collama-chatheader")
export class ChatHeader extends LitElement {
    static styles = [chatHeaderStyles];

    @property({ type: Array }) sessions: ChatSession[] = [];
    @property({ type: String }) activeSessionId = "";
    @property({ type: Number }) contextUsed = 0;
    @property({ type: Number }) contextMax = 0;
    @property({ type: Boolean }) isGenerating = false;
    @state() private _dropdownOpen = false;

    @query("collama-session-dropdown")
    private _sessionDropdown!: BaseDropdown;

    private _onStoreChange = () => this._updateFromStore();

    connectedCallback() {
        super.connectedCallback();
        ChatSessionStore.instance.addEventListener("change", this._onStoreChange);
        this._updateFromStore();
    }

    disconnectedCallback() {
        ChatSessionStore.instance.removeEventListener("change", this._onStoreChange);
        super.disconnectedCallback();
    }

    firstUpdated() {
        this._sessionDropdown?.addEventListener("dropdown-close", this._onDropdownClose);
    }

    updated(changed: PropertyValues) {
        if (changed.has("isGenerating") && this.isGenerating) {
            this._sessionDropdown?.close();
        }
    }

    private _updateFromStore() {
        const store = ChatSessionStore.instance;
        this.sessions = [...store.sessions];
        this.activeSessionId = store.activeSessionId;
        this.contextUsed = store.contextUsed;
        this.contextMax = store.contextMax;
    }

    private _toggleDropdown() {
        if (this.isGenerating) {
            return;
        }
        this._sessionDropdown?.toggle();
        this._dropdownOpen = this._sessionDropdown?.isOpen ?? false;
    }

    private _onDropdownClose = () => {
        this._dropdownOpen = false;
    };

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

    private _handleSelectSession(id: string) {
        if (this.isGenerating) {
            return;
        }
        ChatSessionStore.instance.selectSession(id);

        this.dispatchEvent(
            new CustomEvent("select-session", {
                detail: { id: id },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleDeleteSession(id: string) {
        if (this.isGenerating) {
            return;
        }
        ChatSessionStore.instance.deleteSession(id);
    }

    private _handleRenameSession(id: string, newTitle: string) {
        if (this.isGenerating) {
            return;
        }
        ChatSessionStore.instance.renameSession(id, newTitle);
    }

    private _handleCopySession(id: string) {
        if (this.isGenerating) {
            return;
        }
        ChatSessionStore.instance.copySession(id);
    }

    render() {
        return html`
            <div class="header-bar">
                <collama-session-button
                    .disabled=${this.isGenerating}
                    .expanded=${this._dropdownOpen}
                    @toggle-session-dropdown=${this._toggleDropdown}
                ></collama-session-button>
                <div class="header-actions">
                    <span class="usage-icon">${icons.brain}</span>
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

            <collama-session-dropdown
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                @select-session=${(e: CustomEvent) => this._handleSelectSession(e.detail.id)}
                @delete-session=${(e: CustomEvent) => this._handleDeleteSession(e.detail.id)}
                @rename-session=${(e: CustomEvent) => this._handleRenameSession(e.detail.id, e.detail.newTitle)}
                @copy-session=${(e: CustomEvent) => this._handleCopySession(e.detail.id)}
            ></collama-session-dropdown>
        `;
    }
}
