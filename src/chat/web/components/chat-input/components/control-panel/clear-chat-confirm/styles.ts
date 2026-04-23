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
`;
