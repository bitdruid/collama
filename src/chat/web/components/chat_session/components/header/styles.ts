// src/chat/web/components/chat_session/components/header/styles.ts
import { css } from "lit";

export const headerStyles = css`
  .session-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }

  .header-left:hover {
    opacity: 0.8;
  }

  .header-title {
    font-weight: bold;
    font-size: 12px;
    text-transform: uppercase;
    color: var(--vscode-foreground);
    opacity: 0.8;
  }

  .toggle-icon {
    font-size: 10px;
    color: var(--vscode-foreground);
    opacity: 0.6;
  }

  .header-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .new-chat-button {
    width: 24px;
    height: 24px;
    font-size: 16px;
    background-color: #9b59b6;
    color: #fff;
  }

  .new-chat-button:hover {
    background-color: #8e44ad;
  }

  .new-chat-button:active {
    background-color: #7d3c98;
  }
`;
