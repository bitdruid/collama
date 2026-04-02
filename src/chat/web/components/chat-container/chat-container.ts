import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { AttachedContext, ChatContext, ChatHistory } from "../../../../common/context-chat";
import type { ChatSession, ToolConfirmRequest } from "../../types";
import { ChatSessionStore } from "../chat-session/chat-session-store";
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
 * Uses the ChatContext from ChatSessionStore (single source of truth) and exposes a
 * Lit-reactive `messages` snapshot for child components. Delegates user
 * interactions to `handlers-outbound` and host messages to `handlers-inbound`.
 */
@customElement("collama-chatcontainer")
export class ChatContainer extends LitElement {
    static styles = chatContainerStyles;

    @property({ type: Array }) sessions: ChatSession[] = [];
    @property({ type: Boolean }) hasTokenData: boolean = false;
    @property({ type: Boolean, reflect: true }) isLoading: boolean = false;
    @property({ type: Number }) agentToken: number = 0;
    @property({ type: Number }) contextMax: number = 0;
    @property({ type: Number }) contextUsed: number = 0;
    @property({ type: String }) activeSessionId: string = "";
    @state() contextSearchResults: { fileName: string; filePath: string; relativePath: string; isFolder: boolean }[] =
        [];

    @state() contextStartIndex: number = 0;
    @state() currentContexts: AttachedContext[] = [];
    @state() messages: ChatHistory[] = [];
    @state() showScrollButton: boolean = false;
    @state() toolConfirmRequest: ToolConfirmRequest | null = null;

    // Reference to store's ChatContext (single source of truth)
    // Public so handlers can access it
    chatContext?: ChatContext;
    private _updateTimer: number | null = null;
    private _inputResizeObserver: ResizeObserver | null = null;
    private _lastInputHeight = 0;
    private _messageHandler: ((e: MessageEvent) => void) | null = null;

    @query("collama-chatinput")
    private chatInput!: HTMLElement;

    @query("collama-chatoutput")
    private chatOutput!: HTMLElement;

    @query("collama-scroll-down")
    private scrollDown!: HTMLElement;

    private handleExportSession = (e: CustomEvent) => onExportSession(this, e);
    private handleSelectSession = (e: CustomEvent) => onSelectSession(e);
    private handleDeleteSession = (e: CustomEvent) => onDeleteSession(e);
    private handleRenameSession = (e: CustomEvent) => onRenameSession(e);
    private handleResendMessage = (e: CustomEvent) => onResendMessage(this, e);
    private handleEditMessage = (e: CustomEvent) => onEditMessage(this, e);
    private handleDeleteMessage = (e: CustomEvent) => onDeleteMessage(this, e);
    private handleSummarizeTurn = (e: CustomEvent) => onSummarizeTurn(this, e);
    private handleNearBottomChanged = (e: CustomEvent) => onNearBottomChanged(this, e);
    private handleSubmit = (e: CustomEvent) => onSubmit(this, e);
    private handleCancel = () => onCancel(this);
    private handleSummarizeConversation = () => onSummarizeConversation(this);
    private handleContextCleared = (e: CustomEvent) => onContextCleared(this, e);
    private handleToolConfirmAccept = (e: CustomEvent) => onToolConfirmAccept(this, e);
    private handleToolConfirmAcceptAll = (e: CustomEvent) => onToolConfirmAcceptAll(this, e);
    private handleToolConfirmCancel = (e: CustomEvent) => onToolConfirmCancel(this, e);
    private handleScrollDown = () => this.scrollToBottom();

    /** Creates a fresh array snapshot from store's ChatContext to trigger a Lit re-render. */
    syncMessages() {
        this.messages = [...(this.chatContext?.getMessages() || [])];
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
        const output = this.chatOutput as unknown as { scrollToBottom?: () => void };
        output?.scrollToBottom?.();
    }

    private _onStoreChange = () => {
        // Refresh ChatContext reference when store changes
        // This handles the case where chatContext was undefined initially
        this.chatContext = ChatSessionStore.instance.getActiveChatContext();
        this.syncMessages();
    };

    /** Initializes the component by signaling readiness to the backend and setting up the window message listener for host communication. */
    connectedCallback() {
        super.connectedCallback();
        // Get ChatContext reference from store (not a copy)
        // Note: May be undefined initially until backend sends init message
        this.chatContext = ChatSessionStore.instance.getActiveChatContext();

        // Subscribe to store changes for automatic synchronization
        this._onStoreChange = this._onStoreChange.bind(this);
        ChatSessionStore.instance.addEventListener("change", this._onStoreChange);

        backendApi.ready();
        const dispatch = createInboundDispatcher(this);
        this._messageHandler = (e: MessageEvent) => dispatch(e.data);
        window.addEventListener("message", this._messageHandler);
    }

    /**
     * Sets up a ResizeObserver on the chat input to synchronize scrolling.
     *
     * Adjusts the scroll position of the chat output when the input height changes
     * to prevent the content from being obscured or jumping.
     */
    firstUpdated() {
        if (!this.chatInput || !this.chatOutput) {
            return;
        }

        this._lastInputHeight = this.chatInput.getBoundingClientRect().height;
        this._inputResizeObserver = new ResizeObserver(() => {
            const newHeight = this.chatInput.getBoundingClientRect().height;
            const delta = newHeight - this._lastInputHeight;
            this._lastInputHeight = newHeight;
            if (Math.abs(delta) > 1) {
                this.chatOutput.scrollTop += delta;
            }
        });
        this._inputResizeObserver.observe(this.chatInput);
    }

    /**
     * Cleans up resources when the component is removed from the DOM.
     *
     * Disconnects the ResizeObserver, removes the window message listener,
     * and clears any pending update timers.
     */
    disconnectedCallback() {
        super.disconnectedCallback();
        this._inputResizeObserver?.disconnect();
        if (this._messageHandler) {
            window.removeEventListener("message", this._messageHandler);
            this._messageHandler = null;
        }
        if (this._updateTimer !== null) {
            clearTimeout(this._updateTimer);
            this._updateTimer = null;
        }
        // Unsubscribe from store to prevent memory leaks
        ChatSessionStore.instance.removeEventListener("change", this._onStoreChange);
    }

    /**
     * Renders the main chat interface layout.
     *
     * Includes the session sidebar, the chat output area with scroll controls,
     * the input area, and the loading indicator.
     */
    render() {
        return html`
            <collama-chatsessions
                .sessions=${this.sessions}
                .activeSessionId=${this.activeSessionId}
                .contextUsed=${this.contextUsed}
                .contextMax=${this.contextMax}
                @export-session=${this.handleExportSession}
                @new-chat=${onNewChat}
                @select-session=${this.handleSelectSession}
                @delete-session=${this.handleDeleteSession}
                @rename-session=${this.handleRenameSession}
                @copy-session=${onCopySession}
            ></collama-chatsessions>
            <div class="chat-area">
                <div class="output-wrapper">
                    <collama-chatoutput
                        .messages=${this.messages}
                        .contextStartIndex=${this.contextStartIndex}
                        .isGenerating=${this.isLoading}
                        @resend-message=${this.handleResendMessage}
                        @edit-message=${this.handleEditMessage}
                        @delete-message=${this.handleDeleteMessage}
                        @summarize-turn=${this.handleSummarizeTurn}
                        @near-bottom-changed=${this.handleNearBottomChanged}
                    ></collama-chatoutput>
                    <collama-scroll-down
                        .visible=${this.showScrollButton}
                        @scroll-down=${this.handleScrollDown}
                    ></collama-scroll-down>
                </div>
                <collama-error-modal></collama-error-modal>
                <collama-chatinput
                    @submit=${this.handleSubmit}
                    @cancel=${this.handleCancel}
                    @summarize-conversation=${this.handleSummarizeConversation}
                    @auto-accept=${onAutoAccept}
                    @context-cleared=${this.handleContextCleared}
                    @context-search=${onContextSearch}
                    @context-add-file=${onContextAddFile}
                    @tool-confirm-accept=${this.handleToolConfirmAccept}
                    @tool-confirm-accept-all=${this.handleToolConfirmAcceptAll}
                    @tool-confirm-cancel=${this.handleToolConfirmCancel}
                    .contexts=${this.currentContexts}
                    .isLoading=${this.isLoading}
                    .agentToken=${this.agentToken}
                    .hasTokenData=${this.hasTokenData}
                    .toolConfirmRequest=${this.toolConfirmRequest}
                    .contextSearchResults=${this.contextSearchResults}
                ></collama-chatinput>
            </div>
            <collama-loading-snake .active=${this.isLoading}></collama-loading-snake>
        `;
    }
}
