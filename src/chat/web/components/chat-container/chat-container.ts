import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { AttachedContext, ChatContext, ChatHistory } from "../../../../common/context-chat";
import { defaultChatConfig, type ChatConfig, type ChatSession, type ToolConfirmRequest } from "../../types";
import "../chat-modal/acquire-modal/acquire-modal";
import "../chat-modal/settings-modal/settings-modal";
import "../chat-modal/tool-confirm-modal/tool-confirm-modal";
import "../chat-notification/context-notification/context-notification";
import { ChatSessionStore } from "../chat-session/chat-session-store";
import { createInboundDispatcher } from "./handlers-inbound";
import {
    onAcquireAutoSummaryAccept,
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

    @state() config: ChatConfig = defaultChatConfig;
    @state() contextStartIndex: number = 0;
    @state() currentContexts: AttachedContext[] = [];
    @state() messages: ChatHistory[] = [];
    @state() showScrollButton: boolean = false;
    @state() toolConfirmRequest: ToolConfirmRequest | null = null;
    @state() showAcquireModal = false;
    @state() acquireModalTitle = "";
    @state() acquireModalDescription = "";
    @state() showErrorModal = false;
    @state() errorModalContent = "";
    @state() showSettingsModal = false;
    @state() snakeLoadingSpeed = 1500;
    @state() snakeEyecandyMode = false;
    @state() flatDesign = false;
    @state() agentsMdActive = false;

    // Reference to store's ChatContext (single source of truth)
    // Public so handlers can access it
    chatContext?: ChatContext;
    private _updateTimer: number | null = null;
    private _inputResizeObserver: ResizeObserver | null = null;
    private _lastInputHeight = 0;
    private _messageHandler: ((e: MessageEvent) => void) | null = null;
    private _wasContextAtAutoSummaryThreshold = false;
    private _autoSummaryInProgress = false;
    private _autoSummaryWaitingForContextUsage = false;

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
    private handleConvertToGhost = () => onConvertToGhost();
    private handleClearChat = () => onClearChat(this);
    private handleSummarizeConversation = () => onSummarizeConversation(this);
    private handleAcquireAutoSummaryAccept = () => onAcquireAutoSummaryAccept(this);
    private handleContextCleared = (e: CustomEvent) => onContextCleared(this, e);
    private handleToolConfirmAccept = (e: CustomEvent) => onToolConfirmAccept(this, e);
    private handleToolConfirmAcceptAll = (e: CustomEvent) => onToolConfirmAcceptAll(this, e);
    private handleToolConfirmCancel = (e: CustomEvent) => onToolConfirmCancel(this, e);
    private handleScrollDown = () => this.scrollToBottom();
    private handleErrorModalClose = () => {
        this.showErrorModal = false;
        this.errorModalContent = "";
    };
    private handleOpenSettings = () => {
        this.showSettingsModal = true;
    };
    private handleSettingsModalClose = () => {
        this.showSettingsModal = false;
    };
    private handleSettingsUpdate = (e: CustomEvent) => {
        const { key, value } = e.detail as { key: keyof ChatConfig; value: ChatConfig[keyof ChatConfig] };
        this.config = { ...this.config, [key]: value };
        backendApi.updateConfig(key, value);
    };
    private handleSnakeSpeedUpdate = (e: CustomEvent) => {
        const value = Number(e.detail?.value);
        if (!Number.isFinite(value)) {
            return;
        }
        this.snakeLoadingSpeed = Math.min(5000, Math.max(500, value));
        const state = window.vscode.getState?.() || {};
        window.vscode.setState?.({ ...state, snakeLoadingSpeed: this.snakeLoadingSpeed });
    };
    private handleSnakeEyecandyUpdate = (e: CustomEvent) => {
        this.snakeEyecandyMode = Boolean(e.detail?.value);
        const state = window.vscode.getState?.() || {};
        window.vscode.setState?.({ ...state, snakeEyecandyMode: this.snakeEyecandyMode });
    };
    private handleFlatDesignUpdate = (e: CustomEvent) => {
        this.flatDesign = Boolean(e.detail?.value);
        const state = window.vscode.getState?.() || {};
        window.vscode.setState?.({ ...state, flatDesign: this.flatDesign });
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
        const state = window.vscode.getState?.() || {};
        if (typeof state.snakeLoadingSpeed === "number") {
            this.snakeLoadingSpeed = Math.min(5000, Math.max(500, state.snakeLoadingSpeed));
        }
        if (typeof state.snakeEyecandyMode === "boolean") {
            this.snakeEyecandyMode = state.snakeEyecandyMode;
        }
        if (typeof state.flatDesign === "boolean") {
            this.flatDesign = state.flatDesign;
        }
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

    updated(changed: Map<string, unknown>) {
        super.updated(changed);
        if (changed.has("activeSessionId")) {
            this._wasContextAtAutoSummaryThreshold = false;
            this.showAcquireModal = false;
        }
        if (
            changed.has("contextUsed") ||
            changed.has("contextMax") ||
            changed.has("isLoading") ||
            changed.has("activeSessionId")
        ) {
            this._autoSummarizeAtContextThreshold();
        }
        if (changed.has("flatDesign")) {
            this.style.setProperty("--theme-flat", this.flatDesign ? "1" : "0");
        }
    }

    private _getContextUsageRatio(): number {
        if (this.contextMax <= 0) {
            return 0;
        }
        return this.contextUsed / this.contextMax;
    }

    private _autoSummarizeAtContextThreshold() {
        if (!this._shouldShowAutoSummaryConfirm()) {
            this._wasContextAtAutoSummaryThreshold = false;
            return;
        }

        if (this._wasContextAtAutoSummaryThreshold || this.isLoading || this.showAcquireModal) {
            return;
        }

        this._wasContextAtAutoSummaryThreshold = true;
        this._showAcquireModal("Auto-Summary", "Accept to summarize the conversation.");
    }

    private _showAcquireModal(title: string, description: string) {
        this.acquireModalTitle = title;
        this.acquireModalDescription = description;
        this.showAcquireModal = true;
    }

    beginAutoSummary() {
        this._autoSummaryInProgress = true;
        this._autoSummaryWaitingForContextUsage = true;
    }

    markAutoSummaryComplete() {
        this._autoSummaryInProgress = false;
    }

    completeAutoSummaryContextUpdate() {
        if (!this._autoSummaryWaitingForContextUsage) {
            return;
        }

        this._autoSummaryWaitingForContextUsage = false;
        this._wasContextAtAutoSummaryThreshold = this._shouldShowAutoSummaryConfirm();
        if (this._wasContextAtAutoSummaryThreshold) {
            this._showAcquireModal("Auto-Summary", "Accept to summarize the conversation.");
        }
    }

    reopenAutoSummaryOnError() {
        if (!this._autoSummaryInProgress) {
            return;
        }
        this._autoSummaryInProgress = false;
        this._autoSummaryWaitingForContextUsage = false;
        this._showAcquireModal("Auto-Summary", "Accept to summarize the conversation.");
    }

    private _shouldShowContextNotification(): boolean {
        return this._getContextUsageRatio() >= 0.85;
    }

    private _shouldShowAutoSummaryConfirm(): boolean {
        return this._getContextUsageRatio() >= 0.95;
    }

    /**
     * Renders the main chat interface layout.
     *
     * Includes the session sidebar, the chat output area with scroll controls,
     * the input area, and the loading indicator.
     */
    render() {
        const hasOutOfContextMessages = this.contextStartIndex > 0;
        const showContextNotification = hasOutOfContextMessages || this._shouldShowContextNotification();
        const contextNotificationKind = hasOutOfContextMessages ? "out-of-context" : "threshold";

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
                        @resend-message=${this.handleResendMessage}
                        @edit-message=${this.handleEditMessage}
                        @delete-message=${this.handleDeleteMessage}
                        @summarize-turn=${this.handleSummarizeTurn}
                        @near-bottom-changed=${this.handleNearBottomChanged}
                    ></collama-chatoutput>
                    ${showContextNotification
                        ? html`<collama-context-notification
                              autoShow
                              .kind=${contextNotificationKind}
                              .contextUsed=${this.contextUsed}
                              .contextMax=${this.contextMax}
                          ></collama-context-notification>`
                        : ""}
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
                ${this.toolConfirmRequest
                    ? html`<collama-tool-confirm-modal
                          autoShow
                          .request=${this.toolConfirmRequest}
                          @tool-confirm-accept=${this.handleToolConfirmAccept}
                          @tool-confirm-accept-all=${this.handleToolConfirmAcceptAll}
                          @tool-confirm-cancel=${this.handleToolConfirmCancel}
                      ></collama-tool-confirm-modal>`
                    : ""}
                ${this.showAcquireModal
                    ? html`<collama-acquire-modal
                          autoShow
                          .title=${this.acquireModalTitle}
                          .description=${this.acquireModalDescription}
                          @acquire-accept=${this.handleAcquireAutoSummaryAccept}
                      ></collama-acquire-modal>`
                    : ""}
                ${this.showSettingsModal
                    ? html`<collama-settings-modal
                          autoShow
                          .config=${this.config}
                          .snakeLoadingSpeed=${this.snakeLoadingSpeed}
                          .snakeEyecandyMode=${this.snakeEyecandyMode}
                          .flatDesign=${this.flatDesign}
                          .agentsMdActive=${this.agentsMdActive}
                          @overlay-close=${this.handleSettingsModalClose}
                          @settings-update=${this.handleSettingsUpdate}
                          @snake-speed-update=${this.handleSnakeSpeedUpdate}
                          @snake-eyecandy-update=${this.handleSnakeEyecandyUpdate}
                          @flat-design-update=${this.handleFlatDesignUpdate}
                      ></collama-settings-modal>`
                    : ""}
                <collama-chatinput
                    ?inert=${this.showAcquireModal}
                    aria-disabled=${this.showAcquireModal ? "true" : "false"}
                    @submit=${this.handleSubmit}
                    @cancel=${this.handleCancel}
                    @convert-to-ghost=${this.handleConvertToGhost}
                    @clear-chat=${this.handleClearChat}
                    @open-settings=${this.handleOpenSettings}
                    @summarize-conversation=${this.handleSummarizeConversation}
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
                    .config=${this.config}
                ></collama-chatinput>
            </div>
            <collama-loading-snake
                .active=${this.isLoading}
                .speed=${this.snakeLoadingSpeed}
                .eyecandy=${this.snakeEyecandyMode}
            ></collama-loading-snake>
        `;
    }
}
