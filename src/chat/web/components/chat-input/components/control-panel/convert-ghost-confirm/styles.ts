import { css } from "lit";
import { themeColors } from "../../../../../styles/theme-colors";

export const convertGhostConfirmStyles = css`
    :host {
        right: auto;
        left: 0;
    }

    .confirm-content {
        padding: 10px 14px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .confirm-text {
        color: ${themeColors.uiFont};
        font-size: 12px;
        text-align: center;
    }

    .confirm-actions {
        display: flex;
        justify-content: center;
        gap: 8px;
    }

    .confirm-btn {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .cancel-btn {
        background-color: ${themeColors.cancel};
        color: ${themeColors.cleanWhite};
    }

    .cancel-btn:hover {
        background-color: ${themeColors.cancelHover};
    }

    .cancel-btn:active {
        background-color: ${themeColors.cancelActive};
    }

    .ok-btn {
        background-color: ${themeColors.ghostChat};
        color: ${themeColors.cleanWhite};
    }

    .ok-btn:hover {
        background-color: ${themeColors.ghostChatHover};
    }

    .ok-btn:active {
        background-color: ${themeColors.ghostChatActive};
    }
`;
