import * as vscode from "vscode";

import { mailbox } from "../../agent/mailbox";
import { getToolDefinitions, getToolHistoryPolicy } from "../../agent/tools";
import {
    cancelAllPendingConfirms,
    getAutoAcceptAll,
    resolveToolConfirm,
    setAutoAcceptAll,
} from "../../agent/tools/utils/confirm";
import { cancelAllPendingDecisions, resolveToolDecision } from "../../agent/tools/flow";
import { getActiveSessionCount, onSessionChange } from "../../agent/tools/utils/shell-session";
import { isAgentsMdActive } from "../../common/agents-md";
import { buildInstructionOptions, ToolCall } from "../../common/client";
import { AttachedContext, ChatContext, ChatHistory, CustomMessageKeys } from "../../common/context-chat";
import { parseContextUri } from "../../common/context-editor";
import { deleteMemory, getAllMemory, isMemoryActive, writeMemory } from "../../common/memory";
import { PromptConstructor } from "../../common/prompt";
import Tokenizer from "../../common/tokenizer";
import { getChatSettings, userConfig } from "../../config";
import { logMsg } from "../../logging";
import type { ChatSession } from "../shared";
import { StartPage } from "../frontend/chat-init";
import { AgentRunner, RunKind } from "./agent-runner";
import { recomputeContextState, trimMessagesForContext } from "./context-state";
import { addContext, handleContextSearch, setContextWebviewReady } from "./handlers/context";
import { SessionHandlers } from "./handlers/session";
import { handleSummarizeRequest } from "./handlers/summary";
import { SessionManager } from "./session-manager";
import { mapSessionsToSummaries, sanitizeMessages, setWebview } from "./utils";

// chat panel logic for the extension
export class ChatPanel {
    private sessionManager: SessionManager;
    private sessionHandlers: SessionHandlers;
    private agentRunner: AgentRunner;

    get webview(): vscode.Webview {
        return this.webviewView.webview;
    }

    // create the panel and init session data
    constructor(
        private webviewView: vscode.WebviewView,
        private extContext: vscode.ExtensionContext,
    ) {
        this.sessionManager = new SessionManager(extContext, webviewView);
        this.sessionHandlers = new SessionHandlers(this.sessionManager, extContext);
        this.agentRunner = new AgentRunner();

        // forward shell session count changes to the webview
        onSessionChange(() => {
            try {
                this.webviewView.webview.postMessage({
                    type: "shell-sessions-update",
                    activeShells: getActiveSessionCount(),
                });
            } catch {
                // webview may be disposed
            }
        });

        // the runner owns mailbox delivery; the panel provides the wake-run body
        this.agentRunner.attachMailbox({
            getActiveSessionId: () => this.sessionManager.getActiveSession()?.id ?? null,
            runWake: (sessionId, notes) => this.runWake(sessionId, notes),
        });
    }

    // message type handler registry
    private readonly messageHandlers: Record<string, (msg: any, webview: vscode.Webview) => void | Promise<void>> = {
        "tool-confirm-response": (msg) => resolveToolConfirm(msg.id, msg.value, msg.reason),
        "tool-decision-response": (msg) => resolveToolDecision(msg.id, msg.value),
        "chat-ready": (_, webview) => this.handleChatReady(webview),
        "new-session": () => this.sessionHandlers.handleNewSession(),
        "new-ghost-session": () => this.sessionHandlers.handleNewGhostSession(),
        // switch/delete can change the active session - re-check the mailbox for held messages
        "switch-session": async (msg) => {
            await this.sessionHandlers.handleSwitchSession(msg);
            this.agentRunner.checkMailbox();
        },
        "export-session": (msg) => this.sessionHandlers.handleExportSession(msg),
        "export-session-html": (msg) => this.sessionHandlers.handleExportSessionHtml(msg),
        "import-session": () => this.sessionHandlers.handleImportSession(),
        "rename-session": (msg) => this.sessionHandlers.handleRenameSession(msg),
        "copy-session": (msg) => this.sessionHandlers.handleCopySession(msg),
        "delete-session": async (msg) => {
            await this.sessionHandlers.handleDeleteSession(msg);
            this.agentRunner.checkMailbox();
        },
        "delete-messages": (msg) => this.handleDeleteMessages(msg),
        "auto-accept-all": (msg) => setAutoAcceptAll(msg.enabled),
        "convert-to-ghost": () => this.handleConvertToGhost(),
        "clear-chat": () => this.handleClearChat(),
        "chat-cancel": (_, webview) => this.handleChatCancel(webview),
        "summarize-request": (msg, webview) => this.handleSummarize(msg, webview),
        "chat-request": (msg, webview) => this.handleChatRequest(msg, webview),
        "chat-intercept": (msg) => this.handleChatIntercept(msg),
        "chat-intercept-cancel": (msg) => this.agentRunner.cancelInjected(msg.id),
        "context-search": (msg, webview) => handleContextSearch(msg, webview),
        "context-add": (msg, webview) => addContext(parseContextUri(msg.relativePath), webview),
        "config-update-request": (msg, webview) => this.handleConfigUpdateRequest(msg, webview),
        "memory-list-request": (_, webview) => this.handleMemoryListRequest(webview),
        "memory-delete": (msg, webview) => this.handleMemoryDelete(msg, webview),
        "memory-add": (msg, webview) => this.handleMemoryAdd(msg, webview),
        "memory-edit": (msg, webview) => this.handleMemoryEdit(msg, webview),
        log: (msg) => logMsg(`WEBVIEW - ${msg.message}`),
    };

    // send all stored memories (both scopes) to the viewer
    private handleMemoryListRequest(webview: vscode.Webview) {
        webview.postMessage({ type: "memory-list", entries: getAllMemory() });
    }

    // delete a memory then re-send the list
    private async handleMemoryDelete(msg: { key: string; scope: "global" | "workspace" }, webview: vscode.Webview) {
        await deleteMemory(msg.key, msg.scope);
        webview.postMessage({ type: "memory-list", entries: getAllMemory() });
        webview.postMessage({ type: "config-update", memoryActive: isMemoryActive() });
    }

    // add a memory then re-send the list
    private async handleMemoryAdd(
        msg: { key: string; short: string; long: string; scope: "global" | "workspace" },
        webview: vscode.Webview,
    ) {
        await writeMemory(msg.key, msg.short, msg.long, msg.scope);
        webview.postMessage({ type: "memory-list", entries: getAllMemory() });
        webview.postMessage({ type: "config-update", memoryActive: isMemoryActive() });
    }

    // edit a memory then re-send the list
    private async handleMemoryEdit(
        msg: { oldKey: string; key: string; short: string; long: string; scope: "global" | "workspace" },
        webview: vscode.Webview,
    ) {
        await deleteMemory(msg.oldKey, msg.scope);
        await writeMemory(msg.key, msg.short, msg.long, msg.scope);
        webview.postMessage({ type: "memory-list", entries: getAllMemory() });
        webview.postMessage({ type: "config-update", memoryActive: isMemoryActive() });
    }

    // render the initial chat page in the webview
    renderPanel() {
        const page = new StartPage(this.extContext, this.webviewView);
        const webview = this.webviewView.webview;

        setContextWebviewReady(false, webview);
        webview.html = page.generate();
        setWebview(webview);

        webview.onDidReceiveMessage(async (msg) => {
            const handler = this.messageHandlers[msg.type];
            if (handler) {
                await handler(msg, webview);
            }
        });
    }

    // ==================== Message Handlers ====================

    // send initial state to the webview on chat-ready
    private async handleChatReady(webview: vscode.Webview) {
        await this.sessionManager.init();
        setContextWebviewReady(true, webview);
        const activeSession = this.sessionManager.getActiveSession();
        const messages = activeSession?.messages.getMessages() || [];
        const contextMax = userConfig.apiTokenContextLenInstruct;

        webview.postMessage({
            type: "init",
            sessions: mapSessionsToSummaries(this.sessionManager.sessions),
            activeSessionId: this.sessionManager.activeSessionId,
            history: sanitizeMessages(messages),
            contextUsed: activeSession?.messages.sumTokensFrom(activeSession.contextStartIndex) ?? 0,
            contextMax,
            contextStartIndex: activeSession?.contextStartIndex || 0,
            config: getChatSettings(),
            agentsMdActive: isAgentsMdActive(),
            memoryActive: isMemoryActive(),
            autoAcceptAll: getAutoAcceptAll(),
            activeShells: getActiveSessionCount(),
        });
    }

    // persist settings changed inside the chat webview
    private async handleConfigUpdateRequest(msg: { key: string; value: unknown }, webview: vscode.Webview) {
        const schema = {
            agenticMode: "boolean",
            enableEditTools: "boolean",
            enableShellTool: "boolean",
            liteMode: "boolean",
        } as const;
        const key = msg.key as keyof typeof schema;

        if (msg.key === "verbosityMode") {
            if (!["compact", "medium", "detailed"].includes(String(msg.value))) {
                return;
            }

            await vscode.workspace
                .getConfiguration("collama")
                .update("verbosityMode", msg.value, vscode.ConfigurationTarget.Global);
            webview.postMessage({
                type: "config-update",
                config: { verbosityMode: msg.value },
            });
            return;
        }

        if (!(key in schema) || typeof msg.value !== schema[key]) {
            return;
        }

        await vscode.workspace.getConfiguration("collama").update(key, msg.value, vscode.ConfigurationTarget.Global);
        webview.postMessage({
            type: "config-update",
            config: { [key]: msg.value },
        });
    }

    // delete a turn from a session's history
    private async handleDeleteMessages(msg: { turnStart: number; turnEnd: number; sessionId: string }) {
        const { turnStart, turnEnd, sessionId } = msg;
        const session = this.sessionManager.sessions.find((s) => s.id === sessionId)!;
        const approxTokensFreed = session.messages.sumTokensInRange(turnStart, turnEnd);
        session.messages.removeRange(turnStart, turnEnd);
        const { contextStartIndex } = await recomputeContextState(session.messages);
        this.sessionManager.updateSession(session, (s) => {
            s.contextStartIndex = contextStartIndex;
        });
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Messages deleted for session ${sessionId} (~${approxTokensFreed} tokens freed)`);
    }

    // toggle the active session between ghost and stored
    private handleConvertToGhost() {
        const session = this.sessionManager.getActiveSession();
        if (!session) {
            return;
        }
        if (session.ghost) {
            this.sessionManager.updateSession(session, (s) => {
                s.ghost = false;
            });
            this.sessionManager.sendSessionsUpdate();
            this.sessionManager.saveSessions();
            logMsg(`Session ${session.id} converted to stored`);
            return;
        }
        this.sessionManager.updateSession(session, (s) => {
            s.ghost = true;
        });
        this.sessionManager.sendSessionsUpdate();
        this.sessionManager.saveSessions();
        logMsg(`Session ${session.id} converted to ghost`);
    }

    // clear all messages from the active session
    private handleClearChat() {
        const session = this.sessionManager.getActiveSession();
        if (!session) {
            return;
        }
        this.sessionManager.updateSession(session, (s) => {
            s.messages.setMessages([]);
            s.contextStartIndex = 0;
        });
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Cleared messages for session ${session.id}`);
    }

    // remove the incomplete assistant/tool tail from the latest user turn
    private removeActiveRunTail(session: NonNullable<ReturnType<SessionManager["getActiveSession"]>>) {
        const msgs = session.messages.getMessages();
        let lastUserIdx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "user") {
                lastUserIdx = i;
                break;
            }
        }

        if (lastUserIdx >= 0 && lastUserIdx + 1 < session.messages.length()) {
            session.messages.removeRange(lastUserIdx + 1, session.messages.length());
            return true;
        }

        return false;
    }

    // cancel the current chat request
    private handleChatCancel(webview: vscode.Webview) {
        if (this.agentRunner.isRunning()) {
            logMsg("Cancelling agent execution");
            this.agentRunner.cancel();

            // resolve pending tool confirm/decision promises so the agent doesn't hang
            cancelAllPendingDecisions();
            cancelAllPendingConfirms();

            // prune the run's session, not the viewed one - the user may have switched mid-run
            const runSessionId = mailbox.getRunSession();
            const target =
                (runSessionId && this.sessionManager.sessions.find((s) => s.id === runSessionId)) ||
                this.sessionManager.getActiveSession();
            if (target) {
                // strip the incomplete assistant/tool tail from the cancelled run
                // keep the user message so they can see/retry their prompt
                this.sessionManager.updateSession(target, (s) => {
                    this.removeActiveRunTail(s);
                    s.messages.push({ role: "assistant" as const, content: "**Interrupted**" });
                });
                this.sessionManager.flushSessions();
                webview.postMessage({
                    type: "history-replace",
                    messages: sanitizeMessages(target.messages.getMessages()),
                    sessionId: target.id,
                });
            }
        }
        const activeAfterCancel = this.sessionManager.getActiveSession();
        webview.postMessage({
            type: "chat-complete",
            contextUsed: activeAfterCancel?.messages.sumTokensFrom(activeAfterCancel.contextStartIndex) ?? 0,
        });
    }

    // queue a user interjection into the running loop, inserted at the next turn boundary
    // no-op if no agent is running (frontend only sends this while generating)
    private handleChatIntercept(msg: {
        content: string;
        contexts?: AttachedContext[];
        id: string;
        sessionId?: string;
    }) {
        if (!this.agentRunner.isRunning()) {
            return;
        }
        // cross-session backstop: only the run's own session may inject (webview state may lag)
        const runSessionId = mailbox.getRunSession();
        if (msg.sessionId && runSessionId && msg.sessionId !== runSessionId) {
            logMsg(`Intercept dropped: sent from session ${msg.sessionId} while ${runSessionId} is running`);
            return;
        }
        const customKeys = msg.contexts && msg.contexts.length > 0 ? { contexts: msg.contexts } : undefined;
        this.agentRunner.injectMessage(msg.content, customKeys, msg.id);
        logMsg("Intercept queued into running agent loop");
    }

    // tokens the agent run prepends to every request: system prompt + tool schema (when sent)
    private async estimateAgentOverheadTokens(includeTools: boolean): Promise<number> {
        const tools = includeTools ? getToolDefinitions() : [];
        const overhead = JSON.stringify(PromptConstructor.agentTemplate()) + JSON.stringify(tools);
        return Tokenizer.calcTokens(overhead);
    }

    // handle a new chat request from the user
    private async handleChatRequest(msg: { messages: ChatHistory[]; sessionId: string }, webview: vscode.Webview) {
        const { messages, sessionId } = msg;
        await this.runAsUser("chat", sessionId, async (crossedWake) => {
            // set the session messages (full history + empty assistant slot)
            // title derives from the first user message once, only while still unnamed
            const session = this.sessionManager.sessions.find((s) => s.id === sessionId)!;
            const isUnnamed = session.title === "New Chat" || session.title === "Temporary Chat";
            this.sessionManager.updateSession(session, (s) => {
                s.messages.setMessages([...messages, { role: "assistant" as const, content: "" }]);
                if (isUnnamed) {
                    s.title = SessionManager.generateSessionTitle(messages);
                }
            });

            if (crossedWake) {
                // webview may hold fragments of the aborted wake run - resync to authoritative history
                webview.postMessage({
                    type: "history-replace",
                    messages: sanitizeMessages(session.messages.getMessages()),
                    sessionId: session.id,
                });
            }

            const trimmedMessages = await this.trimForContext(session, webview, messages);
            await this.streamRun(session, webview, trimmedMessages, messages.length);
        });
    }

    /**
     * Claims the runner for a user-initiated operation; an in-flight mailbox wake is cancelled
     * first (user wins), `fn` receives whether that happened so it can resync the webview.
     */
    private async runAsUser(
        kind: RunKind,
        sessionId: string,
        fn: (crossedWake: boolean) => Promise<void>,
    ): Promise<boolean> {
        let crossedWake = false;
        while (true) {
            if (this.agentRunner.activeKind() === "wake") {
                logMsg("User request crossed a mailbox wake - cancelling the wake run");
                crossedWake = true;
                await this.agentRunner.cancelAndWait();
            }
            if (await this.agentRunner.runExclusive(kind, sessionId, () => fn(crossedWake))) {
                return true;
            }
            if (this.agentRunner.activeKind() !== "wake") {
                // webview blocks sends during its own runs; only reachable on state desync
                logMsg(`${kind} request dropped: runner busy with ${this.agentRunner.activeKind()}`);
                return false;
            }
        }
    }

    /**
     * Trims old turns if the context limit is exceeded, persists the new boundary, and notifies
     * the webview. Returns the messages to send to the LLM.
     */
    private async trimForContext(
        session: ChatSession,
        webview: vscode.Webview,
        messages: ChatHistory[],
    ): Promise<ChatHistory[]> {
        const options = buildInstructionOptions();
        // reserve the agent system prompt + tool schema so the trimmed turn starts fitting
        const agentOverhead = await this.estimateAgentOverheadTokens(userConfig.agenticMode);
        const trimContextMax = Math.max(1, userConfig.apiTokenContextLenInstruct - agentOverhead);
        const previousContextStartIndex = session.contextStartIndex || 0;
        const { trimmedMessages, turnsRemoved, tokensFreed, messagesRemoved } = await trimMessagesForContext(
            messages,
            options.max_tokens,
            trimContextMax,
            previousContextStartIndex,
        );

        // persist and notify webview of the current context boundary
        const contextStartIndex = messagesRemoved;
        this.sessionManager.updateSession(session, (s) => {
            s.contextStartIndex = contextStartIndex;
        });
        webview.postMessage({
            type: "context-trimmed",
            turnsRemoved,
            tokensFreed,
            contextStartIndex,
            sessionId: session.id,
        });

        if (turnsRemoved > 0) {
            logMsg(`Context limit exceeded: removed ${turnsRemoved} turn(s) (~${tokensFreed} tokens) from LLM context`);
        }
        return trimmedMessages;
    }

    /**
     * Streams one agent run over `inputMessages` into `session` and finalizes context state.
     * `startIndex` is the index of the trailing empty assistant slot in `session.messages`.
     */
    private async streamRun(
        session: ChatSession,
        webview: vscode.Webview,
        inputMessages: ChatHistory[],
        startIndex: number,
    ) {
        // mutable index of the message being streamed/added
        let currentIndex = startIndex;

        // stamp every webview message with the run's session so the webview can skip
        // mutations while it is showing another chat
        const post = (message: Record<string, unknown>): void => {
            void webview.postMessage({ ...message, sessionId: session.id });
        };

        const completed = await this.agentRunner.run({
            webview,
            messages: new ChatContext(inputMessages),
            errorMessages: () => session.messages.getMessages(),
            onChunk: (chunk) => {
                this.sessionManager.updateSession(session, (s) => {
                    s.messages.appendContent(currentIndex, chunk);
                });
                post({ type: "agent-chunk", index: currentIndex, chunk });
            },
            onEvent: (event) => {
                if (event.type === "agent-reasoning") {
                    const chunk = event.chunk as string;
                    this.sessionManager.updateSession(session, (s) => {
                        s.messages.appendThinking(currentIndex, chunk);
                    });
                    post({ type: "agent-reasoning", index: currentIndex, chunk });
                }

                if (event.type === "agent-tokens") {
                    post({ type: "agent-tokens", tokens: event.tokens });
                }

                if (event.type === "agent-tool-done") {
                    currentIndex++;
                    const toolName = event.toolName as string;
                    const toolCallId = event.toolCallId as string;
                    const toolContent = event.toolResult as string;

                    // parse the tool result for success/failure
                    let toolSuccess = false;
                    try {
                        const parsed = JSON.parse(toolContent);
                        toolSuccess = parsed.success === true;
                    } catch {
                        // non-json result: keep defaults
                    }

                    const toolMeta: CustomMessageKeys["toolMeta"] = {
                        toolName,
                        toolArgs: event.toolArgs as string,
                        toolTarget: event.toolTarget as string,
                        toolSuccess,
                    };

                    // background shell renders as its own accordion
                    if (toolName === "shell") {
                        try {
                            const out = JSON.parse(toolContent)?.output;
                            if (out?.sessionId) {
                                toolMeta.toolStatus = out.status;
                                const liveness = out.status === "running" ? "running" : "exited";
                                toolMeta.toolTarget = `${out.sessionId} · ${liveness}`;
                                toolMeta.toolArgs = out.command ?? "";
                            }
                        } catch {
                            // non-json result: leave the default tooltarget
                        }
                    }

                    const customKeys: CustomMessageKeys = { toolMeta };
                    this.sessionManager.updateSession(session, (s) => {
                        s.messages.replaceRange(currentIndex, currentIndex, [
                            {
                                role: "tool" as const,
                                content: toolContent,
                                tool_call_id: toolCallId,
                                customKeys,
                            },
                        ]);
                    });
                    post({
                        type: "agent-add-message",
                        message: {
                            role: "tool",
                            content: toolContent,
                            tool_call_id: toolCallId,
                            customKeys,
                        },
                    });

                    if (event.toolLastCall) {
                        currentIndex++;
                        this.sessionManager.updateSession(session, (s) => {
                            s.messages.replaceRange(currentIndex, currentIndex, [
                                { role: "assistant" as const, content: "" },
                            ]);
                        });
                        post({
                            type: "agent-add-message",
                            message: { role: "assistant", content: "" },
                        });
                    }
                }

                if (event.type === "agent-tool-calls") {
                    this.sessionManager.updateSession(session, (s) => {
                        const msg = s.messages.getMsgByIndex(currentIndex);
                        if (msg?.role === "assistant") {
                            msg.tool_calls = event.toolCalls as ToolCall[];
                        }
                    });
                    post({
                        type: "agent-tool-calls",
                        index: currentIndex,
                        toolCalls: event.toolCalls as ToolCall[],
                    });
                }

                if (event.type === "agent-injected") {
                    // insert the user interjection before the trailing empty assistant slot
                    // then re-point currentindex at that assistant for the next turn's stream
                    const message = event.message as ChatHistory;
                    this.sessionManager.updateSession(session, (s) => {
                        s.messages.replaceRange(currentIndex, currentIndex, [message]);
                    });
                    post({
                        type: "agent-inject-message",
                        index: currentIndex,
                        message,
                        injectId: event.injectId,
                    });
                    currentIndex++;
                }

                if (event.type === "agent-new-assistant") {
                    // final answer slot filled, open a fresh assistant slot for the post-interjection turn
                    currentIndex++;
                    this.sessionManager.updateSession(session, (s) => {
                        s.messages.replaceRange(currentIndex, currentIndex, [
                            { role: "assistant" as const, content: "" },
                        ]);
                    });
                    post({
                        type: "agent-add-message",
                        message: { role: "assistant", content: "" },
                    });
                }
            },
        });

        if (!completed) {
            this.sessionManager.updateSession(session, (s) => {
                this.removeActiveRunTail(s);
            });
            const { contextStartIndex, contextUsed } = await recomputeContextState(session.messages);
            this.sessionManager.updateSession(session, (s) => {
                s.contextStartIndex = contextStartIndex;
            });
            post({
                type: "history-replace",
                messages: sanitizeMessages(session.messages.getMessages()),
            });
            post({ type: "chat-complete", contextUsed });
            this.sessionManager.sendSessionsUpdate();
            return;
        }

        this.sessionManager.updateSession(session, (s) => {
            s.messages.applyToolHistoryPolicy(getToolHistoryPolicy);
        });

        const { contextStartIndex: completedContextStartIndex, contextUsed } = await recomputeContextState(
            session.messages,
        );
        this.sessionManager.updateSession(session, (s) => {
            s.contextStartIndex = completedContextStartIndex;
        });
        this.sessionManager.flushSessions();

        // notify webview that chat is complete
        post({ type: "chat-complete", contextUsed });

        // update sessions list after the response completes
        this.sessionManager.sendSessionsUpdate();
    }

    // run a summarization request exclusively
    private async handleSummarize(
        msg: { turnStart: number; turnEnd: number; sessionId: string },
        webview: vscode.Webview,
    ) {
        await this.runAsUser("summary", msg.sessionId, async (crossedWake) => {
            if (crossedWake) {
                const active = this.sessionManager.getActiveSession();
                if (active) {
                    // strip the aborted wake tail so the webview-computed summary ranges match
                    this.sessionManager.updateSession(active, (s) => this.removeActiveRunTail(s));
                    webview.postMessage({
                        type: "history-replace",
                        messages: sanitizeMessages(active.messages.getMessages()),
                        sessionId: active.id,
                    });
                }
            }
            await handleSummarizeRequest(msg, webview, this.sessionManager, this.agentRunner);
        });
    }

    /** Body of one wake run: appends the notifications as hidden history, streams the reaction. */
    private async runWake(sessionId: string, notes: ChatHistory[]) {
        const session = this.sessionManager.sessions.find((s) => s.id === sessionId);
        if (!session) {
            return;
        }
        const webview = this.webview;
        // deliver notifications as plain history, then open the streaming slot
        this.sessionManager.updateSession(session, (s) => {
            for (const note of notes) {
                s.messages.push(note);
            }
            s.messages.push({ role: "assistant" as const, content: "" });
        });
        const all = session.messages.getMessages();
        const startIndex = all.length - 1;
        // webview enters generating mode and adopts the snapshot incl. the new slot
        webview.postMessage({
            type: "agent-wake",
            sessionId: session.id,
            messages: sanitizeMessages(all),
        });
        const trimmedMessages = await this.trimForContext(session, webview, all.slice(0, startIndex));
        if (this.agentRunner.wasCancelled()) {
            // a user request crossed this wake during the trim await - user wins
            return;
        }
        await this.streamRun(session, webview, trimmedMessages, startIndex);
    }
}
