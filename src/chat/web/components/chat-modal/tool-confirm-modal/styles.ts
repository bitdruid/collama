import { css } from "lit";
import { themeColors } from "../../../styles/theme-colors";
import { themeFonts } from "../../../styles/theme-fonts";
import { themeStyles } from "../../../styles/theme-styles";

export const toolConfirmStyles = css`
    .confirm-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .confirm-summary {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .confirm-action {
        display: inline-flex;
        align-items: center;
        font-size: ${themeFonts.medium};
        padding: 6px 12px;
        border-radius: 4px;
        background: ${themeColors.submit};
        color: ${themeColors.cleanWhite};
        text-transform: capitalize;
    }

    .confirm-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
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
        color: ${themeColors.cleanWhite};
    }

    .btn-accept-all {
        background: ${themeColors.context};
    }
    .btn-accept-all:hover {
        background: ${themeColors.contextHover};
    }

    .btn-send {
        background: ${themeColors.cancel};
        padding: 6px 12px;
        cursor: pointer;
        border: none;
        border-radius: 4px;
        font-size: ${themeFonts.medium};
        color: ${themeColors.cleanWhite};
    }
    .btn-send:hover {
        background: ${themeColors.cancelHover};
    }
    .btn-send:active {
        background: ${themeColors.cancelActive};
    }

    .confirm-filepath {
        flex: 1;
        min-width: 0;
        font-family: ${themeFonts.family}, monospace;
        font-size: ${themeFonts.medium};
        color: ${themeColors.uiFont};
        padding: 6px 8px;
        border-radius: 4px;
        background: ${themeColors.uiBackgroundDimm};
        border: 1px solid ${themeColors.uiBorderDimm};
        white-space: nowrap;
        overflow-x: auto;
        overflow-y: hidden;
        cursor: pointer;
        text-decoration: none;
        display: block;
    }

    .confirm-filepath:hover {
        background: ${themeColors.uiBackground};
        border-color: ${themeColors.uiBorder};
    }

    .cancel-input-row {
        display: flex;
        gap: 8px;
        animation: fadeIn 0.15s ease-out;
    }

    .cancel-input {
        ${themeStyles.input}
        background: ${themeColors.uiBackgroundDimm};
    }

    .cancel-input:focus {
        ${themeStyles.focus}
    }

    .cancel-input::placeholder {
        color: ${themeColors.placeholder};
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
