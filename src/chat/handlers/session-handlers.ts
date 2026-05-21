import * as vscode from "vscode";

import { ChatContext } from "../../common/context-chat";
import { logMsg } from "../../logging";
import { SessionManager } from "../session-manager";
import { buildExportData } from "../utils-back";
import type { ChatSession } from "../web/types";

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
     * If the current active session is temporary or ghost, it will be deleted first.
     */
    handleNewSession() {
        this.deleteActiveTemporarySession();

        this.sessionManager.createNewSession();
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Created new session: ${this.sessionManager.activeSessionId}`);
    }

    /**
     * Creates a new ghost (temporary, unlisted) session.
     * The session is never persisted and never appears in the sessions list.
     */
    handleNewGhostSession() {
        this.deleteActiveTemporarySession();

        const now = Date.now();
        const ghostSession: ChatSession = {
            id: SessionManager.generateSessionId(),
            title: "Temporary Chat",
            messages: new ChatContext(),
            contextStartIndex: 0,
            ghost: true,
            createdAt: now,
            updatedAt: now,
        };
        this.sessionManager.sessions.push(ghostSession);
        this.sessionManager.activeSessionId = ghostSession.id;
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Created ghost session: ${ghostSession.id}`);
    }

    /**
     * Switches the active session to the specified session.
     * If the current active session is temporary or ghost, it will be deleted first.
     * @param msg - The message containing the session ID to switch to.
     */
    handleSwitchSession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        if (!this.sessionManager.sessions.find((s) => s.id === sessionId)) {
            return;
        }

        this.deleteActiveTemporarySession();

        this.sessionManager.activeSessionId = sessionId;
        this.sessionManager.saveSessions();
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
            filters: { "HTML": ["html"] },
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
     * Opens a read-only preview of a session's chat history as raw JSON.
     */
    handleExportSession(msg: { sessionId: string }) {
        const session = this.sessionManager.sessions.find((s) => s.id === msg.sessionId);
        const messages = session?.messages.getMessages() || [];
        const json = JSON.stringify(buildExportData(this.extContext, messages), null, 2);
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
     * Renames a session with a new title.
     * @param msg - The message containing the session ID and new title.
     */
    handleRenameSession(msg: { sessionId: string; newTitle: string }) {
        const { sessionId, newTitle } = msg;
        const session = this.sessionManager.sessions.find((s) => s.id === sessionId);
        if (session && newTitle && newTitle.trim() !== "") {
            this.sessionManager.updateSession(session, (s) => {
                s.title = newTitle.trim();
                s.customTitle = true;
            });
            this.sessionManager.sendSessionsUpdate();
            logMsg(`Renamed session ${sessionId} to "${newTitle}"`);
        }
    }

    /**
     * Creates a copy of an existing session.
     * @param msg - The message containing the session ID to copy.
     */
    handleCopySession(msg: { sessionId: string }) {
        const { sessionId } = msg;
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
    handleDeleteSession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        this.sessionManager.sessions = this.sessionManager.sessions.filter((s) => s.id !== sessionId);

        if (this.sessionManager.activeSessionId === sessionId) {
            if (this.sessionManager.sessions.length > 0) {
                this.sessionManager.activeSessionId = this.sessionManager.sessions.sort(
                    (a, b) => b.updatedAt - a.updatedAt,
                )[0].id;
            } else {
                this.sessionManager.createNewSession();
            }
        }

        this.sessionManager.saveSessions();
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Deleted session: ${sessionId}`);
    }

    /**
     * Deletes the currently active session if it is temporary or ghost.
     * This is used to clean up temporary sessions before creating new ones.
     */
    private deleteActiveTemporarySession() {
        const oldSession = this.sessionManager.getActiveSession();
        if (!oldSession?.temporary && !oldSession?.ghost) {
            return;
        }

        this.sessionManager.sessions = this.sessionManager.sessions.filter((s) => s.id !== oldSession.id);
        logMsg(`Auto-deleted temporary/ghost session: ${oldSession.id}`);
    }
}
