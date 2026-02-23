
import { css } from "lit";

export const headerCss = css`
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

  .icon-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--vscode-foreground);
    cursor: pointer;
    font-size: 16px;
  }

  .icon-button:hover {
    background: var(--vscode-toolbar-hoverBackground);
  }

  .new-chat-button {
    background-color: #2277a8;
    color: #fff;
  }

  .new-chat-button:hover {
    background-color: #185d86;
  }
`;
