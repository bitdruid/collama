import { html, LitElement } from "lit";
import { state } from "lit/decorators.js";

import { AttachedContext, ChatContext, ChatHistory } from "../../../../common/context-chat";
import "../chat-agent-counter/agent-token-counter";
import "../chat-output/output";
import "../chat-scroll-button/scroll-down-button";
import "../chat-session/chat-sessions";
import { ChatSession } from "../chat-session/chat-sessions";

import { createInboundDispatcher } from "./handlers-inbound";
import {
    onCancel,
    onCompress,
    onContextCleared,
    onCopySession,
    onDeleteMessage,
    onDeleteSession,
    onEditMessage,
    onNearBottomChanged,
    onNewChat,
    onRenameSession,
    onResendMessage,
    onSelectSession,
    onSubmit,
} from "./handlers-outbound";
import { chatContainerStyles } from "./styles";
import { backendApi } from "./utils";

/**
 * Root webview component that orchestrates the chat UI.
 *
 * Owns the authoritative message history (`wvChatContext`) and exposes a
 * Lit-reactive `messages` snapshot for child components. Delegates user
 * interactions to `handlers-outbound` and host messages to `handlers-inbound`.
 */
export class ChatContainer extends LitElement {
    static styles = chatContainerStyles;

    // -- Reactive state --
    @state() messages: ChatHistory[] = [];
    @state() sessions: ChatSession[] = [];
    @state() activeSessionId: string = "";
    @state() currentContexts: AttachedContext[] = [];
    @state() contextUsed: number = 0;
    @state() contextMax: number = 0;
    @state() contextStartIndex: number = 0;
    @state() isLoading: boolean = false;
    @state() agent_token: number = 0;
    @state() hasTokenData: boolean = false;
    @state() toastMessage: string = "";
    @state() showScrollButton: boolean = false;

    // -- Internal state --
    wvChatContext = new ChatContext();
    private _updateTimer: number | null = null;
    private _toastTimer: number | null = null;
    private _loadingTimeout: number | null = null;

    // -- Methods used by handler modules --

    /** Creates a fresh array snapshot from `wvChatContext` to trigger a Lit re-render. */
    syncMessages() {
        this.messages = [...this.wvChatContext.getMessages()];
    }

    /** Displays a toast message for 2.5 s, resetting the timer if called again before it clears. */
    showToast(message: string) {
        this.toastMessage = message;
        if (this._toastTimer !== null) {
            window.clearTimeout(this._toastTimer);
        }
        this._toastTimer = window.setTimeout(() => {
            this.toastMessage = "";
            this._toastTimer = null;
        }, 2500);
    }

    /**
     * Debounces UI updates during streaming to avoid excessive re-renders.
     * Schedules a re-render at ~30 fps (33 ms) by creating a fresh array snapshot.
     */
    debounceSyncMessages() {
        if (this._updateTimer === null) {
            this._updateTimer = window.setTimeout(() => {
                this._updateTimer = null;
                this.syncMessages();
            }, 33);
        }
    }

    /** Starts a 60 s fallback timer that clears `isLoading` if no `chat-complete` arrives. */
    startLoadingTimeout() {
        this.clearLoadingTimeout();
        this._loadingTimeout = window.setTimeout(() => {
            this.isLoading = false;
            this._loadingTimeout = null;
        }, 60000);
    }

    /** Cancels the pending loading fallback timer, if any. */
    clearLoadingTimeout() {
        if (this._loadingTimeout !== null) {
            window.clearTimeout(this._loadingTimeout);
            this._loadingTimeout = null;
        }
    }

    /** Scrolls the chat output to the bottom. */
    scrollDown() {
        const output = this.shadowRoot?.querySelector("collama-chatoutput") as any;
        output?.scrollDown();
    }

    /** Initializes the component by signaling readiness to the backend and setting up the window message listener for host communication. */
    connectedCallback() {
        super.connectedCallback();
        backendApi.ready();
        const dispatch = createInboundDispatcher(this);
        window.addEventListener("message", (e) => dispatch(e.data));
    }

    render() {
        return html`
            <collama-chatsessions
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                .contextUsed=${this.contextUsed}
                .contextMax=${this.contextMax}
                @new-chat=${onNewChat}
                @select-session=${(e: CustomEvent) => onSelectSession(e)}
                @delete-session=${(e: CustomEvent) => onDeleteSession(e)}
                @rename-session=${(e: CustomEvent) => onRenameSession(e)}
                @copy-session=${(e: CustomEvent) => onCopySession(e)}
            ></collama-chatsessions>
            <div class="chat-area">
                <div class="output-wrapper">
                    <collama-chatoutput
                        .messages=${this.messages}
                        .contextStartIndex=${this.contextStartIndex}
                        .isGenerating=${this.isLoading}
                        @resend-message=${(e: CustomEvent) => onResendMessage(this, e)}
                        @edit-message=${(e: CustomEvent) => onEditMessage(this, e)}
                        @delete-message=${(e: CustomEvent) => onDeleteMessage(this, e)}
                        @near-bottom-changed=${(e: CustomEvent) => onNearBottomChanged(this, e)}
                    ></collama-chatoutput>
                    <collama-token-counter
                        .agentToken=${this.agent_token}
                        .visible=${this.isLoading && this.hasTokenData}
                    ></collama-token-counter>
                    <collama-scroll-down
                        .visible=${this.showScrollButton}
                        @scroll-down=${() => this.scrollDown()}
                    ></collama-scroll-down>
                </div>
                <collama-chatinput
                    @submit=${(e: CustomEvent) => onSubmit(this, e)}
                    @cancel=${() => onCancel(this)}
                    @compress=${() => onCompress(this)}
                    @context-cleared=${(e: CustomEvent) => onContextCleared(this, e)}
                    .contexts=${this.currentContexts}
                    .isLoading=${this.isLoading}
                ></collama-chatinput>
            </div>
            <div class="toast ${this.toastMessage ? "visible" : ""}">${this.toastMessage}</div>
        `;
    }
}

customElements.define("collama-chatcontainer", ChatContainer);
