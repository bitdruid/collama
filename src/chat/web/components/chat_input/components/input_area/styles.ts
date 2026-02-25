// src/chat/web/components/chat_input/components/input_area/styles.ts
import { css } from "lit";

export const inputAreaStyles = css`
  .input-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 40px;
  }

  .input-textarea {
    width: 100%;
    min-height: 40px;
    max-height: 100px;
    padding: 8px 12px;
    border: 1px solid var(--vscode-input-border);
    border-radius: 4px;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    font-family: var(--vscode-font-family);
    font-size: 13px;
    line-height: 1.4;
    resize: none;
    outline: none;
    transition: border-color 0.2s ease;
  }

  .input-textarea:focus {
    border-color: var(--vscode-focusBorder);
  }

  .input-textarea::placeholder {
    color: var(--vscode-input-placeholderForeground);
  }

  .input-textarea:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
