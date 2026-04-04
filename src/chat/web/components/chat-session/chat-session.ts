// src/components/chat-sessions.ts
import { LitElement, css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import "./components/dropdown/chat-session-dropdown";
import "./components/header/chat-session-header";

import type { ChatSession } from "../../types";
import { ChatSessionStore } from "./chat-session-store";

@customElement("collama-chatsessions")
export class ChatSessions extends LitElement {
    static styles = css`
        :host {
            position: relative;
        }

        .dropdown-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
        }

        .dropdown-overlay.open {
            display: block;
        }
    `;

    @state() isOpen = false;
    @property({ type: Array }) sessions: ChatSession[] = [];
    @property({ type: String }) activeSessionId = "";
    @property({ type: Number }) contextUsed = 0;
    @property({ type: Number }) contextMax = 0;

    private _onStoreChange = () => this._updateFromStore();

    private handleSelectSession = (e: CustomEvent) => this._handleSelectSession(e.detail.id);
    private handleDeleteSession = (e: CustomEvent) => this._handleDeleteSession(e.detail.id);
    private handleRenameSession = (e: CustomEvent) => this._handleRenameSession(e.detail.id, e.detail.newTitle);
    private handleCopySession = (e: CustomEvent) => this._handleCopySession(e.detail.id);
    private handleOverlayClick = () => (this.isOpen = false);

    connectedCallback() {
        super.connectedCallback();
        ChatSessionStore.instance.addEventListener("change", this._onStoreChange);
        this._updateFromStore();
    }

    disconnectedCallback() {
        ChatSessionStore.instance.removeEventListener("change", this._onStoreChange);
        super.disconnectedCallback();
    }

    private _updateFromStore() {
        const store = ChatSessionStore.instance;
        this.sessions = [...store.sessions];
        this.activeSessionId = store.activeSessionId;
        this.contextUsed = store.contextUsed;
        this.contextMax = store.contextMax;
    }

    private _toggleOpen() {
        this.isOpen = !this.isOpen;
    }

    private _handleNewChat() {
        ChatSessionStore.instance.newChat();
        this.isOpen = false;
    }

    private _handleNewGhostChat() {
        this.isOpen = false;
        this.dispatchEvent(new CustomEvent("new-ghost-chat", { bubbles: true, composed: true }));
    }

    private _handleSelectSession(id: string) {
        ChatSessionStore.instance.selectSession(id);
        this.isOpen = false;

        this.dispatchEvent(
            new CustomEvent("select-session", {
                detail: { id: id },
                bubbles: true,
                composed: true,
            }),
        );
    }

    private _handleDeleteSession(id: string) {
        ChatSessionStore.instance.deleteSession(id);
    }

    private _handleRenameSession(id: string, newTitle: string) {
        ChatSessionStore.instance.renameSession(id, newTitle);
    }

    private _handleCopySession(id: string) {
        ChatSessionStore.instance.copySession(id);
    }

    render() {
        return html`
            <collama-chatsession-header
                .isOpen=${this.isOpen}
                @toggle=${this._toggleOpen}
                @new-ghost-chat=${this._handleNewGhostChat}
                .contextUsed=${this.contextUsed}
                .contextMax=${this.contextMax}
            ></collama-chatsession-header>

            <div class="dropdown-overlay ${this.isOpen ? "open" : ""}" @click=${this.handleOverlayClick}></div>

            <collama-chatsessions-dropdown
                .isOpen=${this.isOpen}
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                @new-chat=${this._handleNewChat}
                @select-session=${this.handleSelectSession}
                @delete-session=${this.handleDeleteSession}
                @rename-session=${this.handleRenameSession}
                @copy-session=${this.handleCopySession}
            ></collama-chatsessions-dropdown>
        `;
    }
}
