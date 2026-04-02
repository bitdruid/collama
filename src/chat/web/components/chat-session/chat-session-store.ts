// src/services/chat-session-store.ts

import { ChatContext, type ChatHistory } from "../../../../common/context-chat";
import type { ChatSession } from "../../types";

export class ChatSessionStore extends EventTarget {
    static instance = new ChatSessionStore();

    sessions: ChatSession[] = [];
    activeSessionId = "";
    contextUsed = 0;
    contextMax = 0;

    private _emitChange() {
        this.dispatchEvent(new CustomEvent("change"));
    }

    newChat() {
        const id = Date.now().toString();
        const now = Date.now();
        const newSession: ChatSession = {
            id,
            title: "New Chat",
            messages: new ChatContext(),
            contextStartIndex: 0,
            createdAt: now,
            updatedAt: now,
        };
        this.sessions = [...this.sessions, newSession];
        this.activeSessionId = id;
        this._emitChange();
    }

    selectSession(id: string) {
        if (this.activeSessionId !== id) {
            this.activeSessionId = id;
            this._emitChange();
        }
    }

    deleteSession(id: string) {
        this.sessions = this.sessions.filter((s) => s.id !== id);
        if (this.activeSessionId === id) {
            this.activeSessionId = this.sessions.length ? this.sessions[0].id : "";
        }
        this._emitChange();
    }

    renameSession(id: string, newTitle: string) {
        this.sessions = this.sessions.map((s) => (s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s));
        this._emitChange();
    }

    copySession(id: string) {
        const source = this.sessions.find((s) => s.id === id);
        if (!source) {
            return;
        }
        const now = Date.now();
        const newSession: ChatSession = {
            id: now.toString(),
            title: source.title + " (Copy)",
            customTitle: true,
            messages: new ChatContext(JSON.parse(JSON.stringify(source.messages.getMessages()))),
            contextStartIndex: source.contextStartIndex,
            createdAt: now,
            updatedAt: now,
        };
        this.sessions = [...this.sessions, newSession];
        this.activeSessionId = newSession.id;
        this._emitChange();
    }

    setContextUsage(used: number, max: number) {
        this.contextUsed = used;
        this.contextMax = max;
        this._emitChange();
    }

    loadFromBackend(data: {
        sessions: ChatSession[];
        activeSessionId: string;
        contextUsed: number;
        contextMax: number;
    }) {
        this.sessions = data.sessions || [];
        this.activeSessionId = data.activeSessionId || "";
        this.contextUsed = data.contextUsed || 0;
        this.contextMax = data.contextMax || 0;
        this._emitChange();
    }

    clear() {
        this.sessions = [];
        this.activeSessionId = "";
        this.contextUsed = 0;
        this.contextMax = 0;
        this._emitChange();
    }

    /**
     * Get the ChatContext for a specific session
     * @param sessionId - Session ID
     * @returns ChatContext instance or undefined if session not found
     */
    getChatContext(sessionId: string): ChatContext | undefined {
        const session = this.sessions.find((s) => s.id === sessionId);
        return session?.messages;
    }

    /**
     * Get the ChatContext for the active session
     * @returns ChatContext instance or undefined if no active session
     */
    getActiveChatContext(): ChatContext | undefined {
        if (!this.activeSessionId) {
            return undefined;
        }
        return this.getChatContext(this.activeSessionId);
    }

    /**
     * Update messages for a session from backend data
     * Replaces the ChatContext content without creating a new instance
     * @param sessionId - Session ID
     * @param messages - New messages from backend
     */
    updateSessionMessages(sessionId: string, messages: ChatHistory[]): void {
        const session = this.sessions.find((s) => s.id === sessionId);
        if (session) {
            session.messages.setMessages(messages);
            this._emitChange();
        }
    }

    /**
     * Append a message to a session's ChatContext
     * @param sessionId - Session ID
     * @param message - Message to append
     */
    appendMessage(sessionId: string, message: ChatHistory): void {
        const session = this.sessions.find((s) => s.id === sessionId);
        if (session) {
            session.messages.push(message);
            this._emitChange();
        }
    }

    /**
     * Update session state from backend message
     * Handles session summaries (metadata) and active session history
     * @param data - Backend session state data
     */
    updateFromBackend(data: {
        sessions: Array<{
            id: string;
            title: string;
            customTitle?: boolean;
            createdAt: number;
            updatedAt: number;
        }>;
        activeSessionId: string;
        history: ChatHistory[];
        contextUsed: number;
        contextMax: number;
    }): void {
        const { sessions: sessionSummaries, activeSessionId, history, contextUsed, contextMax } = data;

        // Update session metadata without losing ChatContext instances
        sessionSummaries.forEach((summary) => {
            const session = this.sessions.find((s) => s.id === summary.id);
            if (session) {
                // Update metadata, preserve ChatContext
                session.title = summary.title;
                session.customTitle = summary.customTitle;
                session.createdAt = summary.createdAt;
                session.updatedAt = summary.updatedAt;
            } else {
                // New session - create with ChatContext
                this.sessions.push({
                    ...summary,
                    messages: new ChatContext(),
                    contextStartIndex: 0,
                });
            }
        });

        // Remove sessions that no longer exist
        const summaryIds = new Set(sessionSummaries.map((s) => s.id));
        this.sessions = this.sessions.filter((s) => summaryIds.has(s.id));

        // Update the active session's messages from history
        if (activeSessionId && history.length > 0) {
            this.updateSessionMessages(activeSessionId, history);
        }

        // Update store state
        this.activeSessionId = activeSessionId;
        this.contextUsed = contextUsed;
        this.contextMax = contextMax;

        this._emitChange();
    }
}
