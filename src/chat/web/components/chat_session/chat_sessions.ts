// import { LitElement, css, html } from "lit";

// import { logWebview } from "../chat_container/chat_container";
// import { chatSessionStyle } from "./styles/chat_session_style";

// export interface ChatSession {
//     id: string;
//     title: string;
//     createdAt: number;
//     updatedAt: number;
// }

// export class ChatSessions extends LitElement {
//     static properties = {
//         sessions: { state: true },
//         activeSessionId: { state: true },
//         isOpen: { state: true },
//         editingSessionId: { state: true },
//         contextUsed: { state: true },
//         contextMax: { state: true },
//     };

//     static styles = chatSessionStyle

//     sessions: ChatSession[] = [];
//     activeSessionId: string = "";
//     isOpen: boolean = false;
//     editingSessionId: string | null = null;
//     contextUsed: number = 0;
//     contextMax: number = 0;

//     private _formatDate(timestamp: number): string {
//         const date = new Date(timestamp);
//         const today = new Date();
//         const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
//         const diffDays = (startOfDay(today) - startOfDay(date)) / 86400000;

//         if (diffDays === 0) {
//             return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
//         }

//         if (diffDays === 1) {
//             return "Yesterday";
//         }

//         if (diffDays < 7) {
//             return date.toLocaleDateString([], { weekday: "short" });
//         }

//         return date.toLocaleDateString([], { month: "short", day: "numeric" });
//     }

//     private _handleNewChat() {
//         logWebview("New chat clicked");
//         this.isOpen = false;
//         this.dispatchEvent(
//             new CustomEvent("new-chat", {
//                 bubbles: true,
//                 composed: true,
//             }),
//         );
//     }

//     private _handleSelectSession(sessionId: string) {
//         logWebview(`Selected session ${sessionId}`);
//         this.isOpen = false;
//         this.dispatchEvent(
//             new CustomEvent("select-session", {
//                 detail: { sessionId },
//                 bubbles: true,
//                 composed: true,
//             }),
//         );
//     }

//     private _handleDeleteSession(e: Event, sessionId: string) {
//         e.stopPropagation();
//         logWebview(`Delete session ${sessionId}`);
//         this.dispatchEvent(
//             new CustomEvent("delete-session", {
//                 detail: { sessionId },
//                 bubbles: true,
//                 composed: true,
//             }),
//         );
//     }

//     private _handleRenameSession(e: Event, session: ChatSession) {
//         e.stopPropagation();
//         this.editingSessionId = session.id;
//         // Focus input
//         this.updateComplete.then(() => {
//             const input = this.shadowRoot?.querySelector(".session-title-input") as HTMLInputElement;
//             if (input) {
//                 input.focus();
//                 input.select();
//             }
//         });
//     }

//     private _handleRenameKeyDown(e: KeyboardEvent, session: ChatSession) {
//         if (e.key === "Enter") {
//             e.preventDefault();
//             this._submitRename(session);
//         } else if (e.key === "Escape") {
//             e.preventDefault();
//             this.editingSessionId = null;
//         }
//     }

//     private _handleRenameBlur(session: ChatSession) {
//         this._submitRename(session);
//     }

//     private _submitRename(session: ChatSession) {
//         const input = this.shadowRoot?.querySelector(".session-title-input") as HTMLInputElement;
//         const newTitle = input?.value?.trim();
//         if (newTitle && newTitle !== session.title) {
//             logWebview(`Rename session ${session.id} to "${newTitle}"`);
//             this.dispatchEvent(
//                 new CustomEvent("rename-session", {
//                     detail: { sessionId: session.id, newTitle },
//                     bubbles: true,
//                     composed: true,
//                 }),
//             );
//         }
//         this.editingSessionId = null;
//     }

//     private _toggleOpen() {
//         this.isOpen = !this.isOpen;
//     }

//     private _closePopup() {
//         this.isOpen = false;
//     }

//     private _renderContextUsage() {
//         if (this.contextMax <= 0) {
//             return html``;
//         }

//         const percentage = Math.min((this.contextUsed / this.contextMax) * 100, 100);
//         const barClass = percentage >= 90 ? "danger" : percentage >= 70 ? "warning" : "";

//         return html`
//             <div class="context-usage" title="Context usage: ${this.contextUsed} / ${this.contextMax} tokens">
//                 <div class="context-bar-container">
//                     <div class="context-bar ${barClass}" style="width: ${percentage}%"></div>
//                 </div>
//                 <span class="context-text">${Math.round(percentage)}%</span>
//             </div>
//         `;
//     }

//     render() {
//         const sortedSessions = [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt);

//         return html`
//             <div class="sessions-header">
//                 <div class="header-left" @click=${this._toggleOpen}>
//                     <span class="header-title">Chat History</span>
//                     <span class="toggle-icon">${this.isOpen ? "▲" : "▼"}</span>
//                 </div>
//                 <div class="header-buttons">
//                     <span class="header-title">Context Usage</span>
//                     ${this._renderContextUsage()}
//                     <button class="icon-button new-chat-button" @click=${this._handleNewChat} title="New Chat">
//                         +
//                     </button>
//                 </div>
//             </div>
//             <div class="popup-overlay ${this.isOpen ? "open" : ""}" @click=${this._closePopup}></div>
//             <div class="sessions-popup ${this.isOpen ? "open" : ""}">
//                 ${sortedSessions.length === 0
//                     ? html`<div class="empty-state">No chat history yet</div>`
//                     : sortedSessions.map(
//                           (session) => html`
//                               <div
//                                   class="session-item ${session.id === this.activeSessionId ? "active" : ""}"
//                                   @click=${() =>
//                                       this.editingSessionId !== session.id && this._handleSelectSession(session.id)}
//                               >
//                                   <div class="session-info">
//                                       ${this.editingSessionId === session.id
//                                           ? html`<input
//                                                 class="session-title-input"
//                                                 type="text"
//                                                 .value=${session.title}
//                                                 @keydown=${(e: KeyboardEvent) => this._handleRenameKeyDown(e, session)}
//                                                 @blur=${() => this._handleRenameBlur(session)}
//                                                 @click=${(e: Event) => e.stopPropagation()}
//                                             />`
//                                           : html`<div class="session-title">${session.title}</div>`}
//                                       <div class="session-date">${this._formatDate(session.updatedAt)}</div>
//                                   </div>
//                                   <div class="session-actions">
//                                       <button
//                                           class="icon-button action-button rename-button"
//                                           @click=${(e: Event) => this._handleRenameSession(e, session)}
//                                           title="Rename chat"
//                                       >
//                                           R
//                                       </button>
//                                       <button
//                                           class="icon-button action-button delete-button"
//                                           @click=${(e: Event) => this._handleDeleteSession(e, session.id)}
//                                           title="Delete chat"
//                                       >
//                                           X
//                                       </button>
//                                   </div>
//                               </div>
//                           `,
//                       )}
//             </div>
//         `;
//     }
// }

// customElements.define("collama-chatsessions", ChatSessions);
