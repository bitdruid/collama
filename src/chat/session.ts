import * as vscode from "vscode";
import { ChatHistory } from "../common/context-chat";
import { userConfig } from "../config";
import {} from "./subscriptions";
import { calculateContextUsage, mapSessionsToSummaries, sanitizeMessages } from "./utils-host";

/**
 * Represents a single chat session, including its messages and metadata.
 */
export interface ChatSession {
    id: string;
    title: string;
    messages: ChatHistory[];
    contextStartIndex: number;
    createdAt: number;
    updatedAt: number;
}

/** Key for storing chat sessions in global state. */
const CHAT_SESSIONS_KEY = "collama.chatSessions";
/** Key for storing the active session ID in global state. */
const ACTIVE_SESSION_KEY = "collama.activeSessionId";

/**
 * Manages the lifecycle and persistence of chat sessions.
 */
export class Session {
    sessions: ChatSession[] = [];
    activeSessionId: string = "";

    /**
     * Initializes the session manager by loading sessions from the extension's global state.
     * Ensures an active session exists, creating one if necessary.
     *
     * @param context - The extension context.
     * @param webviewView - The webview view used for communication with the UI.
     */
    constructor(
        private extContext: vscode.ExtensionContext,
        private webviewView: vscode.WebviewView,
    ) {
        this.sessions = this.extContext.globalState.get<ChatSession[]>(CHAT_SESSIONS_KEY, []);
        this.activeSessionId = this.extContext.globalState.get<string>(ACTIVE_SESSION_KEY, "");

        if (this.sessions.length === 0) {
            this.createNewSession();
        } else if (!this.activeSessionId || !this.sessions.find((s) => s.id === this.activeSessionId)) {
            this.activeSessionId = this.sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
            this.extContext.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
        }
    }

    /**
     * Generates a unique session ID using the current timestamp.
     *
     * @returns A string that uniquely identifies a chat session.
     */
    static generateSessionId(): string {
        return `session_${Date.now()}`;
    }

    /**
     * Generates a title for a chat session based on the first user message.
     *
     * @param messages - The array of chat history messages.
     * @returns A truncated title derived from the first user message, or "New Chat" if none.
     */
    static generateSessionTitle(messages: ChatHistory[]): string {
        const firstUserMessage = messages.find((m) => m.role === "user");
        if (firstUserMessage) {
            const content = firstUserMessage.content.trim();
            return content.length > 40 ? content.substring(0, 40) + "..." : content;
        }
        return "New Chat";
    }

    /**
     * Retrieves the currently active chat session.
     *
     * @returns The active {@link ChatSession} or {@code undefined} if none is active.
     */
    getActiveSession(): ChatSession | undefined {
        return this.sessions.find((s) => s.id === this.activeSessionId);
    }

    /**
     * Creates a new chat session, sets it as active, and persists the change.
     *
     * @returns The newly created {@link ChatSession}.
     */
    createNewSession(): ChatSession {
        const newSession: ChatSession = {
            id: Session.generateSessionId(),
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
    saveSessions() {
        this.extContext.globalState.update(CHAT_SESSIONS_KEY, this.sessions);
        this.extContext.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
    }

    /**
     * Applies a mutation to a specific session, updates its timestamp, and saves the changes.
     *
     * @param session - The session to mutate. If undefined, the function returns immediately.
     * @param mutate - A callback function that performs the desired mutation on the session object.
     */
    updateSession(session: ChatSession | undefined, mutate: (s: ChatSession) => void) {
        if (!session) {
            return;
        }
        mutate(session);
        session.updatedAt = Date.now();
        this.saveSessions();
    }

    /**
     * Sends the current session state, including history and context usage, to the webview.
     */
    async sendSessionsUpdate() {
        const activeSession = this.getActiveSession();
        const contextUsed = await calculateContextUsage(activeSession?.messages || []);
        const contextMax = userConfig.apiTokenContextLenInstruct;
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
}
