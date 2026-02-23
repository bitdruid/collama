// src/styles/context-usage.css
import { css } from "lit";

export const contextUsageCss = css`
  .context-usage {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
  }

  .context-bar-container {
    width: 50px;
    height: 8px;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    overflow: hidden;
  }

  .context-bar {
    height: 100%;
    background: #4ec9b0;
    border-radius: 3px;
    transition: width 0.2s ease;
  }

  .context-bar.warning {
    background: #cca700;
  }

  .context-bar.danger {
    background: #f14c4c;
  }

  .context-text {
    white-space: nowrap;
  }
`;
