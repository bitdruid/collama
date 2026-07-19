import { css } from "lit";
import { themeAnimations, themeColors, themeStyles } from "../../../../../styles";

export const toggleChatTypeButtonStyles = css`
    ${themeAnimations.loadingAnimations}

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

    .toggle-chat-type-button {
        width: 24px;
        height: 24px;
        padding: 0;
        color: ${themeColors.cleanWhite};
        background-color: ${themeColors.ghostChat};
    }

    .toggle-chat-type-button:hover:not(:disabled) {
        background-color: ${themeColors.ghostChatHover};
    }

    .toggle-chat-type-button:active:not(:disabled) {
        background-color: ${themeColors.ghostChat};
    }

    .toggle-chat-type-button:disabled {
        cursor: not-allowed;
        opacity: 0.45;
    }

    :host([pulse]) .toggle-chat-type-button {
        ${themeAnimations.loadingPulse(themeColors.ghostChat)}
    }
`;
