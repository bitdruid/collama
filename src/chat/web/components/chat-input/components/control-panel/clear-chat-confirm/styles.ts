import { css } from "lit";
import { themeColors } from "../../../../../styles/theme-colors";

export const clearChatConfirmStyles = css`
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
        color: ${themeColors.textWhite};
    }

    .cancel-btn:hover {
        background-color: ${themeColors.cancelHover};
    }

    .ok-btn {
        background-color: ${themeColors.submit};
        color: ${themeColors.textWhite};
    }

    .ok-btn:hover {
        background-color: ${themeColors.contextHover};
    }
`;
