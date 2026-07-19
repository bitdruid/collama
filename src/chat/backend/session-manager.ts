import * as vscode from "vscode";
import { mailbox } from "../../agent/mailbox";
import { ChatContext, ChatHistory } from "../../common/context-chat";
import { userConfig } from "../../config";
import { logMsg } from "../../logging";
import type { ChatSession } from "../shared";
import { mapSessionsToSummaries, sanitizeMessages, SessionSummary } from "./utils";

/**
 * On-disk shape for a single session's message history.
 * One file per session under {globalStorageUri}/sessions/{id}.json.
 */
interface StoredHistory {
    messages: ChatHistory[];
    contextStartIndex: number;
}

/** Legacy globalState key — only read once during migration. */
const LEGACY_SESSIONS_KEY = "collama.chatSessions";
/** Lightweight summary index: title + timestamps, never message bodies. */
const SESSION_INDEX_KEY = "collama.sessionIndex";
const ACTIVE_SESSION_KEY = "collama.activeSessionId";

const SESSIONS_DIR = "sessions";
const SAVE_DEBOUNCE_MS = 500;
/** Cap of in-memory loaded histories. Active session is always loaded on top. */
const MAX_LOADED_HISTORIES = 3;

/**
 * Manages chat sessions with per-file on-disk storage and lazy loading.
 *
 * - `sessions` is the in-memory index — every entry has summary fields populated,
 *   but `messages` is an empty placeholder for sessions whose history hasn't been
 *   read from disk yet.
 * - `loadedIds` tracks which sessions actually have their messages in memory,
 *   most-recent first. Capped at MAX_LOADED_HISTORIES; the active session is
 *   never evicted.
 * - File writes are debounced during streaming; boundaries call `flushSessions()`
 *   to persist immediately.
 */
export class SessionManager {
    sessions: ChatSession[] = [];
    activeSessionId: string = "";

    private sessionsDir: vscode.Uri;
    private loadedIds: string[] = [];
    private dirtyIds = new Set<string>();
    private indexDirty = false;
    private saveTimer: NodeJS.Timeout | null = null;
    private initPromise: Promise<void> | null = null;

    constructor(
        private extContext: vscode.ExtensionContext,
        private webviewView: vscode.WebviewView,
    ) {
        this.sessionsDir = vscode.Uri.joinPath(extContext.globalStorageUri, SESSIONS_DIR);
    }

    /**
     * Async initialization: ensures storage dir exists, runs one-shot migration
     * from the legacy globalState blob, loads the index, and eagerly loads the
     * active session's history. Idempotent — safe to call repeatedly.
     */
    init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.doInit();
        }
        return this.initPromise;
    }

    private async doInit(): Promise<void> {
        await this.ensureSessionsDir();
        await this.migrateLegacy();

        const index = this.extContext.globalState.get<SessionSummary[]>(SESSION_INDEX_KEY, []);
        this.activeSessionId = this.extContext.globalState.get<string>(ACTIVE_SESSION_KEY, "");

        if (index.length === 0) {
            this.createNewSession();
            return;
        }

        // Index-only hydration: messages stay empty until loaded on demand.
        this.sessions = index.map((s) => ({
            ...s,
            messages: new ChatContext(),
            contextStartIndex: 0,
        }));

        if (!this.activeSessionId || !this.sessions.find((s) => s.id === this.activeSessionId)) {
            this.activeSessionId = [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
            this.extContext.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
        }

        await this.loadHistory(this.activeSessionId);
    }

    static generateSessionId(): string {
        return `session_${Date.now()}`;
    }

    static generateSessionTitle(messages: ChatHistory[]): string {
        const firstUserMessage = messages.find((m) => m.role === "user");
        if (firstUserMessage) {
            const content = firstUserMessage.content.trim();
            return content.length > 40 ? content.substring(0, 40) + "..." : content;
        }
        return "New Chat";
    }

    getActiveSession(): ChatSession | undefined {
        return this.sessions.find((s) => s.id === this.activeSessionId);
    }

    /**
     * Loads a session's messages from disk on demand. No-op if already loaded
     * (just bumps LRU). Required before reading `.messages` on any non-active
     * session (e.g. export, copy).
     */
    async ensureLoaded(id: string): Promise<void> {
        await this.loadHistory(id);
    }

    private async loadHistory(id: string): Promise<void> {
        const session = this.sessions.find((s) => s.id === id);
        if (!session) {
            return;
        }
        if (this.loadedIds.includes(id)) {
            this.loadedIds = [id, ...this.loadedIds.filter((x) => x !== id)];
            return;
        }
        try {
            const buf = await vscode.workspace.fs.readFile(this.fileFor(id));
            const parsed = JSON.parse(Buffer.from(buf).toString("utf8")) as StoredHistory;
            session.messages = new ChatContext(parsed.messages || []);
            session.contextStartIndex = parsed.contextStartIndex || 0;
        } catch (err) {
            logMsg(`Failed to load session ${id}: ${String(err)}`);
            session.messages = new ChatContext();
            session.contextStartIndex = 0;
        }
        this.loadedIds = [id, ...this.loadedIds];
        this.evict();
    }

    private evict() {
        if (this.loadedIds.length <= MAX_LOADED_HISTORIES) {
            return;
        }
        // Walk from LRU end, drop anything that isn't active or pending write.
        const keep: string[] = [];
        for (let i = this.loadedIds.length - 1; i >= 0; i--) {
            const id = this.loadedIds[i];
            const isProtected = id === this.activeSessionId || this.dirtyIds.has(id);
            if (!isProtected && this.loadedIds.length - keep.length > MAX_LOADED_HISTORIES) {
                const s = this.sessions.find((x) => x.id === id);
                if (s) {
                    s.messages = new ChatContext();
                }
            } else {
                keep.unshift(id);
            }
        }
        this.loadedIds = keep;
    }

    createNewSession(): ChatSession {
        const newSession: ChatSession = {
            id: SessionManager.generateSessionId(),
            title: "New Chat",
            messages: new ChatContext(),
            contextStartIndex: 0,
            updatedAt: Date.now(),
        };
        this.sessions.push(newSession);
        this.activeSessionId = newSession.id;
        this.loadedIds = [newSession.id, ...this.loadedIds.filter((x) => x !== newSession.id)];
        this.markDirty(newSession.id);
        this.saveSessions();
        return newSession;
    }

    /**
     * Copies a session. Requires the source to be loaded — caller is responsible
     * for `await ensureLoaded(sourceId)` before calling.
     */
    copySession(sourceId: string): ChatSession | undefined {
        const source = this.sessions.find((s) => s.id === sourceId);
        if (!source || !this.loadedIds.includes(sourceId)) {
            return undefined;
        }
        const newSession: ChatSession = {
            id: SessionManager.generateSessionId(),
            title: source.title + " (Copy)",
            messages: new ChatContext(JSON.parse(JSON.stringify(source.messages.getMessages()))),
            contextStartIndex: source.contextStartIndex,
            updatedAt: Date.now(),
        };
        this.sessions.push(newSession);
        this.activeSessionId = newSession.id;
        this.loadedIds = [newSession.id, ...this.loadedIds];
        this.markDirty(newSession.id);
        this.saveSessions();
        return newSession;
    }

    /**
     * Adds an imported session built from a header + message array. Generates a
     * fresh id (the original may collide with an existing session), persists,
     * and sets it as the active session.
     */
    importSession(messages: ChatHistory[]): ChatSession {
        const newSession: ChatSession = {
            id: SessionManager.generateSessionId(),
            title: SessionManager.generateSessionTitle(messages),
            messages: new ChatContext(messages),
            // Recomputed against the importer's own model/config on the next request.
            contextStartIndex: 0,
            updatedAt: Date.now(),
        };
        this.sessions.push(newSession);
        this.activeSessionId = newSession.id;
        this.loadedIds = [newSession.id, ...this.loadedIds];
        this.markDirty(newSession.id);
        this.saveSessions();
        return newSession;
    }

    /**
     * Removes a session from the index and unlinks its file. Safe to call on
     * an unloaded session.
     */
    async deleteSessionAsync(id: string): Promise<void> {
        this.sessions = this.sessions.filter((s) => s.id !== id);
        this.loadedIds = this.loadedIds.filter((x) => x !== id);
        this.dirtyIds.delete(id);
        // Undelivered mailbox notifications for this session have no chat left to land in.
        mailbox.purgeSession(id);
        this.indexDirty = true;
        try {
            await vscode.workspace.fs.delete(this.fileFor(id));
        } catch {
            // File may not exist (never persisted, e.g. ghost) — silent.
        }
        this.saveSessions();
    }

    /**
     * Debounced save trigger. Use `flushSessions()` at user-visible boundaries
     * (chat-complete, cancel, switch, delete) to guarantee persistence.
     */
    saveSessions() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
        }
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            void this.flushSessions();
        }, SAVE_DEBOUNCE_MS);
    }

    /**
     * Immediately writes any dirty session files and (if changed) the index.
     * Cancels any pending debounced save.
     */
    async flushSessions(): Promise<void> {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }

        const ids = [...this.dirtyIds];
        this.dirtyIds.clear();
        const wroteIndex = this.indexDirty;
        this.indexDirty = false;

        await Promise.all(ids.map((id) => this.writeHistory(id)));

        if (wroteIndex || ids.length > 0) {
            const summaries: SessionSummary[] = mapSessionsToSummaries(this.sessions.filter((s) => !s.ghost));
            this.extContext.globalState.update(SESSION_INDEX_KEY, summaries);
        }
        this.extContext.globalState.update(ACTIVE_SESSION_KEY, this.activeSessionId);
    }

    private async writeHistory(id: string): Promise<void> {
        const session = this.sessions.find((s) => s.id === id);
        if (!session || session.ghost) {
            return;
        }
        if (!this.loadedIds.includes(id)) {
            // Messages aren't in memory — nothing to write (no message-level change happened).
            return;
        }
        const payload: StoredHistory = {
            messages: session.messages.getMessages(),
            contextStartIndex: session.contextStartIndex,
        };
        try {
            await vscode.workspace.fs.writeFile(this.fileFor(id), Buffer.from(JSON.stringify(payload), "utf8"));
        } catch (err) {
            logMsg(`Failed to write session ${id}: ${String(err)}`);
        }
    }

    /**
     * Apply a mutation to a session. Marks the session and index dirty and
     * schedules a debounced save.
     */
    updateSession(session: ChatSession | undefined, mutate: (s: ChatSession) => void) {
        if (!session) {
            return;
        }
        mutate(session);
        session.updatedAt = Date.now();
        this.markDirty(session.id);
        this.saveSessions();
    }

    private markDirty(id: string) {
        this.dirtyIds.add(id);
        this.indexDirty = true;
    }

    /**
     * Sends the current session state to the webview. Assumes the active
     * session's history is already loaded.
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

    private fileFor(id: string): vscode.Uri {
        return vscode.Uri.joinPath(this.sessionsDir, `${id}.json`);
    }

    private async ensureSessionsDir(): Promise<void> {
        try {
            await vscode.workspace.fs.createDirectory(this.sessionsDir);
        } catch {
            // Already exists — fine.
        }
    }

    /**
     * One-shot migration from the legacy single-blob globalState entry into
     * per-file storage. Safe to call on every boot — no-op once migrated.
     */
    private async migrateLegacy(): Promise<void> {
        const legacy = this.extContext.globalState.get<unknown>(LEGACY_SESSIONS_KEY);
        if (!Array.isArray(legacy) || legacy.length === 0) {
            if (legacy !== undefined) {
                this.extContext.globalState.update(LEGACY_SESSIONS_KEY, undefined);
            }
            return;
        }
        const typed = legacy as Array<{
            id: string;
            title: string;
            updatedAt: number;
            messages: ChatHistory[];
            contextStartIndex?: number;
        }>;

        await Promise.all(
            typed.map(async (s) => {
                const payload: StoredHistory = {
                    messages: s.messages || [],
                    contextStartIndex: s.contextStartIndex || 0,
                };
                try {
                    await vscode.workspace.fs.writeFile(
                        this.fileFor(s.id),
                        Buffer.from(JSON.stringify(payload), "utf8"),
                    );
                } catch (err) {
                    logMsg(`Migration: failed to write session ${s.id}: ${String(err)}`);
                }
            }),
        );

        const summaries: SessionSummary[] = typed.map((s) => ({
            id: s.id,
            title: s.title,
            updatedAt: s.updatedAt,
        }));
        await this.extContext.globalState.update(SESSION_INDEX_KEY, summaries);
        await this.extContext.globalState.update(LEGACY_SESSIONS_KEY, undefined);
        logMsg(`Migrated ${typed.length} sessions to per-file storage`);
    }
}
