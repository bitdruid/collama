import { css } from "lit";

import { themeColors } from "../../../styles/theme-colors";

export type ActionButtonVariant = "accept" | "cancel";

export const actionButtonStyles = css`
    :host {
        display: inline-flex;
        width: 28px;
        height: 28px;
        flex: 0 0 auto;
    }

    .action-button {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        padding: 0;
        border: none;
        border-radius: 4px;
        color: ${themeColors.cleanWhite};
        cursor: pointer;
        transition: background-color 0.15s ease;
    }

    .action-button:disabled {
        background: ${themeColors.disabled};
        cursor: not-allowed;
        opacity: 0.7;
    }

    .accept {
        background: ${themeColors.submit};
    }

    .accept:hover:not(:disabled) {
        background: ${themeColors.submitHover};
    }

    .accept:active:not(:disabled) {
        background: ${themeColors.submitActive};
    }

    .cancel {
        background: ${themeColors.cancel};
    }

    .cancel:hover:not(:disabled) {
        background: ${themeColors.cancelHover};
    }

    .cancel:active:not(:disabled) {
        background: ${themeColors.cancelActive};
    }
`;
