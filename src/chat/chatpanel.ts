import * as vscode from "vscode";

import { Agent } from "../agent/agent";
import { resolveToolConfirm, setAutoAcceptAll } from "../agent/tools/edit";
import { ChatContext, ChatHistory } from "../common/context-chat";
import { EditorContext } from "../common/context-editor";
import { buildInstructionOptions, ToolCall } from "../common/llmoptions";
import { checkPredictFitsContextLength } from "../common/models";
import { chatCompress_Template, chatSummarizeTurn_Template } from "../common/prompt";
import { populateMsgTokens, sumMsgTokens } from "../common/utils-common";
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
     * Renders the initial chat page inside the webview.
     */
    renderPanel() {
        const page = new StartPage(this.extContext, this.webviewView);
        const webview = this.webviewView.webview;

        webview.html = page.generate();
        setWebview(webview);

        webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === "tool-confirm-response") {
                resolveToolConfirm(msg.id, msg.value, msg.reason);
                return;
            }
            if (msg.type === "chat-ready") {
                this.handleChatReady(webview);
                return;
            }

            if (msg.type === "new-session") {
                this.handleNewSession();
                return;
            }

            if (msg.type === "switch-session") {
                this.handleSwitchSession(msg);
                return;
            }

            if (msg.type === "export-session") {
                this.handleExportSession(msg);
                return;
            }

            if (msg.type === "rename-session") {
                this.handleRenameSession(msg);
                return;
            }

            if (msg.type === "copy-session") {
                this.handleCopySession(msg);
                return;
            }

            if (msg.type === "delete-session") {
                this.handleDeleteSession(msg);
                return;
            }

            if (msg.type === "update-messages") {
                this.handleUpdateMessages(msg);
                return;
            }

            if (msg.type === "auto-accept-all") {
                setAutoAcceptAll(msg.enabled);
                return;
            }

            if (msg.type === "chat-cancel") {
                this.handleChatCancel(webview);
                return;
            }

            if (msg.type === "summarize-conversation-request") {
                await this.handleSummarizeConversationRequest(msg, webview);
                return;
            }

            if (msg.type === "summarize-turn-request") {
                await this.handleSummarizeTurnRequest(msg, webview);
                return;
            }

            if (msg.type === "chat-request") {
                await this.handleChatRequest(msg, webview);
                return;
            }

            if (msg.type === "log") {
                logMsg(`WEBVIEW - ${msg.message}`);
            }
        });
    }

    /**
     * Sends the current editor context to the webview.
     *
     * @param currentContext - The context object containing editor state.
     */
    receiveCurrentContext(currentContext: EditorContext) {
        const document = currentContext.textEditor.document;
        const fileName = document.fileName.split("/").pop() || document.fileName;
        const filePath = document.fileName;
        const hasSelection = currentContext.selectionText.length > 0;
        const startLine = currentContext.selectionStartLine + 1; // 1-based
        const endLine = currentContext.selectionEndLine + 1;

        this.webviewView.webview.postMessage({
            type: "context-update",
            context: {
                fileName,
                filePath,
                hasSelection,
                startLine,
                endLine,
                content: hasSelection ? currentContext.selectionText : currentContext.activeFileText,
            },
        });
    }

    /**
     * Handles the chat-ready message by sending initial state to the webview.
     */
    private handleChatReady(webview: vscode.Webview) {
        const activeSession = this.session.getActiveSession();
        const messages = activeSession?.messages || [];
        const contextMax = userConfig.apiTokenContextLenInstruct;

        webview.postMessage({
            type: "init",
            sessions: mapSessionsToSummaries(this.session.sessions),
            activeSessionId: this.session.activeSessionId,
            history: sanitizeMessages(messages),
            contextMax,
            contextStartIndex: activeSession?.contextStartIndex || 0,
        });
    }

    /**
     * Handles creating a new session.
     */
    private handleNewSession() {
        this.session.createNewSession();
        this.session.sendSessionsUpdate();
        logMsg(`Created new session: ${this.session.activeSessionId}`);
    }

    /**
     * Handles switching to a different session.
     */
    private handleSwitchSession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        if (this.session.sessions.find((s) => s.id === sessionId)) {
            this.session.activeSessionId = sessionId;
            this.session.saveSessions();
            this.session.sendSessionsUpdate();
            logMsg(`Switched to session: ${sessionId}`);
        }
    }

    /**
     * Opens a read-only preview of a session's chat history as raw JSON.
     */
    private handleExportSession(msg: { sessionId: string }) {
        const session = this.session.sessions.find((s) => s.id === msg.sessionId);
        const messages = session?.messages || [];
        const { name, version } = this.extContext.extension.packageJSON;
        const exportData = [{ extension: name, version: version }, ...messages];
        const json = JSON.stringify(exportData, null, 2);
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
            logMsg(`Copied session ${sessionId} → ${newSession.id}`);
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
     * Handles updating messages for a session.
     */
    private handleUpdateMessages(msg: { messages: ChatHistory[]; sessionId: string; approxTokensFreed: number }) {
        const { messages, sessionId, approxTokensFreed } = msg;
        const session = this.session.sessions.find((s) => s.id === sessionId);
        this.session.updateSession(session, (s) => {
            s.messages = messages;
            if (!s.customTitle) {
                s.title = Session.generateSessionTitle(messages);
            }
        });
        this.session.sendSessionsUpdate();
        logMsg(`Messages updated for session ${sessionId} (~${approxTokensFreed} tokens freed)`);
    }

    /**
     * Handles cancelling the current chat request.
     */
    private handleChatCancel(webview: vscode.Webview) {
        if (this.currentAgent) {
            logMsg("Cancelling agent execution");
            this.currentAgent.cancel();
            this.currentAgent = null;
        }
        webview.postMessage({ type: "chat-complete" });
    }

    /**
     * Handles compressing the chat history into a summary.
     */
    private async handleSummarizeConversationRequest(
        msg: { messages: ChatHistory[]; assistantIndex: number; sessionId: string },
        webview: vscode.Webview,
    ) {
        const { messages, assistantIndex, sessionId } = msg;
        const session = this.session.sessions.find((s) => s.id === sessionId);

        const summaryPrompt = [...messages, { role: "user" as const, content: chatCompress_Template }];

        const agent = new Agent();
        this.currentAgent = agent;
        let summaryContent = "";

        await agent.work(summaryPrompt, async (chunk) => {
            summaryContent += chunk;
            webview.postMessage({ type: "agent-chunk", index: assistantIndex, chunk });
        });
        this.currentAgent = null;

        const fenced = `\`\`\`Summary: Conversation\n${summaryContent.replace(/`/g, "\\`")}\n\`\`\``;
        const compressedMessages: ChatHistory[] = [
            { role: "user" as const, content: "Context summary:" },
            { role: "assistant" as const, content: fenced },
        ];

        await populateMsgTokens(compressedMessages);
        this.session.updateSession(session, (s) => {
            s.messages = compressedMessages;
            s.contextStartIndex = 0;
        });

        webview.postMessage({ type: "conversation-summarized", messages: compressedMessages });
        webview.postMessage({ type: "chat-complete", contextUsed: sumMsgTokens(compressedMessages) });
        this.session.sendSessionsUpdate();
        logMsg(`Compressed chat for session ${sessionId}`);
    }

    /**
     * Handles summarizing a single turn (user message + assistant/tool responses).
     * Replaces the turn with the original user message and a fenced Summary accordion.
     */
    private async handleSummarizeTurnRequest(
        msg: { turnMessages: ChatHistory[]; turnStart: number; turnEnd: number; sessionId: string },
        webview: vscode.Webview,
    ) {
        const { turnMessages, turnStart, turnEnd, sessionId } = msg;
        const session = this.session.sessions.find((s) => s.id === sessionId);

        const summaryPrompt = [...turnMessages, { role: "user" as const, content: chatSummarizeTurn_Template }];

        const agent = new Agent();
        this.currentAgent = agent;
        let summaryContent = "";

        await agent.work(summaryPrompt, async (chunk) => {
            summaryContent += chunk;
        });
        this.currentAgent = null;

        const fenced = `\`\`\`Summary: Turn\n${summaryContent.replace(/`/g, "\\`")}\n\`\`\``;
        const replacementMessages: ChatHistory[] = [
            { role: "user" as const, content: "Context summary:" },
            { role: "assistant" as const, content: fenced },
        ];

        await populateMsgTokens(replacementMessages);
        // Replace the turn range in the session messages
        this.session.updateSession(session, (s) => {
            s.messages.splice(turnStart, turnEnd - turnStart, ...replacementMessages);
        });

        const allMessages = session?.messages || [];
        webview.postMessage({ type: "turn-summarized", messages: allMessages });
        webview.postMessage({ type: "chat-complete", contextUsed: sumMsgTokens(allMessages) });
        this.session.sendSessionsUpdate();
        logMsg(`Summarized turn at ${turnStart}-${turnEnd} for session ${sessionId}`);
    }

    /**
     * Handles a new chat request from the user.
     */
    private async handleChatRequest(msg: { messages: ChatHistory[]; sessionId: string }, webview: vscode.Webview) {
        const { messages, sessionId } = msg;

        // Mutable index tracking the current message being streamed/added
        let currentIndex = messages.length;

        // Update the active session's messages (full history + empty assistant slot)
        const session = this.session.sessions.find((s) => s.id === sessionId);
        this.session.updateSession(session, (s) => {
            s.messages = [...messages, { role: "assistant" as const, content: "" }];
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

        const agent = new Agent();
        this.currentAgent = agent;
        await agent.work(
            trimmedMessages,
            async (chunk) => {
                this.session.updateSession(session, (s) => {
                    s.messages[currentIndex].content += chunk;
                });
                webview.postMessage({ type: "agent-chunk", index: currentIndex, chunk });
            },
            async (event) => {
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
                        s.messages.splice(currentIndex, 0, {
                            role: "tool" as const,
                            content: "[tool result has been stripped after agent answered]",
                            tool_call_id: event.toolCallId as string,
                            customKeys,
                        });
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
                        const msg = s.messages[currentIndex];
                        if (msg.role === "assistant") {
                            msg.tool_calls = event.toolCalls as ToolCall[];
                        }
                    });
                }

                if (event.type === "agent-assistant-new") {
                    currentIndex++;
                    this.session.updateSession(session, (s) => {
                        s.messages.splice(currentIndex, 0, {
                            role: "assistant" as const,
                            content: "",
                        });
                    });
                    webview.postMessage({
                        type: "agent-add-message",
                        message: { role: "assistant", content: "" },
                    });
                }
            },
        );
        this.currentAgent = null;

        // Tokenize any new messages (assistant + tool) that don't have msgTokens yet
        await populateMsgTokens(session!.messages);
        this.session.saveSessions();

        // Notify webview that chat is complete
        webview.postMessage({ type: "chat-complete", contextUsed: sumMsgTokens(session!.messages) });

        // Update sessions list after response completes
        this.session.sendSessionsUpdate();
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
