import * as vscode from "vscode";

import { ChatContext, ChatHistory } from "../../../common/context-chat";
import { logMsg } from "../../../logging";
import type { ChatSession } from "../../shared";
import { SessionManager } from "../session-manager";

/**
 * Handles chat session lifecycle actions requested by the webview.
 */
export class SessionHandlers {
    constructor(
        private readonly sessionManager: SessionManager,
        private readonly extContext: vscode.ExtensionContext,
    ) {}

    /**
     * Creates a new session and sets it as the active session.
     * If the current active session is a ghost, it will be deleted first.
     */
    handleNewSession() {
        this.deleteActiveGhostSession();

        this.sessionManager.createNewSession();
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Created new session: ${this.sessionManager.activeSessionId}`);
    }

    /**
     * Creates a new ghost (temporary, unlisted) session.
     * The session is never persisted and never appears in the sessions list.
     */
    handleNewGhostSession() {
        this.deleteActiveGhostSession();

        const ghostSession: ChatSession = {
            id: SessionManager.generateSessionId(),
            title: "Temporary Chat",
            messages: new ChatContext(),
            contextStartIndex: 0,
            ghost: true,
            updatedAt: Date.now(),
        };
        this.sessionManager.sessions.push(ghostSession);
        this.sessionManager.activeSessionId = ghostSession.id;
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Created ghost session: ${ghostSession.id}`);
    }

    /**
     * Switches the active session to the specified session.
     * If the current active session is a ghost, it will be deleted first.
     * @param msg - The message containing the session ID to switch to.
     */
    async handleSwitchSession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        if (!this.sessionManager.sessions.find((s) => s.id === sessionId)) {
            return;
        }

        this.deleteActiveGhostSession();

        this.sessionManager.activeSessionId = sessionId;
        await this.sessionManager.ensureLoaded(sessionId);
        await this.sessionManager.flushSessions();
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Switched to session: ${sessionId}`);
    }

    /**
     * Prompts the user for a path and writes the session as a self-contained HTML file.
     * Offers to open the resulting file in the default browser.
     */
    async handleExportSessionHtml(msg: { sessionId: string; title: string; html: string }) {
        const safeName = (msg.title || "chat-export").replace(/[\\/:*?"<>|]+/g, "_").trim() || "chat-export";
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const defaultUri = workspaceFolder
            ? vscode.Uri.joinPath(workspaceFolder.uri, `${safeName}.html`)
            : vscode.Uri.file(`${safeName}.html`);
        const target = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { HTML: ["html"] },
            saveLabel: "Export chat",
        });
        if (!target) {
            return;
        }
        try {
            await vscode.workspace.fs.writeFile(target, Buffer.from(msg.html, "utf8"));
            logMsg(`Exported session ${msg.sessionId} as HTML to ${target.fsPath}`);
            const choice = await vscode.window.showInformationMessage(
                `Chat exported to ${target.fsPath}`,
                "Open in browser",
            );
            if (choice === "Open in browser") {
                vscode.env.openExternal(target);
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to write HTML export: ${String(err)}`);
        }
    }

    /**
     * Prompts the user for a path and writes the session's chat history as JSON.
     * The first array element is a header identifying the producing extension
     * (e.g. "collama-1.7.18"); it's discarded on import.
     */
    async handleExportSession(msg: { sessionId: string }) {
        await this.sessionManager.ensureLoaded(msg.sessionId);
        const session = this.sessionManager.sessions.find((s) => s.id === msg.sessionId);
        const messages = session?.messages.getMessages() || [];
        const { name, version } = this.extContext.extension.packageJSON;
        const json = JSON.stringify([{ version: `${name}-${version}` }, ...messages], null, 2);

        const safeName = (session?.title || "chat-export").replace(/[\\/:*?"<>|]+/g, "_").trim() || "chat-export";
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const defaultUri = workspaceFolder
            ? vscode.Uri.joinPath(workspaceFolder.uri, `${safeName}.json`)
            : vscode.Uri.file(`${safeName}.json`);
        const target = await vscode.window.showSaveDialog({
            defaultUri,
            filters: { JSON: ["json"] },
            saveLabel: "Export chat",
        });
        if (!target) {
            return;
        }
        try {
            await vscode.workspace.fs.writeFile(target, Buffer.from(json, "utf8"));
            logMsg(`Exported session ${msg.sessionId} as JSON to ${target.fsPath}`);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to write JSON export: ${String(err)}`);
        }
    }

    /**
     * Prompts the user for a JSON file and imports it as a new session.
     * The first array element is the export header and is discarded; the rest
     * are the messages. The imported session becomes the active session.
     */
    async handleImportSession() {
        const picked = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: { JSON: ["json"] },
            openLabel: "Import chat",
        });
        if (!picked || picked.length === 0) {
            return;
        }
        const uri = picked[0];
        try {
            const buf = await vscode.workspace.fs.readFile(uri);
            const raw = JSON.parse(Buffer.from(buf).toString("utf8"));
            if (!Array.isArray(raw)) {
                throw new Error("Expected an array");
            }
            const messages = raw.slice(1) as ChatHistory[];
            this.deleteActiveGhostSession();
            const newSession = this.sessionManager.importSession(messages);
            await this.sessionManager.flushSessions();
            this.sessionManager.sendSessionsUpdate();
            logMsg(`Imported session ${newSession.id} from ${uri.fsPath}`);
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to import chat: ${String(err)}`);
        }
    }

    /**
     * Renames a session with a new title.
     * @param msg - The message containing the session ID and new title.
     */
    handleRenameSession(msg: { sessionId: string; newTitle: string }) {
        const { sessionId, newTitle } = msg;
        const session = this.sessionManager.sessions.find((s) => s.id === sessionId);
        if (session && newTitle && newTitle.trim() !== "") {
            this.sessionManager.updateSession(session, (s) => {
                s.title = newTitle.trim();
            });
            this.sessionManager.sendSessionsUpdate();
            logMsg(`Renamed session ${sessionId} to "${newTitle}"`);
        }
    }

    /**
     * Creates a copy of an existing session.
     * @param msg - The message containing the session ID to copy.
     */
    async handleCopySession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        await this.sessionManager.ensureLoaded(sessionId);
        const newSession = this.sessionManager.copySession(sessionId);
        if (newSession) {
            this.sessionManager.sendSessionsUpdate();
            logMsg(`Copied session ${sessionId} to ${newSession.id}`);
        }
    }

    /**
     * Deletes a session. If the deleted session was active, switches to the most recently
     * updated session or creates a new session if none remain.
     * @param msg - The message containing the session ID to delete.
     */
    async handleDeleteSession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        const wasActive = this.sessionManager.activeSessionId === sessionId;

        await this.sessionManager.deleteSessionAsync(sessionId);

        if (wasActive) {
            if (this.sessionManager.sessions.length > 0) {
                const next = [...this.sessionManager.sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
                this.sessionManager.activeSessionId = next.id;
                await this.sessionManager.ensureLoaded(next.id);
            } else {
                this.sessionManager.createNewSession();
            }
        }

        await this.sessionManager.flushSessions();
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Deleted session: ${sessionId}`);
    }

    /**
     * Deletes the currently active session if it is a ghost (unlisted, never
     * persisted). Used to clean up ghost sessions before creating/switching.
     */
    private deleteActiveGhostSession() {
        const oldSession = this.sessionManager.getActiveSession();
        if (!oldSession?.ghost) {
            return;
        }

        this.sessionManager.sessions = this.sessionManager.sessions.filter((s) => s.id !== oldSession.id);
        logMsg(`Auto-deleted ghost session: ${oldSession.id}`);
    }
}
