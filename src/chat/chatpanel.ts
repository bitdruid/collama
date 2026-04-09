import * as vscode from "vscode";

import { Agent, AgentEvent } from "../agent/agent";
import { resolveToolConfirm, setAutoAcceptAll } from "../agent/tools/edit";
import { ChatContext, ChatHistory, sumMsgTokens } from "../common/context-chat";
import { EditorContext, getRelativePath } from "../common/context-editor";
import { checkPredictFitsContextLength } from "../common/models";
import { chatSummarize_Template } from "../common/prompt";
import { populateMsgTokens } from "../common/tokenizer";
import { buildInstructionOptions, ToolCall } from "../common/types-llm";
import { userConfig } from "../config";
import { logMsg } from "../logging";
import { Session } from "./session";
import { mapSessionsToSummaries, sanitizeMessages, setWebview } from "./utils-back";
import { StartPage } from "./web/components/chat-start";

/**
 * Encapsulates the chat panel logic within the extension.
 */
export class ChatPanel {
    private session: Session;
    private currentAgent: Agent | null = null;

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
        this.session = new Session(extContext, webviewView);
    }

    /**
     * Registry of message type handlers.
     */
    private readonly messageHandlers: Record<string, (msg: any, webview: vscode.Webview) => void | Promise<void>> = {
        "tool-confirm-response": (msg) => resolveToolConfirm(msg.id, msg.value, msg.reason),
        "chat-ready": (_, webview) => this.handleChatReady(webview),
        "new-session": () => this.handleNewSession(),
        "new-ghost-session": () => this.handleNewGhostSession(),
        "switch-session": (msg) => this.handleSwitchSession(msg),
        "export-session": (msg) => this.handleExportSession(msg),
        "rename-session": (msg) => this.handleRenameSession(msg),
        "copy-session": (msg) => this.handleCopySession(msg),
        "delete-session": (msg) => this.handleDeleteSession(msg),
        "delete-messages": (msg) => this.handleDeleteMessages(msg),
        "auto-accept-all": (msg) => setAutoAcceptAll(msg.enabled),
        "convert-to-ghost": () => this.handleConvertToGhost(),
        "clear-chat": () => this.handleClearChat(),
        "chat-cancel": (_, webview) => this.handleChatCancel(webview),
        "summarize-request": (msg, webview) => this.handleSummarizeRequest(msg, webview),
        "chat-request": (msg, webview) => this.handleChatRequest(msg, webview),
        "context-search": (msg, webview) => this.handleContextSearch(msg, webview),
        "context-add-file": (msg, webview) => this.handleContextAddFile(msg, webview),
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
        const activeSession = this.session.getActiveSession();
        const messages = activeSession?.messages.getMessages() || [];
        const contextMax = userConfig.apiTokenContextLenInstruct;

        webview.postMessage({
            type: "init",
            sessions: mapSessionsToSummaries(this.session.sessions),
            activeSessionId: this.session.activeSessionId,
            history: sanitizeMessages(messages),
            contextUsed: activeSession?.messages.sumTokens() ?? 0,
            contextMax,
            contextStartIndex: activeSession?.contextStartIndex || 0,
        });
    }

    /**
     * Handles creating a new session.
     */
    private handleNewSession() {
        // Auto-delete the old session if it was temporary or ghost
        const oldSession = this.session.getActiveSession();
        if (oldSession?.temporary || oldSession?.ghost) {
            this.session.sessions = this.session.sessions.filter((s) => s.id !== oldSession.id);
            logMsg(`Auto-deleted temporary/ghost session: ${oldSession.id}`);
        }

        this.session.createNewSession();
        this.session.sendSessionsUpdate();
        logMsg(`Created new session: ${this.session.activeSessionId}`);
    }

    /**
     * Handles creating a new ghost (temporary, unlisted) session.
     * The session is never persisted and never appears in the sessions list.
     */
    private handleNewGhostSession() {
        // Auto-delete the old session if it was temporary or ghost
        const oldSession = this.session.getActiveSession();
        if (oldSession?.temporary || oldSession?.ghost) {
            this.session.sessions = this.session.sessions.filter((s) => s.id !== oldSession.id);
            logMsg(`Auto-deleted temporary/ghost session: ${oldSession.id}`);
        }

        const now = Date.now();
        const ghostSession = {
            id: Session.generateSessionId(),
            title: "Temporary Chat",
            messages: new ChatContext(),
            contextStartIndex: 0,
            ghost: true,
            createdAt: now,
            updatedAt: now,
        };
        this.session.sessions.push(ghostSession);
        this.session.activeSessionId = ghostSession.id;
        this.session.sendSessionsUpdate();
        logMsg(`Created ghost session: ${ghostSession.id}`);
    }

    /**
     * Handles switching to a different session.
     */
    private handleSwitchSession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        if (!this.session.sessions.find((s) => s.id === sessionId)) {
            return;
        }

        // Auto-delete the old session if it was temporary or ghost
        const oldSession = this.session.getActiveSession();
        if (oldSession?.temporary || oldSession?.ghost) {
            this.session.sessions = this.session.sessions.filter((s) => s.id !== oldSession.id);
            logMsg(`Auto-deleted temporary/ghost session: ${oldSession.id}`);
        }

        this.session.activeSessionId = sessionId;
        this.session.saveSessions();
        this.session.sendSessionsUpdate();
        logMsg(`Switched to session: ${sessionId}`);
    }

    /**
     * Opens a read-only preview of a session's chat history as raw JSON.
     */
    private handleExportSession(msg: { sessionId: string }) {
        const session = this.session.sessions.find((s) => s.id === msg.sessionId);
        const messages = session?.messages.getMessages() || [];
        const json = JSON.stringify(this.buildExportData(messages), null, 2);
        const uri = vscode.Uri.parse(`untitled:session-export-${msg.sessionId}.json`);
        vscode.workspace.openTextDocument(uri).then((doc) => {
            vscode.window.showTextDocument(doc, { preview: true }).then((editor) => {
                editor.edit((editBuilder) => {
                    editBuilder.insert(new vscode.Position(0, 0), json);
                });
            });
        });
    }

    /**
     * Handles renaming a session.
     */
    private handleRenameSession(msg: { sessionId: string; newTitle: string }) {
        const { sessionId, newTitle } = msg;
        const session = this.session.sessions.find((s) => s.id === sessionId);
        if (session && newTitle && newTitle.trim() !== "") {
            this.session.updateSession(session, (s) => {
                s.title = newTitle.trim();
                s.customTitle = true;
            });
            this.session.sendSessionsUpdate();
            logMsg(`Renamed session ${sessionId} to "${newTitle}"`);
        }
    }

    /**
     * Handles copying a session.
     */
    private handleCopySession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        const newSession = this.session.copySession(sessionId);
        if (newSession) {
            this.session.sendSessionsUpdate();
            logMsg(`Copied session ${sessionId} to ${newSession.id}`);
        }
    }

    /**
     * Handles deleting a session.
     */
    private handleDeleteSession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        this.session.sessions = this.session.sessions.filter((s) => s.id !== sessionId);

        // If we deleted the active session, switch to another or create new
        if (this.session.activeSessionId === sessionId) {
            if (this.session.sessions.length > 0) {
                this.session.activeSessionId = this.session.sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
            } else {
                this.session.createNewSession();
            }
        }

        this.session.saveSessions();
        this.session.sendSessionsUpdate();
        logMsg(`Deleted session: ${sessionId}`);
    }

    /**
     * Handles deleting a turn from a session's message history.
     */
    private handleDeleteMessages(msg: { turnStart: number; turnEnd: number; sessionId: string }) {
        const { turnStart, turnEnd, sessionId } = msg;
        const session = this.session.sessions.find((s) => s.id === sessionId)!;
        const approxTokensFreed = session.messages.sumTokensInRange(turnStart, turnEnd);
        this.session.updateSession(session, (s) => {
            s.messages.removeRange(turnStart, turnEnd);
            if (!s.customTitle) {
                s.title = Session.generateSessionTitle(s.messages.getMessages());
            }
        });
        this.session.sendSessionsUpdate();
        logMsg(`Messages deleted for session ${sessionId} (~${approxTokensFreed} tokens freed)`);
    }

    /**
     * Converts the active session to a ghost session.
     * Has no effect if the session is already ghost.
     */
    private handleConvertToGhost() {
        const session = this.session.getActiveSession();
        if (!session || session.ghost) {
            return;
        }
        this.session.updateSession(session, (s) => {
            s.ghost = true;
            s.temporary = false;
        });
        this.session.sendSessionsUpdate();
        this.session.saveSessions();
        logMsg(`Session ${session.id} converted to ghost`);
    }

    /**
     * Clears all messages from the active session.
     */
    private handleClearChat() {
        const session = this.session.getActiveSession();
        if (!session) {
            return;
        }
        this.session.updateSession(session, (s) => {
            s.messages.setMessages([]);
            s.contextStartIndex = 0;
        });
        this.session.sendSessionsUpdate();
        logMsg(`Cleared messages for session ${session.id}`);
    }

    /**
     * Handles cancelling the current chat request.
     */
    private handleChatCancel(webview: vscode.Webview) {
        if (this.currentAgent) {
            logMsg("Cancelling agent execution");
            this.currentAgent.cancel();
            this.currentAgent = null;

            const active = this.session.getActiveSession();
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
                this.session.updateSession(active, (s) => {
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
        webview.postMessage({
            type: "chat-complete",
            contextUsed: this.session.getActiveSession()?.messages.sumTokens() ?? 0,
        });
    }

    /**
     * Handles compressing the chat history into a summary.
     */
    private async handleSummarizeRequest(
        msg: { turnStart: number; turnEnd: number; sessionId: string },
        webview: vscode.Webview,
    ) {
        const { turnStart, turnEnd, sessionId } = msg;
        const session = this.session.sessions.find((s) => s.id === sessionId)!;
        const isConversation = turnStart === 0 && turnEnd === session.messages.length();
        const label = isConversation ? "Conversation" : "Turn";
        const sourceMessages = session.messages.getMessages().slice(turnStart, turnEnd);
        const summarized = await this.summarizeContent(webview, sourceMessages, chatSummarize_Template, label);

        this.session.updateSession(session, (s) => {
            if (isConversation) {
                s.messages.setMessages(summarized);
                s.contextStartIndex = 0;
            } else {
                s.messages.replaceRange(turnStart, turnEnd, summarized);
            }
        });

        const allMessages = isConversation ? summarized : session.messages.getMessages();
        webview.postMessage({ type: "summary-complete", messages: allMessages, isConversation });
        webview.postMessage({ type: "chat-complete", contextUsed: sumMsgTokens(allMessages) });
        this.session.sendSessionsUpdate();
        logMsg(`Summarized ${isConversation ? "conversation" : "turn"} for session ${sessionId}`);
    }

    /**
     * Handles a new chat request from the user.
     */
    private async handleChatRequest(msg: { messages: ChatHistory[]; sessionId: string }, webview: vscode.Webview) {
        const { messages, sessionId } = msg;

        // Mutable index tracking the current message being streamed/added
        let currentIndex = messages.length;

        // Update the active session's messages (full history + empty assistant slot)
        const session = this.session.sessions.find((s) => s.id === sessionId)!;
        this.session.updateSession(session, (s) => {
            s.messages.setMessages([...messages, { role: "assistant" as const, content: "" }]);
            if (!s.customTitle) {
                s.title = Session.generateSessionTitle(messages);
            }
        });

        const options = buildInstructionOptions();

        // Trim old turns if context limit is exceeded
        const { trimmedMessages, turnsRemoved, tokensFreed, messagesRemoved } = await trimMessagesForContext(
            messages,
            options.num_predict,
            userConfig.apiTokenContextLenInstruct,
        );

        // Persist and notify webview of current context boundary
        const contextStartIndex = messagesRemoved;
        this.session.updateSession(session, (s) => {
            s.contextStartIndex = contextStartIndex;
        });
        webview.postMessage({ type: "context-trimmed", turnsRemoved, tokensFreed, contextStartIndex });

        if (turnsRemoved > 0) {
            logMsg(`Context limit exceeded: removed ${turnsRemoved} turn(s) (~${tokensFreed} tokens) from LLM context`);
        }

        await this.runAgent(
            webview,
            new ChatContext(trimmedMessages),
            (chunk) => {
                this.session.updateSession(session, (s) => {
                    s.messages.appendContent(currentIndex, chunk);
                });
                webview.postMessage({ type: "agent-chunk", index: currentIndex, chunk });
            },
            (event) => {
                if (event.type === "agent-tokens") {
                    webview.postMessage({ type: "agent-tokens", tokens: event.tokens });
                }

                if (event.type === "agent-tool-done") {
                    currentIndex++;

                    const customKeys = {
                        toolName: event.toolName as string,
                        toolArgs: event.toolArgs as string,
                        toolTarget: event.toolTarget as string,
                    };
                    this.session.updateSession(session, (s) => {
                        s.messages.replaceRange(currentIndex, currentIndex, [
                            {
                                role: "tool" as const,
                                content: "[tool result has been stripped after agent answered]",
                                tool_call_id: event.toolCallId as string,
                                customKeys,
                            },
                        ]);
                    });
                    webview.postMessage({
                        type: "agent-add-message",
                        message: {
                            role: "tool",
                            content: "[tool result has been stripped after agent answered]",
                            customKeys,
                        },
                    });
                }

                if (event.type === "agent-tool-calls") {
                    this.session.updateSession(session, (s) => {
                        const msg = s.messages.getMsgByIndex(currentIndex);
                        if (msg?.role === "assistant") {
                            msg.tool_calls = event.toolCalls as ToolCall[];
                        }
                    });
                }

                if (event.type === "agent-assistant-new") {
                    currentIndex++;

                    this.session.updateSession(session, (s) => {
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
        );

        // Tokenize any new messages (assistant + tool) that don't have msgTokens yet
        await populateMsgTokens(session.messages.getMessages());
        this.session.saveSessions();

        // Notify webview that chat is complete
        webview.postMessage({ type: "chat-complete", contextUsed: session.messages.sumTokens() });

        // Update sessions list after response completes
        this.session.sendSessionsUpdate();
    }

    /**
     * Searches workspace files/folders matching the query and sends results to the webview.
     */
    private async handleContextSearch(msg: { query: string }, webview: vscode.Webview) {
        const query = msg.query?.trim();
        if (!query) {
            webview.postMessage({ type: "context-search-results", results: [] });
            return;
        }

        const pattern = `**/*${query}*`;
        const excludePattern = "**/node_modules/**";

        try {
            const uris = await vscode.workspace.findFiles(pattern, excludePattern, 50);
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || "";

            const results = uris.map((uri) => {
                const fullPath = uri.fsPath;
                const relativePath = workspaceRoot ? fullPath.replace(workspaceRoot + "/", "") : fullPath;
                const fileName = fullPath.split("/").pop() || fullPath;
                return { fileName, filePath: fullPath, relativePath, isFolder: false };
            });

            // Also search for matching folders
            const folderUris = await vscode.workspace.findFiles(`${pattern}/**/*`, excludePattern, 50);
            const seenFolders = new Set<string>();
            for (const uri of folderUris) {
                const parts = uri.fsPath.split("/");
                // Walk up the path to find folders matching the query
                for (let i = parts.length - 2; i >= 0; i--) {
                    if (parts[i].toLowerCase().includes(query.toLowerCase())) {
                        const folderPath = parts.slice(0, i + 1).join("/");
                        if (!seenFolders.has(folderPath) && folderPath !== workspaceRoot) {
                            seenFolders.add(folderPath);
                            const relativePath = workspaceRoot
                                ? folderPath.replace(workspaceRoot + "/", "")
                                : folderPath;
                            results.unshift({
                                fileName: parts[i],
                                filePath: folderPath,
                                relativePath,
                                isFolder: true,
                            });
                        }
                        break;
                    }
                }
            }

            webview.postMessage({ type: "context-search-results", results: results.slice(0, 50) });
        } catch {
            webview.postMessage({ type: "context-search-results", results: [] });
        }
    }

    /**
     * Reads a file or folder and sends it as an attached context to the webview.
     */
    private async handleContextAddFile(msg: { filePath: string; isFolder: boolean }, webview: vscode.Webview) {
        const { filePath, isFolder } = msg;

        try {
            const uri = vscode.Uri.file(filePath);
            const fileName = filePath.split("/").pop() || filePath;
            const relativePath = getRelativePath(uri);

            if (isFolder) {
                // For folders, list the directory contents as the context
                const entries = await vscode.workspace.fs.readDirectory(uri);
                const listing = entries
                    .map(([name, type]) => {
                        const prefix = type === vscode.FileType.Directory ? "[dir]  " : "       ";
                        return `${prefix}${name}`;
                    })
                    .join("\n");

                webview.postMessage({
                    type: "context-update",
                    context: {
                        fileName: fileName + "/",
                        filePath,
                        relativePath: relativePath + "/",
                        isFolder: true,
                        hasSelection: false,
                        startLine: 0,
                        endLine: 0,
                        content: listing,
                    },
                });
            } else {
                const contentBytes = await vscode.workspace.fs.readFile(uri);
                const content = Buffer.from(contentBytes).toString("utf8");

                webview.postMessage({
                    type: "context-update",
                    context: {
                        fileName,
                        filePath,
                        relativePath,
                        isFolder: false,
                        hasSelection: false,
                        startLine: 0,
                        endLine: 0,
                        content,
                    },
                });
            }
        } catch (err) {
            logMsg(`Failed to read context file: ${filePath} - ${err}`);
        }
    }

    // ==================== Helper Methods ====================

    /**
     * Sends the current editor context to the webview.
     *
     * @param currentContext - The context object containing editor state.
     */
    receiveCurrentContext(currentContext: EditorContext) {
        const hasSelection = currentContext.selectionText.length > 0;
        const startLine = currentContext.selectionStartLine + 1; // 1-based
        const endLine = currentContext.selectionEndLine + 1;

        this.webviewView.webview.postMessage({
            type: "context-update",
            context: {
                fileName: currentContext.fileName,
                filePath: currentContext.filePath,
                relativePath: currentContext.relativePath,
                isFolder: currentContext.isFolder,
                hasSelection,
                startLine,
                endLine,
                content: hasSelection ? currentContext.selectionText : currentContext.activeFileText,
            },
        });
    }

    /** Builds a portable export payload: extension metadata + messages. */
    private buildExportData(messages: ChatHistory[]) {
        const { name, version } = this.extContext.extension.packageJSON;
        return [{ extension: name, version: version }, ...messages];
    }

    /**
     * Runs the agent with a 60s startup timeout. The timeout fires only if the agent
     * never produces a first chunk; any inbound chunk clears it. Callers are responsible
     * for sending `chat-complete` after post-processing.
     */
    private async runAgent(
        webview: vscode.Webview,
        messages: ChatContext,
        onChunk: (chunk: string) => void,
        onEvent?: (event: AgentEvent) => void,
    ): Promise<void> {
        const agent = new Agent();
        this.currentAgent = agent;
        const timeout = setTimeout(() => {
            agent.cancel();
            webview.postMessage({ type: "chat-complete", contextUsed: messages.sumTokens() });
        }, 60000);

        try {
            await agent.work(
                messages,
                (chunk) => {
                    clearTimeout(timeout);
                    onChunk(chunk);
                },
                (event) => {
                    clearTimeout(timeout);
                    onEvent?.(event);
                },
            );
        } catch (error) {
            agent.cancel();
            const errorInfo = {
                message: error instanceof Error ? error.message : String(error),
                stack: error instanceof Error ? error.stack : undefined,
                name: error instanceof Error ? error.name : "Error",
            };
            const exportedChat = JSON.stringify(this.buildExportData(messages.getMessages()), null, 2);
            const errorMessage = `\n\n--- ERROR ---\n\nname:\n${errorInfo.name}\n\nmessage:\n${errorInfo.message}\n\nstack:\n${errorInfo.stack || "N/A"}`;
            webview.postMessage({
                type: "agent-error",
                exportedChat,
                errorMessage,
            });
        } finally {
            clearTimeout(timeout);
            this.currentAgent = null;
        }
    }

    /**
     * Runs the agent on the given messages and returns the raw summary text.
     */
    private async summarizeText(webview: vscode.Webview, sourceMessages: ChatHistory[]): Promise<string> {
        const prompt = [...sourceMessages, { role: "user" as const, content: chatSummarize_Template }];
        let text = "";
        await this.runAgent(webview, new ChatContext(prompt), (chunk) => {
            text += chunk;
        });
        return text;
    }

    /**
     * Handles compressing the chat history into a summary.
     */
    private async summarizeContent(
        webview: vscode.Webview,
        sourceMessages: ChatHistory[],
        promptTemplate: string,
        label: string,
    ): Promise<ChatHistory[]> {
        if (label === "Conversation") {
            const messages = new ChatContext(sourceMessages);
            const turnSummaries: string[] = [];
            let i = 0;
            let turnNum = 1;
            const totalTurns = messages.getTurnCount();
            while (i < sourceMessages.length) {
                const end = messages.getTurnEnd(i);
                if (end <= i) {
                    break;
                }
                const turnMsgs = sourceMessages.slice(i, end);
                webview.postMessage({ type: "summary-progress", current: turnNum, total: totalTurns });
                const text = await this.summarizeText(webview, turnMsgs);
                turnSummaries.push(`# Turn ${turnNum}\n${text}`);
                turnNum++;
                i = end;
            }
            const combined = turnSummaries.join("\n\n");
            const fenced = `\`\`\`Summary: ${label}\n${combined.replace(/`/g, "\\`")}\n\`\`\``;
            const result: ChatHistory[] = [
                { role: "user" as const, content: "Context summary:" },
                { role: "assistant" as const, content: fenced },
            ];
            await populateMsgTokens(result);
            return result;
        }

        const summaryPrompt = [...sourceMessages, { role: "user" as const, content: promptTemplate }];
        let summaryContent = "";

        await this.runAgent(webview, new ChatContext(summaryPrompt), (chunk) => {
            summaryContent += chunk;
        });

        const fenced = `\`\`\`Summary: ${label}\n${summaryContent.replace(/`/g, "\\`")}\n\`\`\``;
        const result: ChatHistory[] = [
            { role: "user" as const, content: "Context summary:" },
            { role: "assistant" as const, content: fenced },
        ];
        await populateMsgTokens(result);
        return result;
    }
}

/**
 * Trims user+assistant message pairs from the beginning of the conversation
 * until the predicted response fits within the remaining context window.
 * Uses {@link checkPredictFitsContextLength} to account for num_predict and overhead buffers.
 * Always keeps at least the last message pair (the new user message + empty assistant).
 *
 * @param messages - The full message array.
 * @param numPredict - The number of tokens reserved for the model response.
 * @param contextMax - The maximum context length in tokens.
 * @returns The trimmed messages and info about what was removed.
 */
async function trimMessagesForContext(
    messages: ChatHistory[],
    numPredict: number,
    contextMax: number,
): Promise<{ trimmedMessages: ChatHistory[]; turnsRemoved: number; tokensFreed: number; messagesRemoved: number }> {
    await populateMsgTokens(messages);
    const tokenCounts = messages.map((msg) => msg.customKeys!.msgTokens!);
    let totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

    if (checkPredictFitsContextLength(numPredict, totalTokens, contextMax)) {
        return { trimmedMessages: messages, turnsRemoved: 0, tokensFreed: 0, messagesRemoved: 0 };
    }

    const ctx = new ChatContext();
    ctx.setMessages(messages);

    let turnsRemoved = 0;
    let tokensFreed = 0;
    let startIndex = 0;

    // Remove full turns from the beginning, keeping at least the last turn.
    while (!checkPredictFitsContextLength(numPredict, totalTokens, contextMax)) {
        const turnEnd = ctx.getTurnEnd(startIndex);
        // Keep at least the last turn
        if (turnEnd >= messages.length) {
            break;
        }
        for (let i = startIndex; i < turnEnd; i++) {
            totalTokens -= tokenCounts[i];
            tokensFreed += tokenCounts[i];
        }
        startIndex = turnEnd;
        turnsRemoved++;
    }

    return {
        trimmedMessages: messages.slice(startIndex),
        turnsRemoved,
        tokensFreed,
        messagesRemoved: startIndex,
    };
}
