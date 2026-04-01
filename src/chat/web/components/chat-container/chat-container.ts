import { html, LitElement } from "lit";
import { state } from "lit/decorators.js";

import { AttachedContext, ChatContext, ChatHistory } from "../../../../common/context-chat";
import type { ToolConfirmRequest } from "../chat-input/components/tool-confirm/tool-confirm";
import "../chat-modal/error-modal/error-modal";
import "../chat-output/chat-output";
import "../chat-scroll-button/chat-scroll-button.ts";
import "../chat-session/chat-session";
import { ChatSession } from "../chat-session/chat-session";

import "./chat-container-loading";
import { createInboundDispatcher } from "./handlers-inbound";
import {
    onAutoAccept,
    onCancel,
    onContextAddFile,
    onContextCleared,
    onContextSearch,
    onCopySession,
    onDeleteMessage,
    onDeleteSession,
    onEditMessage,
    onExportSession,
    onNearBottomChanged,
    onNewChat,
    onRenameSession,
    onResendMessage,
    onSelectSession,
    onSubmit,
    onSummarizeConversation,
    onSummarizeTurn,
    onToolConfirmAccept,
    onToolConfirmAcceptAll,
    onToolConfirmCancel,
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
    @state() showScrollButton: boolean = false;
    @state() toolConfirmRequest: ToolConfirmRequest | null = null;
    @state() contextSearchResults: { fileName: string; filePath: string; relativePath: string; isFolder: boolean }[] =
        [];

    // -- Internal state --
    wvChatContext = new ChatContext();
    private _updateTimer: number | null = null;
    private _inputResizeObserver: ResizeObserver | null = null;
    private _lastInputHeight = 0;

    // -- Methods used by handler modules --

    /** Creates a fresh array snapshot from `wvChatContext` to trigger a Lit re-render. */
    syncMessages() {
        this.messages = [...this.wvChatContext.getMessages()];
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

    /** Scrolls the chat output to the bottom and activates sticky scroll. */
    scrollToBottom() {
        const output = this.shadowRoot?.querySelector("collama-chatoutput") as any;
        output?.scrollToBottom();
    }

    /** Initializes the component by signaling readiness to the backend and setting up the window message listener for host communication. */
    connectedCallback() {
        super.connectedCallback();
        backendApi.ready();
        const dispatch = createInboundDispatcher(this);
        window.addEventListener("message", (e) => dispatch(e.data));
    }

    firstUpdated() {
        const chatInput = this.shadowRoot?.querySelector("collama-chatinput") as HTMLElement | null;
        const chatOutput = this.shadowRoot?.querySelector("collama-chatoutput") as HTMLElement | null;
        if (!chatInput || !chatOutput) {
            return;
        }

        this._lastInputHeight = chatInput.getBoundingClientRect().height;
        this._inputResizeObserver = new ResizeObserver(() => {
            const newHeight = chatInput.getBoundingClientRect().height;
            const delta = newHeight - this._lastInputHeight;
            this._lastInputHeight = newHeight;
            if (Math.abs(delta) > 1) {
                chatOutput.scrollTop += delta;
            }
        });
        this._inputResizeObserver.observe(chatInput);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this._inputResizeObserver?.disconnect();
    }

    render() {
        return html`
            <collama-chatsessions
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                .contextUsed=${this.contextUsed}
                .contextMax=${this.contextMax}
                @export-session=${(e: CustomEvent) => onExportSession(this, e)}
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
                        @summarize-turn=${(e: CustomEvent) => onSummarizeTurn(this, e)}
                        @near-bottom-changed=${(e: CustomEvent) => onNearBottomChanged(this, e)}
                    ></collama-chatoutput>
                    <collama-scroll-down
                        .visible=${this.showScrollButton}
                        @scroll-down=${() => this.scrollToBottom()}
                    ></collama-scroll-down>
                </div>
                <collama-error-modal></collama-error-modal>
                <collama-chatinput
                    @submit=${(e: CustomEvent) => onSubmit(this, e)}
                    @cancel=${() => onCancel(this)}
                    @summarize-conversation=${() => onSummarizeConversation(this)}
                    @auto-accept=${(e: CustomEvent) => onAutoAccept(e)}
                    @context-cleared=${(e: CustomEvent) => onContextCleared(this, e)}
                    @context-search=${(e: CustomEvent) => onContextSearch(e)}
                    @context-add-file=${(e: CustomEvent) => onContextAddFile(e)}
                    @tool-confirm-accept=${(e: CustomEvent) => onToolConfirmAccept(this, e)}
                    @tool-confirm-accept-all=${(e: CustomEvent) => onToolConfirmAcceptAll(this, e)}
                    @tool-confirm-cancel=${(e: CustomEvent) => onToolConfirmCancel(this, e)}
                    .contexts=${this.currentContexts}
                    .isLoading=${this.isLoading}
                    .agentToken=${this.agent_token}
                    .hasTokenData=${this.hasTokenData}
                    .toolConfirmRequest=${this.toolConfirmRequest}
                    .contextSearchResults=${this.contextSearchResults}
                ></collama-chatinput>
            </div>
            <collama-loading-snake .active=${this.isLoading}></collama-loading-snake>
        `;
    }
}

customElements.define("collama-chatcontainer", ChatContainer);
