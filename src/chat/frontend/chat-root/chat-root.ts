import { html, LitElement } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { AttachedContext, ChatContext, ChatHistory } from "../../../common/context-chat";
import {
    defaultChatSettings,
    type ChatSession,
    type ChatSettings,
    type MemoryViewEntry,
    type ToolConfirmRequest,
    type ToolDecisionRequest,
} from "../../shared";
import { BaseDropdown } from "../template-components/dropdown/base-dropdown";
import "./components/chat-active-shells/chat-active-shells";
import "./components/chat-dropdown";
import { ChatSessionStore } from "./components/chat-header/chat-session-store";
import "./components/chat-modal";
import "./components/chat-notification/context-notification/context-notification";
import "./components/chat-pending-intercept/chat-pending-intercept";
import { createInboundDispatcher } from "./handlers/inbound";
import {
    onAcquireAutoSummaryAccept,
    onAddMemory,
    onAutoAccept,
    onCancel,
    onChatReady,
    onClearChat,
    onContextAdd,
    onContextCleared,
    onContextSearch,
    onConvertToGhost,
    onCopySession,
    onDeleteMemory,
    onDeleteMessage,
    onDeleteSession,
    onEditMemory,
    onEditMessage,
    onExportSession,
    onExportSessionHtml,
    onImportSession,
    onInterceptCancel,
    onNearBottomChanged,
    onNewChat,
    onNewGhostChat,
    onOpenMemory,
    onRenameSession,
    onResendMessage,
    onSelectSession,
    onSettingsUpdate,
    onSubmit,
    onSummarizeConversation,
    onSummarizeTurn,
    onToolConfirmAccept,
    onToolConfirmAcceptAll,
    onToolConfirmCancel,
    onToolDecisionSelect,
} from "./handlers/outbound";
import { ChatRootStyles } from "./styles";

type ActiveDropdown = "" | "session" | "settings";
type ActiveModal = "" | "error" | "toolConfirm" | "toolDecision" | "acquire" | "memory";

/**
 * Root webview component that orchestrates the chat UI.
 *
 * Uses the ChatContext from ChatSessionStore (single source of truth) and exposes a
 * Lit-reactive `messages` snapshot for child components. Delegates user
 * interactions to outbound handlers and host messages to the inbound dispatcher.
 */
@customElement("collama-chatroot")
export class ChatRoot extends LitElement {
    static styles = ChatRootStyles;

    @property({ type: Array }) sessions: ChatSession[] = [];
    @property({ type: Boolean }) hasTokenData: boolean = false;
    @property({ type: Boolean, reflect: true }) isGenerating: boolean = false;
    @property({ type: Boolean, reflect: true }) isSummarizing: boolean = false;
    @property({ type: Number }) agentToken: number = 0;
    @property({ type: Number }) contextMax: number = 0;
    @property({ type: Number }) contextUsed: number = 0;
    @property({ type: String }) activeSessionId: string = "";
    /** Session a backend-initiated mailbox wake run belongs to (set on `agent-wake`, cleared on
     *  chat-complete/error; empty during the user's own runs — the UI pins them to that session).
     *  Gates intercepts: typing while viewing a different chat must not inject into the wake run. */
    @state() generatingSessionId: string = "";
    @state() contextSearchResults: { fileName: string; relativePath: string; isFolder: boolean }[] = [];

    @state() config: ChatSettings = defaultChatSettings;
    @state() contextStartIndex: number = 0;
    @state() currentContexts: AttachedContext[] = [];
    @state() pendingIntercepts: { id: string; text: string; contextCount: number }[] = [];
    @state() messages: ChatHistory[] = [];
    @state() showScrollButton: boolean = false;
    @state() toolConfirmRequest: ToolConfirmRequest | null = null;
    @state() toolDecisionRequest: ToolDecisionRequest | null = null;
    @state() acquireModalTitle = "";
    @state() acquireModalDescription = "";
    @state() errorModalContent = "";
    @state() activeModal: ActiveModal = "";
    @state() fancyTyping = false;
    @state() flatDesign = false;
    @state() showThinking = true;
    @state() agentsMdActive = false;
    @state() memoryActive = false;
    @state() memoryEntries: MemoryViewEntry[] = [];
    @state() autoAccept = false;
    @state() activeDropdown: ActiveDropdown = "";
    @state() activeShells = 0;
    // transient "−Xk · N turns" label on the context bar after a trim
    @state() contextFlash = "";
    private _contextFlashTimer: number | null = null;

    // Reference to store's ChatContext (single source of truth)
    // Public so handlers can access it
    chatContext?: ChatContext;
    private _updateTimer: number | null = null;
    private _inputResizeObserver: ResizeObserver | null = null;
    private _lastInputHeight = 0;
    private _pendingResizeObserver: ResizeObserver | null = null;
    private _lastPendingHeight = 0;
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

    @query(".bottom-overlay")
    private bottomOverlay!: HTMLElement;

    @query("collama-session-dropdown, collama-settings-dropdown")
    private activeDropdownElement?: BaseDropdown;

    private handleExportSession = (e: CustomEvent) => onExportSession(this, e);
    private handleExportSessionHtml = (e: CustomEvent) => onExportSessionHtml(this, e);
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
    // dismissing the summary recommendation just closes it, threshold guard keeps it from nagging
    private handleAcquireDismiss = () => {
        if (this.activeModal === "acquire") {
            this.activeModal = "";
        }
    };
    private handleContextCleared = (e: CustomEvent) => onContextCleared(this, e);
    private handleInterceptCancel = (e: CustomEvent) => onInterceptCancel(this, e);
    private handleToolConfirmAccept = (e: CustomEvent) => onToolConfirmAccept(this, e);
    private handleToolConfirmAcceptAll = (e: CustomEvent) => onToolConfirmAcceptAll(this, e);
    private handleToolConfirmCancel = (e: CustomEvent) => onToolConfirmCancel(this, e);
    private handleToolDecisionSelect = (e: CustomEvent) => onToolDecisionSelect(this, e);
    private handleScrollDown = () => this.scrollToBottom();
    private handleErrorModalClose = () => {
        this.activeModal = "";
        this.errorModalContent = "";
    };
    private handleSettingsUpdate = (e: CustomEvent) => onSettingsUpdate(this, e);
    private handleOpenMemory = () => {
        this.activeDropdown = "";
        onOpenMemory(this);
    };
    private handleDeleteMemory = (e: CustomEvent) => onDeleteMemory(this, e);
    private handleAddMemory = (e: CustomEvent) => onAddMemory(this, e);
    private handleEditMemory = (e: CustomEvent) => onEditMemory(this, e);
    private handleMemoryModalClose = () => {
        this.activeModal = "";
    };
    private handleFancyTypingUpdate = (e: CustomEvent) => {
        this.fancyTyping = Boolean(e.detail?.value);
        const state = window.vscode.getState?.() || {};
        window.vscode.setState?.({ ...state, fancyTyping: this.fancyTyping });
    };
    private handleFlatDesignUpdate = (e: CustomEvent) => {
        this.flatDesign = Boolean(e.detail?.value);
        const state = window.vscode.getState?.() || {};
        window.vscode.setState?.({ ...state, flatDesign: this.flatDesign });
    };
    private handleShowThinkingUpdate = (e: CustomEvent) => {
        this.showThinking = Boolean(e.detail?.value);
        const state = window.vscode.getState?.() || {};
        window.vscode.setState?.({ ...state, showThinking: this.showThinking });
    };
    private handleToggleSessionDropdown = () => this.toggleDropdown("session");
    private handleToggleSettingsDropdown = () => this.toggleDropdown("settings");
    private handleDropdownClose = () => {
        this.activeDropdown = "";
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
        const store = ChatSessionStore.instance;
        // Refresh ChatContext reference when store changes
        // This handles the case where chatContext was undefined initially
        this.chatContext = store.getActiveChatContext();
        this.sessions = [...store.sessions];
        this.activeSessionId = store.activeSessionId;
        this.contextUsed = store.contextUsed;
        this.contextMax = store.contextMax;
        this.syncMessages();
    };

    /** Initializes the component by signaling readiness to the backend and setting up the window message listener for host communication. */
    connectedCallback() {
        super.connectedCallback();
        const state = window.vscode.getState?.() || {};
        if (typeof state.fancyTyping === "boolean") {
            this.fancyTyping = state.fancyTyping;
        }
        if (typeof state.flatDesign === "boolean") {
            this.flatDesign = state.flatDesign;
        }
        if (typeof state.showThinking === "boolean") {
            this.showThinking = state.showThinking;
        }
        // Get ChatContext reference from store (not a copy)
        // Note: May be undefined initially until backend sends init message
        this.chatContext = ChatSessionStore.instance.getActiveChatContext();

        // Subscribe to store changes for automatic synchronization
        this._onStoreChange = this._onStoreChange.bind(this);
        ChatSessionStore.instance.addEventListener("change", this._onStoreChange);

        onChatReady();
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

        // The bottom overlay (pending-intercept banner) floats over the output's bottom. Reserve
        // matching scroll padding (so the last message + in-flow loading dots clear it) and nudge
        // scrollTop by the delta, keeping the visible content put instead of jumping — same
        // approach as the input observer above.
        if (this.bottomOverlay) {
            this._pendingResizeObserver = new ResizeObserver(() => {
                const height = this.bottomOverlay.getBoundingClientRect().height;
                const delta = height - this._lastPendingHeight;
                this._lastPendingHeight = height;
                this.chatOutput.style.paddingBottom = height > 0 ? `${height}px` : "";
                if (Math.abs(delta) > 1) {
                    this.chatOutput.scrollTop += delta;
                }
            });
            this._pendingResizeObserver.observe(this.bottomOverlay);
        }
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
        this._pendingResizeObserver?.disconnect();
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
            this.activeModal = "";
        }

        if (
            changed.has("contextUsed") ||
            changed.has("contextMax") ||
            changed.has("isGenerating") ||
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

    // tokens trimmed out of the live window (before contextStartIndex)
    private _contextTrimmedTokens(): number {
        if (this.contextStartIndex <= 0 || !this.chatContext) {
            return 0;
        }
        return this.chatContext.sumTokensInRange(0, this.contextStartIndex);
    }

    // flash the trim annotation so the drop reads as intentional, auto-clears after the fade
    public flashContextTrim(turnsRemoved: number, tokensFreed: number): void {
        if (turnsRemoved <= 0) {
            return;
        }
        const tokens = tokensFreed >= 1000 ? `${(tokensFreed / 1000).toFixed(1)}k` : `${tokensFreed}`;
        this.contextFlash = `−${tokens} · ${turnsRemoved} turn${turnsRemoved > 1 ? "s" : ""}`;
        if (this._contextFlashTimer !== null) {
            clearTimeout(this._contextFlashTimer);
        }
        this._contextFlashTimer = window.setTimeout(() => {
            this.contextFlash = "";
            this._contextFlashTimer = null;
        }, 4000);
    }

    private _autoSummarizeAtContextThreshold() {
        if (!this._shouldShowAutoSummaryConfirm()) {
            this._wasContextAtAutoSummaryThreshold = false;
            return;
        }

        if (this._wasContextAtAutoSummaryThreshold || this.isGenerating || this.activeModal === "acquire") {
            return;
        }

        this._wasContextAtAutoSummaryThreshold = true;
        this._showAcquireModal("Auto-Summary", "Summary recommended.");
    }

    private _showAcquireModal(title: string, description: string) {
        this.acquireModalTitle = title;
        this.acquireModalDescription = description;
        this.activeModal = "acquire";
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
            this._showAcquireModal("Auto-Summary", "Summary recommended.");
        }
    }

    reopenAutoSummaryOnError() {
        if (!this._autoSummaryInProgress) {
            return;
        }
        this._autoSummaryInProgress = false;
        this._autoSummaryWaitingForContextUsage = false;
        this._showAcquireModal("Auto-Summary", "Summary recommended.");
    }

    private _shouldShowContextNotification(): boolean {
        return this._getContextUsageRatio() >= 0.85;
    }

    private _shouldShowAutoSummaryConfirm(): boolean {
        return this._getContextUsageRatio() >= 0.95;
    }

    private toggleDropdown(kind: ActiveDropdown) {
        if (!kind) {
            return;
        }
        this.activeDropdown = kind;
        this.activeDropdownElement?.toggle();
    }

    private get showSettingsBadge(): boolean {
        return (
            this.config.liteMode ||
            !this.config.agenticMode ||
            (this.config.agenticMode && (!this.config.enableEditTools || !this.config.enableShellTool))
        );
    }

    private renderActiveDropdown() {
        if (this.activeDropdown === "session") {
            return html`
                <collama-session-dropdown
                    .autoShow=${true}
                    .sessions=${this.sessions}
                    .activeSessionId=${this.activeSessionId}
                    @dropdown-close=${this.handleDropdownClose}
                    @export-session-html=${this.handleExportSessionHtml}
                    @select-session=${this.handleSelectSession}
                    @delete-session=${this.handleDeleteSession}
                    @rename-session=${this.handleRenameSession}
                    @copy-session=${onCopySession}
                ></collama-session-dropdown>
            `;
        }

        if (this.activeDropdown === "settings") {
            return html`
                <collama-settings-dropdown
                    .autoShow=${true}
                    .config=${this.config}
                    .fancyTyping=${this.fancyTyping}
                    .flatDesign=${this.flatDesign}
                    .showThinking=${this.showThinking}
                    .agentsMdActive=${this.agentsMdActive}
                    .memoryActive=${this.memoryActive}
                    @dropdown-close=${this.handleDropdownClose}
                    @settings-update=${this.handleSettingsUpdate}
                    @fancy-typing-update=${this.handleFancyTypingUpdate}
                    @flat-design-update=${this.handleFlatDesignUpdate}
                    @show-thinking-update=${this.handleShowThinkingUpdate}
                    @open-memory=${this.handleOpenMemory}
                ></collama-settings-dropdown>
            `;
        }

        return "";
    }

    private renderActiveModal() {
        if (this.activeModal === "error") {
            return html`
                <collama-error-modal
                    autoShow
                    .content=${this.errorModalContent}
                    @overlay-close=${this.handleErrorModalClose}
                ></collama-error-modal>
            `;
        }

        if (this.activeModal === "toolConfirm" && this.toolConfirmRequest) {
            return html`
                <collama-tool-confirm-modal
                    autoShow
                    .request=${this.toolConfirmRequest}
                    @tool-confirm-accept=${this.handleToolConfirmAccept}
                    @tool-confirm-accept-all=${this.handleToolConfirmAcceptAll}
                    @tool-confirm-cancel=${this.handleToolConfirmCancel}
                ></collama-tool-confirm-modal>
            `;
        }

        if (this.activeModal === "toolDecision" && this.toolDecisionRequest) {
            return html`
                <collama-tool-decision-modal
                    autoShow
                    .request=${this.toolDecisionRequest}
                    @tool-decision-select=${this.handleToolDecisionSelect}
                ></collama-tool-decision-modal>
            `;
        }

        if (this.activeModal === "acquire") {
            return html`
                <collama-acquire-modal
                    autoShow
                    .title=${this.acquireModalTitle}
                    .description=${this.acquireModalDescription}
                    @acquire-accept=${this.handleAcquireAutoSummaryAccept}
                    @overlay-close=${this.handleAcquireDismiss}
                ></collama-acquire-modal>
            `;
        }

        if (this.activeModal === "memory") {
            return html`
                <collama-memory-modal
                    autoShow
                    .entries=${this.memoryEntries}
                    @memory-delete-request=${this.handleDeleteMemory}
                    @memory-add-request=${this.handleAddMemory}
                    @memory-edit-request=${this.handleEditMemory}
                    @overlay-close=${this.handleMemoryModalClose}
                ></collama-memory-modal>
            `;
        }

        return "";
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

        const showLoadingDots = this.isGenerating;
        return html`
            <collama-chatheader
                .contextUsed=${this.contextUsed}
                .contextMax=${this.contextMax}
                .contextTrimmed=${this._contextTrimmedTokens()}
                .contextFlash=${this.contextFlash}
                .isGenerating=${this.isGenerating}
                .sessionDropdownOpen=${this.activeDropdown === "session"}
                .settingsDropdownOpen=${this.activeDropdown === "settings"}
                .showSettingsBadge=${this.showSettingsBadge}
                .activeShells=${this.activeShells}
                @export-session=${this.handleExportSession}
                @import-session=${onImportSession}
                @new-chat=${onNewChat}
                @new-ghost-chat=${onNewGhostChat}
                @toggle-session-dropdown=${this.handleToggleSessionDropdown}
                @toggle-settings-dropdown=${this.handleToggleSettingsDropdown}
                @select-session=${this.handleSelectSession}
                @delete-session=${this.handleDeleteSession}
                @rename-session=${this.handleRenameSession}
                @copy-session=${onCopySession}
            ></collama-chatheader>
            <div class="chat-area">
                <div class="output-wrapper">
                    ${this.renderActiveDropdown()}
                    <collama-chatoutput
                        .messages=${this.messages}
                        .contextStartIndex=${this.contextStartIndex}
                        .isGenerating=${this.isGenerating}
                        .showLoadingDots=${showLoadingDots}
                        .showThinking=${this.showThinking}
                        .fancyTyping=${this.fancyTyping}
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
                        .isGenerating=${this.isGenerating}
                        @scroll-down=${this.handleScrollDown}
                    ></collama-scroll-down>
                    <div class="bottom-overlay">
                        <collama-active-shells .count=${this.activeShells}></collama-active-shells>
                        <collama-pending-intercept
                            .items=${this.pendingIntercepts}
                            @cancel-intercept=${this.handleInterceptCancel}
                        ></collama-pending-intercept>
                    </div>
                </div>
                ${this.renderActiveModal()}
                <collama-chatinput
                    ?inert=${this.activeModal === "acquire"}
                    @submit=${this.handleSubmit}
                    @cancel=${this.handleCancel}
                    @convert-to-ghost=${this.handleConvertToGhost}
                    @clear-chat=${this.handleClearChat}
                    @summarize-conversation=${this.handleSummarizeConversation}
                    @auto-accept=${onAutoAccept}
                    @context-cleared=${this.handleContextCleared}
                    @context-search=${onContextSearch}
                    @context-add=${onContextAdd}
                    .contexts=${this.currentContexts}
                    .isGenerating=${this.isGenerating}
                    .isSummarizing=${this.isSummarizing}
                    .agentToken=${this.agentToken}
                    .hasTokenData=${this.hasTokenData}
                    .isGhost=${this.sessions.find((s) => s.id === this.activeSessionId)?.ghost === true}
                    .contextSearchResults=${this.contextSearchResults}
                    .autoAccept=${this.autoAccept}
                ></collama-chatinput>
            </div>
        `;
    }
}
