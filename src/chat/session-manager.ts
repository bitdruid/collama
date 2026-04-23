import * as vscode from "vscode";
import { ChatContext, ChatHistory } from "../common/context-chat";
import { userConfig } from "../config";
import { mapSessionsToSummaries, sanitizeMessages } from "./utils-back";
import type { ChatSession } from "./web/types";

/**
 * Represents a serialized chat session stored in the extension's global state.
 * The `messages` field is stored as a plain array rather than a ChatContext instance.
 *
 * @see ChatSession
 * @see ChatContext
 */
interface StoredChatSession extends Omit<ChatSession, "messages"> {
    messages: ChatHistory[];
}

/**
 * Key used for persisting chat sessions in the extension's global state.
 */
const CHAT_SESSIONS_KEY = "collama.chatSessions";

/**
 * Key used for persisting the active session ID in the extension's global state.
 */
const ACTIVE_SESSION_KEY = "collama.activeSessionId";

/**
 * Manages the lifecycle and persistence of chat sessions within the VS Code extension.
 * Handles loading, creating, updating, and deleting sessions while maintaining
 * synchronization with the extension's global state and the webview UI.
 *
 * @example
 * ```typescript
 * const sessionManager = new SessionManager(context, webviewView);
 * sessionManager.createNewSession();
 * ```
 */
export class SessionManager {
    sessions: ChatSession[] = [];
    activeSessionId: string = "";

    /**
     * Initializes the session manager by loading sessions from the extension's global state.
     * If no sessions exist, creates a new session. If the active session ID is invalid,
     * selects the most recently updated session as active.
     *
     * @param extContext - The VS Code extension context used for global state access.
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
     * Generates a unique session identifier using the current timestamp.
     * The format is `session_{timestamp}` where timestamp is milliseconds since epoch.
     *
     * @returns A unique string identifier for a chat session.
     */
    static generateSessionId(): string {
        return `session_${Date.now()}`;
    }

    /**
     * Generates a title for a chat session based on the first user message.
     * If the content exceeds 40 characters, it is truncated with an ellipsis.
     *
     * @param messages - The array of chat history messages to derive the title from.
     * @returns A truncated title derived from the first user message, or "New Chat" if none exists.
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
     * Retrieves the currently active chat session from the managed sessions.
     *
     * @returns The active {@link ChatSession} if found, or `undefined` if no active session exists.
     */
    getActiveSession(): ChatSession | undefined {
        return this.sessions.find((s) => s.id === this.activeSessionId);
    }

    /**
     * Creates a new chat session with default values, sets it as the active session,
     * and persists the change to global state.
     *
     * @returns The newly created {@link ChatSession} instance.
     */
    createNewSession(): ChatSession {
        const newSession: ChatSession = {
            id: SessionManager.generateSessionId(),
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
     * Creates a deep copy of an existing session with cloned messages and a "(Copy)" suffix
     * appended to the title. The copied session is set as the active session.
     *
     * @param sourceId - The unique identifier of the session to copy.
     * @returns The newly created session copy, or `undefined` if the source session was not found.
     */
    copySession(sourceId: string): ChatSession | undefined {
        const source = this.sessions.find((s) => s.id === sourceId);
        if (!source) {
            return undefined;
        }
        const now = Date.now();
        const newSession: ChatSession = {
            id: SessionManager.generateSessionId(),
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
     * Persists all non-temporary and non-ghost sessions along with the active session ID
     * to the extension's global state. Sessions marked as `temporary` or `ghost` are
     * excluded from persistence.
     *
     * @see StoredChatSession
     */
    saveSessions() {
        const toStore: StoredChatSession[] = this.sessions
            .filter((s) => !s.temporary && !s.ghost)
            .map((s) => ({ ...s, messages: s.messages.getMessages() }));
        this.extContext.globalState.update(CHAT_SESSIONS_KEY, toStore);
        this.extContext.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
    }

    /**
     * Applies a mutation to a specific session, updates its `updatedAt` timestamp,
     * and persists the changes to global state.
     *
     * @param session - The session to mutate. If `undefined`, the function returns immediately without action.
     * @param mutate - A callback function that performs the desired mutation on the session object.
     * @example
     * ```typescript
     * sessionManager.updateSession(session, (s) => {
     *     s.title = "Updated Title";
     * });
     * ```
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
     * Sends the current session state to the webview via a message.
     * The message includes session summaries, the active session ID, sanitized message history,
     * and context usage information. Token counts are pre-computed on the backend.
     *
     * @see mapSessionsToSummaries
     * @see sanitizeMessages
     */
    sendSessionsUpdate() {
        const activeSession = this.getActiveSession();
        const messages = activeSession?.messages.getMessages() || [];

        this.webviewView.webview.postMessage({
            type: "sessions-update",
            sessions: mapSessionsToSummaries(this.sessions),
            activeSessionId: this.activeSessionId,
            history: sanitizeMessages(messages),
            contextUsed: activeSession?.messages.sumTokensFrom(activeSession.contextStartIndex) ?? 0,
            contextMax: userConfig.apiTokenContextLenInstruct,
            contextStartIndex: activeSession?.contextStartIndex || 0,
        });
    }
}
