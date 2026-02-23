// src/styles/session-item.css
import { css } from "lit";

export const sessionItemCss = css`
  .session-item {
    display: flex;
    align-items: center;
    padding: 8px 12px;
    cursor: pointer;
    border-left: 3px solid transparent;
    transition: background 0.1s ease;
  }

  .session-item:hover {
    background: var(--vscode-list-hoverBackground);
  }

  .session-item.active {
    background: var(--vscode-list-activeSelectionBackground);
    border-left-color: var(--vscode-focusBorder);
  }

  .session-info {
    flex: 1;
    min-width: 0;
    overflow: hidden;
  }

  .session-title {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--vscode-foreground);
  }

  .session-title-input {
    font-size: 13px;
    width: 100%;
    padding: 2px 4px;
    border: 1px solid var(--vscode-focusBorder);
    border-radius: 2px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    outline: none;
  }

  .session-date {
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    margin-top: 2px;
  }

  .session-actions {
    display: flex;
    gap: 2px;
    opacity: 0;
  }

  .session-item:hover .session-actions {
    opacity: 1;
  }

  .action-button {
    font-size: 14px;
  }

  .rename-button {
    color: var(--vscode-foreground);
  }

  .delete-button {
    color: var(--vscode-errorForeground);
  }
`;
