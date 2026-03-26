// src/chat/web/components/chat_session/components/header/styles.ts
import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";

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
        font-size: ${themeFonts.medium};
        text-transform: uppercase;
        color: ${themeColors.uiFont};
        opacity: 0.8;
    }

    .toggle-icon {
        font-size: ${themeFonts.medium};
        color: ${themeColors.uiFont};
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
        font-size: ${themeFonts.giant};
        background-color: ${themeColors.submit};
        color: ${themeColors.textWhite};
    }

    .new-chat-button:hover {
        background-color: ${themeColors.submitHover};
    }

    .new-chat-button:active {
        background-color: ${themeColors.submitActive};
    }
`;
