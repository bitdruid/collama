import { css } from "lit";
import { themeColors } from "../../../../styles/theme-colors";
import { themeFonts } from "../../../../styles/theme-fonts";
import { themeStyles } from "../../../../styles/theme-styles";
import { panelStyles } from "../../styles-shared";

export const toolConfirmStyles = css`
    ${panelStyles}
    :host {
        padding: 8px;
    }

    .confirm-action {
        font-size: ${themeFonts.medium};
        padding: 2px 8px;
        border-radius: 4px;
        background: ${themeColors.submit};
        color: ${themeColors.textWhite};
        text-transform: capitalize;
    }

    .confirm-buttons {
        display: flex;
        gap: 8px;
        margin-top: 12px;
    }

    .confirm-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        font-size: ${themeFonts.medium};
        color: ${themeColors.textWhite};
    }

    .btn-accept {
        background: ${themeColors.submit};
    }
    .btn-accept:hover {
        background: ${themeColors.submitHover};
    }
    .btn-accept:active {
        background: ${themeColors.submitActive};
    }

    .btn-accept-all {
        background: ${themeColors.context};
    }
    .btn-accept-all:hover {
        background: ${themeColors.contextHover};
    }

    .btn-cancel {
        background: ${themeColors.cancel};
    }
    .btn-cancel:hover {
        background: ${themeColors.cancelHover};
    }
    .btn-cancel:active {
        background: ${themeColors.cancelActive};
    }

    .btn-send {
        background: ${themeColors.cancel};
        padding: 6px 12px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        font-size: ${themeFonts.medium};
        color: ${themeColors.textWhite};
    }
    .btn-send:hover {
        background: ${themeColors.cancelHover};
    }
    .btn-send:active {
        background: ${themeColors.cancelActive};
    }

    .confirm-filepath {
        font-family: ${themeFonts.family}, monospace;
        font-size: ${themeFonts.medium};
        color: ${themeColors.uiFont};
        padding: 8px 12px;
        border-radius: 6px;
        background: ${themeColors.uiBackground};
        border: 1px solid ${themeColors.uiBorder};
        word-break: break-all;
    }

    .cancel-input-row {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        animation: fadeIn 0.15s ease-out;
    }

    .cancel-input {
        flex: 1;
        padding: 6px 10px;
        border-radius: 6px;
        border: 1px solid ${themeColors.uiBorder};
        background: ${themeColors.uiBackground};
        color: ${themeColors.disabled};
        font-family: ${themeFonts.family};
        font-size: ${themeFonts.medium};
        outline: none;
    }

    .cancel-input:focus {
        ${themeStyles.focus}
    }

    .cancel-input::placeholder {
        color: ${themeColors.disabled};
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
`;
