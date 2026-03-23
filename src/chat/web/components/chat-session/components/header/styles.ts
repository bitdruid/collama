// src/chat/web/components/chat_session/components/header/styles.ts
import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";

export const headerStyles = css`
    ${themeColors}
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
        color: var(--color-ui-font);
        opacity: 0.8;
    }

    .toggle-icon {
        font-size: 10px;
        color: var(--color-ui-font);
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
        background-color: var(--color-submit);
        color: var(--color-ui-element-font);
    }

    .new-chat-button:hover {
        background-color: var(--color-submit-hover);
    }

    .new-chat-button:active {
        background-color: var(--color-submit-active);
    }
`;
