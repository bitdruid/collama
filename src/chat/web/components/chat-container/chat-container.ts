import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { AttachedContext, ChatContext, ChatHistory } from "../../../../common/context-chat";
import type { ChatSession, ToolConfirmRequest } from "../../types";
import { ChatSessionStore } from "../chat-session/chat-session-store";
import type { ChatSearch, SearchResult } from "../chat-input/components/chat-search/chat-search";
import "../chat-input/components/chat-search/chat-search";
import "../chat-input/components/tool-confirm/tool-confirm";
import { createInboundDispatcher } from "./handlers-inbound";
import {
    onAutoAccept,
    onCancel,
    onClearChat,
    onContextAddFile,
    onContextCleared,
    onContextSearch,
    onConvertToGhost,
    onCopySession,
    onDeleteMessage,
    onDeleteSession,
    onEditMessage,
    onExportSession,
    onNearBottomChanged,
    onNewChat,
    onNewGhostChat,
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
    @state() searchQuery: string = "";
    @state() activeSearchMessageId: string = "";
    @state() showSearch = false;
    @state() showErrorModal = false;
    @state() errorModalContent = "";

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

    @query("collama-chat-search")
    private chatSearch?: ChatSearch;

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
    private handleConvertToGhost = () => onConvertToGhost();
    private handleClearChat = () => onClearChat(this);
    private handleSummarizeConversation = () => onSummarizeConversation(this);
    private handleContextCleared = (e: CustomEvent) => onContextCleared(this, e);
    private handleToolConfirmAccept = (e: CustomEvent) => onToolConfirmAccept(this, e);
    private handleToolConfirmAcceptAll = (e: CustomEvent) => onToolConfirmAcceptAll(this, e);
    private handleToolConfirmCancel = (e: CustomEvent) => onToolConfirmCancel(this, e);
    private handleScrollDown = () => this.scrollToBottom();
    private handleSearchToggle = () => (this.showSearch = true);
    private handleSearchQuery = (e: CustomEvent) => this._performSearch(e.detail.query);
    private handleSearchNavigate = (e: CustomEvent) => {
        this.activeSearchMessageId = e.detail.messageId;
        this._scrollToMessage(e.detail.messageId);
    };
    private handleSearchClear = () => {
        this.searchQuery = "";
        this.activeSearchMessageId = "";
    };
    private handleSearchClose = () => (this.showSearch = false);
    private handleErrorModalClose = () => {
        this.showErrorModal = false;
        this.errorModalContent = "";
    };
    private handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "f") {
            e.preventDefault();
            this.showSearch = true;
        }
    };

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

    private _performSearch(query: string) {
        this.searchQuery = query;
        if (!query) {
            this.chatSearch?.setResults([]);
            this.activeSearchMessageId = "";
            return;
        }
        const lowerQuery = query.toLowerCase();
        const results: SearchResult[] = [];
        for (const [i, msg] of this.messages.entries()) {
            if (msg.content && msg.content.toLowerCase().includes(lowerQuery)) {
                results.push({ messageIndex: i, messageId: msg.customKeys?.id ?? String(i) });
            }
        }
        this.chatSearch?.setResults(results);
    }

    private _scrollToMessage(messageId: string) {
        const output = this.chatOutput;
        if (!output?.shadowRoot) {
            return;
        }
        const el = output.shadowRoot.querySelector(`[data-message-id="${messageId}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
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
        window.addEventListener("keydown", this.handleKeyDown);
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
        window.removeEventListener("keydown", this.handleKeyDown);
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
                @new-ghost-chat=${onNewGhostChat}
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
                        .searchQuery=${this.searchQuery}
                        .activeSearchMessageId=${this.activeSearchMessageId}
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
                ${this.showErrorModal
                    ? html`<collama-error-modal
                          autoShow
                          .content=${this.errorModalContent}
                          @overlay-close=${this.handleErrorModalClose}
                      ></collama-error-modal>`
                    : ""}
                ${this.showSearch
                    ? html`<collama-chat-search
                          autoShow
                          @overlay-close=${this.handleSearchClose}
                          @search-query=${this.handleSearchQuery}
                          @search-navigate=${this.handleSearchNavigate}
                          @search-clear=${this.handleSearchClear}
                      ></collama-chat-search>`
                    : ""}
                ${this.toolConfirmRequest
                    ? html`<collama-tool-confirm
                          autoShow
                          .request=${this.toolConfirmRequest}
                          @tool-confirm-accept=${this.handleToolConfirmAccept}
                          @tool-confirm-accept-all=${this.handleToolConfirmAcceptAll}
                          @tool-confirm-cancel=${this.handleToolConfirmCancel}
                      ></collama-tool-confirm>`
                    : ""}
                <collama-chatinput
                    @submit=${this.handleSubmit}
                    @cancel=${this.handleCancel}
                    @convert-to-ghost=${this.handleConvertToGhost}
                    @clear-chat=${this.handleClearChat}
                    @summarize-conversation=${this.handleSummarizeConversation}
                    @search-toggle=${this.handleSearchToggle}
                    @auto-accept=${onAutoAccept}
                    @context-cleared=${this.handleContextCleared}
                    @context-search=${onContextSearch}
                    @context-add-file=${onContextAddFile}
                    .contexts=${this.currentContexts}
                    .isLoading=${this.isLoading}
                    .agentToken=${this.agentToken}
                    .hasTokenData=${this.hasTokenData}
                    .isGhost=${this.sessions.find((s) => s.id === this.activeSessionId)?.ghost === true}
                    .contextSearchResults=${this.contextSearchResults}
                ></collama-chatinput>
            </div>
            <collama-loading-snake .active=${this.isLoading}></collama-loading-snake>
        `;
    }
}
