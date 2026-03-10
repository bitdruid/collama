import * as vscode from "vscode";

import { Agent } from "../agent/agent";
import { ChatHistory } from "../common/context-chat";
import { EditorContext } from "../common/context-editor";
import { buildInstructionOptions } from "../common/llmoptions";
import { checkPredictFitsContextLength } from "../common/models";
import { chatCompress_Template } from "../common/prompt";
import Tokenizer from "../common/utils-common";
import { userConfig } from "../config";
import { logMsg } from "../logging";
import { Session } from "./session";
import { calculateContextUsage, mapSessionsToSummaries, sanitizeMessages } from "./utils-host";
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

        webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === "chat-ready") {
                await this.handleChatReady(webview);
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

            if (msg.type === "delete-session") {
                this.handleDeleteSession(msg);
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

            if (msg.type === "update-messages") {
                this.handleUpdateMessages(msg);
                return;
            }

            if (msg.type === "chat-cancel") {
                this.handleChatCancel(webview);
                return;
            }

            if (msg.type === "compress-request") {
                await this.handleCompressRequest(msg, webview);
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
        const hasSelection = currentContext.selectionText.length > 0;
        const startLine = currentContext.selectionStartLine + 1; // 1-based
        const endLine = currentContext.selectionEndLine + 1;

        this.webviewView.webview.postMessage({
            type: "context-update",
            context: {
                fileName,
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
    private async handleChatReady(webview: vscode.Webview) {
        const activeSession = this.session.getActiveSession();
        const contextUsed = await calculateContextUsage(activeSession?.messages || []);
        const contextMax = userConfig.apiTokenContextLenInstruct;

        webview.postMessage({
            type: "init",
            sessions: mapSessionsToSummaries(this.session.sessions),
            activeSessionId: this.session.activeSessionId,
            history: sanitizeMessages(activeSession?.messages || []),
            contextUsed,
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
    private async handleCompressRequest(
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
            { role: "user" as const, content: "Summarize our conversation." },
            { role: "assistant" as const, content: fenced },
        ];

        this.session.updateSession(session, (s) => {
            s.messages = compressedMessages;
            s.contextStartIndex = 0;
        });

        webview.postMessage({ type: "compressed", messages: compressedMessages });
        webview.postMessage({ type: "chat-complete" });
        this.session.sendSessionsUpdate();
        logMsg(`Compressed chat for session ${sessionId}`);
    }

    /**
     * Handles a new chat request from the user.
     */
    private async handleChatRequest(msg: { messages: ChatHistory[]; sessionId: string }, webview: vscode.Webview) {
        const { messages, sessionId } = msg;

        // Derive assistantIndex — the slot right after the last received message
        const assistantIndex = messages.length;

        // Update the active session's messages (full history + empty assistant slot)
        const session = this.session.sessions.find((s) => s.id === sessionId);
        this.session.updateSession(session, (s) => {
            s.messages = [...messages, { role: "assistant" as const, content: "" }];
            if (!s.customTitle) {
                s.title = Session.generateSessionTitle(messages);
            }
        });

        const options = buildInstructionOptions();

        // Trim old message pairs if context limit is exceeded
        const { trimmedMessages, pairsRemoved, tokensFreed } = await trimMessagesForContext(
            messages,
            options.num_predict,
            userConfig.apiTokenContextLenInstruct,
        );

        // Persist and notify webview of current context boundary
        const contextStartIndex = pairsRemoved * 2;
        this.session.updateSession(session, (s) => {
            s.contextStartIndex = contextStartIndex;
        });
        webview.postMessage({ type: "context-trimmed", pairsRemoved, tokensFreed, contextStartIndex });

        if (pairsRemoved > 0) {
            logMsg(`Context limit exceeded: removed ${pairsRemoved} pair(s) (~${tokensFreed} tokens) from LLM context`);
        }

        const agent = new Agent();
        this.currentAgent = agent;
        await agent.work(
            trimmedMessages,
            async (chunk) => {
                this.session.updateSession(session, (s) => {
                    s.messages[assistantIndex].content += chunk;
                });
                webview.postMessage({ type: "agent-chunk", index: assistantIndex, chunk });
            },
            async (event) => {
                if (event.type === "agent-tokens") {
                    webview.postMessage({ type: "agent-tokens", tokens: event.tokens });
                }
            },
        );
        this.currentAgent = null;

        // Notify webview that chat is complete
        webview.postMessage({ type: "chat-complete" });

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
): Promise<{ trimmedMessages: ChatHistory[]; pairsRemoved: number; tokensFreed: number }> {
    const tokenCounts = await Promise.all(messages.map((msg) => Tokenizer.calcTokens(msg.content)));
    let totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

    if (checkPredictFitsContextLength(numPredict, totalTokens, contextMax)) {
        return { trimmedMessages: messages, pairsRemoved: 0, tokensFreed: 0 };
    }

    let pairsRemoved = 0;
    let tokensFreed = 0;
    let startIndex = 0;

    // Remove pairs from the beginning, but keep at least the last pair
    while (!checkPredictFitsContextLength(numPredict, totalTokens, contextMax) && startIndex + 2 < messages.length) {
        const pairTokens = tokenCounts[startIndex] + tokenCounts[startIndex + 1];
        totalTokens -= pairTokens;
        tokensFreed += pairTokens;
        startIndex += 2;
        pairsRemoved++;
    }

    return {
        trimmedMessages: messages.slice(startIndex),
        pairsRemoved,
        tokensFreed,
    };
}
