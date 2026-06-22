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


    .confirm-filepath {
        flex: 1;
        min-width: 0;
        font-family: ${themeFonts.familyMono};
        font-size: ${themeFonts.size.small};
        line-height: ${themeFonts.lineHeight.normal};
        border-radius: ${themeStyles.borderRadius.large};
        color: ${themeColors.uiFont};
        padding: 6px 8px;
        background: ${themeColors.uiBackgroundDimm};
        border: ${themeStyles.border.dimm};
        white-space: normal;
        overflow-wrap: anywhere;
        cursor: pointer;
        text-decoration: none;
        display: block;
    }

    .confirm-filepath:hover {
        background: ${themeColors.uiBackgroundHoverDimm};
        border-color: ${themeColors.uiBackgroundHoverDimm};
    }

    .confirm-filepath.danger {
        color: ${themeColors.usageDanger};
        border-color: color-mix(in srgb, ${themeColors.usageDanger} 5%, ${themeColors.uiBackgroundDimm});
        background: ${themeColors.uiBackgroundDimm};
    }

    .confirm-filepath.danger:hover {
        border-color: color-mix(in srgb, ${themeColors.usageDanger} 10%, ${themeColors.uiBackgroundDimm});
        background: ${themeColors.uiBackgroundDimm};
    }

    .cancel-input {
        display: block;
    }
`;
