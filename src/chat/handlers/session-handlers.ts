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

    handleCopySession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        const newSession = this.sessionManager.copySession(sessionId);
        if (newSession) {
            this.sessionManager.sendSessionsUpdate();
            logMsg(`Copied session ${sessionId} to ${newSession.id}`);
        }
    }

    handleDeleteSession(msg: { sessionId: string }) {
        const { sessionId } = msg;
        this.sessionManager.sessions = this.sessionManager.sessions.filter((s) => s.id !== sessionId);

        if (this.sessionManager.activeSessionId === sessionId) {
            if (this.sessionManager.sessions.length > 0) {
                this.sessionManager.activeSessionId = this.sessionManager.sessions.sort((a, b) => b.updatedAt - a.updatedAt)[0].id;
            } else {
                this.sessionManager.createNewSession();
            }
        }

        this.sessionManager.saveSessions();
        this.sessionManager.sendSessionsUpdate();
        logMsg(`Deleted session: ${sessionId}`);
    }

    private deleteActiveTemporarySession() {
        const oldSession = this.sessionManager.getActiveSession();
        if (!oldSession?.temporary && !oldSession?.ghost) {
            return;
        }

        this.sessionManager.sessions = this.sessionManager.sessions.filter((s) => s.id !== oldSession.id);
        logMsg(`Auto-deleted temporary/ghost session: ${oldSession.id}`);
    }
}
