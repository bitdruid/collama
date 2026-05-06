import { css } from "lit";
import { themeColors } from "../../../../styles";

export const createChatButtonStyles = css`
    .icon-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 4px;
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
    }

    .create-chat-button.normal {
        background-color: ${themeColors.submit};
    }

    .create-chat-button.normal:hover:not(:disabled) {
        background-color: ${themeColors.submitHover};
    }

    .create-chat-button.normal:active:not(:disabled) {
        background-color: ${themeColors.submit};
    }

    .create-chat-button.ghost {
        background-color: ${themeColors.ghostChat};
    }

    .create-chat-button.ghost:hover:not(:disabled) {
        background-color: ${themeColors.ghostChatHover};
    }

    .create-chat-button.ghost:active:not(:disabled) {
        background-color: ${themeColors.ghostChat};
    }

    .create-chat-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }
`;
