// src/components/chat-sessions.ts
import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";

import "./header/chat_session_header";
import "./popup/chat_session_popup";

import { ChatSessionStore } from "../services/chat_session_store";
import { chatSessionStyle } from "../styles/chat_session_style";
import { logWebview } from "../../chat_container/chat_container";

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}


@customElement("collama-chatsessions")
export class ChatSessions extends LitElement {

    static styles = chatSessionStyle;

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
    
    this.dispatchEvent(new CustomEvent("select-session", {
        detail: { id: id },  // <-- von sessionId zu id ändern
        bubbles: true,
        composed: true
    }));
}

    private _handleDeleteSession(id: string) {
        logWebview("massimo_session: " + id);
        ChatSessionStore.instance.deleteSession(id);
    }

    private _handleRenameSession(id: string, newTitle: string) {
        ChatSessionStore.instance.renameSession(id, newTitle);
    }

    render() {
        return html`
            <collama-chatsession-header
                .isOpen=${this.isOpen}
                @toggle=${this._toggleOpen}
                .contextUsed=${this.contextUsed}
                .contextMax=${this.contextMax}
            ></collama-chatsession-header>

            <div
                class="popup-overlay ${this.isOpen ? "open" : ""}"
                @click=${() => (this.isOpen = false)}
            ></div>

            <collama-chatsessions-popup
                .isOpen=${this.isOpen}
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                @new-chat=${this._handleNewChat}
                @select-session=${(e: CustomEvent) => this._handleSelectSession(e.detail.id)}
                @delete-session=${(e: CustomEvent) => this._handleDeleteSession(e.detail.id)}
                @rename-session=${(e: CustomEvent) =>
                    this._handleRenameSession(e.detail.id, e.detail.newTitle)}
            ></collama-chatsessions-popup>
        `;
    }
}
