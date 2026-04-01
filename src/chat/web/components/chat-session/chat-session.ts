// src/components/chat-sessions.ts
import { LitElement, css, html } from "lit";
import { customElement } from "lit/decorators.js";

import "./components/dropdown/chat-session-dropdown";
import "./components/header/chat-session-header";

import { ChatSessionStore } from "./chat-session-store";

export interface ChatSession {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
}

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

    static properties = {
        isOpen: { state: true },
        sessions: { state: true },
        activeSessionId: { state: true },
        contextUsed: { state: true },
        contextMax: { state: true },
    };

    isOpen = false;
    sessions: ChatSession[] = [];
    activeSessionId = "";
    contextUsed = 0;
    contextMax = 0;

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
                .contextUsed=${this.contextUsed}
                .contextMax=${this.contextMax}
            ></collama-chatsession-header>

            <div class="dropdown-overlay ${this.isOpen ? "open" : ""}" @click=${() => (this.isOpen = false)}></div>

            <collama-chatsessions-dropdown
                .isOpen=${this.isOpen}
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                @new-chat=${this._handleNewChat}
                @select-session=${(e: CustomEvent) => this._handleSelectSession(e.detail.id)}
                @delete-session=${(e: CustomEvent) => this._handleDeleteSession(e.detail.id)}
                @rename-session=${(e: CustomEvent) => this._handleRenameSession(e.detail.id, e.detail.newTitle)}
                @copy-session=${(e: CustomEvent) => this._handleCopySession(e.detail.id)}
            ></collama-chatsessions-dropdown>
        `;
    }
}
