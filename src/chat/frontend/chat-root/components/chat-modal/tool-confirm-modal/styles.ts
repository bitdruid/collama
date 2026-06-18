import { css } from "lit";
import { themeColors, themeFonts, themeStyles } from "../../../../styles";

export const toolConfirmStyles = css`
    .confirm-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .confirm-action {
        color: ${themeColors.uiFont};
        font-weight: ${themeFonts.weight.bold};
        text-transform: capitalize;
    }

    .confirm-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
    }

    .btn-send {
        background: ${themeColors.cancel};
        padding: 6px 12px;
        cursor: pointer;
        border: none;
        border-radius: ${themeStyles.borderRadius.small};
        color: ${themeColors.cleanWhite};
    }
    .btn-send:hover {
        background: ${themeColors.cancelHover};
    }
    .btn-send:active {
        background: ${themeColors.cancel};
    }

    .confirm-filepath {
        flex: 1;
        min-width: 0;
        font-family: ${themeFonts.familyMono};
        font-size: ${themeFonts.size.small};
        color: ${themeColors.uiFont};
        padding: 6px 8px;
        border-radius: ${themeStyles.borderRadius.small};
        background: ${themeColors.uiBackgroundDimm};
        border: ${themeStyles.border.dimm};
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

    .confirm-filepath.danger {
        color: ${themeColors.usageDanger};
        border-color: ${themeColors.uiBorderDimm};
        background: color-mix(in srgb, ${themeColors.usageDanger} 5%, ${themeColors.uiBackgroundDimm});
    }

    .confirm-filepath.danger:hover {
        border-color: ${themeColors.uiBorderHoverDimm};
        background: color-mix(in srgb, ${themeColors.usageDanger} 10%, ${themeColors.uiBackgroundDimm});
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
