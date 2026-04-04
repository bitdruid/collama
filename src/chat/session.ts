import * as vscode from "vscode";
import { ChatContext, ChatHistory } from "../common/context-chat";
import { userConfig } from "../config";
import { mapSessionsToSummaries, sanitizeMessages } from "./utils-back";
import type { ChatSession } from "./web/types";

/** Serialized form of a session as stored in globalState (messages as plain array). */
interface StoredChatSession extends Omit<ChatSession, "messages"> {
    messages: ChatHistory[];
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
        const stored = this.extContext.globalState.get<StoredChatSession[]>(CHAT_SESSIONS_KEY, []);
        this.sessions = stored.map((s) => ({ ...s, messages: new ChatContext(s.messages) }));
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
            messages: new ChatContext(),
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
     * Creates a copy of an existing session with cloned messages and a "(Copy)" title suffix.
     *
     * @param sourceId - The ID of the session to copy.
     * @returns The newly created session, or undefined if the source was not found.
     */
    copySession(sourceId: string): ChatSession | undefined {
        const source = this.sessions.find((s) => s.id === sourceId);
        if (!source) {
            return undefined;
        }
        const now = Date.now();
        const newSession: ChatSession = {
            id: Session.generateSessionId(),
            title: source.title + " (Copy)",
            customTitle: true,
            messages: new ChatContext(JSON.parse(JSON.stringify(source.messages.getMessages()))),
            contextStartIndex: source.contextStartIndex,
            createdAt: now,
            updatedAt: now,
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
        const toStore: StoredChatSession[] = this.sessions
            .filter((s) => !s.temporary)
            .map((s) => ({ ...s, messages: s.messages.getMessages() }));
        this.extContext.globalState.update(CHAT_SESSIONS_KEY, toStore);
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
     * Sends the current session state to the webview.
     * Token counts are pre-computed on the backend via msgTokens.
     */
    sendSessionsUpdate() {
        const activeSession = this.getActiveSession();
        const messages = activeSession?.messages.getMessages() || [];

        this.webviewView.webview.postMessage({
            type: "sessions-update",
            sessions: mapSessionsToSummaries(this.sessions),
            activeSessionId: this.activeSessionId,
            history: sanitizeMessages(messages),
            contextUsed: activeSession?.messages.sumTokens() ?? 0,
            contextMax: userConfig.apiTokenContextLenInstruct,
            contextStartIndex: activeSession?.contextStartIndex || 0,
        });
    }
}
