import * as vscode from "vscode";

import { Agent } from "../agent/agent";
import { ChatHistory } from "../common/context_chat";
import { Context } from "../common/context_editor";
import { buildInstructionOptions } from "../common/llmoptions";
import { checkPredictFitsContextLength } from "../common/models";
import Tokenizer from "../common/utils";
import { sysConfig } from "../config";
import { logMsg } from "../logging";
import { mapSessionsToSummaries } from "./utils";
import { StartPage } from "./web/components/chat_start";

let panel: ChatPanel | null = null;
const CHAT_SESSIONS_KEY = "collama.chatSessions";
const ACTIVE_SESSION_KEY = "collama.activeSessionId";

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatHistory[];
    contextStartIndex: number;
    createdAt: number;
    updatedAt: number;
}

/**
 * Generates a unique session ID using the current timestamp.
 *
 * @returns A string that uniquely identifies a chat session.
 */
function generateSessionId(): string {
    return `session_${Date.now()}`;
}

/**
 * Generates a title for a chat session based on the first user message.
 *
 * @param messages - The array of chat history messages.
 * @returns A truncated title derived from the first user message, or "New Chat" if none.
 */
function generateSessionTitle(messages: ChatHistory[]): string {
    const firstUserMessage = messages.find((m) => m.role === "user");
    if (firstUserMessage) {
        const content = firstUserMessage.content.trim();
        return content.length > 40 ? content.substring(0, 40) + "..." : content;
    }
    return "New Chat";
}

/**
 * Calculates the total token usage for a chat session's messages.
 *
 * @param messages - The array of chat history messages.
 * @returns The total token count.
 */
async function calculateContextUsage(messages: ChatHistory[]): Promise<number> {
    const tokenCounts = await Promise.all(messages.map((msg) => Tokenizer.calcTokens(msg.content)));
    return tokenCounts.reduce((total, count) => total + count, 0);
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

/**
 * Sanitizes chat messages for persistence and display.
 *
 * Removes any temporary loading flags and ensures that empty assistant messages
 * display a fallback text.
 *
 * @param messages - The array of chat history messages to sanitize.
 * @returns A new array of messages without loading flags and with fallback content where appropriate.
 */
function sanitizeMessages(messages: ChatHistory[]): ChatHistory[] {
    return messages.map((m) => {
        const { loading, ...rest } = m as ChatHistory & { loading?: boolean };
        // If assistant message is empty and was loading, show fallback
        if (rest.role === "assistant" && !rest.content && loading) {
            return { ...rest, content: "No response received." };
        }
        return rest;
    });
}

/**
 * Registers the command that sends the current selection to the chat view.
 *
 * @param context - The extension context used to register the command.
 */
export function registerSendToChatCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("collama.sendToChat", async () => {
        if (panel) {
            logMsg("Edit (Selection): SendToChat triggered");
            await vscode.commands.executeCommand("workbench.view.extension.collama_chat");
            const currentContext = await Context.create();
            if (currentContext) {
                panel.receiveCurrentContext(currentContext);
            }
        }
    });
    context.subscriptions.push(disposable);
}

/**
 * Registers the webview provider that displays the chat panel.
 *
 * @param context - The extension context used to register the provider.
 */
export function registerChatProvider(context: vscode.ExtensionContext) {
    const provider: vscode.WebviewViewProvider = {
        resolveWebviewView(webviewView) {
            webviewView.webview.options = {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, "media"),
                    vscode.Uri.joinPath(context.extensionUri, "dist"),
                ],
            };
            panel = new ChatPanel(webviewView, context);
            panel.renderPanel();
        },
    };
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("collama_chatview", provider));
}

/**
 * Encapsulates the chat panel logic within the extension.
 */
class ChatPanel {
    private sessions: ChatSession[] = [];
    private activeSessionId: string = "";
    private currentAgent: Agent | null = null;

    /**
     * Creates a new ChatPanel instance and initializes session data.
     *
     * @param webviewView - The webview view that hosts the panel.
     * @param context - The extension context.
     */
    constructor(
        private webviewView: vscode.WebviewView,
        private context: vscode.ExtensionContext,
    ) {
        // Use globalState for persistence across IDE restarts
        this.sessions = this.context.globalState.get<ChatSession[]>(CHAT_SESSIONS_KEY, []);
        this.activeSessionId = this.context.globalState.get<string>(ACTIVE_SESSION_KEY, "");

        // If no sessions exist, create a default one
        if (this.sessions.length === 0) {
            this.createNewSession();
        } else if (!this.activeSessionId || !this.sessions.find((s) => s.id === this.activeSessionId)) {
            // If active session doesn't exist, use the most recent one
            this.activeSessionId = this.sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
            this.context.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
        }
    }

    /**
     * Retrieves the currently active chat session.
     *
     * @returns The active {@link ChatSession} or {@code undefined} if none is active.
     */
    private getActiveSession(): ChatSession | undefined {
        return this.sessions.find((s) => s.id === this.activeSessionId);
    }

    /**
     * Creates a new chat session, sets it as active, and persists the change.
     *
     * @returns The newly created {@link ChatSession}.
     */
    private createNewSession(): ChatSession {
        const newSession: ChatSession = {
            id: generateSessionId(),
            title: "New Chat",
            messages: [],
            contextStartIndex: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.sessions.push(newSession);
        this.activeSessionId = newSession.id;
        this.saveSessions();
        return newSession;
    }

    /**
     * Persists all sessions and the active session ID to the global state.
     */
    private saveSessions() {
        this.context.globalState.update(CHAT_SESSIONS_KEY, this.sessions);
        this.context.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
    }

    /**
     * Sends the current session state to the webview.
     */
    private async sendSessionsUpdate() {
        const activeSession = this.getActiveSession();
        const contextUsed = await calculateContextUsage(activeSession?.messages || []);
        const contextMax = sysConfig.contextLenInstruct;
        this.webviewView.webview.postMessage({
            type: "sessions-update",
            sessions: mapSessionsToSummaries(this.sessions),
            activeSessionId: this.activeSessionId,
            history: sanitizeMessages(activeSession?.messages || []),
            contextUsed,
            contextMax,
            contextStartIndex: activeSession?.contextStartIndex || 0,
        });
    }

    /**
     * Renders the initial chat page inside the webview.
     */
    renderPanel() {
        const page = new StartPage(this.context, this.webviewView);
        const webview = this.webviewView.webview;

        webview.html = page.generate();

        webview.onDidReceiveMessage(async (msg) => {
            if (msg.type === "chat-ready") {
                // Send initial state when webview is ready
                const activeSession = this.getActiveSession();
                const contextUsed = await calculateContextUsage(activeSession?.messages || []);
                const contextMax = sysConfig.contextLenInstruct;
                webview.postMessage({
                    type: "init",
                    sessions: mapSessionsToSummaries(this.sessions),
                    activeSessionId: this.activeSessionId,
                    history: sanitizeMessages(activeSession?.messages || []),
                    contextUsed,
                    contextMax,
                    contextStartIndex: activeSession?.contextStartIndex || 0,
                });
                return;
            }

            if (msg.type === "new-session") {
                this.createNewSession();
                this.sendSessionsUpdate();
                logMsg(`Created new session: ${this.activeSessionId}`);
                return;
            }

            if (msg.type === "switch-session") {
                const { sessionId } = msg;
                if (this.sessions.find((s) => s.id === sessionId)) {
                    this.activeSessionId = sessionId;
                    this.context.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
                    this.sendSessionsUpdate();
                    logMsg(`Switched to session: ${sessionId}`);
                }
                return;
            }

            if (msg.type === "delete-session") {
                const { sessionId } = msg;
                this.sessions = this.sessions.filter((s) => s.id !== sessionId);

                // If we deleted the active session, switch to another or create new
                if (this.activeSessionId === sessionId) {
                    if (this.sessions.length > 0) {
                        this.activeSessionId = this.sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
                    } else {
                        this.createNewSession();
                    }
                }

                this.saveSessions();
                this.sendSessionsUpdate();
                logMsg(`Deleted session: ${sessionId}`);
                return;
            }

            if (msg.type === "rename-session") {
                const { sessionId, newTitle } = msg;
                const session = this.sessions.find((s) => s.id === sessionId);
                if (session && newTitle && newTitle.trim() !== "") {
                    session.title = newTitle.trim();
                    session.updatedAt = Date.now();
                    this.saveSessions();
                    this.sendSessionsUpdate();
                    logMsg(`Renamed session ${sessionId} to "${newTitle}"`);
                }
                return;
            }

            if (msg.type === "update-messages") {
                const { messages, sessionId, approxTokensFreed } = msg;
                const session = this.sessions.find((s) => s.id === sessionId);
                if (session) {
                    session.messages = messages;
                    session.updatedAt = Date.now();
                    session.title = generateSessionTitle(messages);
                    this.saveSessions();
                }
                this.sendSessionsUpdate();
                logMsg(`Messages updated for session ${sessionId} (~${approxTokensFreed} tokens freed)`);
                return;
            }

            if (msg.type === "chat-cancel") {
                // Cancel the currently running agent
                if (this.currentAgent) {
                    logMsg("Cancelling agent execution");
                    this.currentAgent.cancel();
                    this.currentAgent = null;
                }
                webview.postMessage({ type: "chat-complete" });
                return;
            }

            if (msg.type === "chat-request") {
                const { messages, assistantIndex, sessionId } = msg;

                // Update the active session's messages (full history)
                const session = this.sessions.find((s) => s.id === sessionId);
                if (session) {
                    session.messages = messages;
                    session.updatedAt = Date.now();
                    session.title = generateSessionTitle(messages);
                    this.saveSessions();
                }

                const options = buildInstructionOptions();

                // Trim old message pairs if context limit is exceeded
                const { trimmedMessages, pairsRemoved, tokensFreed } = await trimMessagesForContext(
                    messages,
                    options.num_predict,
                    sysConfig.contextLenInstruct,
                );

                // Persist and notify webview of current context boundary
                const contextStartIndex = pairsRemoved * 2;
                if (session) {
                    session.contextStartIndex = contextStartIndex;
                    this.saveSessions();
                }
                webview.postMessage({ type: "context-trimmed", pairsRemoved, tokensFreed, contextStartIndex });

                if (pairsRemoved > 0) {
                    logMsg(
                        `Context limit exceeded: removed ${pairsRemoved} pair(s) (~${tokensFreed} tokens) from LLM context`,
                    );
                }

                const agent = new Agent();
                this.currentAgent = agent;
                await agent.work(trimmedMessages, async (chunk) => {
                    if (session) {
                        session.messages[assistantIndex].content += chunk;
                        session.updatedAt = Date.now();
                        this.saveSessions();
                    }
                    webview.postMessage({ type: "chunk", index: assistantIndex, chunk });
                });
                this.currentAgent = null;

                // Update sessions list after response completes
                this.sendSessionsUpdate();
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
    receiveCurrentContext(currentContext: Context) {
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
}
