import * as vscode from "vscode";

import { shouldDeduplicateToolResult } from "../agent/tools";
import { resolveToolConfirm, setAutoAcceptAll } from "../agent/tools/edit";
import { ChatContext, ChatHistory } from "../common/context-chat";
import { buildInstructionOptions, ToolCall } from "../common/types-llm";
import { userConfig } from "../config";
import { logMsg } from "../logging";
import { AgentRunner } from "./agent-runner";
import { recomputeContextState, trimMessagesForContext } from "./context-state";
import { handleContextAddFile, handleContextSearch } from "./handlers/context-handlers";
import { SessionHandlers } from "./handlers/session-handlers";
import { handleSummarizeRequest } from "./handlers/summary-handlers";
import { SessionManager } from "./session-manager";
import { createConfigSnapshot, mapSessionsToSummaries, sanitizeMessages, setWebview } from "./utils-back";
import { StartPage } from "./web/components/chat-start";

/**
 * Encapsulates the chat panel logic within the extension.
 */
export class ChatPanel {
    private sessionManager: SessionManager;
    private sessionHandlers: SessionHandlers;
    private agentRunner: AgentRunner;

    get webview(): vscode.Webview {
        return this.webviewView.webview;
    }

    /**
     * Creates a new ChatPanel instance and initializes session data.
     *
     * @param webviewView - The webview view that hosts the panel.
     * @param context - The extension context.
     */
    constructor(
        private webviewView: vscode.WebviewView,
        private extContext: vscode.ExtensionContext,
    ) {
        this.sessionManager = new SessionManager(extContext, webviewView);
        this.sessionHandlers = new SessionHandlers(this.sessionManager, extContext);
        this.agentRunner = new AgentRunner(extContext);
    }

    /**
     * Registry of message type handlers.
     */
    private readonly messageHandlers: Record<string, (msg: any, webview: vscode.Webview) => void | Promise<void>> = {
        "tool-confirm-response": (msg) => resolveToolConfirm(msg.id, msg.value, msg.reason),
        "chat-ready": (_, webview) => this.handleChatReady(webview),
        "new-session": () => this.sessionHandlers.handleNewSession(),
        "new-ghost-session": () => this.sessionHandlers.handleNewGhostSession(),
        "switch-session": (msg) => this.sessionHandlers.handleSwitchSession(msg),
        "export-session": (msg) => this.sessionHandlers.handleExportSession(msg),
        "rename-session": (msg) => this.sessionHandlers.handleRenameSession(msg),
        "copy-session": (msg) => this.sessionHandlers.handleCopySession(msg),
        "delete-session": (msg) => this.sessionHandlers.handleDeleteSession(msg),
        "delete-messages": (msg) => this.handleDeleteMessages(msg),
        "auto-accept-all": (msg) => setAutoAcceptAll(msg.enabled),
        "convert-to-ghost": () => this.handleConvertToGhost(),
        "clear-chat": () => this.handleClearChat(),
        "chat-cancel": (_, webview) => this.handleChatCancel(webview),
        "summarize-request": (msg, webview) =>
            handleSummarizeRequest(msg, webview, this.sessionManager, this.agentRunner),
        "chat-request": (msg, webview) => this.handleChatRequest(msg, webview),
        "context-search": (msg, webview) => handleContextSearch(msg, webview),
        "context-add-file": (msg, webview) => handleContextAddFile(msg, webview),
        "config-update-request": (msg, webview) => this.handleConfigUpdateRequest(msg, webview),
        log: (msg) => logMsg(`WEBVIEW - ${msg.message}`),
    };

    /**
     * Renders the initial chat page inside the webview.
     */
    renderPanel() {
        const page = new StartPage(this.extContext, this.webviewView);
        const webview = this.webviewView.webview;

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

    /**
     * Handles the chat-ready message by sending initial state to the webview.
     */
    private handleChatReady(webview: vscode.Webview) {
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
            config: createConfigSnapshot(userConfig),
        });
    }

    /**
     * Persists supported settings changed inside the chat webview.
     */
    private async handleConfigUpdateRequest(msg: { key: string; value: unknown }, webview: vscode.Webview) {
        const schema = {
            agentic: "boolean",
            enableEditTools: "boolean",
            enableShellTool: "boolean",
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

    /**
     * Handles deleting a turn from a session's message history.
     */
    private async handleDeleteMessages(msg: { turnStart: number; turnEnd: number; sessionId: string }) {
        const { turnStart, turnEnd, sessionId } = msg;
        const session = this.sessionManager.sessions.find((s) => s.id === sessionId)!;
        const approxTokensFreed = session.messages.sumTokensInRange(turnStart, turnEnd);
        session.messages.removeRange(turnStart, turnEnd);
        const { contextStartIndex } = await recomputeContextState(session.messages);
        this.sessionManager.updateSession(session, (s) => {
            s.contextStartIndex = contextStartIndex;
            if (!s.customTitle) {
                s.title = SessionManager.generateSessionTitle(s.messages.getMessages());
            }
        });
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Messages deleted for session ${sessionId} (~${approxTokensFreed} tokens freed)`);
    }

    /**
     * Toggles the active session between ghost and stored.
     */
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
            s.temporary = false;
        });
        this.sessionManager.sendSessionsUpdate();
        this.sessionManager.saveSessions();
        logMsg(`Session ${session.id} converted to ghost`);
    }

    /**
     * Clears all messages from the active session.
     */
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

    /**
     * Handles cancelling the current chat request.
     */
    private handleChatCancel(webview: vscode.Webview) {
        if (this.agentRunner.isRunning()) {
            logMsg("Cancelling agent execution");
            this.agentRunner.cancel();

            const active = this.sessionManager.getActiveSession();
            if (active) {
                // Strip the incomplete assistant/tool tail produced by the cancelled run,
                // keeping the user message so they can see/retry their prompt.
                const msgs = active.messages.getMessages();
                let lastUserIdx = -1;
                for (let i = msgs.length - 1; i >= 0; i--) {
                    if (msgs[i].role === "user") {
                        lastUserIdx = i;
                        break;
                    }
                }
                this.sessionManager.updateSession(active, (s) => {
                    if (lastUserIdx >= 0 && lastUserIdx + 1 < s.messages.length()) {
                        s.messages.removeRange(lastUserIdx + 1, s.messages.length());
                    }
                    s.messages.push({ role: "assistant" as const, content: "**Interrupted**" });
                });
                webview.postMessage({
                    type: "history-replace",
                    messages: sanitizeMessages(active.messages.getMessages()),
                });
            }
        }
        const activeAfterCancel = this.sessionManager.getActiveSession();
        webview.postMessage({
            type: "chat-complete",
            contextUsed: activeAfterCancel?.messages.sumTokensFrom(activeAfterCancel.contextStartIndex) ?? 0,
        });
    }

    /**
     * Handles a new chat request from the user.
     */
    private async handleChatRequest(msg: { messages: ChatHistory[]; sessionId: string }, webview: vscode.Webview) {
        const { messages, sessionId } = msg;

        // Mutable index tracking the current message being streamed/added
        let currentIndex = messages.length;

        // Update the active session's messages (full history + empty assistant slot)
        const session = this.sessionManager.sessions.find((s) => s.id === sessionId)!;
        this.sessionManager.updateSession(session, (s) => {
            s.messages.setMessages([...messages, { role: "assistant" as const, content: "" }]);
            if (!s.customTitle) {
                s.title = SessionManager.generateSessionTitle(messages);
            }
        });

        const options = buildInstructionOptions();

        // Trim old turns if context limit is exceeded
        const previousContextStartIndex = session.contextStartIndex || 0;
        const { trimmedMessages, turnsRemoved, tokensFreed, messagesRemoved } = await trimMessagesForContext(
            messages,
            options.num_predict,
            userConfig.apiTokenContextLenInstruct,
            previousContextStartIndex,
        );

        // Persist and notify webview of current context boundary
        const contextStartIndex = messagesRemoved;
        this.sessionManager.updateSession(session, (s) => {
            s.contextStartIndex = contextStartIndex;
        });
        webview.postMessage({ type: "context-trimmed", turnsRemoved, tokensFreed, contextStartIndex });

        if (turnsRemoved > 0) {
            logMsg(`Context limit exceeded: removed ${turnsRemoved} turn(s) (~${tokensFreed} tokens) from LLM context`);
        }

        await this.agentRunner.run({
            webview,
            messages: new ChatContext(trimmedMessages),
            onChunk: (chunk) => {
                this.sessionManager.updateSession(session, (s) => {
                    s.messages.appendContent(currentIndex, chunk);
                });
                webview.postMessage({ type: "agent-chunk", index: currentIndex, chunk });
            },
            onEvent: (event) => {
                if (event.type === "agent-tokens") {
                    webview.postMessage({ type: "agent-tokens", tokens: event.tokens });
                }

                if (event.type === "agent-tool-done") {
                    currentIndex++;
                    const toolName = event.toolName as string;
                    const toolCallId = event.toolCallId as string;
                    const toolContent = event.toolResult as string;

                    const customKeys = {
                        toolName,
                        toolArgs: event.toolArgs as string,
                        toolTarget: event.toolTarget as string,
                    };
                    this.sessionManager.updateSession(session, (s) => {
                        s.messages.replaceRange(currentIndex, currentIndex, [
                            {
                                role: "tool" as const,
                                content: toolContent,
                                tool_call_id: toolCallId,
                                customKeys,
                            },
                        ]);
                        s.messages.deduplicateToolResult(toolCallId, shouldDeduplicateToolResult);
                    });
                    webview.postMessage({
                        type: "agent-add-message",
                        message: {
                            role: "tool",
                            content: toolContent,
                            tool_call_id: toolCallId,
                            customKeys,
                        },
                    });
                }

                if (event.type === "agent-tool-calls") {
                    this.sessionManager.updateSession(session, (s) => {
                        const msg = s.messages.getMsgByIndex(currentIndex);
                        if (msg?.role === "assistant") {
                            msg.tool_calls = event.toolCalls as ToolCall[];
                        }
                    });
                    webview.postMessage({
                        type: "agent-tool-calls",
                        index: currentIndex,
                        toolCalls: event.toolCalls as ToolCall[],
                    });
                }

                if (event.type === "agent-assistant-new") {
                    currentIndex++;

                    this.sessionManager.updateSession(session, (s) => {
                        s.messages.replaceRange(currentIndex, currentIndex, [
                            {
                                role: "assistant" as const,
                                content: "",
                            },
                        ]);
                    });
                    webview.postMessage({
                        type: "agent-add-message",
                        message: { role: "assistant", content: "" },
                    });
                }
            },
        });

        const { contextStartIndex: completedContextStartIndex, contextUsed } = await recomputeContextState(session.messages);
        this.sessionManager.updateSession(session, (s) => {
            s.contextStartIndex = completedContextStartIndex;
        });
        this.sessionManager.saveSessions();

        // Notify webview that chat is complete
        webview.postMessage({ type: "chat-complete", contextUsed });

        // Update sessions list after response completes
        this.sessionManager.sendSessionsUpdate();
    }

}
