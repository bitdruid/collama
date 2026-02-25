// src/chat/web/components/chat_input/components/input_panel/styles.ts
import { css } from "lit";

export const inputPanelStyles = css`
  .input-panel {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    padding: 12px;
    background: var(--vscode-editor-background);
    border-top: 1px solid var(--vscode-panel-border);
  }

  .input-panel:focus-within {
    border-top-color: var(--vscode-focusBorder);
  }
`;
