import { css } from "lit";
import { themeColors, themeStyles } from "../../../../../styles";

export const createChatButtonStyles = css`
    .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: ${themeStyles.borderRadius.small};
        background: transparent;
        cursor: pointer;
        transition: background 0.2s ease;
    }

    .icon-button:active:not(:disabled) {
        transform: scale(0.95);
    }

    .create-chat-button {
        width: 24px;
        height: 24px;
        padding: 0;
        color: ${themeColors.cleanWhite};
        background-color: ${themeColors.submit};
    }

    .create-chat-button:hover:not(:disabled) {
        background-color: ${themeColors.submitHover};
    }

    .create-chat-button:active:not(:disabled) {
        background-color: ${themeColors.submit};
    }

    .create-chat-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
`;
