import * as vscode from "vscode";
import { Context } from "../common/context";
import { llmChat } from "../common/ollama";
import { userConfig } from "../config";
import { logMsg } from "../logging";
import { StartPage } from "./web/components/chat_start";

let panel: ChatPanel | null = null;
const CHAT_SESSIONS_KEY = "collama.chatSessions";
const ACTIVE_SESSION_KEY = "collama.activeSessionId";

export interface ChatHistory {
    role: "system" | "user" | "assistant";
    content: string;
}

export interface ChatSession {
    id: string;
    title: string;
    messages: ChatHistory[];
    createdAt: number;
    updatedAt: number;
}

/**
 * Generates a unique session ID
 */
function generateSessionId(): string {
    return `session_${Date.now()}`;
}

/**
 * Generates a title from the first user message
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
 * Sanitizes messages for persistence/display by removing loading flag
 * and ensuring empty assistant messages show a fallback
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
 * @param context The extension context used to register the command.
 */
export function registerSendToChatCommand(context: vscode.ExtensionContext) {
    const disposable = vscode.commands.registerCommand("collama.sendToChat", async () => {
        if (panel) {
            logMsg("Edit (Selection): SendToChat triggered");
            await vscode.commands.executeCommand("workbench.view.extension.collama_chat");
            const currentContext = Context.create();
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
 * @param context The extension context used to register the provider.
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

    /**
     * Creates a new ChatPanel instance.
     *
     * @param webviewView The webview view that hosts the panel.
     * @param context The extension context.
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
     * Gets the currently active session
     */
    private getActiveSession(): ChatSession | undefined {
        return this.sessions.find((s) => s.id === this.activeSessionId);
    }

    /**
     * Creates a new chat session
     */
    private createNewSession(): ChatSession {
        const newSession: ChatSession = {
            id: generateSessionId(),
            title: "New Chat",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };
        this.sessions.push(newSession);
        this.activeSessionId = newSession.id;
        this.saveSessions();
        return newSession;
    }

    /**
     * Saves all sessions to globalState
     */
    private saveSessions() {
        this.context.globalState.update(CHAT_SESSIONS_KEY, this.sessions);
        this.context.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
    }

    /**
     * Sends current state to webview
     */
    private sendSessionsUpdate() {
        const activeSession = this.getActiveSession();
        this.webviewView.webview.postMessage({
            type: "sessions-update",
            sessions: this.sessions.map((s) => ({
                id: s.id,
                title: s.title,
                createdAt: s.createdAt,
                updatedAt: s.updatedAt,
            })),
            activeSessionId: this.activeSessionId,
            history: sanitizeMessages(activeSession?.messages || []),
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
                webview.postMessage({
                    type: "init",
                    sessions: this.sessions.map((s) => ({
                        id: s.id,
                        title: s.title,
                        createdAt: s.createdAt,
                        updatedAt: s.updatedAt,
                    })),
                    activeSessionId: this.activeSessionId,
                    history: sanitizeMessages(activeSession?.messages || []),
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

            if (msg.type === "chat-request") {
                const { messages, assistantIndex, sessionId } = msg;

                // Update the active session's messages
                const session = this.sessions.find((s) => s.id === sessionId);
                if (session) {
                    session.messages = messages;
                    session.updatedAt = Date.now();
                    session.title = generateSessionTitle(messages);
                    this.saveSessions();
                }

                await llmChat(
                    userConfig.apiInstructionModel,
                    messages,
                    {
                        num_predict: -1,
                        temperature: 0.8,
                        top_p: 0.8,
                        top_k: 20,
                        rep_p: 0.1,
                        pre_p: 1.0,
                        fre_p: 1.0,
                    },
                    {
                        modelStop: [],
                        userStop: [],
                    },
                    true,
                    (chunk) => {
                        if (session) {
                            session.messages[assistantIndex].content += chunk;
                            session.updatedAt = Date.now();
                            this.saveSessions();
                        }
                        webview.postMessage({
                            type: "chunk",
                            index: assistantIndex,
                            chunk,
                        });
                    },
                );

                // Update sessions list after response completes
                this.sendSessionsUpdate();
            }

            if (msg.type === "log") {
                logMsg(`WEBVIEW - ${msg.message}`);
            }
        });
    }

    /**
     * Sends the current context to the webview as a message.
     *
     * @param currentContext The context object to send.
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
