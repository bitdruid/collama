// src/chat/web/components/chat_input/components/input_buttons/styles.ts
import { css } from "lit";

export const inputButtonsStyles = css`
  .input-buttons {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
  }

  .clear-button {
    color: var(--vscode-foreground);
    opacity: 0.6;
  }

  .clear-button:hover:not(:disabled) {
    opacity: 1;
  }

  .submit-button {
    width: 32px;
    height: 32px;
    font-size: 18px;
  }

  .submit-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
`;
