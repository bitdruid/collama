// // src/components/chat-sessions-popup.ts
// import { LitElement, html, css } from "lit";
// import { customElement, property } from "lit/decorators.js";
// import "./chat_session_item";
// import "./chat_empty_state";

// import { popupCss } from "../styles/popup_style";
// import { ChatSession } from "./chat_sessions";

// @customElement("collama-chatsessions-popup")
// export class ChatSessionsPopup extends LitElement {
//   @property({ type: Boolean }) isOpen = false;
//   @property({ type: Array }) sessions: ChatSession[] = [];
//   @property({ type: String }) activeSessionId = "";

//   static styles = popupCss;

//   render() {
//     const sorted = [...this.sessions].sort((a, b) => b.updatedAt - a.updatedAt);

//     return html`
//       <div class="sessions-popup ${this.isOpen ? "open" : ""}">
//         ${sorted.length === 0
//           ? html`<collama-empty-state></collama-empty-state>`
//           : sorted.map(
//               session => html`
//                 <collama-chat-session-item
//                   .session=${session}
//                   .isActive=${session.id === this.activeSessionId}
//                   @select=${() =>
//                     this.dispatchEvent(
//                       new CustomEvent("select-session", { detail: { id: session.id }, bubbles: true, composed: true }),
//                     )}
//                   @delete=${() =>
//                     this.dispatchEvent(
//                       new CustomEvent("delete-session", { detail: { id: session.id }, bubbles: true, composed: true }),
//                     )}
//                   @rename=${(e: CustomEvent) =>
//                     this.dispatchEvent(
//                       new CustomEvent("rename-session", {
//                         detail: { id: e.detail.id, newTitle: e.detail.newTitle },
//                         bubbles: true,
//                         composed: true,
//                       }),
//                     )}
//                 ></collama-chat-session-item>
//               `,
//             )}
//       </div>
//     `;
//   }
// }
