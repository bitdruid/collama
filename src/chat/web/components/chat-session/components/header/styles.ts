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
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: ${themeColors.uiFont};
        opacity: 0.6;
        transition: transform 0.2s ease;
    }

    .toggle-icon.expanded {
        transform: rotate(180deg);
    }

    .toggle-icon svg {
        display: block;
        width: 14px;
        height: 14px;
    }

    .header-buttons {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .new-chat-button {
        width: 24px;
        height: 24px;
        padding: 0;
        background-color: ${themeColors.submit};
        color: ${themeColors.cleanWhite};
    }

    .new-chat-button svg {
        display: block;
        width: 14px;
        height: 14px;
    }

    .new-chat-button:hover {
        background-color: ${themeColors.submitHover};
    }

    .new-chat-button:active {
        background-color: ${themeColors.submit};
    }

    .new-ghost-chat-button {
        width: 24px;
        height: 24px;
        padding: 0;
        background-color: ${themeColors.ghostChat};
        color: ${themeColors.cleanWhite};
    }

    .new-ghost-chat-button svg {
        display: block;
        width: 14px;
        height: 14px;
    }

    .new-ghost-chat-button:hover {
        background-color: ${themeColors.ghostChatHover};
    }

    .new-ghost-chat-button:active {
        background-color: ${themeColors.ghostChat};
    }
`;
