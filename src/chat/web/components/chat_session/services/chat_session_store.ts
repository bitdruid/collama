// src/services/chat-session-store.ts

import { ChatSession } from "../components/chat_sessions";

export class ChatSessionStore extends EventTarget {
  static instance = new ChatSessionStore();

  sessions: ChatSession[] = [];
  activeSessionId = "";
  contextUsed = 0;
  contextMax = 0;

  private _emitChange() {
    this.dispatchEvent(new CustomEvent("change"));
  }

  /* ---------- CRUD ---------- */

  newChat() {
    const id = Date.now().toString();
    const now = Date.now();
    const newSession: ChatSession = {
      id,
      title: "New Chat",
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
    this.sessions = this.sessions.filter(s => s.id !== id);
    if (this.activeSessionId === id) {
      this.activeSessionId = this.sessions.length ? this.sessions[0].id : "";
    }
    this._emitChange();
  }

  renameSession(id: string, newTitle: string) {
    this.sessions = this.sessions.map(s =>
      s.id === id ? { ...s, title: newTitle, updatedAt: Date.now() } : s,
    );
    this._emitChange();
  }

  /* ---------- Context‑Usage ---------- */

  setContextUsage(used: number, max: number) {
    this.contextUsed = used;
    this.contextMax = max;
    this._emitChange();
  }

  /* ---------- NEU: Vom Extension Host initialisieren ---------- */
  
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
}
