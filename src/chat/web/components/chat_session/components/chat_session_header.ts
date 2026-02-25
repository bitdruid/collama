// // src/components/chat-session-header.ts
// import { LitElement, html, css } from "lit";
// import { customElement, property } from "lit/decorators.js";
// import { headerCss } from "../styles/header_style";

// @customElement("collama-chatsession-header")
// export class ChatSessionHeader extends LitElement {
//   @property({ type: Boolean }) isOpen = false;
//   @property({ type: Number }) contextUsed = 0;
//   @property({ type: Number }) contextMax = 0;

//   static styles = headerCss;

//   render() {
//     return html`
//       <div class="session-header">
//         <div class="header-left" @click=${this._toggle}>
//           <span class="header-title">Chat History</span>
//           <span class="toggle-icon">${this.isOpen ? "▲" : "▼"}</span>
//         </div>
//         <div class="header-buttons">
//           <span class="header-title">Context Usage</span>
//           <collama-context-usage-bar
//             .used=${this.contextUsed}
//             .max=${this.contextMax}
//           ></collama-context-usage-bar>
//           <button class="icon-button new-chat-button" @click=${this._newChat} title="New Chat">
//             +
//           </button>
//         </div>
//       </div>
//     `;
//   }

//   private _toggle() {
//     this.dispatchEvent(new CustomEvent("toggle", { bubbles: true, composed: true }));
//   }

//   private _newChat() {
//     this.dispatchEvent(new CustomEvent("new-chat", { bubbles: true, composed: true }));
//   }
// }
